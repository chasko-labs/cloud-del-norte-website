// Camera-locked horizon haze billboard.
//
// Why: scene fog (FOGMODE_EXP2) alone wasn't reading as haze. The dune mesh
// is bounded (60×40) and the sky is a clear gradient — there's no atmospheric
// volume between them for fog to fill. A single alpha-blended quad parented
// to the camera, slightly in front of the dune ground, sells the haze that
// White Sands actually has at noon.
//
// Performance:
//   - 1 mesh, 4 verts, 2 triangles → 1 extra draw call, sub-microsecond
//   - alphaBlend on, depthWrite off → composes over dunes without z-fighting
//   - parented to camera so it never needs per-frame transform updates
//   - shader is 4 uniforms + a vertical gradient → trivial fragment cost
//
// Visual: vertical gradient from horizon-color (mid band) to fully transparent
// at top and partially transparent at bottom. Acts like the bright haze layer
// you'd see at noon at White Sands looking toward the mountains.

import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Constants } from "@babylonjs/core/Engines/constants.js";
import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";

import type { AnimationState } from "./AnimationController.js";
import { mixPhaseColor, type PhaseWeights } from "./dune-colors.js";
import {
	HAZE_BAND_BOTTOM_OPACITY,
	HAZE_BAND_MID_OPACITY,
	HAZE_BAND_TOP_OPACITY,
	HAZE_QUAD_DISTANCE,
	HAZE_QUAD_SCALE_H,
	HAZE_QUAD_SCALE_W,
} from "./white-sands-features.js";

const HAZE_SHADER_NAME = "cdnDuneHaze";

const HAZE_VERTEX_SOURCE = `
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

// Three-stop vertical gradient on alpha: top transparent, mid full haze,
// bottom partial haze. The mid band sits at the dune horizon line so the
// haze is densest exactly where the dunes meet the sky.
const HAZE_FRAGMENT_SOURCE = `
precision highp float;
varying vec2 vUV;
uniform vec3 hazeCol;
uniform float topOpacity;
uniform float midOpacity;
uniform float bottomOpacity;

void main(void) {
  // vUV.y goes 0 (bottom) to 1 (top).
  float y = vUV.y;
  // Two-segment gradient: bottom→mid (rising), mid→top (falling).
  float midBand = 0.45;
  float a;
  if (y < midBand) {
    float t = y / midBand;
    a = mix(bottomOpacity, midOpacity, smoothstep(0.0, 1.0, t));
  } else {
    float t = (y - midBand) / (1.0 - midBand);
    a = mix(midOpacity, topOpacity, smoothstep(0.0, 1.0, t));
  }
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

export class HazeBackdrop {
	private readonly mesh: Mesh;
	private readonly material: ShaderMaterial;
	private readonly hazeScratch: [number, number, number] = [0, 0, 0];
	private readonly hazeColor = new Color3(0, 0, 0);

	constructor(scene: Scene, camera: Camera) {
		ensureRegistered();
		// Plane mesh — always faces camera since we parent it to the camera.
		this.mesh = MeshBuilder.CreatePlane(
			"dune-haze",
			{ width: HAZE_QUAD_SCALE_W, height: HAZE_QUAD_SCALE_H },
			scene,
		);
		// Parent to the camera so the quad rides with the view. Position offset
		// in front of the camera along its forward axis. Babylon's default
		// camera-local +Z is forward, so position.z = +distance puts the quad
		// in front. Tilt down very slightly so the bottom band aligns with the
		// dune horizon, not above it.
		this.mesh.parent = camera;
		this.mesh.position = new Vector3(0, -2, HAZE_QUAD_DISTANCE);

		this.material = new ShaderMaterial(
			"dune-haze-mat",
			scene,
			{ vertex: HAZE_SHADER_NAME, fragment: HAZE_SHADER_NAME },
			{
				attributes: ["position", "uv"],
				uniforms: [
					"worldViewProjection",
					"hazeCol",
					"topOpacity",
					"midOpacity",
					"bottomOpacity",
				],
				needAlphaBlending: true,
			},
		);
		// Standard alpha blend, no depth write so the quad composites over dunes
		// without occluding them in the depth buffer (which would prevent the
		// dune fragment shader's haze contribution from compositing correctly).
		this.material.alphaMode = Constants.ALPHA_COMBINE;
		this.material.backFaceCulling = false;
		this.material.disableDepthWrite = true;
		this.material.setFloat("topOpacity", HAZE_BAND_TOP_OPACITY);
		this.material.setFloat("midOpacity", HAZE_BAND_MID_OPACITY);
		this.material.setFloat("bottomOpacity", HAZE_BAND_BOTTOM_OPACITY);
		this.mesh.material = this.material;
		// Render after the dunes (renderingGroupId 1) so it sits visually on top
		// without z-fighting the skybox or dune mesh.
		this.mesh.renderingGroupId = 1;
		// Apply initial color so the first frame doesn't flash black.
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
		mixPhaseColor(this.hazeScratch, w, (p) => p.horizon);
		this.hazeColor.set(
			this.hazeScratch[0],
			this.hazeScratch[1],
			this.hazeScratch[2],
		);
		this.material.setColor3("hazeCol", this.hazeColor);
	}
}
