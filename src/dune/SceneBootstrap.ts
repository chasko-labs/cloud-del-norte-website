// Engine + scene lifecycle, perf instrumentation, ?dune=static fallback.
//
// Refactor of the original src/lib/background-viz/dune-scene.ts monolith.
// External-facing names (`mountDuneScene`, `mountDuneSceneOnCanvas`,
// `ensureDuneFallback`) and their handle shapes are preserved EXACTLY so
// callers don't have to change.
//
// Static-fallback gate (perf budget): unchanged contract:
//   - PERF_WARMUP_FRAMES (120) frames must elapse before the gate considers
//     tripping
//   - PERF_BUDGET_MS (8) is the test-page degraded threshold (wallpaper uses
//     its own 16ms budget via getPerfMedian polling — see background-viz/
//     index.ts)
//   - getPerfMedian returns 0 until the rolling window first fills
//
// ?dune=static rollout-safety: when the URL has ?dune=static, mountDuneScene
// short-circuits and only ensures the fallback gradient div. Useful for
// rolling back the babylon scene without redeploying.

import "@babylonjs/core/Animations/animatable.js";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";

import {
	AnimationController,
	CAMERA_RADIUS_BASE,
} from "./AnimationController.js";
import { Atmosphere } from "./Atmosphere.js";
import { AudioAdapter } from "./AudioAdapter.js";
import { DuneGround } from "./DuneGround.js";
import { HazeBackdrop } from "./HazeBackdrop.js";
import { Skybox } from "./Skybox.js";

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

/** Test-page handle. */
export interface DuneSceneCanvasHandle {
	engine: Engine;
	scene: Scene;
	resize(): void;
	dispose(): void;
	getPerfMedian(): number;
	getLastFrameMs(): number;
	isPerfDegraded(): boolean;
	/** Re-read --station-primary-rgb and tint scene fog. Call on station change, NOT per frame. */
	refreshStationTint(): void;
	/** Pause render loop without disposing GPU resources. Survives theme flips. */
	pause(): void;
	/** Resume render loop after a pause(). No-op if not paused. */
	resume(): void;
}

/** Wallpaper handle. */
export interface DuneSceneHandle {
	destroy(): void;
	resize(): void;
	getPerfMedian(): number;
	/** Re-read --station-primary-rgb and tint scene fog. Call on station change, NOT per frame. */
	refreshStationTint(): void;
	/**
	 * Hide/show the dune canvas + pause/resume the render loop in one call.
	 * Cheaper than destroy+rebuild on every theme flip — keeps shaders compiled,
	 * blue-noise texture uploaded, mesh on the GPU. Memory cost: ~25-40MB
	 * resident vs reclaiming it. Win: 200-400ms cold-mount cost paid once.
	 */
	setVisible(visible: boolean): void;
}

/**
 * Browser-only check for ?dune=static query param. SSR-safe (returns false
 * if window/location aren't available). The param forces the static cream
 * fallback path in mountDuneScene without a code change.
 */
function shouldForceStatic(): boolean {
	if (typeof window === "undefined") return false;
	if (typeof window.location === "undefined") return false;
	try {
		const params = new URLSearchParams(window.location.search);
		return params.get("dune") === "static";
	} catch {
		return false;
	}
}

function detectReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
	return mql?.matches === true;
}

/**
 * Mount the dune scene on a caller-provided <canvas>. Used by the
 * /dune-test/ standalone page where the canvas is in the DOM already.
 */
export function mountDuneSceneOnCanvas(
	canvas: HTMLCanvasElement,
): DuneSceneCanvasHandle {
	const engine = new Engine(canvas, true, {
		preserveDrawingBuffer: true,
		stencil: true,
		alpha: true,
	});
	const scene = new Scene(engine);
	scene.clearColor = new Color4(0.929, 0.898, 0.831, 1.0); // #ede5d4

	const camera = new ArcRotateCamera(
		"dune-cam",
		-Math.PI / 3,
		1.1,
		CAMERA_RADIUS_BASE,
		Vector3.Zero(),
		scene,
	);
	camera.fov = 0.6;
	camera.inputs.clear();
	const cameraAlphaBase = camera.alpha;

	const reducedMotion = detectReducedMotion();
	const animation = new AnimationController({ reducedMotion });
	const audio = new AudioAdapter({ reducedMotion });
	const atmosphere = new Atmosphere(scene);
	const skybox = new Skybox(scene);
	const ground = new DuneGround(scene, { reducedMotion });
	// Camera-locked horizon haze billboard. Sells the White Sands haze that
	// scene fog alone can't deliver against a bounded mesh — alpha-blended quad
	// parented to the camera so it always reads as horizon haze regardless of
	// camera orbit. 1 extra draw call.
	const haze = new HazeBackdrop(scene, camera);

	let lastFrameMs = performance.now();
	let paused = false;

	scene.registerBeforeRender(() => {
		const now = performance.now();
		const delta = (now - lastFrameMs) / 1000;
		lastFrameMs = now;

		animation.update(delta);
		const animState = animation.getState();
		const audioLevels = audio.sample();

		// Camera transforms — radius breathe + alpha drift. Reduced motion
		// freezes both via animation state (alphaOffset stays 0, radius stays
		// at CAMERA_RADIUS_BASE).
		camera.radius = animState.cameraRadius;
		camera.alpha = cameraAlphaBase + animState.cameraAlphaOffset;

		skybox.update(animState);
		ground.update({ animation: animState, audio: audioLevels });
		atmosphere.update(animState);
		haze.update(animState);
	});

	// Perf instrumentation — wraps scene.render() so the sample reflects
	// actual GPU-submission cost, not idle-time between frames.
	const samples: number[] = [];
	let frameCount = 0;
	let lastLogMs = performance.now();
	let lastFrameDuration = 0;
	let currentMedian = 0;
	let degraded = false;

	// Named tick so pause()/resume() can re-arm the same callback after a
	// stopRenderLoop. Babylon doesn't expose a "pause without losing the
	// callback" primitive — stopRenderLoop clears its registered loops
	// outright. Hoisting the function lets resume() rebind without a closure
	// allocation churn each cycle.
	const renderTick = (): void => {
		const start = performance.now();
		scene.render();
		const end = performance.now();

		lastFrameDuration = end - start;
		samples.push(lastFrameDuration);
		if (samples.length > PERF_WINDOW) samples.shift();
		frameCount += 1;

		// Recompute median once the window is full, then refresh every 30
		// frames after that. Match the legacy contract — wallpaper integration
		// polls getPerfMedian() at 2s and a 0 return triggers a retry.
		if (samples.length >= PERF_WINDOW && frameCount % 30 === 0) {
			currentMedian = median(samples);
		}

		if (end - lastLogMs >= 1000 && currentMedian > 0) {
			console.info("[dune] median frame: %sms", currentMedian.toFixed(2));
			lastLogMs = end;
		}

		if (
			!degraded &&
			frameCount > PERF_WARMUP_FRAMES &&
			currentMedian > PERF_BUDGET_MS
		) {
			degraded = true;
			console.warn(
				"[dune] perf degraded — median %sms exceeds %sms budget",
				currentMedian.toFixed(2),
				PERF_BUDGET_MS,
			);
			canvas.classList.add("dune-perf-degraded");
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
			haze.dispose();
			ground.dispose();
			skybox.dispose();
			atmosphere.dispose();
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
		refreshStationTint() {
			atmosphere.refreshStationTint();
		},
		// Pause/resume — stop the render loop without tearing down GPU state.
		// Babylon's stopRenderLoop is a flag flip + clearing the rAF callback,
		// runRenderLoop re-arms it. ~0.1ms each direction. Resetting
		// lastFrameMs on resume prevents the first delta after resume from
		// reflecting the entire pause duration (which would jolt the
		// AnimationController state).
		pause() {
			if (paused) return;
			paused = true;
			engine.stopRenderLoop();
		},
		resume() {
			if (!paused) return;
			paused = false;
			lastFrameMs = performance.now();
			// Re-arm the render loop with the same closure used at construction.
			// Babylon allows multiple loops; we registered exactly one above
			// and need to re-register the identical pump after stopRenderLoop.
			engine.runRenderLoop(renderTick);
		},
	};
}

/**
 * Inject the brand-palette fallback gradient div without mounting the
 * babylon scene. Idempotent.
 */
export function ensureDuneFallback(container: HTMLElement): () => void {
	const existing = container.querySelector<HTMLElement>(
		"[data-cdn-dune-fallback]",
	);
	if (existing) {
		return () => existing.remove();
	}
	const fallback = document.createElement("div");
	fallback.style.cssText =
		"position:fixed;inset:0;z-index:-3;pointer-events:none;" +
		"background:linear-gradient(180deg,#d7c7ee 0%,#ede5d4 50%,#d4c4a8 100%)";
	fallback.setAttribute("aria-hidden", "true");
	fallback.dataset.cdnDuneFallback = "1";
	container.appendChild(fallback);
	return () => fallback.remove();
}

/**
 * Mount the dune scene as a full-viewport wallpaper. Creates its own canvas
 * inside `container` at z-index: -1. The handle's destroy() removes it.
 *
 * Rollout safety: ?dune=static query param short-circuits to the fallback
 * gradient only — useful for rolling back without a code change. The
 * returned handle's no-op destroy/resize keep the caller integration intact.
 */
export function mountDuneScene(container: HTMLElement): DuneSceneHandle {
	ensureDuneFallback(container);

	if (shouldForceStatic()) {
		// Static-fallback path — no babylon engine, no canvas. The fallback
		// gradient div above carries the visual. getPerfMedian returns 0 so
		// the wallpaper integration's perf gate sees "no sample yet" and
		// schedules its retry; the retry will also see 0 and fall back to
		// the static cream layer (keepFallback=true keeps the gradient).
		return {
			destroy() {
				/* no-op: caller owns the fallback gradient lifetime */
			},
			resize() {
				/* no-op */
			},
			getPerfMedian() {
				return 0;
			},
			refreshStationTint() {
				/* no-op: no babylon scene to tint */
			},
			setVisible(_visible: boolean) {
				/* no-op: nothing to show or hide */
			},
		};
	}

	const canvas = document.createElement("canvas");
	canvas.style.cssText =
		"position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none";
	canvas.setAttribute("aria-hidden", "true");
	canvas.dataset.cdnDuneCanvas = "1";
	container.appendChild(canvas);

	const reducedMotionOnMount = detectReducedMotion();
	if (!reducedMotionOnMount && typeof requestAnimationFrame === "function") {
		canvas.style.opacity = "0";
		requestAnimationFrame(() => {
			canvas.style.transition = "opacity 2s ease-out";
			canvas.style.opacity = "1";
		});
	}

	const inner = mountDuneSceneOnCanvas(canvas);
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
		refreshStationTint() {
			inner.refreshStationTint();
		},
		setVisible(visible: boolean) {
			// CSS visibility (not display) keeps the canvas in layout — same
			// width/height/dpr — so engine.resize() observations stay valid
			// while hidden. pointer-events:none is already on the element.
			// pause() drops render-loop CPU + GPU submission cost to zero
			// while hidden; resume() re-arms in <1ms.
			canvas.style.visibility = visible ? "visible" : "hidden";
			if (visible) {
				inner.resume();
			} else {
				inner.pause();
			}
		},
	};
}
