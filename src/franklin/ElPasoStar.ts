// El Paso "Star on the Mountain" — small diamond-shaped sprite at a fixed
// position on the south-franklin face that glows aws-orange in silent state
// and pulses across the brand palette when audio plays.
//
// The real star is a 459-bulb light array on the southern face of the
// Franklins, lit at dusk and visible from across El Paso. We honour the
// landmark by giving it a permanent presence on our silhouette — it's the
// one feature that's NOT extinguished in silent state, so the page always
// reads as "there's a star on the mountain" before any audio kicks in.
//
// Geometry: a single quad, sized per EL_PASO_STAR.sizeU and aspect ratio
// 459:278 (wide diamond). The fragment shader draws a diamond shape (rotated
// square, narrowed by the aspect ratio) with a soft glow halo. The bulb-grid
// detail is hinted at via a tiled stipple pattern but not modelled per-bulb
// — at viewport scale a 459-quad sub-mesh would be wasted detail.

import { Constants } from "@babylonjs/core/Engines/constants.js";
import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";

import type { FranklinAudioLevels } from "./AudioAdapter.js";
import {
	EL_PASO_STAR,
	FRANKLIN_PEAKS,
	PALETTE,
	SILHOUETTE_HEIGHT_U,
	SILHOUETTE_WIDTH_U,
} from "./franklin-features.js";
import {
	buildSilhouetteProfile,
	sampleProfile,
} from "./silhouette-geometry.js";

const SHADER_NAME = "cdnElPasoStar";

const VERTEX_SOURCE = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main(void) {
  vUV = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

// Fragment — diamond shape (rotated square) with bulb-grid stipple hint and
// soft outer glow. Colour ramps from aws-orange (silent) through violet
// (mid energy) to lavender (peak energy) using the audio mid-band amplitude
// as the tilt parameter.
const FRAGMENT_SOURCE = `
precision highp float;
varying vec2 vUV;
uniform float uIntensity;
uniform float uTilt; // 0 silent → 1 peak audio
uniform vec3 orangeCol;
uniform vec3 violetCol;
uniform vec3 lavenderCol;

void main(void) {
  // Centred coords [-0.5, 0.5].
  vec2 p = vUV - vec2(0.5);
  // Diamond shape — abs(x) + abs(y) <= radius. Aspect ratio narrows the y
  // axis so the diamond is wider than tall, matching the real 459×278 star.
  // The diamond bounds are inside [-0.4, 0.4] so there's a glow ring around
  // it inside the quad.
  float diamond = abs(p.x) + abs(p.y * 1.65); // 1.65 ≈ 459/278
  // Body: full bright inside diamond <= 0.32, soft falloff to 0.42.
  float body = 1.0 - smoothstep(0.32, 0.42, diamond);
  // Outer halo — long soft falloff out to 0.5.
  float halo = (1.0 - smoothstep(0.32, 0.5, diamond)) * 0.45;

  // Bulb-grid stipple — high-frequency dots inside the diamond body. We
  // sample a 12×7 grid pattern (matches the 459/278 ratio at lower count)
  // and brighten only at the dot centres so the eye reads "lit bulbs".
  vec2 grid = vUV * vec2(12.0, 7.0);
  vec2 cell = fract(grid) - vec2(0.5);
  float dot = 1.0 - smoothstep(0.18, 0.32, length(cell));
  float bulbs = dot * body;

  // Colour blend — silent state is orange, peak energy mixes through violet
  // and into lavender for the brightest pulses. uTilt drives the mix.
  vec3 colA = mix(orangeCol, violetCol, smoothstep(0.0, 0.6, uTilt));
  vec3 col = mix(colA, lavenderCol, smoothstep(0.6, 1.0, uTilt));

  float a = (body * 0.85 + bulbs * 0.4 + halo) * uIntensity;
  gl_FragColor = vec4(col, a);
}
`;

let registered = false;
function ensureRegistered(): void {
	if (registered) return;
	Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = VERTEX_SOURCE;
	Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = FRAGMENT_SOURCE;
	registered = true;
}

export class ElPasoStar {
	readonly mesh: Mesh;
	private readonly material: ShaderMaterial;

	constructor(scene: Scene) {
		ensureRegistered();
		// Compute placement on the south-franklin peak's south face.
		const peak = FRANKLIN_PEAKS[EL_PASO_STAR.peakIndex];
		const profile = buildSilhouetteProfile();
		// Sample slightly south of the apex (faceFraction down the southern
		// flank) — we walk southward (positive x) by a fraction of the peak's
		// half-width.
		const sampleX = Math.min(1, peak.pos + peak.width * 0.3);
		const localTop = sampleProfile(profile, sampleX);
		const xWorld = (sampleX - 0.5) * SILHOUETTE_WIDTH_U;
		const yWorld =
			localTop * SILHOUETTE_HEIGHT_U * (1 - EL_PASO_STAR.faceFraction);

		const sizeW = EL_PASO_STAR.sizeU;
		const sizeH = EL_PASO_STAR.sizeU / EL_PASO_STAR.aspect;
		this.mesh = MeshBuilder.CreatePlane(
			"el-paso-star",
			{ width: sizeW, height: sizeH },
			scene,
		);
		// Sit just in front of the silhouette so it doesn't z-fight the strata.
		this.mesh.position = new Vector3(xWorld, yWorld, -1.1);

		this.material = new ShaderMaterial(
			"el-paso-star-mat",
			scene,
			{ vertex: SHADER_NAME, fragment: SHADER_NAME },
			{
				attributes: ["position", "uv"],
				uniforms: [
					"worldViewProjection",
					"uIntensity",
					"uTilt",
					"orangeCol",
					"violetCol",
					"lavenderCol",
				],
				needAlphaBlending: true,
			},
		);
		this.material.alphaMode = Constants.ALPHA_COMBINE;
		this.material.backFaceCulling = false;
		this.material.disableDepthWrite = true;
		this.material.setColor3(
			"orangeCol",
			new Color3(
				PALETTE.awsOrange[0],
				PALETTE.awsOrange[1],
				PALETTE.awsOrange[2],
			),
		);
		this.material.setColor3(
			"violetCol",
			new Color3(PALETTE.violet[0], PALETTE.violet[1], PALETTE.violet[2]),
		);
		this.material.setColor3(
			"lavenderCol",
			new Color3(PALETTE.lavender[0], PALETTE.lavender[1], PALETTE.lavender[2]),
		);
		this.material.setFloat("uIntensity", EL_PASO_STAR.silentIntensity);
		this.material.setFloat("uTilt", 0);
		this.mesh.material = this.material;
		// Render after the on-mountain stars so the El Paso star sits on top —
		// it's the landmark anchor.
		this.mesh.renderingGroupId = 3;
	}

	update(audio: FranklinAudioLevels, trippyOpacity: number): void {
		// Silent state intensity is a constant; trippy peak intensity ramps in
		// with trippyOpacity. The combined intensity then breathes with the
		// mid-band amplitude (the bulb-array landmark visually "responds" most
		// to vocal/mid frequencies).
		const intensity =
			EL_PASO_STAR.silentIntensity +
			(EL_PASO_STAR.trippyIntensity - EL_PASO_STAR.silentIntensity) *
				trippyOpacity *
				(0.6 + audio.mid * 0.6);
		this.material.setFloat("uIntensity", intensity);
		// Tilt — drives the colour ramp from orange (silent) through violet
		// (mid energy) toward lavender (peak). Treble + bass push the tilt
		// further so loud transients momentarily flash the brighter end.
		const tilt =
			trippyOpacity * (audio.mid * 0.5 + audio.treble * 0.4 + audio.bass * 0.3);
		this.material.setFloat("uTilt", Math.min(1, tilt));
	}

	dispose(): void {
		this.material.dispose();
		this.mesh.dispose();
	}
}
