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
//   - custom 3-stop vertical gradient skybox (5000u) — Preetham SkyMaterial
//     was replaced 2026-04-30: it produced opaque black at oblique angles
//     in light mode, no parameter tuning recovered it
//   - directional sun + cool hemispheric fill
//   - ArcRotateCamera locked (inputs.clear) — wallpaper, not interactive
//   - slow camera-alpha drift (0.00004 rad/frame); zeroed under reduced motion
//   - prefers-reduced-motion freezes the time uniform + camera drift
//
// Perf: rolling 60-sample median of scene.render() duration. The test-page
// handle adds .dune-perf-degraded to the canvas after warmup; the wallpaper
// integration polls getPerfMedian() at 2s and falls back to the static cream
// canvas if median exceeds its (more lenient) 16ms budget.
//
// Liveness pass (2026-05-01): static dunes felt dead on load. Three additive
// moves give the scene a slow, breathing quality without breaking the
// wallpaper-not-screensaver budget:
//   - 90s timeOfDay color cycle (uniform 0..1) shifts sky horizon, dune
//     shadow tint, and sun color across warm-midday → late-afternoon → dusk
//     → early-morning. Strictly inside the brand palette: lavender / cream /
//     warm-tan / dusk-violet / amber sun. NEVER black, NEVER yellow-saturated.
//   - sun direction wobbles ±0.05 in xz at 0.05 Hz so ridge highlights drift
//     across ~30s. Imperceptible per-frame, alive-feeling over time.
//   - canvas opacity entrance fade 0→1 over 2s on mount; the cream/lavender
//     fallback gradient stays underneath so the cross-fade reads as natural.
// All three respect prefers-reduced-motion: timeOfDay frozen at 0 (warm
// midday), sun direction stays at SUN_DIR_WORLD, canvas opacity is set to 1
// immediately with no transition.
//
// Final liveness pass (2026-05-02) — researcher recs #6, #7, #8:
//   - lavender ambient-occlusion crease: fragment shader fakes AO from a
//     curvature proxy (1 - normal.y). Steep ridge sides + valley creases pick
//     up a gentle wash toward #d7c7ee (brand lavender) at up to 18% strength,
//     0 on flat areas. Never overpowers; introduces the brand violet INTO the
//     scene without painting the whole sand dune.
//   - time-of-day rim light: a back-lit second light direction
//     (-sunDir.x, sunDir.y, -sunDir.z) contributes only on the shadow side via
//     pow(1 - lambert, 3). Tint cycles amber → pale-warm → violet → soft-amber
//     across the same 4-quadrant phase weights — subtle at midday, dramatic
//     at dusk when violet catches the back of ridges.
//   - camera radius breathe: ±0.15 sinusoidal oscillation around base radius
//     45 over a 24s period. Imperceptible per-frame, alive over ~12s. Gated
//     by reduced-motion (the early-return path leaves radius fixed at 45).
//
// Atmosphere pass (2026-05-02) — researcher recs #1, #4, #5:
//   - aerial-perspective haze: exponential fog blends distant dune fragments
//     toward the live horizon palette tint based on view-space depth (vDepth
//     varying). Reuses the same 4-quadrant timeOfDay weighting JS-side so the
//     haze tint tracks the sky's horizon stop exactly.
//   - sun-disc + soft halo in the skybox via dot(vDir, sunDir) + smoothstep,
//     tinted from a sunTint palette computed in the sky shader using the
//     same phase weights as the dune. Sun position passed as sunDir uniform
//     and updated alongside the dune sunDir each frame so wobble carries.
//   - audio-reactive heat shimmer: midLevel-scaled per-fragment UV warp via
//     low-amplitude noise on the sparkle + wind-streak sample coordinates.
//     Amplitude ≤0.008, multiplied by midLevel so silent frames have zero
//     warp (and reduced-motion forces midLevel = 0 already).

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
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";

import { getBandBass, getBandMid } from "./audio.js";

const SHADER_NAME = "duneDisplace";
const SKY_SHADER_NAME = "cdnDuneSky";

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
uniform mat4 world;
uniform mat4 view;
uniform float time;
uniform float bassLevel;
uniform float midLevel;
varying vec2 vUV;
varying float vHeight;
varying vec3 vNormal;
// View-space depth (positive, growing with distance from camera). Drives
// aerial-perspective haze in the fragment shader. Computed from the displaced
// world position through the view matrix so fog responds to the actual ridge
// silhouette, not the flat ground plane.
varying float vDepth;

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
  // mid → drift speed multiplier. Baseline 0.012, up to 0.024 at full mid.
  // Sand drift accelerates with vocal/instrument mid energy. Restrained 2x
  // ceiling so the dunes never appear to gallop — wallpaper, not screensaver.
  float drift = time * (0.012 + midLevel * 0.012);

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

  // bass → vertex amplitude bonus. Up to 18% extra on full bass. Boosts both
  // the displaced Y and the height passed to fragment shading so brighter
  // peaks/deeper valleys read as a coherent swell rather than a phase shift.
  float bassBonus = clamp(bassLevel, 0.0, 1.0) * 0.18;
  float hOut = h * (1.0 + bassBonus);

  vec3 displaced = vec3(position.x, hOut, position.z);
  vHeight = hOut;
  vUV = uv;
  // View-space z (negative in front of camera in right-handed convention).
  // Negate so vDepth is a positive distance growing with range — FS uses it
  // directly in a clamp((vDepth - near) / span) fog ramp.
  vec4 viewPos = view * world * vec4(displaced, 1.0);
  vDepth = -viewPos.z;
  gl_Position = worldViewProjection * vec4(displaced, 1.0);
}
`;

const FRAGMENT_SOURCE = `
precision highp float;
varying vec2 vUV;
varying float vHeight;
varying vec3 vNormal;
varying float vDepth;
uniform float time;
uniform float timeOfDay;
uniform vec3 sunDir;
uniform float fluxLevel;
uniform float midLevel;
// horizonTint — RGB matching the sky shader's horizon stop for the current
// timeOfDay. Computed JS-side using identical 4-quadrant phase weights so
// the aerial haze that distant dunes recede into is the same tint the sky
// paints at the horizon line. No mismatch between sky band and dune fade.
uniform vec3 horizonTint;

// 2D value-noise for cloud-shadow drift. Same hash used in vertex shader.
float fragHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fragNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fragHash(i), fragHash(i+vec2(1.0,0.0)), u.x),
             mix(fragHash(i+vec2(0.0,1.0)), fragHash(i+vec2(1.0,1.0)), u.x), u.y);
}

void main(void) {
  // Pass 4 — restore visible topology. Passes 2-3 chased the no-yellow and
  // no-black guards so hard that every layer (sky horizon, body bg, peak,
  // shadow) collapsed into the same cream band, plus a 0.62 Lambert floor
  // smashed the lit/unlit range. Net result was a flat beige fog. This pass
  // widens the value range while staying inside the brand palette and the
  // prior failure-mode guards (no black, no saturated yellow, no dark green).
  //
  // 2-stop blend: deep-sand shadow → warm cream peak.
  // Liveness pass: shadow + peak both modulated by timeOfDay (0..1, 90s loop)
  // across four phases — warm-midday → late-afternoon → dusk → early-morning.
  // Each stop stays inside the brand palette (no black, no yellow saturation,
  // no green). Phase weights use smoothstep over a 4-quadrant fold so the
  // transitions are continuous and a full loop returns to the start.
  float td = clamp(timeOfDay, 0.0, 1.0);
  // Quadrant weights — sum to 1 at all td. Each peaks at its quadrant centre.
  float wMidday   = max(0.0, 1.0 - abs(td - 0.000) * 4.0) + max(0.0, 1.0 - abs(td - 1.000) * 4.0);
  float wLateAft  = max(0.0, 1.0 - abs(td - 0.250) * 4.0);
  float wDusk     = max(0.0, 1.0 - abs(td - 0.500) * 4.0);
  float wMorning  = max(0.0, 1.0 - abs(td - 0.750) * 4.0);
  float wSum = wMidday + wLateAft + wDusk + wMorning;
  wMidday  /= wSum; wLateAft /= wSum; wDusk /= wSum; wMorning /= wSum;

  // Per-phase shadow stops — all on the warm-tan / dusk-violet axis, never black.
  vec3 shadowMidday  = vec3(0.722, 0.612, 0.471); // #b89c78 — deep sand (current default)
  vec3 shadowLateAft = vec3(0.690, 0.604, 0.510); // #b09a82 — cooler sand
  vec3 shadowDusk    = vec3(0.659, 0.580, 0.612); // #a8949c — dusk-violet warm-taupe
  vec3 shadowMorning = vec3(0.737, 0.624, 0.494); // #bca07e — warm cream-sand
  vec3 shadow = shadowMidday * wMidday + shadowLateAft * wLateAft
              + shadowDusk * wDusk + shadowMorning * wMorning;

  // Per-phase peak stops — all warm/cool cream variants, never bright yellow.
  vec3 peakMidday  = vec3(0.980, 0.969, 0.941); // #faf7f0 — warm cream
  vec3 peakLateAft = vec3(0.961, 0.953, 0.941); // #f5f3f0 — cooler cream
  vec3 peakDusk    = vec3(0.949, 0.929, 0.961); // #f2edf5 — lavender-cream
  vec3 peakMorning = vec3(0.973, 0.957, 0.929); // #f8f4ed — warm-cream returning
  vec3 peak = peakMidday * wMidday + peakLateAft * wLateAft
            + peakDusk * wDusk + peakMorning * wMorning;

  float t = clamp(vHeight / 4.0, 0.0, 1.0);
  vec3 dune = mix(shadow, peak, t);

  // Atmosphere pass — heat shimmer (researcher rec #5). Mid-band audio drives
  // a tiny per-fragment UV warp. Amplitude is multiplied by midLevel so silent
  // frames have zero warp (and reduced-motion forces midLevel = 0). Cap is
  // 0.008 UV units, well below the wavelength of the sparkle and wind-streak
  // textures so the warp reads as shimmer, not slosh. Applied to the UV used
  // by the sparkle hash + wind-streak noise sampling below.
  float shimmerNoise = fragNoise(vUV * 80.0 + vec2(time * 0.4, time * 0.3));
  vec2 warpedUV = vUV + (shimmerNoise - 0.5) * midLevel * 0.008;

  // Liveness pass 3 (2026-05-02) — wind-streak ripples (researcher rec #2).
  // High-frequency anisotropic noise scrolling along a wind vector. Adds
  // combed-sand microtexture only on the lit side. Amplitude 0.018 so it's
  // imperceptible per-frame; reads as the surface "breathing" over seconds.
  vec2 windDir = vec2(0.85, 0.32);
  float streak = fragNoise(warpedUV * vec2(220.0, 60.0) + windDir * time * 0.6);
  streak = smoothstep(0.45, 0.65, streak);
  // Crest-weighted lambert at this stage isn't computed yet — apply after
  // lambert in the lighting block instead. Stash for use below.
  float windStreak = streak;

  // Lambertian diffuse with floor at 0.48 (was 0.62). Even at 0.48 against
  // the new #b89c78 shadow, the deepest fragment lands near (0.347, 0.294,
  // 0.226) — a deep warm taupe, still visibly NOT black, still on-palette.
  // The wider lit/unlit range is what lets the eye actually see the dune
  // ridges as ridges rather than a uniform cream wash.
  float lambert = max(dot(normalize(vNormal), normalize(sunDir)), 0.0);
  float lit = mix(0.48, 1.0, lambert);

  // Sun tint — tungsten at midday, pale cool late-afternoon, amber at dusk,
  // warm-tungsten in the morning. Multiplied into the lit range only (so the
  // shadow side keeps the cool ambient bounce, doesn't get pulled into amber).
  vec3 sunTintMidday  = vec3(1.000, 0.970, 0.880); // tungsten warm
  vec3 sunTintLateAft = vec3(0.965, 0.965, 0.985); // pale cool
  vec3 sunTintDusk    = vec3(1.000, 0.870, 0.760); // amber (NOT yellow — pulled toward red)
  vec3 sunTintMorning = vec3(1.000, 0.945, 0.870); // warm-tungsten morning
  vec3 sunTint = sunTintMidday * wMidday + sunTintLateAft * wLateAft
               + sunTintDusk * wDusk + sunTintMorning * wMorning;
  // Apply tint scaled by lambert so peaks pick up the sun colour, shadows don't.
  vec3 lighting = mix(vec3(1.0), sunTint, lambert) * lit;

  // Liveness pass 2 (2026-05-02) — cloud-shadow drift + crest specular.
  //
  // Cloud shadows: 2-octave value noise sampled in world UV, scrolling slowly
  // across the dunes. Output is a [0..1] mask where lower values = under a
  // cloud. Multiplies into lighting to gently darken (max ~12% reduction).
  // Drift speed 0.008 plane-units/sec matches the ambient breath we want —
  // perceptible over ~10s, never frenetic. Two octaves keep edges soft.
  vec2 cloudUV = vUV * vec2(60.0, 40.0); // back to plane coordinates
  float cloudDriftX = time * 0.008;
  float cloudDriftZ = time * 0.005;
  float cloud = fragNoise(cloudUV * 0.07 + vec2(cloudDriftX, cloudDriftZ));
  cloud += fragNoise(cloudUV * 0.16 + vec2(cloudDriftX * 1.3, cloudDriftZ * 0.9)) * 0.5;
  cloud /= 1.5;
  // Soft mask: only the darker half darkens the surface, peaks are unaffected.
  float cloudShadow = smoothstep(0.35, 0.75, cloud);
  lighting *= mix(0.88, 1.0, cloudShadow);

  // Crest specular: tight glint where sun direction aligns with surface normal
  // AND surface is near-horizontal (ridge top). Blinn-style halfway approx
  // skipped (no view dir uniform) — instead use lambert ^ N as a sharp
  // power curve, gated by ridge-flatness via normal.y. Result: only the
  // sunlit crests gain a small warm highlight, leaving valleys/sides intact.
  float ridgeFlatness = max(normalize(vNormal).y, 0.0);
  float crestGlint = pow(lambert, 24.0) * pow(ridgeFlatness, 6.0);
  // Warm gypsum-crystal tint — pale gold, never pure white.
  vec3 crestTint = vec3(1.0, 0.96, 0.86);
  lighting += crestTint * crestGlint * 0.22;

  // Liveness pass 4 (2026-05-02) — time-of-day rim light (researcher rec #7).
  // Second light direction (back-lit relative to the sun) contributing only on
  // the shadow side via pow(1 - lambert, 3) gate. rim term itself is
  // pow(dot(N, rimDir), 4) so it's tight to the silhouette of far-side ridges.
  // Tint cycles amber → pale-warm → violet → soft-amber across the same 4-
  // quadrant phase weights. Subtle at midday, dramatic at dusk when violet
  // catches the back of ridges.
  vec3 rimDir = vec3(-sunDir.x, sunDir.y, -sunDir.z);
  float rim = max(dot(normalize(vNormal), normalize(rimDir)), 0.0);
  float rimMask = pow(1.0 - lambert, 3.0) * pow(rim, 4.0);
  vec3 rimTintMidday  = vec3(1.000, 0.800, 0.500); // amber
  vec3 rimTintLateAft = vec3(0.950, 0.850, 0.750); // pale warm
  vec3 rimTintDusk    = vec3(0.850, 0.650, 0.950); // violet — dramatic
  vec3 rimTintMorning = vec3(0.900, 0.750, 0.600); // soft amber
  vec3 rimTint = rimTintMidday * wMidday + rimTintLateAft * wLateAft
               + rimTintDusk * wDusk + rimTintMorning * wMorning;
  lighting += rimTint * rimMask * 0.42;

  // Liveness pass 3 — wind-streak modulation (now lambert is in scope).
  // Apply as a small additive whitening on the lit side only — combed-sand
  // microtexture, never visible on the shadow side.
  dune += vec3(0.020, 0.014, 0.006) * windStreak * lambert;

  // Liveness pass 3 — gypsum sparkle (researcher rec #3).
  // Sparse step-thresholded high-freq hash multiplied by ridge flatness +
  // lambert. Only ~1 in 60 fragments at any moment; pinpoint glints on
  // sunlit ridge tops. Cream-to-lavender tint introduces a subtle violet
  // brand color into the scene without ever overpowering. floor(time*2.0)
  // ticks the sparkle field at 2Hz so glints flicker rather than crawl.
  // Sampled on warpedUV so audio shimmer subtly jitters which fragments win.
  float sparkleHash = fragHash(floor(warpedUV * 800.0) + floor(time * 2.0));
  float sparkle = step(0.985, sparkleHash) * pow(ridgeFlatness, 8.0) * lambert;
  vec3 sparkleTint = mix(vec3(1.0, 0.96, 0.86), vec3(0.92, 0.86, 1.0), 0.3);
  lighting += sparkleTint * sparkle * 0.35;

  // Subtle GPU-noise paper-grain to harmonise with the production
  // repeating-linear-gradient(#8b5a2b05) overlay on light mode.
  float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;

  // flux → transient brightness pop on snares/onsets. Up to 8% boost at
  // peak flux; spectralFlux already decays fast in canvas.ts so the bump
  // reads as a flash, not a sustained lift.
  float fluxPop = 1.0 + clamp(fluxLevel, 0.0, 1.0) * 0.08;

  vec3 surface = (dune * lighting + vec3(grain)) * fluxPop;

  // Atmosphere pass — aerial-perspective haze (researcher rec #1). Distant
  // fragments fade toward horizonTint (the sky's horizon stop for the current
  // timeOfDay). Camera radius is 45u; ridges start ~18u from camera and the
  // far edge of the 60×40 ground reaches ~50u in view-space, so the ramp
  // [18, 46] gives a perceptible recede without fogging the foreground. Cap
  // mix at 0.55 so distant peaks still read as dunes — fade, not erase.
  float fogT = clamp((vDepth - 18.0) / 28.0, 0.0, 1.0);
  surface = mix(surface, horizonTint, fogT * 0.55);

  // Liveness pass 4 (2026-05-02) — lavender ambient-occlusion crease (rec #6).
  // Fake AO from height-curvature proxy: where the surface normal points more
  // sideways than up (steep ridge sides + valley creases), tint slightly
  // toward lavender #d7c7ee. smoothstep(0.3, 0.85) keeps flat areas untouched.
  // 0.18 ceiling so the violet brand color never overpowers — only reads as a
  // gentle wash where the geometry naturally pools shadow.
  float aoCurve = 1.0 - max(normalize(vNormal).y, 0.0);
  float aoStrength = smoothstep(0.3, 0.85, aoCurve) * 0.18;
  vec3 aoTint = mix(vec3(1.0), vec3(0.84, 0.78, 0.93), aoStrength);
  surface *= aoTint;

  gl_FragColor = vec4(surface, 1.0);
}
`;

// Custom sky — replaces SkyMaterial (Preetham) which produced opaque black
// bands at certain camera angles in light mode (visible on production: a
// dead-black sky filling the upper half of the dune-scene viewport on dev,
// 2026-04-30 Mac mini Safari). Preetham's mie/rayleigh terms can collapse
// to ~0 at oblique horizon angles regardless of turbidity/rayleigh tuning.
//
// Replacement: deterministic 3-stop vertical gradient painted on the inside
// face of a skybox. Lavender → cream → warm-tan, matching the brand palette
// and the page bg. Pure linear interpolation — cannot produce black.
//
// vDir is the world-space direction from camera to vertex; we use its Y
// component (height) to drive the gradient. Normalised so it works for any
// skybox size. backFaceCulling disabled on the material so the inside paints.
const SKY_VERTEX_SOURCE = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec3 vDir;

void main(void) {
  // World-space position of the skybox vertex; since the box is centred on
  // origin, the position direction equals the view direction from origin.
  vec4 wp = world * vec4(position, 1.0);
  vDir = normalize(wp.xyz);
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT_SOURCE = `
precision highp float;
varying vec3 vDir;
uniform float timeOfDay;
// Sun world-space direction (matches dune material's sunDir uniform — both
// updated each frame with the same wobbled vector so sun-disc tracks the
// same light source the dune is lit by).
uniform vec3 sunDir;

void main(void) {
  // Map y from [-1, 1] to [0, 1]. Below-horizon (negative y) clamps to the
  // tan stop so even if the camera dips below ground, no black appears.
  float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);

  // Brand palette stops (Pass 4 — horizon distinguished from body bg):
  //   y=1.0 (zenith)   → lavender   #d7c7ee = (0.843, 0.780, 0.933)
  //   y=0.0 (horizon)  → warm linen #e8dfca = (0.910, 0.875, 0.792)
  //   y=-1.0 (nadir)   → warm tan   #d4c4a8 = (0.831, 0.769, 0.659)
  // Horizon was #ede5d4 (identical to body bg) — dune outline disappeared into
  // sky. Pulled 1-2 shades richer so the dune silhouette reads against a sky
  // that isn't pixel-identical to the page bg.
  //
  // Liveness pass: the horizon stop modulates with timeOfDay so the sky
  // visibly tracks the same 90s phase the dune surface does. Zenith stays
  // lavender-ish (it's where the page lavender accents live). Nadir stays
  // warm-tan (below-horizon clamp; camera doesn't dip there in practice).
  float td = clamp(timeOfDay, 0.0, 1.0);
  float wMidday  = max(0.0, 1.0 - abs(td - 0.000) * 4.0) + max(0.0, 1.0 - abs(td - 1.000) * 4.0);
  float wLateAft = max(0.0, 1.0 - abs(td - 0.250) * 4.0);
  float wDusk    = max(0.0, 1.0 - abs(td - 0.500) * 4.0);
  float wMorning = max(0.0, 1.0 - abs(td - 0.750) * 4.0);
  float wSum = wMidday + wLateAft + wDusk + wMorning;
  wMidday /= wSum; wLateAft /= wSum; wDusk /= wSum; wMorning /= wSum;

  vec3 horizonMidday  = vec3(0.910, 0.875, 0.792); // #e8dfca warm linen
  vec3 horizonLateAft = vec3(0.890, 0.875, 0.835); // #e3dfd5 cooler linen
  vec3 horizonDusk    = vec3(0.910, 0.855, 0.890); // #e8dae3 lavender-cream wash
  vec3 horizonMorning = vec3(0.925, 0.890, 0.820); // #ece3d1 warm linen returning
  vec3 horizon = horizonMidday * wMidday + horizonLateAft * wLateAft
               + horizonDusk * wDusk + horizonMorning * wMorning;

  vec3 zenith = vec3(0.843, 0.780, 0.933);
  vec3 nadir  = vec3(0.831, 0.769, 0.659);

  vec3 col;
  if (t > 0.5) {
    col = mix(horizon, zenith, (t - 0.5) * 2.0);
  } else {
    col = mix(nadir, horizon, t * 2.0);
  }

  // Atmosphere pass — sun-disc + soft halo (researcher rec #4).
  // sunTint computed inside the sky shader using the same 4-quadrant phase
  // weights as the dune so the sun-in-sky and sun-on-sand pick up the same
  // colour. tungsten / pale-cool / amber / warm-tungsten — never bright
  // yellow; dusk amber is pulled toward red, not toward saturated yellow.
  vec3 sunTintMidday  = vec3(1.000, 0.970, 0.880);
  vec3 sunTintLateAft = vec3(0.965, 0.965, 0.985);
  vec3 sunTintDusk    = vec3(1.000, 0.870, 0.760);
  vec3 sunTintMorning = vec3(1.000, 0.945, 0.870);
  vec3 sunTint = sunTintMidday * wMidday + sunTintLateAft * wLateAft
               + sunTintDusk * wDusk + sunTintMorning * wMorning;

  // Tight inner disc + soft outer halo. Both driven by dot(view-dir, sun-dir);
  // smoothstep(0.997, 1.0) makes the disc small (~4-5° angular radius), the
  // 0.96 halo gives the bloom-lite glow tapering into the surrounding sky.
  // Halo factor 0.18 keeps the additive bloom subtle so the surrounding
  // horizon palette still reads — no white-out around the sun.
  float sunFactor = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
  float sunDisc = smoothstep(0.997, 1.0, sunFactor);
  float sunHalo = smoothstep(0.96, 1.0, sunFactor);
  col = mix(col, sunTint * 1.4, sunDisc);
  col += sunTint * sunHalo * 0.18;

  gl_FragColor = vec4(col, 1.0);
}
`;

// Register shader sources into Babylon's effect store under a stable name so
// ShaderMaterial({ vertex: SHADER_NAME, fragment: SHADER_NAME }) resolves.
Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = VERTEX_SOURCE;
Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = FRAGMENT_SOURCE;
Effect.ShadersStore[`${SKY_SHADER_NAME}VertexShader`] = SKY_VERTEX_SOURCE;
Effect.ShadersStore[`${SKY_SHADER_NAME}FragmentShader`] = SKY_FRAGMENT_SOURCE;

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

// Reduced from 60 → 30 so the perf median computes after fewer frames.
// Browsers throttled by background-tab / low-power mode / cold shader compile
// were taking >6s to fill a 60-frame window, tripping the gate's "no sample
// in 6000ms" fallback. 30 frames at even 10fps fills in 3s.
const PERF_WINDOW = 30;
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
		alpha: true,
	});
	const scene = new Scene(engine);
	// Pass 4 (black-section fix, real this time): OPAQUE cream clearColor.
	// Prior passes used transparent (0,0,0,0); on Mac mini Safari that read
	// as opaque black under certain compositor paths, and even where it
	// honoured the alpha, the SkyMaterial drew opaque black above the dune
	// horizon. Cream clear means: any pixel the skybox/ground doesn't paint
	// shows brand cream, never black. The page bg under the canvas is also
	// cream (#ede5d4) so there's no seam if the canvas is removed.
	scene.clearColor = new Color4(0.929, 0.898, 0.831, 1.0); // #ede5d4

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
	sun.intensity = 1.4; // was 1.1 — lift shadow side so it reads cream/amber, not black
	sun.diffuse = new Color3(1.0, 0.97, 0.88);
	sun.specular = new Color3(0, 0, 0);

	// Warmer pale sky-bounce fill from above, cream ground-bounce from below —
	// the underside of dunes picks up warm sand reflection instead of dim gray.
	const fill = new HemisphericLight("dune-fill", new Vector3(0, 1, 0), scene);
	fill.intensity = 0.45;
	fill.diffuse = new Color3(0.86, 0.88, 0.92); // pale washed sky (was cool 0.72/0.82/0.9)
	fill.groundColor = new Color3(0.97, 0.94, 0.88); // pass 2 — lighter cream bounce (was 0.93/0.90/0.83) to push dunes further into linen tones

	// Sky — custom 3-stop vertical gradient shader. Replaces Preetham
	// SkyMaterial which produced opaque-black bands at oblique angles in
	// light mode (root cause for the persistent "black behind dunes" report
	// 2026-04-30; passes 1-3 tweaked Preetham params and added a fallback
	// div, neither cured the actual canvas pixels reading as black).
	//
	// Skybox size 5000u (was 1000u): comfortably outside the camera frustum
	// at fov 0.6 + radius 45 + arbitrary alpha drift, so the box edges/corners
	// can never enter view and reveal the canvas clear. backFaceCulling off
	// so the inside face paints the gradient.
	const skybox = MeshBuilder.CreateBox("dune-skybox", { size: 5000 }, scene);
	const skyMat = new ShaderMaterial(
		"dune-sky-mat",
		scene,
		{ vertex: SKY_SHADER_NAME, fragment: SKY_SHADER_NAME },
		{
			attributes: ["position"],
			// timeOfDay: 0..1 over a 90s loop; modulates the horizon stop so
			// the sky tracks the same phase the dune surface does.
			// sunDir: world-space direction toward the sun, updated each frame
			// alongside the dune material's sunDir so the sky-disc and the
			// dune lighting agree on where the sun is (and inherit the wobble).
			uniforms: ["worldViewProjection", "world", "timeOfDay", "sunDir"],
		},
	);
	skyMat.backFaceCulling = false;
	skyMat.setFloat("timeOfDay", 0);
	skyMat.setVector3("sunDir", SUN_DIR_WORLD);
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
			// world + view: needed for view-space depth (vDepth varying) used by
			// the aerial-perspective haze. horizonTint: matches the live sky
			// horizon stop so the haze fade and the sky band agree on colour.
			uniforms: [
				"worldViewProjection",
				"world",
				"view",
				"time",
				"timeOfDay",
				"sunDir",
				"bassLevel",
				"midLevel",
				"fluxLevel",
				"horizonTint",
			],
		},
	);
	duneMat.setVector3("sunDir", SUN_DIR_WORLD);
	// Initialise audio uniforms to 0 — silent / pre-play frames render exactly
	// the same as the pre-audio scene. No flicker on first sample arrival.
	duneMat.setFloat("bassLevel", 0);
	duneMat.setFloat("midLevel", 0);
	duneMat.setFloat("fluxLevel", 0);
	// timeOfDay starts at 0 (warm midday). Reduced-motion users stay here
	// forever; everyone else cycles 0→1 over 90s in registerBeforeRender.
	duneMat.setFloat("timeOfDay", 0);
	// horizonTint init — the warm-linen midday horizon stop. Updated each
	// frame from JS to match whatever the sky shader computes for the current
	// timeOfDay. Reduced-motion users keep the midday stop forever.
	duneMat.setColor3("horizonTint", new Color3(0.91, 0.875, 0.792));
	ground.material = duneMat;

	// Animation: respect reduced-motion preference.
	const reducedMotion =
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

	// Flux is published only as the --cdn-flux CSS custom property by the
	// background-viz canvas loop (canvas.ts owns the spectralFlux state — it
	// needs the previous frame's bins for the diff). audio.ts exposes bass +
	// mid as JS exports but not flux. Caching the CSSStyleDeclaration ref
	// avoids the full-style recompute on every frame; only getPropertyValue
	// runs in the hot path. Skipped entirely under reduced-motion.
	const rootStyle =
		typeof document !== "undefined" && !reducedMotion
			? getComputedStyle(document.documentElement)
			: null;

	let timeSeconds = 0;
	let lastFrameMs = performance.now();

	// Liveness pass: 90s timeOfDay loop period (in seconds). Long enough that
	// the cycle reads as ambient mood rather than animation.
	const TIME_OF_DAY_PERIOD_S = 90;
	// Sun-direction wobble — 0.05 Hz (20s period) at 0.05 amplitude in xz.
	// Ridge highlights drift across ~30s window. Imperceptible per-frame.
	const SUN_WOBBLE_HZ = 0.05;
	const SUN_WOBBLE_AMP = 0.05;
	// Liveness pass 4 (2026-05-02) — camera radius breathe (researcher rec #8).
	// Very low-amplitude sinusoidal radius oscillation gives the scene a
	// gentle "alive" parallax over a 24s period. ±0.15 around radius 45 is
	// imperceptible per-frame, perceptible over ~12s. Reduced-motion users
	// skip this (camera radius stays fixed at the constructor's 45).
	const CAMERA_BREATHE_HZ = 1 / 24;
	const CAMERA_BREATHE_AMP = 0.15;
	const CAMERA_RADIUS_BASE = 45;
	// Scratch vector reused each frame to avoid per-frame allocation pressure.
	const sunScratch = new Vector3(0, 0, 0);
	// horizonTint scratch — reused each frame to avoid per-frame Color3 alloc.
	// Stops mirror the sky shader's per-phase horizon stops exactly so the
	// dune's aerial haze and the sky's horizon band stay locked together.
	const horizonScratch = new Color3(0.91, 0.875, 0.792);

	scene.registerBeforeRender(() => {
		if (reducedMotion) {
			duneMat.setFloat("time", 0);
			// timeOfDay frozen at 0 (warm midday) — no surprise color drift
			// for users who explicitly opted out of motion. sunDir stays at
			// the constant SUN_DIR_WORLD set during init; we don't touch it.
			duneMat.setFloat("timeOfDay", 0);
			skyMat.setFloat("timeOfDay", 0);
			// Reduced-motion users get zero audio reactivity too — the whole
			// point of the preference is no surprise movement, and audio
			// reactivity is exactly that.
			duneMat.setFloat("bassLevel", 0);
			duneMat.setFloat("midLevel", 0);
			duneMat.setFloat("fluxLevel", 0);
			return;
		}
		const now = performance.now();
		const delta = (now - lastFrameMs) / 1000;
		lastFrameMs = now;
		timeSeconds += delta;
		duneMat.setFloat("time", timeSeconds);
		camera.alpha += 0.00004;
		// Camera radius breathe — sinusoidal ±0.15 around base 45 over 24s.
		// Tiny parallax that reads as ambient liveness, not zoom. Always active
		// when not reduced-motion (early-return above already skipped this path).
		camera.radius =
			CAMERA_RADIUS_BASE +
			Math.sin(timeSeconds * CAMERA_BREATHE_HZ * Math.PI * 2) *
				CAMERA_BREATHE_AMP;

		// timeOfDay — 0..1 over a 90s loop. Same phase pushed to both the
		// dune material and the sky material so the surface and the horizon
		// shift in lockstep (no temporal mismatch between sky and ground).
		const timeOfDay = (timeSeconds / TIME_OF_DAY_PERIOD_S) % 1;
		duneMat.setFloat("timeOfDay", timeOfDay);
		skyMat.setFloat("timeOfDay", timeOfDay);

		// Sun-direction wobble — gently oscillate xz around SUN_DIR_WORLD
		// then renormalise. 0.05 amplitude on 0.05 Hz: ridge highlights shift
		// over 20s without ever obviously moving. Result fed back into the
		// dune material's sunDir uniform; the DirectionalLight stays fixed
		// (Lambert in the shader is what the eye actually reads). Same vector
		// pushed to the sky material so the sun-disc tracks the wobble too.
		const wobble = Math.sin(timeSeconds * SUN_WOBBLE_HZ * Math.PI * 2);
		const wobbleQuad = Math.cos(timeSeconds * SUN_WOBBLE_HZ * Math.PI * 2);
		sunScratch.set(
			SUN_DIR_WORLD.x + wobble * SUN_WOBBLE_AMP,
			SUN_DIR_WORLD.y,
			SUN_DIR_WORLD.z + wobbleQuad * SUN_WOBBLE_AMP,
		);
		sunScratch.normalize();
		duneMat.setVector3("sunDir", sunScratch);
		skyMat.setVector3("sunDir", sunScratch);

		// horizonTint — recompute from the same 4-quadrant phase weights the
		// shaders use, then push to the dune material so the aerial-perspective
		// haze fade matches whatever the sky shader is painting at the horizon
		// for this frame. Cheap: 4 weight terms + 4 mixes, far under 0.01ms.
		const tdNorm = timeOfDay; // 0..1
		let wMidday =
			Math.max(0, 1 - Math.abs(tdNorm - 0.0) * 4) +
			Math.max(0, 1 - Math.abs(tdNorm - 1.0) * 4);
		let wLateAft = Math.max(0, 1 - Math.abs(tdNorm - 0.25) * 4);
		let wDusk = Math.max(0, 1 - Math.abs(tdNorm - 0.5) * 4);
		let wMorning = Math.max(0, 1 - Math.abs(tdNorm - 0.75) * 4);
		const wSum = wMidday + wLateAft + wDusk + wMorning;
		wMidday /= wSum;
		wLateAft /= wSum;
		wDusk /= wSum;
		wMorning /= wSum;
		// Per-phase horizon stops — mirror the sky shader's values exactly.
		horizonScratch.r =
			0.91 * wMidday + 0.89 * wLateAft + 0.91 * wDusk + 0.925 * wMorning;
		horizonScratch.g =
			0.875 * wMidday + 0.875 * wLateAft + 0.855 * wDusk + 0.89 * wMorning;
		horizonScratch.b =
			0.792 * wMidday + 0.835 * wLateAft + 0.89 * wDusk + 0.82 * wMorning;
		duneMat.setColor3("horizonTint", horizonScratch);

		// Audio uniforms — getBandBass/Mid return 0 when the audio graph isn't
		// built yet (silent / pre-play), so no guard needed here.
		duneMat.setFloat("bassLevel", getBandBass());
		duneMat.setFloat("midLevel", getBandMid());
		const flux = rootStyle
			? parseFloat(rootStyle.getPropertyValue("--cdn-flux")) || 0
			: 0;
		duneMat.setFloat("fluxLevel", flux);
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
 * Inject the brand-palette fallback gradient div without mounting the
 * babylon scene. Idempotent — checks for an existing element first. Used
 * by tryMountDune() so the fallback exists EVEN when software rendering
 * or reduced motion would otherwise skip the dune mount entirely.
 *
 * Returns a disposer for the element. Caller decides when to remove it
 * (e.g. on dark-mode toggle or shell unmount).
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
 * inside `container` at z-index: -1 (in front of the static cream-fallback
 * 2D background-viz canvas at z-index: -2; both still behind body content
 * at z:0+). The handle's destroy() removes the canvas.
 *
 * Stacking order (back to front):
 *   z:-3  fallback gradient div (cream/lavender)
 *   z:-2  static cream bg-viz canvas (watermark layer; opacity 0 when dune mounts)
 *   z:-1  dune scene canvas (BabylonJS, this one)
 *   z:0+  body content (cards, UI chrome)
 *
 * Pass 5 (z-index swap): dune was previously at z:-2 with static at z:-1.
 * Even with opacity:0 on the static canvas after dune mounts, stacking-context
 * quirks were burying the dune visually. Putting dune in front of static
 * means dune ALWAYS wins and the static canvas's opacity state doesn't matter.
 *
 * Pass 4 (real black fix): the fallback div is now created via
 * ensureDuneFallback() and NOT torn down when this handle disposes. The
 * caller (background-viz/index.ts) owns the fallback lifetime — we want the
 * cream/lavender gradient to outlive the babylon scene if the perf gate
 * tears the canvas down.
 */
export function mountDuneScene(container: HTMLElement): DuneSceneHandle {
	// Always ensure the fallback exists — independent of canvas mount success.
	ensureDuneFallback(container);

	const canvas = document.createElement("canvas");
	canvas.style.cssText =
		"position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none";
	canvas.setAttribute("aria-hidden", "true");
	canvas.dataset.cdnDuneCanvas = "1";
	container.appendChild(canvas);

	// Liveness pass: cross-fade the canvas in over 2s on mount. The fallback
	// gradient (cream/lavender) sits underneath at z-index:-3 so the eye sees
	// a smooth gradient → dunes transition rather than a hard pop, even if
	// babylon's first frame takes a beat. Reduced-motion skips the fade and
	// shows the canvas immediately. Guarded against SSR — only runs in browser.
	const reducedMotionOnMount =
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
	if (!reducedMotionOnMount && typeof requestAnimationFrame === "function") {
		canvas.style.opacity = "0";
		requestAnimationFrame(() => {
			canvas.style.transition = "opacity 2s ease-out";
			canvas.style.opacity = "1";
		});
	}

	const inner = mountDuneSceneOnCanvas(canvas);

	// Initial sizing — Babylon uses the canvas client rect.
	inner.resize();

	return {
		destroy() {
			inner.dispose();
			canvas.remove();
			// NOTE: fallback NOT removed here — caller owns its lifetime.
		},
		resize() {
			inner.resize();
		},
		getPerfMedian() {
			return inner.getPerfMedian();
		},
	};
}
