import { createAudioBridge, resumeCtx } from "./audio.js";
import { initCanvas, rebuildStatic } from "./canvas.js";
import { preloadLogo } from "./static.js";

let mounted = false;

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

	return function destroy(): void {
		mounted = false;
		stopLoop();
		destroyAudio();
		window.removeEventListener("cdn:audio:play", onPlay);
		window.removeEventListener("cdn:audio:stop", onStop);
		window.removeEventListener("resize", resize);
		canvas.remove();
		document.documentElement.classList.remove("cdn-viz-active");
	};
}
