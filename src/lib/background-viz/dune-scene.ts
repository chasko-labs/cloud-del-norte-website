// White Sands gypsum-dune scene — shared mount module.
//
// Originated as src/pages/dune-test/scene.ts (PR #1, PR #2). PR #3 lifts it
// here so the standalone /dune-test/ page and the light-mode wallpaper share
// one source of shader, sky, lighting, and perf instrumentation.
//
// Two entry points:
//   - mountDuneScene(container)   — creates its own canvas, returns handle
//                                   shaped for the wallpaper integration
//                                   (destroy / resize / getPerfMedian).
//   - mountDuneSceneOnCanvas(c)   — accepts an existing <canvas>, returns the
//                                   richer test-page handle (engine/scene
//                                   refs, getLastFrameMs, isPerfDegraded).
//
// Composition (per tarn's spec):
//   - subdivided ground plane displaced by 2-octave value-noise in the
//     vertex shader; analytical normal via cross-product of finite-difference
//     partial derivatives of the height field
//   - Lambertian diffuse term in the fragment shader so ridges show real
//     light/shadow contrast against the directional sun
//   - SkyMaterial (Preetham) on a 1000u skybox
//   - directional sun + cool hemispheric fill
//   - ArcRotateCamera locked (inputs.clear) — wallpaper, not interactive
//   - slow camera-alpha drift (0.00004 rad/frame); zeroed under reduced motion
//   - prefers-reduced-motion freezes the time uniform + camera drift
//
// Perf: rolling 60-sample median of scene.render() duration. The test-page
// handle adds .dune-perf-degraded to the canvas after warmup; the wallpaper
// integration polls getPerfMedian() at 2s and falls back to the static cream
// canvas if median exceeds its (more lenient) 16ms budget.

// Side-effect: patches Scene.prototype.beginAnimation. Required because in
// the production bundle, dune-scene's chunk may load before any other module
// that pulls this in, and beginAnimation is not on Scene by default.
// Vite chunk-splits dune-scene and StarScene separately; without this the
// nav 3D logo's `this.scene.beginAnimation(...)` throws "not a function"
// when the wallpaper mounts first (validated 2026-04-30 against built bundle).
import "@babylonjs/core/Animations/animatable.js";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { SkyMaterial } from "@babylonjs/materials/sky/skyMaterial";

const SHADER_NAME = "duneDisplace";

// Sun direction passed to the shader as a uniform. Must match the
// DirectionalLight direction below (negated — light shines _toward_ that
// vector, so the surface "sees" the sun from the opposite side).
const SUN_DIR_WORLD = new Vector3(0.6, 0.35, -0.7).normalize();

const VERTEX_SOURCE = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 worldViewProjection;
uniform float time;
varying vec2 vUV;
varying float vHeight;
varying vec3 vNormal;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
}

// Sample the same 2-octave height field used for the displaced position.
// Centralised so center + finite-difference samples stay in lockstep.
float duneHeight(vec2 p, float drift) {
  float h  = vnoise((p + vec2(drift, drift * 0.4)) * 0.18) * 3.2;
        h += vnoise((p + vec2(drift * 1.3, drift * 0.7)) * 0.42) * 1.1;
  return h;
}

void main(void) {
  vec2 p = position.xz;
  float drift = time * 0.012;

  float h  = duneHeight(p, drift);

  // Analytical normal via finite-difference partial derivatives of the
  // height field. eps = 0.05 in plane units — comfortably below the smaller
  // octave's wavelength (1/0.42 ~= 2.4u) so the gradient stays well-resolved
  // without aliasing across cells.
  const float eps = 0.05;
  float h_x = duneHeight(p + vec2(eps, 0.0), drift);
  float h_z = duneHeight(p + vec2(0.0, eps), drift);
  vec3 dpdx = vec3(eps, h_x - h, 0.0);
  vec3 dpdz = vec3(0.0, h_z - h, eps);
  // cross(dpdz, dpdx) yields an upward-facing normal for the (x, h, z) frame.
  vNormal = normalize(cross(dpdz, dpdx));

  vec3 displaced = vec3(position.x, h, position.z);
  vHeight = h;
  vUV = uv;
  gl_Position = worldViewProjection * vec4(displaced, 1.0);
}
`;

const FRAGMENT_SOURCE = `
precision highp float;
varying vec2 vUV;
varying float vHeight;
varying vec3 vNormal;
uniform float time;
uniform vec3 sunDir;

void main(void) {
  float t = clamp(vHeight / 4.0, 0.0, 1.0);
  vec3 dune = mix(vec3(0.78, 0.69, 0.48), vec3(0.97, 0.96, 0.93), t);

  // Lambertian diffuse against the world-space sun direction. Floor at 0.2
  // so deep-shadow ridges still read as gypsum, not pure black.
  float lambert = max(dot(normalize(vNormal), normalize(sunDir)), 0.2);

  gl_FragColor = vec4(dune * lambert, 1.0);
}
`;

// Register shader sources into Babylon's effect store under a stable name so
// ShaderMaterial({ vertex: SHADER_NAME, fragment: SHADER_NAME }) resolves.
Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = VERTEX_SOURCE;
Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = FRAGMENT_SOURCE;

/** Test-page handle — exposes engine/scene + richer perf accessors. */
export interface DuneSceneCanvasHandle {
	engine: Engine;
	scene: Scene;
	resize(): void;
	dispose(): void;
	/** Median scene.render() duration over the last 60 samples, in ms. */
	getPerfMedian(): number;
	/** Most recent instantaneous frame duration in ms. */
	getLastFrameMs(): number;
	/** Whether the perf gate has tripped (median > 8ms post-warmup). */
	isPerfDegraded(): boolean;
}

/** Wallpaper handle — the integration only needs these three operations. */
export interface DuneSceneHandle {
	destroy(): void;
	resize(): void;
	getPerfMedian(): number;
}

const PERF_WINDOW = 60;
const PERF_WARMUP_FRAMES = 120;
const PERF_BUDGET_MS = 8;

function median(samples: number[]): number {
	if (samples.length === 0) return 0;
	const sorted = [...samples].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 === 0
		? (sorted[mid - 1] + sorted[mid]) / 2
		: sorted[mid];
}

/**
 * Mount the dune scene onto a caller-provided <canvas>. Used by the
 * /dune-test/ standalone page where the canvas is in the document already.
 */
export function mountDuneSceneOnCanvas(
	canvas: HTMLCanvasElement,
): DuneSceneCanvasHandle {
	const engine = new Engine(canvas, true, {
		preserveDrawingBuffer: true,
		stencil: true,
	});
	const scene = new Scene(engine);

	// Camera — wallpaper, not user-controlled.
	const camera = new ArcRotateCamera(
		"dune-cam",
		-Math.PI / 3,
		1.1,
		45,
		Vector3.Zero(),
		scene,
	);
	camera.fov = 0.6;
	camera.inputs.clear();

	// Sun — warm tungsten hint, no specular (matte sand). The shader sun
	// direction is the negated light-travel vector (i.e. _toward_ the sun).
	const sun = new DirectionalLight(
		"dune-sun",
		new Vector3(-0.6, -0.35, 0.7),
		scene,
	);
	sun.intensity = 1.1;
	sun.diffuse = new Color3(1.0, 0.97, 0.88);
	sun.specular = new Color3(0, 0, 0);

	// Cool sky-bounce fill from above, warm ground-bounce from below.
	const fill = new HemisphericLight("dune-fill", new Vector3(0, 1, 0), scene);
	fill.intensity = 0.45;
	fill.diffuse = new Color3(0.72, 0.82, 0.9);
	fill.groundColor = new Color3(0.85, 0.82, 0.72);

	// Sky — Preetham analytical model.
	const skybox = MeshBuilder.CreateBox("dune-skybox", { size: 1000 }, scene);
	const skyMat = new SkyMaterial("dune-sky-mat", scene);
	skyMat.backFaceCulling = false;
	skyMat.luminance = 1.2;
	skyMat.turbidity = 12;
	skyMat.rayleigh = 1.0;
	skyMat.mieCoefficient = 0.01;
	skyMat.mieDirectionalG = 0.82;
	skyMat.inclination = 0.42;
	skyMat.azimuth = 0.22;
	skybox.material = skyMat;

	// Dune ground — subdivided enough for noise to read as topology.
	const ground = MeshBuilder.CreateGround(
		"dune-ground",
		{ width: 60, height: 40, subdivisions: 150 },
		scene,
	);
	const duneMat = new ShaderMaterial(
		"dune-mat",
		scene,
		{ vertex: SHADER_NAME, fragment: SHADER_NAME },
		{
			attributes: ["position", "normal", "uv"],
			uniforms: ["worldViewProjection", "time", "sunDir"],
		},
	);
	duneMat.setVector3("sunDir", SUN_DIR_WORLD);
	ground.material = duneMat;

	// Animation: respect reduced-motion preference.
	const reducedMotion =
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

	let timeSeconds = 0;
	let lastFrameMs = performance.now();

	scene.registerBeforeRender(() => {
		if (reducedMotion) {
			duneMat.setFloat("time", 0);
			return;
		}
		const now = performance.now();
		const delta = (now - lastFrameMs) / 1000;
		lastFrameMs = now;
		timeSeconds += delta;
		duneMat.setFloat("time", timeSeconds);
		camera.alpha += 0.00004;
	});

	// Perf instrumentation — wraps scene.render() so the sample reflects
	// actual GPU-submission cost, not idle-time between frames.
	const samples: number[] = [];
	let frameCount = 0;
	let lastLogMs = performance.now();
	let lastFrameDuration = 0;
	let currentMedian = 0;
	let degraded = false;

	engine.runRenderLoop(() => {
		const start = performance.now();
		scene.render();
		const end = performance.now();

		lastFrameDuration = end - start;
		samples.push(lastFrameDuration);
		if (samples.length > PERF_WINDOW) samples.shift();
		frameCount += 1;

		// Recompute median once the window is full (60 frames), then refresh
		// every 30 frames after that. Previously we only recomputed at exact
		// 60-frame multiples — meant getPerfMedian() returned 0 for the whole
		// first 60 frames, then was stale up to 59 frames between updates.
		// The wallpaper integration's perf gate fires at 2s, so a slow first
		// shader-compile that delayed the first window-fill past 2s caused
		// the gate to read 0 and tear down the scene before it ever produced
		// a real sample (#3 follow-up — observed on safari + cold cache).
		if (samples.length >= PERF_WINDOW && frameCount % 30 === 0) {
			currentMedian = median(samples);
		}

		// Log at most once per second — useful telemetry in production too.
		if (end - lastLogMs >= 1000 && currentMedian > 0) {
			console.info("[dune] median frame: %sms", currentMedian.toFixed(2));
			lastLogMs = end;
		}

		// Hard gate — only after warmup, only fire once. The wallpaper
		// integration uses its own (more lenient) gate via getPerfMedian()
		// polling; this class flag is for the test-page overlay.
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
	});

	return {
		engine,
		scene,
		resize() {
			engine.resize();
		},
		dispose() {
			engine.stopRenderLoop();
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
	};
}

/**
 * Mount the dune scene as a full-viewport wallpaper. Creates its own canvas
 * inside `container` at z-index: -2 (behind the existing 2D background-viz
 * canvas at z-index: -1). The handle's destroy() removes the canvas.
 */
export function mountDuneScene(container: HTMLElement): DuneSceneHandle {
	const canvas = document.createElement("canvas");
	canvas.style.cssText =
		"position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none";
	canvas.setAttribute("aria-hidden", "true");
	canvas.dataset.cdnDuneCanvas = "1";
	container.appendChild(canvas);

	const inner = mountDuneSceneOnCanvas(canvas);

	// Initial sizing — Babylon uses the canvas client rect.
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
	};
}
