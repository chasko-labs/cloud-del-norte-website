// On-mountain star field — points distributed across the silhouette face that
// appear and dance during trippy mode (audio playing) and stay invisible in
// the silent state.
//
// Why a Babylon ParticleSystem isn't a fit: we want a deterministic, fixed
// arrangement of stars whose positions don't drift between frames — the
// "stars dance with audio" effect reads as audio-reactive only when each
// star pulses in place. Particle systems also bring an emitter / lifetime
// machinery we don't need.
//
// Implementation: a single mesh with one quad per star, all built into a
// single VertexData blob. Each vertex carries a band-affinity attribute (0 =
// bass, 1 = mid, 2 = treble) and a base-brightness offset. The fragment
// shader reads three uniform amplitudes (uBass, uMid, uTreble) plus a
// trippyOpacity gate and renders each star as a soft round point coloured by
// the brand palette for its band.
//
// Stars are placed by sampling the silhouette profile and picking points
// inside the mountain shape. Reproducible across page loads via a seeded
// PRNG so visual regression diffs are stable.

import { Constants } from "@babylonjs/core/Engines/constants.js";
import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import type { Scene } from "@babylonjs/core/scene";

import type { FranklinAudioLevels } from "./AudioAdapter.js";
import {
	ON_MOUNTAIN_STAR_COUNT,
	PALETTE,
	SILHOUETTE_HEIGHT_U,
	SILHOUETTE_WIDTH_U,
	STAR_BASE_SIZE_U,
	STAR_SIZE_VARIANCE,
} from "./franklin-features.js";
import {
	buildSilhouetteProfile,
	sampleProfile,
} from "./silhouette-geometry.js";

const SHADER_NAME = "cdnFranklinStarField";

// Vertex shader — per-vertex band attribute is forwarded to the fragment
// shader so we can pick a brand colour per star without instancing. Position
// is in world space (the mesh is parented to the silhouette at origin).
const VERTEX_SOURCE = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;        // local quad uv: (0,0)..(1,1)
attribute float band;     // 0 = bass, 1 = mid, 2 = treble
attribute float baseBrightness;
uniform mat4 worldViewProjection;
uniform float uTime;
varying vec2 vUV;
varying float vBand;
varying float vBaseBrightness;
void main(void) {
  vUV = uv;
  vBand = band;
  vBaseBrightness = baseBrightness;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

// Fragment shader — soft round point with a brand colour per band, modulated
// by the band amplitude and the global trippy opacity. uTrippy ramps 0..1
// when audio starts/stops; multiplying the alpha by uTrippy means the stars
// fade in cleanly without a pop.
const FRAGMENT_SOURCE = `
precision highp float;
varying vec2 vUV;
varying float vBand;
varying float vBaseBrightness;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uTrippy;
uniform float uTime;
uniform vec3 violetCol;
uniform vec3 lavenderCol;
uniform vec3 orangeCol;

void main(void) {
  // Distance-from-center for soft point shape.
  vec2 d = vUV - vec2(0.5);
  float dist = length(d);
  if (dist > 0.5) discard;
  // Soft falloff — quadratic so the star core is bright and the edge is
  // gentle. Anti-aliased without msaa cost.
  float core = 1.0 - smoothstep(0.05, 0.5, dist);

  // Band → colour + amplitude. Ranges:
  //   bass   → orange  (warm, weighty)
  //   mid    → violet  (brand mid)
  //   treble → lavender (sparkle highlight)
  vec3 col;
  float amp;
  if (vBand < 0.5) {
    col = orangeCol;
    amp = uBass;
  } else if (vBand < 1.5) {
    col = violetCol;
    amp = uMid;
  } else {
    col = lavenderCol;
    amp = uTreble;
  }

  // Per-star phase offset using baseBrightness as a hash — different stars
  // peak at slightly different times within the same band so the field reads
  // as "shimmering" not "blinking in unison".
  float phase = sin(uTime * 3.5 + vBaseBrightness * 24.0) * 0.5 + 0.5;
  float pulse = mix(0.4, 1.0, amp) * mix(0.7, 1.0, phase);

  // Final alpha: soft point shape × per-star base brightness × audio pulse
  // × global trippy opacity (audio start/stop fade ramp).
  float a = core * vBaseBrightness * pulse * uTrippy;
  gl_FragColor = vec4(col * pulse, a);
}
`;

let registered = false;
function ensureRegistered(): void {
	if (registered) return;
	Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = VERTEX_SOURCE;
	Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = FRAGMENT_SOURCE;
	registered = true;
}

/**
 * Stable 32-bit PRNG so star positions are reproducible across page loads.
 * Same seed used in dune blue-noise — keeps the visual regression diffs
 * deterministic.
 */
function mulberry32(seed: number): () => number {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export class StarField {
	readonly mesh: Mesh;
	private readonly material: ShaderMaterial;

	constructor(scene: Scene) {
		ensureRegistered();
		this.mesh = new Mesh("franklin-stars", scene);
		const vd = this.buildVertexData();
		vd.applyToMesh(this.mesh, false);

		this.material = new ShaderMaterial(
			"franklin-stars-mat",
			scene,
			{ vertex: SHADER_NAME, fragment: SHADER_NAME },
			{
				attributes: ["position", "uv", "band", "baseBrightness"],
				uniforms: [
					"worldViewProjection",
					"uTime",
					"uBass",
					"uMid",
					"uTreble",
					"uTrippy",
					"violetCol",
					"lavenderCol",
					"orangeCol",
				],
				needAlphaBlending: true,
			},
		);
		this.material.alphaMode = Constants.ALPHA_COMBINE;
		this.material.backFaceCulling = false;
		this.material.disableDepthWrite = true;
		this.material.setFloat("uTime", 0);
		this.material.setFloat("uBass", 0);
		this.material.setFloat("uMid", 0);
		this.material.setFloat("uTreble", 0);
		this.material.setFloat("uTrippy", 0);
		this.material.setColor3(
			"violetCol",
			new Color3(PALETTE.violet[0], PALETTE.violet[1], PALETTE.violet[2]),
		);
		this.material.setColor3(
			"lavenderCol",
			new Color3(PALETTE.lavender[0], PALETTE.lavender[1], PALETTE.lavender[2]),
		);
		this.material.setColor3(
			"orangeCol",
			new Color3(
				PALETTE.awsOrange[0],
				PALETTE.awsOrange[1],
				PALETTE.awsOrange[2],
			),
		);
		this.mesh.material = this.material;
		// Render after the silhouette so the stars paint over it in trippy mode.
		this.mesh.renderingGroupId = 2;
	}

	update(
		audio: FranklinAudioLevels,
		timeSeconds: number,
		trippyOpacity: number,
	): void {
		this.material.setFloat("uTime", timeSeconds);
		this.material.setFloat("uBass", audio.bass);
		this.material.setFloat("uMid", audio.mid);
		this.material.setFloat("uTreble", audio.treble);
		this.material.setFloat("uTrippy", trippyOpacity);
		// Hide the mesh entirely when fully silent — saves the fragment-shader
		// cost of evaluating ON_MOUNTAIN_STAR_COUNT quads per frame for zero
		// visible output. The fade-in transition runs while opacity > 0 so
		// audio-start ramps still draw; audio-stop hits zero and we drop out.
		this.mesh.isVisible = trippyOpacity > 0.001;
	}

	dispose(): void {
		this.material.dispose();
		this.mesh.dispose();
	}

	/**
	 * Generate a quad per star, placed inside the mountain silhouette by
	 * rejection sampling the profile. Each star gets a band attribute (round-
	 * robin distribution so all three bands are equally represented) and a
	 * base-brightness in [0.4, 1.0].
	 */
	private buildVertexData(): VertexData {
		const profile = buildSilhouetteProfile();
		const rand = mulberry32(0xf24c);
		const positions: number[] = [];
		const uvs: number[] = [];
		const bands: number[] = [];
		const brightnesses: number[] = [];
		const indices: number[] = [];

		let placed = 0;
		let attempts = 0;
		const MAX_ATTEMPTS = ON_MOUNTAIN_STAR_COUNT * 8;
		while (placed < ON_MOUNTAIN_STAR_COUNT && attempts < MAX_ATTEMPTS) {
			attempts++;
			const xn = rand(); // 0..1 along ridge
			const yn = rand(); // 0..1 vertical
			const localTop = sampleProfile(profile, xn);
			// Reject if above the silhouette top — would put the star in the
			// open sky which is the canvas-2D layer's domain.
			if (yn > localTop) continue;
			// Reject very low samples — bottom of the silhouette is the dissolve
			// region so on-mountain stars there look detached from the mountain.
			if (yn < 0.05) continue;

			const x = (xn - 0.5) * SILHOUETTE_WIDTH_U;
			const y = yn * SILHOUETTE_HEIGHT_U;
			// Slight z-offset so the star quad floats just in front of the
			// silhouette face and isn't z-fought (depth-write is off but a
			// small offset still helps the eye).
			const z = -1.05;

			const sizeMult = 1 + (rand() - 0.5) * STAR_SIZE_VARIANCE;
			const size = STAR_BASE_SIZE_U * sizeMult;
			const half = size / 2;

			// Build a quad — 4 verts, 2 tris. Local UVs (0..1) used by the
			// fragment shader for the soft-point falloff.
			const baseIdx = placed * 4;
			positions.push(x - half, y - half, z);
			uvs.push(0, 0);
			positions.push(x + half, y - half, z);
			uvs.push(1, 0);
			positions.push(x + half, y + half, z);
			uvs.push(1, 1);
			positions.push(x - half, y + half, z);
			uvs.push(0, 1);

			// Band — round-robin so the field is balanced across bass/mid/treble.
			const band = placed % 3;
			for (let i = 0; i < 4; i++) bands.push(band);

			// Per-star base brightness — 0.4..1.0. Lower-brightness stars read
			// as "background twinkle"; brighter ones read as "lead pulses".
			const brightness = 0.4 + rand() * 0.6;
			for (let i = 0; i < 4; i++) brightnesses.push(brightness);

			indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
			indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
			placed++;
		}

		const vd = new VertexData();
		vd.positions = positions;
		vd.indices = indices;
		vd.uvs = uvs;
		// Custom attributes — Babylon recognises arbitrary kinds when listed in
		// shader attributes config above.
		vd.set(new Float32Array(bands), "band");
		vd.set(new Float32Array(brightnesses), "baseBrightness");
		return vd;
	}
}
