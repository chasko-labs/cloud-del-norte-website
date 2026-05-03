import { createAudioBridge, resumeCtx } from "./audio.js";
import { initCanvas, rebuildStatic } from "./canvas.js";
import {
	type DuneSceneHandle,
	ensureDuneFallback,
	mountDuneScene,
} from "./dune-scene.js";
import { preloadLogo } from "./static.js";

let mounted = false;

// Wallpaper perf budget — more lenient than the 8ms test-page gate since the
// scene is behind content. After warmup, if median > 16ms we tear it down
// and revert to the 2D cream layer.
//
// Two-stage gate: first sample at 2s (cheap escape hatch for already-bad
// hardware that's hitting the budget). If the median hasn't computed yet
// (med === 0 — engine still compiling shaders / uploading textures / first
// 60 frames not collected), reschedule a final check at 6s. This avoids the
// pathological "killed before babylon was even ready" fallback that hit on
// safari + retina + cold cache, where shader compile alone consumed >1.5s
// and the perf window never closed before the gate fired.
const DUNE_PERF_BUDGET_MS = 16;
const DUNE_PERF_GATE_DELAY_MS = 2000;
// Bumped 4000 → 12000 (total gate timeout 14s instead of 6s). Browsers under
// background-tab throttle / low-power mode / first-paint shader compile were
// failing the 6s budget even though the scene would render fine given more
// time. 14s is forgiving without being indefinite — at <2fps for 14s the
// browser is genuinely stuck and the static-cream fallback is the right call.
const DUNE_PERF_GATE_RETRY_DELAY_MS = 12000;

function isDarkMode(): boolean {
	return document.documentElement.classList.contains("awsui-dark-mode");
}

function reducedMotion(): boolean {
	return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Detect software-rendered WebGL (SwiftShader / llvmpipe / Mesa software
// rasteriser). On these GPUs the dune scene will never hit the 16ms budget,
// and the perf gate's tear-down can race with the static-canvas opacity flip
// in ways that surprise the user. Skip the dune mount entirely instead.
function isSoftwareRendering(): boolean {
	try {
		const probe = document.createElement("canvas");
		const gl = (probe.getContext("webgl2") ||
			probe.getContext("webgl")) as WebGLRenderingContext | null;
		if (!gl) return false;
		const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
		const renderer = debugInfo
			? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
			: "";
		return /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(
			renderer,
		);
	} catch {
		return false;
	}
}

// Escape hatch for verification harnesses (CI screenshot pipeline + ad-hoc
// capture scripts) running headless on rocm-aibox where ANGLE reports
// SwiftShader ("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)
// (0x0000C0DE)), SwiftShader driver)"). Real users never append this param so
// they keep the software-rendering protection. Harnesses opt in by appending
// ?__cdn_force_wallpaper=1 to force the dune mount regardless of renderer.
function shouldSkipDune(): boolean {
	const params = new URLSearchParams(window.location.search);
	if (params.get("__cdn_force_wallpaper") === "1") return false;
	return isSoftwareRendering();
}

export function mount(): () => void {
	if (mounted) return () => {};
	mounted = true;

	const { canvas, ctx, startLoop, stopLoop, resize } = initCanvas();
	const { initAudio, destroyAudio } = createAudioBridge(ctx);

	// preload logo bitmap; rebuild static layers (with watermark) once ready
	void preloadLogo().then(() => rebuildStatic());

	function onPlay(e: Event): void {
		const { element, stationKey } = (e as CustomEvent).detail as {
			element: HTMLAudioElement;
			stationKey: string;
		};
		try {
			initAudio(element, stationKey);
		} catch {
			// CORS or AudioContext failure — loop still starts, bins will be zeros
		}
		startLoop();
		// Re-tint dune scene fog from the new station's primary colour. The
		// CSS custom prop --station-primary-rgb is set by the persistent-
		// player on station change and is live by the time this event fires
		// (player sets style before dispatch). One-shot read, NOT per frame.
		duneHandle?.refreshStationTint();
	}

	function onStop(): void {
		// audio paused — analyser bins drop to silence naturally; ambient loop continues.
		// do NOT destroy/close the AudioContext here: MediaElementSourceNode can only be
		// created once per element, and destroyAudio() nulls the context, breaking reconnect.
	}

	// ambient loop runs immediately; audio reactivity added when a stream plays
	startLoop();

	window.addEventListener("cdn:audio:play", onPlay);
	window.addEventListener("cdn:audio:stop", onStop);
	window.addEventListener("resize", resize);
	document.addEventListener("visibilitychange", () => {
		resumeCtx();
	});

	// ── Dune wallpaper (light mode only, non-reduced-motion) ────────────────
	//
	// Layering: dune scene canvas at z-index:-2; the 2D background-viz canvas
	// at z-index:-1 is hidden via opacity:0 while dune is active so the cream
	// fill + watermark don't paint over the babylon scene. Approach (a) from
	// tarn's spec — ship simple, the audio-reactive bloom/motes overlay
	// (approach (b)) is a known cleanup item for a future PR.
	//
	// Theme toggle (v0.0.0067+): mount-once + pause/resume. The babylon scene
	// is created lazily on the first light-mode entry, then KEPT ALIVE across
	// all subsequent dark↔light flips via setVisible(). Cost trade:
	//   - destroy+rebuild on every flip: 200-400ms per swap (engine boot,
	//     shader compile, mesh build, blue-noise upload, perf-window warmup)
	//   - mount-once + setVisible: <2ms per swap, ~25-40MB resident in dark
	//     mode. Acceptable: a user who toggles mode 3+ times per session
	//     (typical) wins; even 1-flip sessions break even because the
	//     hidden scene is render-loop-paused and consumes near-zero CPU.
	let duneHandle: DuneSceneHandle | null = null;
	let dunePerfTimer: number | null = null;
	let duneFallback = false;
	let removeDuneFallback: (() => void) | null = null;

	// Dark-mode wallpaper (v0.0.0081+): the BabylonJS Franklin scene was
	// retired in favour of a static SVG silhouette (FranklinOverlay) rendered
	// by the el-paso-nights layer. The canvas-2D dark.ts starfield still
	// renders behind the overlay; nothing else lives here for dark mode.

	function setStaticCanvasVisible(visible: boolean): void {
		canvas.style.opacity = visible ? "1" : "0";
	}

	function onDuneResize(): void {
		duneHandle?.resize();
	}

	function disposeDune(opts: { keepFallback?: boolean } = {}): void {
		if (dunePerfTimer !== null) {
			window.clearTimeout(dunePerfTimer);
			dunePerfTimer = null;
		}
		if (duneHandle) {
			duneHandle.destroy();
			duneHandle = null;
			window.removeEventListener("resize", onDuneResize);
		}
		// Pass 4: in dark mode or on full unmount, drop the fallback too —
		// the static dark canvas takes over. When the dune scene's perf gate
		// trips but we're still in light mode, we want to KEEP the fallback
		// so the page stays cream/lavender instead of going to whatever the
		// static canvas under it shows.
		if (!opts.keepFallback && removeDuneFallback) {
			removeDuneFallback();
			removeDuneFallback = null;
		}
		setStaticCanvasVisible(true);
	}

	// Cheap path for theme flips: keep the babylon scene mounted and just
	// hide+pause it. Saves the 200-400ms cold-mount cost on dark→light flip
	// for users who toggle mode (common). Falls through to tryMountDune() if
	// the scene was never created (cold first light-mode entry) or was
	// disposed by the perf gate / static-fallback gate.
	function hideDuneForDark(): void {
		if (!duneHandle) return;
		duneHandle.setVisible(false);
		setStaticCanvasVisible(true);
		// Keep the fallback gradient div around — it lives behind the static
		// dark canvas and is harmless. Removing+re-adding it on every flip
		// would defeat the purpose of this pause optimisation.
	}

	function showDuneForLight(): void {
		if (!duneHandle) {
			tryMountDune();
			return;
		}
		duneHandle.setVisible(true);
		// Pick up any station change that happened while we were hidden.
		duneHandle.refreshStationTint();
		setStaticCanvasVisible(false);
	}

	function tryMountDune(): void {
		if (duneHandle) return;
		if (isDarkMode()) return;

		// Pass 4 (real black fix): inject the brand-palette fallback gradient
		// FIRST and unconditionally for light mode, before any early-return
		// gate. This guarantees a non-black backdrop regardless of whether
		// the babylon scene mounts (software-render skip, reduced-motion skip,
		// mount throw, perf-gate teardown). Idempotent.
		if (!removeDuneFallback) {
			removeDuneFallback = ensureDuneFallback(document.body);
		}

		if (duneFallback) return; // perf gate already tripped this session
		if (reducedMotion()) return;
		if (shouldSkipDune()) {
			// Software rasteriser detected — wallpaper would chug + perf-gate
			// fallback path can race the canvas-opacity flip. Stay on cream;
			// the fallback gradient div above already gives us cream/lavender
			// instead of any black bleed-through.
			duneFallback = true;
			return;
		}

		try {
			duneHandle = mountDuneScene(document.body);
		} catch (err) {
			console.warn(
				"[bg-viz] dune scene mount failed; staying on static cream",
				err,
			);
			return;
		}

		// Pick up the currently-active station primary colour for fog tint
		// on first paint. The Atmosphere constructor already does this once
		// internally, but remount-after-theme-toggle paths benefit from the
		// explicit call here too.
		duneHandle.refreshStationTint();

		setStaticCanvasVisible(false);
		window.addEventListener("resize", onDuneResize);

		// Perf gate — sample after warmup. Two-stage: 2s first check, 6s retry
		// if the median window hadn't closed yet on the first check.
		const checkPerf = (isFinal: boolean): void => {
			dunePerfTimer = null;
			if (!duneHandle) return;
			const med = duneHandle.getPerfMedian();
			if (med > DUNE_PERF_BUDGET_MS) {
				console.warn(
					"[bg-viz] dune scene perf below threshold (median %sms); fallback to static cream",
					med.toFixed(2),
				);
				duneFallback = true;
				// Keep the cream/lavender gradient div — we're still in light
				// mode, the perf gate just retired the babylon scene. Without
				// keepFallback the page would briefly flash through whatever
				// the body bg paints (currently cream via styles.css safety
				// net, but layered defence).
				disposeDune({ keepFallback: true });
				return;
			}
			if (med === 0) {
				// Perf window hasn't closed yet (< 60 frames collected). On the
				// first check this is normal — shader compile + texture upload +
				// first frame stalls eat into the 2s budget. Retry once. On the
				// final check, no median means babylon is genuinely stuck (no
				// frames at all in 6s) — fall back. If the engine is producing
				// frames but slowly, lastFrameMs / individual sample push would
				// have populated something; med === 0 means the render loop
				// hasn't ticked even once past frame 60.
				if (isFinal) {
					console.warn(
						"[bg-viz] dune scene never produced a perf sample in %sms; fallback to static cream",
						DUNE_PERF_GATE_DELAY_MS + DUNE_PERF_GATE_RETRY_DELAY_MS,
					);
					duneFallback = true;
					disposeDune({ keepFallback: true });
				} else {
					dunePerfTimer = window.setTimeout(
						() => checkPerf(true),
						DUNE_PERF_GATE_RETRY_DELAY_MS,
					);
				}
			}
			// med > 0 && med <= budget — keep the scene running. No further checks.
		};
		dunePerfTimer = window.setTimeout(
			() => checkPerf(false),
			DUNE_PERF_GATE_DELAY_MS,
		);
	}

	tryMountDune();
	// Dark-mode wallpaper is the static FranklinOverlay SVG (rendered by the
	// el-paso-nights React layer) — no imperative mount needed here.

	// React to runtime theme toggles. Cloudscape adds/removes
	// awsui-dark-mode on <html> when the theme picker fires.
	//
	// Mount-once policy: on dark, hide+pause the babylon scene; on light,
	// resume it. Only fall through to dispose/mount when the scene doesn't
	// exist yet (first light-mode entry) or was killed by the perf gate.
	// Coalesce rapid-fire mutations — Cloudscape can flip several class
	// tokens in one transaction, generating multiple records per flip.
	let themeFlipQueued = false;
	const themeObserver = new MutationObserver((records) => {
		// Single-pass: only honour records that actually changed `class`.
		let saw = false;
		for (const r of records) {
			if (r.type === "attributes" && r.attributeName === "class") {
				saw = true;
				break;
			}
		}
		if (!saw || themeFlipQueued) return;
		themeFlipQueued = true;
		// Defer the visibility flip one frame so we don't fight Cloudscape's
		// own applyMode walk that runs on the same tick. The class flip
		// happens immediately (CSS palette swaps within the frame), the
		// scene swap rides the following frame.
		requestAnimationFrame(() => {
			themeFlipQueued = false;
			if (isDarkMode()) {
				hideDuneForDark();
			} else {
				showDuneForLight();
			}
		});
	});
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	return function destroy(): void {
		mounted = false;
		stopLoop();
		destroyAudio();
		themeObserver.disconnect();
		disposeDune();
		window.removeEventListener("cdn:audio:play", onPlay);
		window.removeEventListener("cdn:audio:stop", onStop);
		window.removeEventListener("resize", resize);
		canvas.remove();
		document.documentElement.classList.remove("cdn-viz-active");
	};
}
