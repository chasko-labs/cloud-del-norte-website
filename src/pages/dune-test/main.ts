// dune-test — standalone validation page for the white-sands gypsum-dune wallpaper
// PR #2 of light-mode background replacement. Adds analytical normals,
// reduced-motion gate, perf instrumentation, and a top-right perf overlay.
// Not yet wired into background-viz.

import { mountDuneScene } from "./scene";

const canvas = document.getElementById("dune-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
	throw new Error("dune-test: #dune-canvas not found or wrong element type");
}

const handle = mountDuneScene(canvas);

window.addEventListener("resize", () => handle.resize());
window.addEventListener("beforeunload", () => handle.dispose());

// Perf overlay — test-page only. Ticks at 4Hz (250ms) so the values are
// readable without flicker; FPS is computed from a 1s sliding window of the
// rAF clock to decouple it from scene.render() duration.
const fpsEl = document.getElementById("dune-perf-fps");
const medEl = document.getElementById("dune-perf-med");
const lastEl = document.getElementById("dune-perf-last");
const overlayEl = document.getElementById("dune-perf");

if (fpsEl && medEl && lastEl && overlayEl) {
	const fpsWindow: number[] = [];
	let lastTickMs = performance.now();

	const rafTick = () => {
		const now = performance.now();
		const dt = now - lastTickMs;
		lastTickMs = now;
		if (dt > 0) fpsWindow.push(1000 / dt);
		// Keep ~1s of frames at 60fps.
		if (fpsWindow.length > 60) fpsWindow.shift();
		requestAnimationFrame(rafTick);
	};
	requestAnimationFrame(rafTick);

	setInterval(() => {
		const fps =
			fpsWindow.length === 0
				? 0
				: fpsWindow.reduce((a, b) => a + b, 0) / fpsWindow.length;
		fpsEl.textContent = fps.toFixed(0);
		medEl.textContent = `${handle.getPerfMedian().toFixed(2)}ms`;
		lastEl.textContent = `${handle.getLastFrameMs().toFixed(2)}ms`;
		overlayEl.classList.toggle("degraded", handle.isPerfDegraded());
	}, 250);
}
