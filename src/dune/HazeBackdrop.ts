// Screen-space horizon haze layer.
//
// v0.0.0085 — escalated rewrite. Three prior attempts at "make the fog
// visible" failed:
//   - v0.0.0067: scene.fogDensity 0.012, FOGMODE_EXP2 → invisible (Babylon
//     scene fog is StandardMaterial / PBRMaterial only, ShaderMaterial
//     bypasses it entirely).
//   - v0.0.0073: density 0.012 → 0.028, fragment fogMix 0.55 → 0.78, plus a
//     camera-parented alpha quad → STILL invisible.
//
// Root cause of the v0.0.0073 invisibility:
//   1. The camera-parented quad sat at position.z = +38 in CAMERA-LOCAL space.
//      Babylon's ArcRotateCamera local +Z direction depends on alpha/beta; at
//      our (-π/3, 1.1) frame the +Z axis points BEHIND the look direction so
//      the quad rendered behind the camera (off-screen).
//   2. Even if visible, the haze color was the `horizon` palette stop
//      (~#e8dfca cream) — the SAME color as the dune body and the sky horizon
//      band. Cream-on-cream layered at α=0.42 = invisible by definition.
//
// v0.0.0085 fix: render a fullscreen NDC quad. The vertex shader writes
// gl_Position = vec4(position.xy, depth, 1.0) directly — no view, no
// projection, no parent. The quad ALWAYS covers the viewport regardless of
// camera orbit. The fragment shader composites two haze passes:
//
//   1. Vertical alpha gradient, top→bottom: fully transparent above 60% up,
//      ramping to 0.55 alpha across the lower 40% of the viewport (where the
//      dunes actually are, post-camera-frame).
//   2. Narrow horizontal strip centered on the dune horizon line (y≈0.55),
//      18% tall, peaking at 0.5 alpha — this is where atmospheric path length
//      is longest in real-world physics, sells the haze.
//
// Color is HAZE_COLOR_WARM (#fadbb0 peach-cream), deliberately warmer +
// slightly more saturated than the cream `horizon` palette stop so the haze
// reads as a distinct atmospheric layer instead of dissolving into the cream
// dune body. Reads as "foggy desert morning, El Paso vibe".
//
// Performance: 1 mesh, 4 verts, 2 triangles, 1 extra draw call per frame.
// Renders in renderingGroupId 1 AFTER the dune ground (group 0) so it
// composites over the dunes.

import { Constants } from "@babylonjs/core/Engines/constants.js";
import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";

import type { AnimationState } from "./AnimationController.js";
import { mixPhaseColor, type PhaseWeights } from "./dune-colors.js";
import {
	HAZE_BAND_BOTTOM_OPACITY,
	HAZE_BAND_MID_OPACITY,
	HAZE_BAND_TOP_OPACITY,
	HAZE_COLOR_WARM,
	HAZE_HORIZON_STRIP_CENTER_Y,
	HAZE_HORIZON_STRIP_HEIGHT,
	HAZE_HORIZON_STRIP_PEAK_OPACITY,
} from "./white-sands-features.js";

const HAZE_SHADER_NAME = "cdnDuneHazeV2";

// Vertex shader — bypass camera entirely. Position attributes interpreted as
// NDC clip-space coords directly. The mesh is built as a unit plane in
// xy [-1, +1] which becomes the entire viewport. z = 0.999 keeps the quad
// just inside the far clip plane so depthWrite-off + alpha-blend can still
// composite correctly behind any post-process.
const HAZE_VERTEX_SOURCE = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUV;
void main(void) {
  vUV = uv;
  // Pass position straight through as NDC. Plane was built x:[-1,1], y:[-1,1]
  // (CreatePlane width=2 height=2 centered at origin). z forced to 0.999 so
  // the quad sits at the far plane in NDC depth — composites over everything
  // but doesn't punch through the depth buffer.
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`;

// Fragment shader — composite TWO haze passes:
//
//   1. Bottom-weighted vertical gradient. y < 0.6 ramps from bottomOpacity
//      (at y=0, viewport bottom) up through midOpacity at y≈0.4 to topOpacity
//      at y=0.6+. Above that, fully transparent.
//   2. Horizontal strip centered at stripCenterY ± stripHalfHeight, peaking
//      at stripPeak alpha. Smoothstep falloff at the edges.
//
// Both passes use the SAME warm haze color (hazeCol uniform). Final alpha is
// max(verticalAlpha, stripAlpha) so the strip can pop above the gradient
// without simple-summing into >1.0 alpha (which would blow out highlights).
//
// vUV.y goes 0 (bottom of screen) to 1 (top) — convention from CreatePlane
// + the way the NDC-bypass vertex shader passes uv unchanged.
const HAZE_FRAGMENT_SOURCE = `
precision highp float;
varying vec2 vUV;
uniform vec3 hazeCol;
uniform float topOpacity;
uniform float midOpacity;
uniform float bottomOpacity;
uniform float stripCenterY;
uniform float stripHalfHeight;
uniform float stripPeak;

void main(void) {
  float y = vUV.y;

  // Pass 1 — bottom-weighted vertical gradient. The dunes occupy roughly the
  // lower 60% of the viewport at the standard ArcRotate frame, so the haze is
  // densest where the dunes are, fading to clear above.
  float vAlpha;
  if (y < 0.4) {
    // Bottom 40% — bottom→mid ramp.
    float t = y / 0.4;
    vAlpha = mix(bottomOpacity, midOpacity, smoothstep(0.0, 1.0, t));
  } else if (y < 0.6) {
    // 40-60% — mid→top fadeout (haze thins above the dune line).
    float t = (y - 0.4) / 0.2;
    vAlpha = mix(midOpacity, topOpacity, smoothstep(0.0, 1.0, t));
  } else {
    vAlpha = topOpacity;
  }

  // Pass 2 — horizon strip. Narrow band at the dune-sky line, peak alpha
  // higher than the vertical gradient. smoothstep falloff at both edges so
  // the strip blends into the surrounding viewport.
  float dy = abs(y - stripCenterY);
  float stripT = 1.0 - smoothstep(0.0, stripHalfHeight, dy);
  float stripAlpha = stripPeak * stripT;

  // Composite — max so peaks don't sum past 1.0. Strip wins where it's denser.
  float a = max(vAlpha, stripAlpha);

  gl_FragColor = vec4(hazeCol, a);
}
`;

let registered = false;
function ensureRegistered(): void {
	if (registered) return;
	Effect.ShadersStore[`${HAZE_SHADER_NAME}VertexShader`] = HAZE_VERTEX_SOURCE;
	Effect.ShadersStore[`${HAZE_SHADER_NAME}FragmentShader`] =
		HAZE_FRAGMENT_SOURCE;
	registered = true;
}

/**
 * Compute the haze color for a given phase. Mixes the WARM haze base with a
 * subtle phase-weighted shift so dusk pushes slightly violet, morning slightly
 * peachy. Most of the chroma stays warm-cream — Bryan's spec is "foggy desert
 * morning", not "color-shifting fog".
 *
 * Exported for tests so we can verify the haze color stays meaningfully
 * DIFFERENT from the cream `horizon` palette stop (the v0.0.0073 bug).
 */
export function computeHazeColor(
	weights: PhaseWeights,
	out: [number, number, number],
): [number, number, number] {
	// Pre-mix the palette horizon stop into a scratch — this is what the OLD
	// haze used (and it was invisible because it equalled the dune body).
	const horizonScratch: [number, number, number] = [0, 0, 0];
	mixPhaseColor(horizonScratch, weights, (p) => p.horizon);
	// Blend the warm base 70% with the phase-tinted horizon 30% so dusk/morning
	// still pull the haze toward the day's mood without losing the warm cream.
	const w = 0.7;
	out[0] = HAZE_COLOR_WARM[0] * w + horizonScratch[0] * (1 - w);
	out[1] = HAZE_COLOR_WARM[1] * w + horizonScratch[1] * (1 - w);
	out[2] = HAZE_COLOR_WARM[2] * w + horizonScratch[2] * (1 - w);
	return out;
}

export class HazeBackdrop {
	private readonly mesh: Mesh;
	private readonly material: ShaderMaterial;
	private readonly hazeScratch: [number, number, number] = [0, 0, 0];
	private readonly hazeColor = new Color3(0, 0, 0);

	/**
	 * @param scene Scene to attach to.
	 * @param _camera Unused — kept for API parity with v0.0.0073 callers.
	 *   The screen-space NDC vertex shader bypasses the camera entirely; this
	 *   is the entire point of the v0.0.0085 rewrite. Prefixed with _ to signal
	 *   intentional non-use to lints.
	 */
	constructor(scene: Scene, _camera?: unknown) {
		ensureRegistered();
		// Build a 2x2 plane centered at origin. Vertex shader interprets the
		// xy positions as NDC clip-space directly — full viewport coverage.
		this.mesh = MeshBuilder.CreatePlane(
			"dune-haze",
			{ width: 2, height: 2 },
			scene,
		);
		// Disable frustum culling — the NDC bypass means Babylon's bounding-box
		// math doesn't match where the quad actually renders.
		this.mesh.alwaysSelectAsActiveMesh = true;

		this.material = new ShaderMaterial(
			"dune-haze-mat",
			scene,
			{ vertex: HAZE_SHADER_NAME, fragment: HAZE_SHADER_NAME },
			{
				attributes: ["position", "uv"],
				uniforms: [
					"hazeCol",
					"topOpacity",
					"midOpacity",
					"bottomOpacity",
					"stripCenterY",
					"stripHalfHeight",
					"stripPeak",
				],
				needAlphaBlending: true,
			},
		);
		// Standard alpha blend, no depth write so the haze composites over the
		// dunes without writing into the depth buffer (which would prevent
		// later effects from sampling depth correctly).
		this.material.alphaMode = Constants.ALPHA_COMBINE;
		this.material.backFaceCulling = false;
		this.material.disableDepthWrite = true;
		// No depth test — guarantees the haze is never occluded by the skybox
		// or any background mesh. Combined with renderingGroupId 1 the haze
		// reliably composites on TOP of the dune scene.
		this.material.depthFunction = Constants.ALWAYS;
		this.material.setFloat("topOpacity", HAZE_BAND_TOP_OPACITY);
		this.material.setFloat("midOpacity", HAZE_BAND_MID_OPACITY);
		this.material.setFloat("bottomOpacity", HAZE_BAND_BOTTOM_OPACITY);
		this.material.setFloat("stripCenterY", HAZE_HORIZON_STRIP_CENTER_Y);
		this.material.setFloat("stripHalfHeight", HAZE_HORIZON_STRIP_HEIGHT * 0.5);
		this.material.setFloat("stripPeak", HAZE_HORIZON_STRIP_PEAK_OPACITY);
		this.mesh.material = this.material;
		// renderingGroupId 1 — render AFTER the dune ground (default group 0)
		// so the haze composites on top.
		this.mesh.renderingGroupId = 1;
		// First-frame color so the haze doesn't flash black before update().
		this.applyPhase({ midday: 1, lateAft: 0, dusk: 0, morning: 0 });
	}

	update(animation: AnimationState): void {
		this.applyPhase(animation.phaseWeights);
	}

	dispose(): void {
		this.material.dispose();
		this.mesh.dispose();
	}

	private applyPhase(w: PhaseWeights): void {
		computeHazeColor(w, this.hazeScratch);
		this.hazeColor.set(
			this.hazeScratch[0],
			this.hazeScratch[1],
			this.hazeScratch[2],
		);
		this.material.setColor3("hazeCol", this.hazeColor);
	}
}
