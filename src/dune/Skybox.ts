// Custom 3-stop sky shader on a 5000u box. Replaces Preetham SkyMaterial
// which collapsed to opaque-black at oblique angles in light mode.
//
// Refactor (2026-05-02): horizon stop and sunTint pre-mixed JS-side. Shader
// drops 8 vec3 muls + 4 weight terms / pixel. Sun-disc + halo logic remains.

import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";

import type { AnimationState } from "./AnimationController.js";
import { mixPhaseColor, type PhaseWeights } from "./dune-colors.js";

const SKY_SHADER_NAME = "cdnDuneSkyV2";

const SKY_VERTEX_SOURCE = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec3 vDir;

void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  vDir = normalize(wp.xyz);
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

// Fragment shader — horizon + sunTint are uniforms now (pre-mixed JS-side).
// Zenith and nadir stay constant brand stops (lavender + warm-tan); only the
// horizon stop and the sun colour shift across the day.
const SKY_FRAGMENT_SOURCE = `
precision highp float;
varying vec3 vDir;
uniform vec3 sunDir;
uniform vec3 horizonCol;
uniform vec3 sunTint;

void main(void) {
  // y in [-1, 1] → t in [0, 1]. Below-horizon clamps to nadir to guarantee
  // no black ever appears even if the camera dips below the ground plane.
  float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);

  // Brand stops:
  //   zenith #d7c7ee — lavender (constant; this is where the page accents live)
  //   horizon — uniform from JS (4-phase mix)
  //   nadir   #d4c4a8 — warm-tan, constant
  vec3 zenith = vec3(0.843, 0.780, 0.933);
  vec3 nadir  = vec3(0.831, 0.769, 0.659);

  vec3 col;
  if (t > 0.5) {
    col = mix(horizonCol, zenith, (t - 0.5) * 2.0);
  } else {
    col = mix(nadir, horizonCol, t * 2.0);
  }

  // Sun-disc + halo. dot(view-dir, sun-dir); smoothstep for tight + soft.
  float sunFactor = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
  float sunDisc = smoothstep(0.997, 1.0, sunFactor);
  float sunHalo = smoothstep(0.96, 1.0, sunFactor);
  col = mix(col, sunTint * 1.4, sunDisc);
  col += sunTint * sunHalo * 0.18;

  gl_FragColor = vec4(col, 1.0);
}
`;

let registered = false;
function ensureRegistered(): void {
	if (registered) return;
	Effect.ShadersStore[`${SKY_SHADER_NAME}VertexShader`] = SKY_VERTEX_SOURCE;
	Effect.ShadersStore[`${SKY_SHADER_NAME}FragmentShader`] = SKY_FRAGMENT_SOURCE;
	registered = true;
}

export class Skybox {
	private readonly mesh: Mesh;
	private readonly material: ShaderMaterial;
	private readonly horizonScratch: [number, number, number] = [0, 0, 0];
	private readonly sunTintScratch: [number, number, number] = [0, 0, 0];
	private readonly horizonColor = new Color3(0, 0, 0);
	private readonly sunTintColor = new Color3(0, 0, 0);

	constructor(scene: Scene) {
		ensureRegistered();
		this.mesh = MeshBuilder.CreateBox("dune-skybox", { size: 5000 }, scene);
		this.material = new ShaderMaterial(
			"dune-sky-mat",
			scene,
			{ vertex: SKY_SHADER_NAME, fragment: SKY_SHADER_NAME },
			{
				attributes: ["position"],
				uniforms: [
					"worldViewProjection",
					"world",
					"sunDir",
					"horizonCol",
					"sunTint",
				],
			},
		);
		this.material.backFaceCulling = false;
		this.mesh.material = this.material;
		// Initial state — midday horizon + tungsten sun.
		this.applyPhase({ midday: 1, lateAft: 0, dusk: 0, morning: 0 });
	}

	update(animation: AnimationState): void {
		this.material.setVector3("sunDir", animation.sunDir);
		this.applyPhase(animation.phaseWeights);
	}

	dispose(): void {
		this.material.dispose();
		this.mesh.dispose();
	}

	/**
	 * Get the horizon RGB stop for the current phase. Caller-friendly helper
	 * for any consumer that wants the same stop the sky paints (e.g. the
	 * dune material's aerial-haze fade) — but DuneMaterial reads from
	 * dune-colors directly so this is unused in practice. Kept for parity.
	 */
	getHorizonColor(): Color3 {
		return this.horizonColor;
	}

	private applyPhase(w: PhaseWeights): void {
		mixPhaseColor(this.horizonScratch, w, (p) => p.horizon);
		mixPhaseColor(this.sunTintScratch, w, (p) => p.sunTint);
		this.horizonColor.set(
			this.horizonScratch[0],
			this.horizonScratch[1],
			this.horizonScratch[2],
		);
		this.sunTintColor.set(
			this.sunTintScratch[0],
			this.sunTintScratch[1],
			this.sunTintScratch[2],
		);
		this.material.setColor3("horizonCol", this.horizonColor);
		this.material.setColor3("sunTint", this.sunTintColor);
	}
}
