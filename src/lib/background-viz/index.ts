import { createAudioBridge, resumeCtx } from "./audio.js";
import { initCanvas, rebuildStatic } from "./canvas.js";
import { type DuneSceneHandle, mountDuneScene } from "./dune-scene.js";
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
const DUNE_PERF_GATE_RETRY_DELAY_MS = 4000;

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
	// Theme toggle: MutationObserver on <html> watches for awsui-dark-mode
	// class changes. Destroy on dark, re-mount on light. Destroy is simpler
	// than pause and avoids leaking the babylon engine when the user spends
	// most of their session in dark mode.
	let duneHandle: DuneSceneHandle | null = null;
	let dunePerfTimer: number | null = null;
	let duneFallback = false;

	function setStaticCanvasVisible(visible: boolean): void {
		canvas.style.opacity = visible ? "1" : "0";
	}

	function onDuneResize(): void {
		duneHandle?.resize();
	}

	function disposeDune(): void {
		if (dunePerfTimer !== null) {
			window.clearTimeout(dunePerfTimer);
			dunePerfTimer = null;
		}
		if (duneHandle) {
			duneHandle.destroy();
			duneHandle = null;
			window.removeEventListener("resize", onDuneResize);
		}
		setStaticCanvasVisible(true);
	}

	function tryMountDune(): void {
		if (duneHandle) return;
		if (duneFallback) return; // perf gate already tripped this session
		if (isDarkMode()) return;
		if (reducedMotion()) return;
		if (isSoftwareRendering()) {
			// Software rasteriser detected — wallpaper would chug + perf-gate
			// fallback path can race the canvas-opacity flip. Stay on cream.
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
				disposeDune();
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
					disposeDune();
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

	// React to runtime theme toggles. Cloudscape adds/removes
	// awsui-dark-mode on <html> when the theme picker fires.
	const themeObserver = new MutationObserver((records) => {
		for (const r of records) {
			if (r.type !== "attributes" || r.attributeName !== "class") continue;
			if (isDarkMode()) {
				disposeDune();
			} else {
				tryMountDune();
			}
		}
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
