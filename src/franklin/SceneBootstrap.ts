// Engine + scene lifecycle for the Franklin Mountains scene.
//
// Mirrors src/dune/SceneBootstrap.ts — same handle shapes (mountFranklinScene
// returns a FranklinSceneHandle with destroy/resize/getPerfMedian/setVisible)
// so the wallpaper integration in src/lib/background-viz/index.ts can wire
// franklin in alongside dune with no shape divergence.
//
// Architecture (augment, not replace): the existing canvas-2D dark.ts layer
// still paints the deep-space starfield + nebula at z-index:-2. The Franklin
// babylon scene mounts ON TOP at z-index:-1 with alpha=true so the canvas-2D
// stars show through wherever the silhouette doesn't occlude them. That
// gives us the negative-space effect Bryan asked for: stars in the sky, dark
// silhouette, El Paso star always lit, on-mountain stars only during audio.
//
// Perf instrumentation matches the dune scene's PERF_WINDOW=30, PERF_WARMUP=120,
// PERF_BUDGET_MS=8 contract so the wallpaper integration can poll
// getPerfMedian() identically.
//
// ?franklin=static query param forces the static-cream-fallback path (NOT
// implemented yet — for the dune scene this gates against software-rasterizer
// machines that will never hit budget; in dark mode the fallback is just the
// existing canvas-2D dark layer which is already the "ground truth" so we
// don't need a separate fallback div).

import "@babylonjs/core/Animations/animatable.js";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";

import { FranklinAnimationController } from "./AnimationController.js";
import { FranklinAudioAdapter } from "./AudioAdapter.js";
import { ElPasoStar } from "./ElPasoStar.js";
import {
	CAMERA_ALPHA,
	CAMERA_BETA,
	CAMERA_FOV,
	CAMERA_RADIUS,
} from "./franklin-features.js";
import { MountainSilhouette } from "./MountainSilhouette.js";
import { StarField } from "./StarField.js";

const PERF_WINDOW = 30;
const PERF_WARMUP_FRAMES = 120;
const PERF_BUDGET_MS = 8;

export function median(samples: readonly number[]): number {
	if (samples.length === 0) return 0;
	const sorted = [...samples].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 === 0
		? (sorted[mid - 1] + sorted[mid]) / 2
		: sorted[mid];
}

/** Test-page handle (mirrors DuneSceneCanvasHandle). */
export interface FranklinSceneCanvasHandle {
	engine: Engine;
	scene: Scene;
	resize(): void;
	dispose(): void;
	getPerfMedian(): number;
	getLastFrameMs(): number;
	isPerfDegraded(): boolean;
	pause(): void;
	resume(): void;
}

/** Wallpaper handle (mirrors DuneSceneHandle). */
export interface FranklinSceneHandle {
	destroy(): void;
	resize(): void;
	getPerfMedian(): number;
	setVisible(visible: boolean): void;
}

function detectReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
	return mql?.matches === true;
}

function shouldForceStatic(): boolean {
	if (typeof window === "undefined") return false;
	if (typeof window.location === "undefined") return false;
	try {
		const params = new URLSearchParams(window.location.search);
		return params.get("franklin") === "static";
	} catch {
		return false;
	}
}

/**
 * Mount the franklin scene on a caller-provided <canvas>. Used by an
 * eventual /franklin-test/ standalone page if we want one (mirroring
 * /dune-test/), and internally by mountFranklinScene below.
 */
export function mountFranklinSceneOnCanvas(
	canvas: HTMLCanvasElement,
): FranklinSceneCanvasHandle {
	// alpha:true so the canvas-2D dark starfield shows through the negative
	// space (sky around the silhouette). preserveDrawingBuffer left on for
	// parity with dune; not strictly needed in production but keeps screenshot
	// tooling happy.
	const engine = new Engine(canvas, true, {
		preserveDrawingBuffer: true,
		stencil: true,
		alpha: true,
	});
	const scene = new Scene(engine);
	// Fully transparent clear — the canvas-2D layer underneath provides the
	// night sky + stars. Our scene only contributes silhouette + on-mountain
	// pulse layers + El Paso star.
	scene.clearColor = new Color4(0, 0, 0, 0);

	// Camera target elevated to ~peak level so the silhouette anchors to the
	// BOTTOM of the viewport. Bryan v0.0.0078: prior framing had mountains
	// floating mid-screen with sky underneath ("doesnt make a lot of sense").
	// With target at peak height, the silhouette occupies the lower portion of
	// the view and sky only shows in the V-shaped crevasses between peaks.
	const camera = new ArcRotateCamera(
		"franklin-cam",
		CAMERA_ALPHA,
		CAMERA_BETA,
		CAMERA_RADIUS,
		new Vector3(0, 7.8, 0),
		scene,
	);
	camera.fov = CAMERA_FOV;
	camera.inputs.clear();

	const reducedMotion = detectReducedMotion();
	const animation = new FranklinAnimationController({ reducedMotion });
	const audio = new FranklinAudioAdapter({ reducedMotion });
	const silhouette = new MountainSilhouette(scene);
	const stars = new StarField(scene);
	const elPaso = new ElPasoStar(scene);

	let lastFrameMs = performance.now();
	let paused = false;

	scene.registerBeforeRender(() => {
		const now = performance.now();
		const delta = (now - lastFrameMs) / 1000;
		lastFrameMs = now;

		const audioLevels = audio.sample();
		// Drive trippy mode from the body class — that's the explicit signal
		// the persistent player sets when an audio element starts producing
		// sound. Going through audio-amplitude alone would create false-
		// positive trippy mode whenever the analyser saw any noise floor.
		animation.setTrippy(audioLevels.streamPlaying);
		animation.update(delta);
		const animState = animation.getState();

		// Camera breathe — minimal, just a radius oscillation.
		camera.radius = animState.cameraRadius;

		// Silhouette has no per-frame uniforms (silhouette colour is constant
		// across the cycle — it's the night-sky landmark, not a sun-tinted body).
		// Skip its update() entirely for one less function call per frame.
		stars.update(audioLevels, animState.timeSeconds, animState.trippyOpacity);
		elPaso.update(audioLevels, animState.trippyOpacity);
	});
	// Silhouette mesh is referenced for renderingGroupId ordering — the Mesh
	// goes through Babylon's renderer naturally. Also exposed so the test page
	// could inspect it.
	void silhouette;

	const samples: number[] = [];
	let frameCount = 0;
	let lastLogMs = performance.now();
	let lastFrameDuration = 0;
	let currentMedian = 0;
	let degraded = false;

	const renderTick = (): void => {
		const start = performance.now();
		scene.render();
		const end = performance.now();

		lastFrameDuration = end - start;
		samples.push(lastFrameDuration);
		if (samples.length > PERF_WINDOW) samples.shift();
		frameCount += 1;

		if (samples.length >= PERF_WINDOW && frameCount % 30 === 0) {
			currentMedian = median(samples);
		}

		if (end - lastLogMs >= 1000 && currentMedian > 0) {
			console.info("[franklin] median frame: %sms", currentMedian.toFixed(2));
			lastLogMs = end;
		}

		if (
			!degraded &&
			frameCount > PERF_WARMUP_FRAMES &&
			currentMedian > PERF_BUDGET_MS
		) {
			degraded = true;
			console.warn(
				"[franklin] perf degraded — median %sms exceeds %sms budget",
				currentMedian.toFixed(2),
				PERF_BUDGET_MS,
			);
			canvas.classList.add("franklin-perf-degraded");
		}
	};
	engine.runRenderLoop(renderTick);

	return {
		engine,
		scene,
		resize() {
			engine.resize();
		},
		dispose() {
			engine.stopRenderLoop();
			elPaso.dispose();
			stars.dispose();
			silhouette.dispose();
			scene.dispose();
			engine.dispose();
		},
		getPerfMedian() {
			return currentMedian;
		},
		getLastFrameMs() {
			return lastFrameDuration;
		},
		isPerfDegraded() {
			return degraded;
		},
		pause() {
			if (paused) return;
			paused = true;
			engine.stopRenderLoop();
		},
		resume() {
			if (!paused) return;
			paused = false;
			lastFrameMs = performance.now();
			engine.runRenderLoop(renderTick);
		},
	};
}

/**
 * Mount the franklin scene as a full-viewport wallpaper. Creates its own
 * canvas inside `container` at z-index: -1 (sits ON TOP of the canvas-2D
 * dark layer at z:-2 so the silhouette occludes the stars correctly).
 *
 * Rollout safety: ?franklin=static query param short-circuits to a no-op
 * handle — the canvas-2D dark layer underneath continues to paint and the
 * page degrades gracefully to "v0.0.0066-style starfield".
 */
export function mountFranklinScene(
	container: HTMLElement,
): FranklinSceneHandle {
	if (shouldForceStatic()) {
		return {
			destroy() {
				/* no-op */
			},
			resize() {
				/* no-op */
			},
			getPerfMedian() {
				return 0;
			},
			setVisible(_visible: boolean) {
				/* no-op */
			},
		};
	}

	const canvas = document.createElement("canvas");
	// z-index:-1 — sits ABOVE the canvas-2D dark layer at z:-2 so the
	// silhouette occludes the back-plane stars (negative space effect).
	canvas.style.cssText =
		"position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none";
	canvas.setAttribute("aria-hidden", "true");
	canvas.dataset.cdnFranklinCanvas = "1";
	container.appendChild(canvas);

	const reducedMotionOnMount = detectReducedMotion();
	if (!reducedMotionOnMount && typeof requestAnimationFrame === "function") {
		canvas.style.opacity = "0";
		requestAnimationFrame(() => {
			canvas.style.transition = "opacity 1.6s ease-out";
			canvas.style.opacity = "1";
		});
	}

	const inner = mountFranklinSceneOnCanvas(canvas);
	inner.resize();

	return {
		destroy() {
			inner.dispose();
			canvas.remove();
		},
		resize() {
			inner.resize();
		},
		getPerfMedian() {
			return inner.getPerfMedian();
		},
		setVisible(visible: boolean) {
			canvas.style.visibility = visible ? "visible" : "hidden";
			if (visible) {
				inner.resume();
			} else {
				inner.pause();
			}
		},
	};
}
