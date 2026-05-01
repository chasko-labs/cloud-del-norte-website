// White Sands gypsum-dune scene — PR #1 standalone validation.
//
// Composition (per tarn's spec):
//   - subdivided ground plane displaced by 2-octave value-noise in the
//     vertex shader; height feeds into a white→ochre ramp in the fragment
//   - SkyMaterial (Preetham) on a 1000u skybox
//   - directional sun + cool hemispheric fill
//   - ArcRotateCamera locked (inputs.clear) — wallpaper, not interactive
//   - slow camera-alpha drift (0.00004 rad/frame)
//   - prefers-reduced-motion freezes the time uniform + camera drift
//
// Deferred to PR #2: analytical normal recomputation in the vertex shader so
// lighting tracks the displaced surface. For PR #1, lighting is approximate.

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Effect } from "@babylonjs/core/Materials/effect";
import { SkyMaterial } from "@babylonjs/materials/sky/skyMaterial";

const SHADER_NAME = "duneDisplace";

const VERTEX_SOURCE = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 worldViewProjection;
uniform float time;
varying vec2 vUV;
varying float vHeight;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
}

void main(void) {
  vec2 p = position.xz;
  float drift = time * 0.012;
  float h  = vnoise((p + vec2(drift, drift * 0.4)) * 0.18) * 3.2;
        h += vnoise((p + vec2(drift * 1.3, drift * 0.7)) * 0.42) * 1.1;
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
uniform float time;

void main(void) {
  float t = clamp(vHeight / 4.0, 0.0, 1.0);
  vec3 dune = mix(vec3(0.78, 0.69, 0.48), vec3(0.97, 0.96, 0.93), t);
  gl_FragColor = vec4(dune, 1.0);
}
`;

// Register shader sources into Babylon's effect store under a stable name so
// ShaderMaterial({ vertex: SHADER_NAME, fragment: SHADER_NAME }) resolves.
Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = VERTEX_SOURCE;
Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = FRAGMENT_SOURCE;

export interface DuneSceneHandle {
	engine: Engine;
	scene: Scene;
	resize(): void;
	dispose(): void;
}

export function mountDuneScene(canvas: HTMLCanvasElement): DuneSceneHandle {
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

	// Sun — warm tungsten hint, no specular (matte sand).
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
			uniforms: ["worldViewProjection", "time"],
		},
	);
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

	engine.runRenderLoop(() => scene.render());

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
	};
}
