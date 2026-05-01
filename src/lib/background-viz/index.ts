import { createAudioBridge, resumeCtx } from "./audio.js";
import { initCanvas, rebuildStatic } from "./canvas.js";
import { type DuneSceneHandle, mountDuneScene } from "./dune-scene.js";
import { preloadLogo } from "./static.js";

let mounted = false;

// Wallpaper perf budget — more lenient than the 8ms test-page gate since the
// scene is behind content. After 2s warmup, if median > 16ms we tear it down
// and revert to the 2D cream layer.
const DUNE_PERF_BUDGET_MS = 16;
const DUNE_PERF_GATE_DELAY_MS = 2000;

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

		// Perf gate — sample after warmup.
		dunePerfTimer = window.setTimeout(() => {
			dunePerfTimer = null;
			if (!duneHandle) return;
			const med = duneHandle.getPerfMedian();
			// med === 0 means the perf window hasn't filled yet (< 60 frames in
			// 2s ≈ < 30fps). Treat that as already-failing and fall back.
			if (med === 0 || med > DUNE_PERF_BUDGET_MS) {
				console.warn(
					"[bg-viz] dune scene perf below threshold; fallback to static cream",
				);
				duneFallback = true;
				disposeDune();
			}
		}, DUNE_PERF_GATE_DELAY_MS);
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
