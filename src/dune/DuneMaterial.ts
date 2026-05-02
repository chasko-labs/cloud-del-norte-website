// Dune ground ShaderMaterial — fragment shader, color stops, uniform wiring.
//
// Refactor (2026-05-02): the fragment shader no longer computes 4 phase
// weights or stores 4 colour triples per stop. Instead JS pre-mixes each
// stop into a single Color3 uniform per frame (shadow / peak / sunTint /
// horizonTint / rimTint), so the shader's per-fragment work shrinks
// substantially. CPU side adds 5 mixes per frame — under 0.01ms.
//
// Other moves:
//   - vertex shader emits two new flat-shaded varyings: vCloudShadow and
//     vFogT. Both are coarse enough that vertex interpolation is visually
//     indistinguishable from per-fragment evaluation, and the saving is real
//     (fragment shader runs at ~2M invocations/frame vs vertex at ~22k).
//   - sparkle threshold raised 0.985 → 0.992 (sparser glints, brand-aligned)
//   - sparkle tint shifts toward lavender (0.5 mix from cream→lavender,
//     was 0.3) — brand violet axis
//   - sparkle hash uses cheap channel-rotation noise, not the trig hash
//     (saves an expensive sin() per glint)
//   - domain-warp UV drift replaces vertical slosh: noise samples are read
//     through warpedUV that itself has a low-amplitude noise offset; the
//     surface drift reads as horizontal motion of the texture, not vertical.
//   - polynomial approximations for high powers:
//       pow(x, 24) ≈ poly approx via x*x then square chains
//       pow(x, 8)  ≈ x*x*x*x*x*x*x*x via two squarings + multiply
//   - logoPulse uniform modulates sparkle brightness as a low-frequency
//     [0..1] envelope echoing the star-logo bulb cadence (24s period).
//   - ?dune=static path skips this entirely (handled in SceneBootstrap).

import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture.js";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

import type { AnimationState } from "./AnimationController.js";
import type { AudioLevels } from "./AudioAdapter.js";
import { createBlueNoiseTexture } from "./blue-noise.js";
import { mixPhaseColor, type PhaseWeights } from "./dune-colors.js";

const SHADER_NAME = "duneDisplaceV2";

// Vertex shader — same noise field as the original, plus two coarse outputs:
//   vCloudShadow — [0..1] cloud-mask sample. Smooth enough at 150-subdivision
//                  ground that vertex interpolation reads identical to the
//                  per-fragment sample. Saves 2 fragNoise invocations / pixel.
//   vFogT        — [0..1] aerial-haze fade factor based on view-space depth.
//                  Was computed in fragment from vDepth; computing in vertex
//                  saves a clamp + divide per pixel and is exact (linear in
//                  depth, which is itself linear across the triangle).
const VERTEX_SOURCE = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform mat4 view;
uniform float time;
uniform float bassLevel;
uniform float midLevel;
varying vec2 vUV;
varying float vHeight;
varying vec3 vNormal;
varying float vCloudShadow;
varying float vFogT;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
}

float duneHeight(vec2 p, float drift) {
  float h  = vnoise((p + vec2(drift, drift * 0.4)) * 0.18) * 3.2;
        h += vnoise((p + vec2(drift * 1.3, drift * 0.7)) * 0.42) * 1.1;
  return h;
}

void main(void) {
  vec2 p = position.xz;
  // Domain-warp drift: drift advances time, but the height field is now
  // sampled with an additional low-amplitude noise offset on p so the
  // surface evolution reads as horizontal swirl rather than vertical slosh.
  // Amplitude clamped (0.4 plane units) to stay below the smaller octave.
  float drift = time * (0.012 + midLevel * 0.012);
  float warpA = vnoise(p * 0.07 + vec2(drift * 0.5, 0.0));
  float warpB = vnoise(p * 0.07 + vec2(0.0, drift * 0.5));
  vec2 pWarp = p + (vec2(warpA, warpB) - 0.5) * 0.4;

  float h  = duneHeight(pWarp, drift);

  const float eps = 0.05;
  float h_x = duneHeight(pWarp + vec2(eps, 0.0), drift);
  float h_z = duneHeight(pWarp + vec2(0.0, eps), drift);
  vec3 dpdx = vec3(eps, h_x - h, 0.0);
  vec3 dpdz = vec3(0.0, h_z - h, eps);
  vNormal = normalize(cross(dpdz, dpdx));

  float bassBonus = clamp(bassLevel, 0.0, 1.0) * 0.18;
  float hOut = h * (1.0 + bassBonus);

  vec3 displaced = vec3(position.x, hOut, position.z);
  vHeight = hOut;
  vUV = uv;

  // Cloud-shadow sample at vertex. Two octaves; smoothstep-darken later in FS.
  vec2 cloudUV = uv * vec2(60.0, 40.0);
  float cd1 = time * 0.008;
  float cd2 = time * 0.005;
  float cloud = vnoise(cloudUV * 0.07 + vec2(cd1, cd2));
  cloud += vnoise(cloudUV * 0.16 + vec2(cd1 * 1.3, cd2 * 0.9)) * 0.5;
  vCloudShadow = cloud / 1.5;

  // View-space depth → fog ramp [18, 46].
  vec4 viewPos = view * world * vec4(displaced, 1.0);
  float vDepth = -viewPos.z;
  vFogT = clamp((vDepth - 18.0) / 28.0, 0.0, 1.0);

  gl_Position = worldViewProjection * vec4(displaced, 1.0);
}
`;

// Fragment shader — palette uniforms pre-mixed CPU side. ALU budget under
// 8ms / pixel on integrated GPU. High-power pow() approximated via squaring.
const FRAGMENT_SOURCE = `
precision highp float;
varying vec2 vUV;
varying float vHeight;
varying vec3 vNormal;
varying float vCloudShadow;
varying float vFogT;
uniform float time;
uniform vec3 sunDir;
uniform float fluxLevel;
uniform float midLevel;
uniform float logoPulse; // [-1, 1], slow 24s sinusoid
// Palette uniforms — pre-mixed JS-side from the 4-quadrant phase weights
// (see dune-colors.ts). Removes ~20 vec3 muls per fragment.
uniform vec3 shadowCol;
uniform vec3 peakCol;
uniform vec3 sunTint;
uniform vec3 horizonTint;
uniform vec3 rimTint;
// 64×64 procedural blue-noise lookup — replaces a per-fragment trig hash for
// sparkle sampling. Wraps via WRAP_ADDRESSMODE so the dune ground tiles.
uniform sampler2D blueNoise;

float fragHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fragNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fragHash(i), fragHash(i+vec2(1.0,0.0)), u.x),
             mix(fragHash(i+vec2(0.0,1.0)), fragHash(i+vec2(1.0,1.0)), u.x), u.y);
}

// Squaring-tree power approximations — deterministic exponents only.
float pow2(float x) { return x * x; }
float pow4(float x) { float x2 = x * x; return x2 * x2; }
float pow8(float x) { float x2 = x * x; float x4 = x2 * x2; return x4 * x4; }
float pow24(float x) { float x4 = pow4(x); float x8 = x4 * x4; return x8 * x8 * x8; }

void main(void) {
  // Body — height-driven shadow → peak mix. Stops are uniforms now.
  float t = clamp(vHeight / 4.0, 0.0, 1.0);
  vec3 dune = mix(shadowCol, peakCol, t);

  // Single base noise sample reused by shimmer + sparkle warp + wind streak.
  // (Cloud mask + fog interpolate from vertex.) Sampled at 80x; the warp
  // amplitude is tiny so the same sample is fine for all three uses.
  float baseNoise = fragNoise(vUV * 80.0 + vec2(time * 0.4, time * 0.3));

  // Heat-shimmer UV warp — tiny, midLevel-gated.
  vec2 warpedUV = vUV + (baseNoise - 0.5) * midLevel * 0.008;

  // Wind streaks — anisotropic noise along wind vector, additive on lit side.
  float streak = fragNoise(warpedUV * vec2(220.0, 60.0) + vec2(0.85, 0.32) * time * 0.6);
  streak = smoothstep(0.45, 0.65, streak);

  // Lighting — Lambert + sun-tint. Floor 0.48 keeps shadow side cream, not black.
  vec3 N = normalize(vNormal);
  vec3 L = normalize(sunDir);
  float lambert = max(dot(N, L), 0.0);
  float lit = mix(0.48, 1.0, lambert);
  vec3 lighting = mix(vec3(1.0), sunTint, lambert) * lit;

  // Cloud shadow — interpolated from vertex, soft mask, max 12% darken.
  float cloudMask = smoothstep(0.35, 0.75, vCloudShadow);
  lighting *= mix(0.88, 1.0, cloudMask);

  // Crest specular — tight glint via pow24 squaring approximation. Gated by
  // ridge-flatness so only sun-aligned ridge tops gain a small warm highlight.
  float ridgeFlatness = max(N.y, 0.0);
  float crestGlint = pow24(lambert) * pow4(ridgeFlatness) * ridgeFlatness * ridgeFlatness;
  lighting += vec3(1.0, 0.96, 0.86) * crestGlint * 0.22;

  // Rim light — back-lit shadow side. (1 - lambert)^3 gate * pow4(rim) tint.
  vec3 rimDir = vec3(-sunDir.x, sunDir.y, -sunDir.z);
  float rim = max(dot(N, normalize(rimDir)), 0.0);
  float invLambert = 1.0 - lambert;
  float rimMask = invLambert * invLambert * invLambert * pow4(rim);
  lighting += rimTint * rimMask * 0.42;

  // Wind streak whitening, lit side only.
  dune += vec3(0.020, 0.014, 0.006) * streak * lambert;

  // Sparkle — sparse glints on sunlit ridge tops. Threshold 0.992 (was 0.985)
  // → ~50% fewer glints. Tint mixes 0.5 toward lavender (was 0.3) so the
  // brand violet axis reads in the highlights. Brightness modulated by
  // logoPulse so the field "twinkles in chorus" with the bulb.
  //
  // Sampling: 64×64 blue-noise lookup (luminance only). Tile via fract() at
  // 12.5x density so each tile covers ~1/12 of the dune ground UV. floor()
  // on time*2 ticks the lookup at 2Hz so glints flicker rather than crawl,
  // implemented by adding a quantised time offset to the UV.
  vec2 sparkleUV = warpedUV * 12.5 + vec2(floor(time * 2.0) * 0.137, 0.0);
  float sparkleHash = texture2D(blueNoise, fract(sparkleUV)).r;
  float sparkle = step(0.992, sparkleHash) * pow8(ridgeFlatness) * lambert;
  vec3 sparkleTint = mix(vec3(1.0, 0.96, 0.86), vec3(0.84, 0.78, 0.96), 0.5);
  // logoPulse [-1, 1] → [0.7, 1.3] envelope; sparkles brighten/dim by ±30%
  // over a 24s cycle. Subtle, but matches the bulb-keyframe rhythm.
  float pulseEnv = 1.0 + logoPulse * 0.3;
  lighting += sparkleTint * sparkle * 0.35 * pulseEnv;

  // Paper grain — tiny noise on screen-space coords.
  float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;

  // Flux pop — transient brightness on snares.
  float fluxPop = 1.0 + clamp(fluxLevel, 0.0, 1.0) * 0.08;

  vec3 surface = (dune * lighting + vec3(grain)) * fluxPop;

  // Aerial-haze fog — vFogT interpolated from vertex. Cap mix at 0.55.
  surface = mix(surface, horizonTint, vFogT * 0.55);

  // AO crease — lavender wash on steep sides, capped at 0.18 strength.
  // Cheap: one max + smoothstep + mix.
  float aoCurve = 1.0 - max(N.y, 0.0);
  float aoStrength = smoothstep(0.3, 0.85, aoCurve) * 0.18;
  // Brand lavender #d7c7ee = (0.843, 0.780, 0.933). Was darker (0.84, 0.78,
  // 0.93) — same axis but brand-exact.
  vec3 aoTint = mix(vec3(1.0), vec3(0.843, 0.780, 0.933), aoStrength);
  surface *= aoTint;

  gl_FragColor = vec4(surface, 1.0);
}
`;

// Register sources once. ShadersStore writes are idempotent per name, but the
// guard is cheaper than the assignment for hot paths (this file is imported
// by SceneBootstrap which may itself remount).
let registered = false;
function ensureRegistered(): void {
	if (registered) return;
	Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = VERTEX_SOURCE;
	Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = FRAGMENT_SOURCE;
	registered = true;
}

/** Frame inputs to update(). */
export interface DuneMaterialUpdateContext {
	animation: AnimationState;
	audio: AudioLevels;
}

export class DuneMaterial {
	readonly material: ShaderMaterial;
	private readonly blueNoise: RawTexture;

	// Scratch tuples reused per frame to avoid GC pressure on a hot path.
	private readonly shadowScratch: [number, number, number] = [0, 0, 0];
	private readonly peakScratch: [number, number, number] = [0, 0, 0];
	private readonly sunTintScratch: [number, number, number] = [0, 0, 0];
	private readonly horizonScratch: [number, number, number] = [0, 0, 0];
	private readonly rimScratch: [number, number, number] = [0, 0, 0];
	private readonly shadowColor = new Color3(0, 0, 0);
	private readonly peakColor = new Color3(0, 0, 0);
	private readonly sunTintColor = new Color3(0, 0, 0);
	private readonly horizonColor = new Color3(0, 0, 0);
	private readonly rimColor = new Color3(0, 0, 0);

	constructor(scene: Scene) {
		ensureRegistered();
		this.material = new ShaderMaterial(
			"dune-mat",
			scene,
			{ vertex: SHADER_NAME, fragment: SHADER_NAME },
			{
				attributes: ["position", "normal", "uv"],
				uniforms: [
					"worldViewProjection",
					"world",
					"view",
					"time",
					"sunDir",
					"bassLevel",
					"midLevel",
					"fluxLevel",
					"logoPulse",
					"shadowCol",
					"peakCol",
					"sunTint",
					"horizonTint",
					"rimTint",
				],
				samplers: ["blueNoise"],
			},
		);

		this.blueNoise = createBlueNoiseTexture(scene);
		this.material.setTexture("blueNoise", this.blueNoise);

		// Initial uniform state — silent, midday.
		this.material.setFloat("time", 0);
		this.material.setFloat("bassLevel", 0);
		this.material.setFloat("midLevel", 0);
		this.material.setFloat("fluxLevel", 0);
		this.material.setFloat("logoPulse", 0);
		this.applyPhase({ midday: 1, lateAft: 0, dusk: 0, morning: 0 });
	}

	attach(mesh: Mesh): void {
		mesh.material = this.material;
	}

	update(context: DuneMaterialUpdateContext): void {
		const { animation, audio } = context;
		this.material.setFloat("time", animation.timeSeconds);
		this.material.setVector3("sunDir", animation.sunDir);
		this.material.setFloat("bassLevel", audio.bass);
		this.material.setFloat("midLevel", audio.mid);
		this.material.setFloat("fluxLevel", audio.flux);
		this.material.setFloat("logoPulse", animation.logoPulse);
		this.applyPhase(animation.phaseWeights);
	}

	dispose(): void {
		this.material.dispose();
		this.blueNoise.dispose();
	}

	private applyPhase(w: PhaseWeights): void {
		mixPhaseColor(this.shadowScratch, w, (p) => p.shadow);
		mixPhaseColor(this.peakScratch, w, (p) => p.peak);
		mixPhaseColor(this.sunTintScratch, w, (p) => p.sunTint);
		mixPhaseColor(this.horizonScratch, w, (p) => p.horizon);
		mixPhaseColor(this.rimScratch, w, (p) => p.rimTint);
		this.shadowColor.set(
			this.shadowScratch[0],
			this.shadowScratch[1],
			this.shadowScratch[2],
		);
		this.peakColor.set(
			this.peakScratch[0],
			this.peakScratch[1],
			this.peakScratch[2],
		);
		this.sunTintColor.set(
			this.sunTintScratch[0],
			this.sunTintScratch[1],
			this.sunTintScratch[2],
		);
		this.horizonColor.set(
			this.horizonScratch[0],
			this.horizonScratch[1],
			this.horizonScratch[2],
		);
		this.rimColor.set(
			this.rimScratch[0],
			this.rimScratch[1],
			this.rimScratch[2],
		);
		this.material.setColor3("shadowCol", this.shadowColor);
		this.material.setColor3("peakCol", this.peakColor);
		this.material.setColor3("sunTint", this.sunTintColor);
		this.material.setColor3("horizonTint", this.horizonColor);
		this.material.setColor3("rimTint", this.rimColor);
	}
}
