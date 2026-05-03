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
import {
	DEFAULT_FIELD_COMPOSITION,
	GYPSUM_WASH_STRENGTH,
	GYPSUM_WASH_THRESHOLD,
	MIGRATION_SPEED_MULTIPLIER,
	RIPPLE_AMPLITUDE,
	RIPPLE_FREQUENCY,
} from "./white-sands-features.js";

const SHADER_NAME = "duneDisplaceV2";

// Vertex shader — White Sands dune-type composition:
//
// Three overlapping signatures contribute to the height field, each weighted
// by region (see white-sands-features.ts/regionWeights for the JS-side intent):
//
//   1. DOME LAYER — low-amplitude isotropic noise. Reads as small circular
//      mounds at the upwind edge of the field. Cheapest layer.
//   2. BARCHAN LAYER — anisotropic noise stretched along the wind axis with
//      crescent-asymmetric phase. Reads as crescent dunes with horns trailing
//      downwind. Mid-frequency.
//   3. TRANSVERSE LAYER — long sinuous ridges perpendicular to wind. Encoded
//      as sin(x*freq + noise(z)) — gives the long parallel ridges that read
//      as "transverse dune field" from above.
//   4. PARABOLIC LAYER — opposite-asymmetry crescent at the downwind edge,
//      U-arms pointing UPWIND (anchored ends).
//
// Plus the existing two coarse outputs:
//   vCloudShadow — [0..1] cloud-mask sample
//   vFogT        — [0..1] aerial-haze depth ramp
//
// Migration: drift coefficient bumped from 0.012 to 0.036 (3x) so the
// pattern flow reads as visible motion across the 90s timeOfDay loop. Bryan
// asked for "faster than 10 ft/year" — at wallpaper scale this is the right
// visual analogue.
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
uniform float domeAmp;
uniform float barchanAmp;
uniform float transverseAmp;
uniform float parabolicAmp;
uniform float migrationSpeed;
varying vec2 vUV;
varying float vHeight;
varying vec3 vNormal;
varying float vCloudShadow;
varying float vFogT;
varying float vRegionGypsum;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
}

// Dome dunes: small low isotropic mounds. Two octaves of plain noise.
float domeLayer(vec2 p, float drift) {
  float n = vnoise((p + vec2(drift * 0.6, 0.0)) * 0.55) * 0.7;
  n += vnoise((p + vec2(drift * 0.9, drift * 0.3)) * 1.2) * 0.3;
  return n;
}

// Barchan crescents: anisotropic noise stretched along wind (x-axis), with
// asymmetric phase shift via abs() folding so leading face is steep, lee face
// trails as horns. Wind is +X by convention. The squared-then-rescaled term
// (n*n*1.4) builds a slip-face-style steeper crest profile than plain noise.
float barchanLayer(vec2 p, float drift) {
  vec2 stretched = vec2(p.x * 0.6, p.y * 1.4);
  float n = vnoise(stretched * 0.32 + vec2(drift * 1.6, drift * 0.4));
  // Asymmetric envelope — steep on upwind side via folded gradient.
  float asym = abs(fract(p.x * 0.18 + drift * 0.4) - 0.4);
  return n * n * 1.4 * (0.6 + asym * 0.8);
}

// Transverse ridges: long sinuous ridges perpendicular to wind axis. The
// sin(x * freq) is the carrier; vnoise(z) phase-shifts the carrier so the
// ridges aren't perfectly parallel — they meander like real transverse dunes.
float transverseLayer(vec2 p, float drift) {
  float phase = vnoise(vec2(p.y * 0.18, drift * 0.4)) * 6.28;
  float ridge = sin(p.x * 0.42 + phase + drift * 1.1);
  // smoothstep to bias toward crests not troughs (real transverse fields are
  // ridges rising from a flat interdune, not symmetric sin waves).
  ridge = smoothstep(-0.3, 0.9, ridge);
  // Mild noise modulation on amplitude so each ridge has variation.
  float amp = 0.6 + vnoise(p * 0.08 + drift * 0.3) * 0.6;
  return ridge * amp;
}

// Parabolic dunes: opposite-asymmetry crescents (arms point UPWIND). At the
// downwind edge of the field. Sign-flipped barchan, basically.
float parabolicLayer(vec2 p, float drift) {
  vec2 stretched = vec2(p.x * 0.5, p.y * 1.6);
  float n = vnoise(stretched * 0.36 + vec2(-drift * 1.2, drift * 0.5));
  float asym = abs(fract(-p.x * 0.20 + drift * 0.3) - 0.4);
  return n * n * 1.2 * (0.6 + asym * 0.7);
}

// Per-vertex region weights — match white-sands-features.ts/regionWeights.
// Smoothstep-soft transitions so the field reads as a continuous gradient
// of dune types upwind→downwind, not banded zones.
vec4 regionWeights(vec2 p) {
  // Normalize to [0,1] across the 60×40 ground centred at origin.
  float xn = (p.x + 30.0) / 60.0;
  float zn = (p.y + 20.0) / 40.0;
  float dome      = smoothstep(0.0, 1.0, 1.0 - xn) * 0.7 + 0.3;
  float barchan   = smoothstep(0.0, 1.0, 1.0 - abs(xn - 0.5) * 2.0) * 0.8 + 0.2;
  float transvers = smoothstep(0.0, 1.0, 1.0 - abs(xn - 0.55) * 1.6) * 0.8 + 0.2;
  float parab     = smoothstep(0.0, 1.0, xn) * 0.6
                  + smoothstep(0.0, 1.0, abs(zn - 0.5) * 2.0) * 0.4;
  return vec4(dome, barchan, transvers, parab);
}

float duneHeight(vec2 p, float drift) {
  vec4 rw = regionWeights(p);
  float h = 0.0;
  h += domeLayer(p, drift)       * domeAmp       * rw.x * 1.6;
  h += barchanLayer(p, drift)    * barchanAmp    * rw.y * 1.4;
  h += transverseLayer(p, drift) * transverseAmp * rw.z * 1.1;
  h += parabolicLayer(p, drift)  * parabolicAmp  * rw.w * 1.0;
  return h;
}

void main(void) {
  vec2 p = position.xz;
  // Migration: drift advances time. migrationSpeed uniform pushes ~3x faster
  // than the original 0.012 baseline so the pattern flow reads on the 90s
  // timeOfDay loop. midLevel still gates audio reactivity bonus.
  float drift = time * (0.012 * migrationSpeed + midLevel * 0.012);
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

  // Region-gypsum mask — pass to FS. Highest in barchan + transverse mid-field
  // bands where the gypsum sand is most active. Used by FS for white wash.
  vec4 rw = regionWeights(p);
  vRegionGypsum = clamp(rw.y * 0.5 + rw.z * 0.5, 0.0, 1.0);

  // Cloud-shadow sample at vertex. Two octaves; smoothstep-darken later in FS.
  vec2 cloudUV = uv * vec2(60.0, 40.0);
  float cd1 = time * 0.008;
  float cd2 = time * 0.005;
  float cloud = vnoise(cloudUV * 0.07 + vec2(cd1, cd2));
  cloud += vnoise(cloudUV * 0.16 + vec2(cd1 * 1.3, cd2 * 0.9)) * 0.5;
  vCloudShadow = cloud / 1.5;

  // View-space depth → fog ramp [18, 46]. Cap raised to 0.85 (was 0.55 in FS)
  // so distant dunes more clearly fade into the haze backdrop.
  vec4 viewPos = view * world * vec4(displaced, 1.0);
  float vDepth = -viewPos.z;
  vFogT = clamp((vDepth - 18.0) / 28.0, 0.0, 1.0);

  gl_Position = worldViewProjection * vec4(displaced, 1.0);
}
`;

// Fragment shader — palette uniforms pre-mixed CPU side. ALU budget under
// 8ms / pixel on integrated GPU. High-power pow() approximated via squaring.
//
// White Sands additions:
//   - WIND RIPPLES: small-scale 90°-to-wind ripples encoded as a high-freq
//     sin term modulated by noise. Tints lit-side ridges, no extra mesh cost.
//   - GYPSUM WASH: bright-white highlight on lit crests above a lambert
//     threshold, scaled by vRegionGypsum so only barchan/transverse bands
//     get the white wash. Brand palette stays load-bearing for shadows.
//   - STRONGER HAZE: vFogT mix raised 0.55 → 0.78 so distant dunes dissolve
//     into the haze backdrop rather than reading as a hard horizon line.
const FRAGMENT_SOURCE = `
precision highp float;
varying vec2 vUV;
varying float vHeight;
varying vec3 vNormal;
varying float vCloudShadow;
varying float vFogT;
varying float vRegionGypsum;
uniform float time;
uniform vec3 sunDir;
uniform float fluxLevel;
uniform float midLevel;
uniform float logoPulse; // [-1, 1], slow 24s sinusoid
uniform float rippleFreq;
uniform float rippleAmp;
uniform float gypsumWash;
uniform float gypsumThresh;
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

  // Wind ripples — high-frequency 90°-to-wind oscillation. Wind = +X, so
  // ripples run perpendicular to X, meaning their carrier is sin(uv.x * freq).
  // Modulated by noise so they're not perfectly periodic. Tint lit-side only.
  // Visible on flat-ish ridge tops where light grazes; gated by ridgeFlatness
  // so the troughs don't get rippled.
  float rippleNoise = fragNoise(vUV * 60.0);
  float ripple = sin(vUV.x * rippleFreq + rippleNoise * 6.28);
  ripple = ripple * 0.5 + 0.5; // [0, 1]
  ripple = smoothstep(0.4, 0.9, ripple);
  dune += vec3(rippleAmp) * ripple * lambert * ridgeFlatness;

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

  // Gypsum-white wash on bright lit crests in the active dune-type bands.
  // Bryan: "20% white wash on the surface lit by sun-disc". Gated by:
  //   - lambert > gypsumThresh (only sun-facing lit fragments)
  //   - vRegionGypsum (only barchan/transverse mid-field where gypsum is most
  //     active visually)
  //   - ridgeFlatness (only ridge tops, not slip faces)
  // Mixes toward bright gypsum white (1, 1, 0.985) — slightly cool to read
  // as bright sun-on-gypsum, not warm desert sand.
  float gypsumMask = smoothstep(gypsumThresh, 1.0, lambert)
                   * vRegionGypsum
                   * ridgeFlatness;
  vec3 gypsumColor = vec3(1.0, 1.0, 0.985);
  surface = mix(surface, gypsumColor, gypsumMask * gypsumWash);

  // Aerial-haze fog — vFogT interpolated from vertex. Cap mix raised to 0.78
  // so distant dunes dissolve into the haze backdrop. Pairs with HazeBackdrop
  // (camera-locked alpha quad) and the bumped scene fog density (0.028).
  surface = mix(surface, horizonTint, vFogT * 0.78);

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
					// White Sands additions — dune-type composition + ripples + gypsum.
					"domeAmp",
					"barchanAmp",
					"transverseAmp",
					"parabolicAmp",
					"migrationSpeed",
					"rippleFreq",
					"rippleAmp",
					"gypsumWash",
					"gypsumThresh",
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
		// White Sands constants — set once, never change per-frame. Pulled from
		// white-sands-features.ts so the values are reviewable in plain TS rather
		// than buried as GLSL literals.
		this.material.setFloat("domeAmp", DEFAULT_FIELD_COMPOSITION.domeAmp);
		this.material.setFloat("barchanAmp", DEFAULT_FIELD_COMPOSITION.barchanAmp);
		this.material.setFloat(
			"transverseAmp",
			DEFAULT_FIELD_COMPOSITION.transverseAmp,
		);
		this.material.setFloat(
			"parabolicAmp",
			DEFAULT_FIELD_COMPOSITION.parabolicAmp,
		);
		this.material.setFloat("migrationSpeed", MIGRATION_SPEED_MULTIPLIER);
		this.material.setFloat("rippleFreq", RIPPLE_FREQUENCY);
		this.material.setFloat("rippleAmp", RIPPLE_AMPLITUDE);
		this.material.setFloat("gypsumWash", GYPSUM_WASH_STRENGTH);
		this.material.setFloat("gypsumThresh", GYPSUM_WASH_THRESHOLD);
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
