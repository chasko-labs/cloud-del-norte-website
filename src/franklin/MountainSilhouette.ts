// Franklin Mountains silhouette mesh + shader.
//
// Geometry: the 1D ridge profile from silhouette-geometry.ts is extruded into
// a thin (depth=2u) slab that fills the bottom of the viewport. The profile
// gives one (x, y) sample per column; for each column we emit two triangles
// connecting (x, y_top) → (x_next, y_top') → (x, 0) → (x_next, 0).
//
// Two-sided so the camera can sit on either side without depth issues. The
// extrusion depth is essentially cosmetic — the slab reads as a flat
// silhouette from the camera position; depth only matters for the very
// shallow ambient occlusion at the gap notch interiors.
//
// Shader: nearly-black silhouette with subtle horizontal "candy stripe"
// sedimentary banding (Bryan: limestone / dolomite layers dipping westward).
// The bands are extremely faint (STRATA_TINT_STRENGTH = 0.06) so they hint
// at the geology without compromising the silhouette read against the night
// sky. Bottom of the silhouette darkens further toward absolute black so the
// horizon line dissolves into the canvas-2D backdrop.
//
// Performance: 1 mesh, ~SILHOUETTE_RESOLUTION × 4 verts (2 caps), single
// draw call. Depth-tested but not depth-writing into the back-plane stars
// (handled by render-group ordering in SceneBootstrap).

import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import type { Scene } from "@babylonjs/core/scene";

import {
	PALETTE,
	SILHOUETTE_DEPTH_U,
	SILHOUETTE_HEIGHT_U,
	SILHOUETTE_WIDTH_U,
	STRATA_BAND_COUNT,
	STRATA_TINT_STRENGTH,
} from "./franklin-features.js";
import {
	buildSilhouetteProfile,
	type SilhouetteProfile,
} from "./silhouette-geometry.js";

const SHADER_NAME = "cdnFranklinSilhouette";

const VERTEX_SOURCE = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
varying float vHeightFrac;
void main(void) {
  vUV = uv;
  // vHeightFrac = 0 at silhouette base, 1 at peak — used by the fragment
  // shader to fade the bottom edge toward absolute black.
  vHeightFrac = uv.y;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

// Fragment shader — near-black base with horizontal strata bands. v0.0.0079:
// removed the bottom-fade dissolve. The mesh now extends well below the
// viewport (yBot = -SILHOUETTE_HEIGHT_U * 2) so its base is never visible —
// the silhouette stays solid alpha=1 from peak down to off-screen, occluding
// the back-plane stars wherever the mountain sits. Bryan v0.0.0078: don't
// show stars under the mountains.
const FRAGMENT_SOURCE = `
precision highp float;
varying vec2 vUV;
varying float vHeightFrac;
uniform vec3 silhouetteColor;
uniform float strataBandCount;
uniform float strataStrength;

void main(void) {
  // Strata bands — modulate the silhouette luminance with a sin wave whose
  // frequency is strataBandCount cycles across the full silhouette height.
  // Very low amplitude (strataStrength) so the silhouette stays a silhouette.
  float bandPhase = vHeightFrac * strataBandCount * 6.28318;
  float band = sin(bandPhase) * 0.5 + 0.5;
  vec3 col = silhouetteColor * (1.0 + band * strataStrength);

  gl_FragColor = vec4(col, 1.0);
}
`;

let registered = false;
function ensureRegistered(): void {
	if (registered) return;
	Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = VERTEX_SOURCE;
	Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = FRAGMENT_SOURCE;
	registered = true;
}

export class MountainSilhouette {
	readonly mesh: Mesh;
	readonly profile: SilhouetteProfile;
	private readonly material: ShaderMaterial;

	constructor(scene: Scene) {
		ensureRegistered();
		this.profile = buildSilhouetteProfile();
		this.mesh = new Mesh("franklin-silhouette", scene);
		const vd = this.buildVertexData();
		vd.applyToMesh(this.mesh, false);

		this.material = new ShaderMaterial(
			"franklin-silhouette-mat",
			scene,
			{ vertex: SHADER_NAME, fragment: SHADER_NAME },
			{
				attributes: ["position", "uv"],
				uniforms: [
					"worldViewProjection",
					"silhouetteColor",
					"strataBandCount",
					"strataStrength",
				],
				needAlphaBlending: true,
			},
		);
		this.material.backFaceCulling = false;
		this.material.setColor3(
			"silhouetteColor",
			new Color3(
				PALETTE.silhouette[0],
				PALETTE.silhouette[1],
				PALETTE.silhouette[2],
			),
		);
		this.material.setFloat("strataBandCount", STRATA_BAND_COUNT);
		this.material.setFloat("strataStrength", STRATA_TINT_STRENGTH);
		this.mesh.material = this.material;

		// Render after the back-plane stars (renderingGroupId 0) so the
		// silhouette occludes them — that's the negative-space effect Bryan
		// asked for. On-mountain stars use renderingGroupId 2 so they paint
		// over the silhouette in trippy mode.
		this.mesh.renderingGroupId = 1;
	}

	/**
	 * Build the extruded slab vertex data from the 1D profile.
	 * Layout: a triangle strip wrapping front face → top edge → back face →
	 * bottom edge. Front and back faces are rectangles per column connecting
	 * (x_i, 0, ±depth/2) and (x_i, h_i, ±depth/2) corners.
	 */
	private buildVertexData(): VertexData {
		const r = this.profile.resolution;
		const halfDepth = SILHOUETTE_DEPTH_U / 2;
		const positions: number[] = [];
		const uvs: number[] = [];
		const indices: number[] = [];

		// Two layers of vertices: top row (height) and bottom row (zero) for
		// front and back faces. Front face: z = -halfDepth. Back face: z = +halfDepth.
		// Layout indices per column i: [frontTop, frontBot, backTop, backBot]
		//   = i*4 + 0, i*4 + 1, i*4 + 2, i*4 + 3.
		// yBot extends FAR below the viewport so the silhouette occludes the
		// back-plane stars all the way down. v0.0.0079: was 0 (silhouette base
		// at world origin) which left a horizon line mid-screen with stars
		// showing below it. Now -SILHOUETTE_HEIGHT_U * 2 puts the mesh base
		// well off-screen.
		const yBotExtended = -SILHOUETTE_HEIGHT_U * 2;
		for (let i = 0; i < r; i++) {
			const xn = this.profile.xs[i]; // 0..1
			const yn = this.profile.ys[i]; // 0..1
			const x = (xn - 0.5) * SILHOUETTE_WIDTH_U;
			const yTop = yn * SILHOUETTE_HEIGHT_U;
			const yBot = yBotExtended;
			// front (z = -halfDepth)
			positions.push(x, yTop, -halfDepth);
			uvs.push(xn, 1);
			positions.push(x, yBot, -halfDepth);
			uvs.push(xn, 0);
			// back (z = +halfDepth)
			positions.push(x, yTop, halfDepth);
			uvs.push(xn, 1);
			positions.push(x, yBot, halfDepth);
			uvs.push(xn, 0);
		}

		// Build quads between adjacent columns. For each pair (i, i+1) we have
		// 4 quads: front face, back face, top-edge cap, bottom-edge cap.
		// Bottom edge isn't visible (it's underneath the camera) — skip.
		for (let i = 0; i < r - 1; i++) {
			const a0 = i * 4; // front top this column
			const a1 = i * 4 + 1; // front bot
			const a2 = i * 4 + 2; // back top
			const a3 = i * 4 + 3; // back bot
			const b0 = (i + 1) * 4; // front top next
			const b1 = (i + 1) * 4 + 1;
			const b2 = (i + 1) * 4 + 2;
			const b3 = (i + 1) * 4 + 3;
			// Front face — wound CCW from -Z view direction.
			indices.push(a0, b0, a1);
			indices.push(b0, b1, a1);
			// Back face — wound CCW from +Z view direction.
			indices.push(a2, a3, b2);
			indices.push(b2, a3, b3);
			// Top cap (the actual ridge silhouette edge — most visible from oblique angles).
			indices.push(a0, a2, b0);
			indices.push(b0, a2, b2);
		}

		const vd = new VertexData();
		vd.positions = positions;
		vd.indices = indices;
		vd.uvs = uvs;
		return vd;
	}

	dispose(): void {
		this.material.dispose();
		this.mesh.dispose();
	}
}
