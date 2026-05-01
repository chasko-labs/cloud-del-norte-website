// Procedural 3D Cloud Del Norte star scene.
// 5-pointed extruded star + 16 independent bulbs across 4 categories:
//   - 5 tip bulbs (outer vertices, larger)
//   - 1 center bulb
//   - 5 arm bulbs (0.45 interpolation along each arm)
//   - 5 diagonal bulbs (inner valley vertices between star points)
//
// Nav bar is always dark (espresso/navy). Single palette — no light-mode swap.
// MutationObserver removed: the star sits in the nav surface which never changes
// regardless of page-level light/dark toggle.
//
// Animation vocabulary mirrors liora led-blink: filament cool/warm curve
// (bright → dim with hue drift → cold floor → warm back up), per-bulb
// phase offsets baked per category index, independent cycles per category.
// Cycles slowed ~50% vs. prior version: slower heartbeat, not strobe.

// Side-effect: patches Scene.prototype.beginAnimation. Required because in
// some bundling/load-order scenarios this prototype method may not be patched
// by other chunks (e.g., StarScene loads before background-viz dune scene
// in dark-mode startup, reduced-motion, or software-rendering paths).
import "@babylonjs/core/Animations/animatable.js";

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Animation } from "@babylonjs/core/Animations/animation";
import { SineEase, EasingFunction } from "@babylonjs/core/Animations/easing";

// ── Brand palette (nav-surface — always dark) ─────────────────────────────────

const VIOLET = new Color3(0.628, 0.392, 0.956);       // #A064F4
const WHITE_VIOLET = new Color3(0.88, 0.78, 1.0);     // near-white lavender
const PURPLE = new Color3(0.353, 0.122, 0.541);        // #5A1F8A
const NAVY = new Color4(0.0, 0.0, 0.165, 1.0);         // #00002A

// ── Types ─────────────────────────────────────────────────────────────────────

export type BulbCategory = "tip" | "center" | "arm" | "diagonal";

export interface BulbMetadata {
	category: BulbCategory;
	index: number;
}

export interface StarSceneOptions {
	autoRotate?: boolean;
	transparentBackground?: boolean;
}

// ── Animation rhythms — slowed ~50% from prior version for calm heartbeat ─────

const CATEGORY_RHYTHM: Record<
	BulbCategory,
	{ cycleFrames: number; minEmissive: number; maxEmissive: number }
> = {
	// Tip: primary visual anchors — slow + bright
	tip:      { cycleFrames: 140, minEmissive: 0.6, maxEmissive: 2.6 },
	// Center: brightest single point
	center:   { cycleFrames: 100, minEmissive: 0.8, maxEmissive: 2.2 },
	// Arm: decorative filler — quieter
	arm:      { cycleFrames: 80,  minEmissive: 0.2, maxEmissive: 1.2 },
	// Diagonal: subtle white-violet accent
	diagonal: { cycleFrames: 90,  minEmissive: 0.15, maxEmissive: 1.0 },
};

// Per-category phase offsets as fractions of cycle (mirrors liora nth-child delays)
const PHASE_OFFSETS: Record<BulbCategory, number[]> = {
	tip:      [0.0, 0.18, 0.4, 0.6, 0.8],
	center:   [0.35],
	arm:      [0.0, 0.22, 0.44, 0.66, 0.88],
	diagonal: [0.1, 0.3, 0.5, 0.7, 0.9],
};

// ── Scene class ───────────────────────────────────────────────────────────────

export class StarScene {
	readonly engine: Engine;
	readonly scene: Scene;
	readonly camera: ArcRotateCamera;
	readonly star: Mesh;
	readonly bulbs: Mesh[];
	private readonly opts: Required<StarSceneOptions>;
	private glow!: GlowLayer;

	constructor(canvas: HTMLCanvasElement, options: StarSceneOptions = {}) {
		this.opts = {
			autoRotate: options.autoRotate ?? true,
			transparentBackground: options.transparentBackground ?? false,
		};

		this.engine = new Engine(canvas, true, {
			preserveDrawingBuffer: true,
			stencil: true,
			alpha: this.opts.transparentBackground,
		});

		this.scene = new Scene(this.engine);
		this.scene.clearColor = this.opts.transparentBackground
			? new Color4(0, 0, 0, 0)
			: NAVY;

		this.camera = this.makeCamera(canvas);
		this.makeAmbient();
		this.star = this.makeStar();
		this.bulbs = this.makeBulbs();
		this.attachBulbLights();
		this.attachGlowLayer();
		this.attachAnimations();

		this.engine.runRenderLoop(() => this.scene.render());
	}

	dispose(): void {
		this.engine.stopRenderLoop();
		this.scene.dispose();
		this.engine.dispose();
	}

	resize(): void {
		this.engine.resize();
	}

	// ── Camera ────────────────────────────────────────────────────────────────

	private makeCamera(canvas: HTMLCanvasElement): ArcRotateCamera {
		const cam = new ArcRotateCamera(
			"cam",
			-Math.PI / 2,
			Math.PI / 2.1,
			4.2,
			Vector3.Zero(),
			this.scene,
		);
		cam.lowerRadiusLimit = 2.5;
		cam.upperRadiusLimit = 8;
		cam.wheelDeltaPercentage = 0.01;
		// Telephoto compression: narrower FOV reads more iconic at small CSS size
		cam.fov = 0.4;
		cam.attachControl(canvas, true);
		return cam;
	}

	// ── Lighting ──────────────────────────────────────────────────────────────

	private makeAmbient(): void {
		const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
		hemi.intensity = 0.35;
		hemi.diffuse = new Color3(0.7, 0.6, 0.95);
		hemi.groundColor = new Color3(0.2, 0.1, 0.3);

		// Rim light from above-behind — gives star silhouette edge against nav surface
		const rim = new DirectionalLight("rim", new Vector3(0, -0.5, -1), this.scene);
		rim.diffuse = new Color3(0.65, 0.55, 0.9);
		rim.intensity = 0.3;
	}

	// ── Star mesh ─────────────────────────────────────────────────────────────

	/** Alternating outer/inner vertices: [outer0, inner0, outer1, inner1, ...] */
	private starVertices(
		points: number,
		outerR: number,
		innerR: number,
	): { x: number; z: number }[] {
		const verts: { x: number; z: number }[] = [];
		for (let i = 0; i < points * 2; i++) {
			const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
			const r = i % 2 === 0 ? outerR : innerR;
			verts.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r });
		}
		return verts;
	}

	private makeStar(): Mesh {
		const points = 5;
		const outer = 1.0;
		const inner = 0.42;
		const depth = 0.18;

		const positions: number[] = [];
		const indices: number[] = [];

		// vertex 0: front center, vertex 1: back center
		positions.push(0, depth / 2, 0);
		positions.push(0, -depth / 2, 0);

		for (let face = 0; face < 2; face++) {
			const y = face === 0 ? depth / 2 : -depth / 2;
			for (let i = 0; i < points * 2; i++) {
				const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
				const r = i % 2 === 0 ? outer : inner;
				positions.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
			}
		}

		const ringLen = points * 2;
		const frontStart = 2;
		const backStart = 2 + ringLen;

		// Front face fan
		for (let i = 0; i < ringLen; i++) {
			indices.push(0, frontStart + i, frontStart + ((i + 1) % ringLen));
		}
		// Back face fan (reversed winding)
		for (let i = 0; i < ringLen; i++) {
			indices.push(1, backStart + ((i + 1) % ringLen), backStart + i);
		}
		// Side quads
		for (let i = 0; i < ringLen; i++) {
			const fa = frontStart + i;
			const fb = frontStart + ((i + 1) % ringLen);
			const ba = backStart + i;
			const bb = backStart + ((i + 1) % ringLen);
			indices.push(fa, ba, fb);
			indices.push(fb, ba, bb);
		}

		const mesh = new Mesh("star", this.scene);
		const data = new VertexData();
		data.positions = positions;
		data.indices = indices;
		const normals: number[] = [];
		VertexData.ComputeNormals(positions, indices, normals);
		data.normals = normals;
		data.applyToMesh(mesh);

		const mat = new PBRMaterial("starMat", this.scene);
		mat.albedoColor = PURPLE;
		mat.metallic = 0.35;
		mat.roughness = 0.32;
		// Bumped emissive so silhouette reads against dark nav (was 0.45 scale / 0.5 intensity)
		mat.emissiveColor = PURPLE.scale(0.7);
		mat.emissiveIntensity = 0.85;
		mesh.material = mat;

		return mesh;
	}

	// ── Bulbs ─────────────────────────────────────────────────────────────────

	private makeBulbs(): Mesh[] {
		const points = 5;
		const outer = 1.0;
		const inner = 0.42;
		const surfaceY = 0.09; // above star face (depth/2)
		const verts = this.starVertices(points, outer, inner);

		const bulbs: Mesh[] = [];

		// One shared material per category — minimizes draw-call overhead
		const tipMat  = this.makeBulbMat("tipMat",    VIOLET,       2.4, 0.0, 0.35);
		const centerMat = this.makeBulbMat("centerMat", VIOLET,     2.2, 0.0, 0.4);
		const armMat  = this.makeBulbMat("armMat",    VIOLET,       1.2, 0.0, 0.45);
		const diagMat = this.makeBulbMat("diagMat",   WHITE_VIOLET, 1.0, 0.0, 0.3);

		// 5 TIP bulbs — outer vertices (even indices), larger for silhouette anchoring
		for (let i = 0; i < points; i++) {
			const v = verts[i * 2];
			const b = MeshBuilder.CreateSphere(
				`bulb_tip_${i}`,
				{ diameter: 0.18, segments: 12 },
				this.scene,
			);
			b.position = new Vector3(v.x, surfaceY, v.z);
			b.material = tipMat;
			b.metadata = { category: "tip", index: i } satisfies BulbMetadata;
			bulbs.push(b);
		}

		// 1 CENTER bulb — largest single point
		const cb = MeshBuilder.CreateSphere(
			"bulb_center",
			{ diameter: 0.22, segments: 12 },
			this.scene,
		);
		cb.position = new Vector3(0, surfaceY, 0);
		cb.material = centerMat;
		cb.metadata = { category: "center", index: 0 } satisfies BulbMetadata;
		bulbs.push(cb);

		// 5 ARM bulbs — 0.45 along each arm toward tip, decorative/smaller
		const armT = 0.45;
		for (let i = 0; i < points; i++) {
			const v = verts[i * 2];
			const b = MeshBuilder.CreateSphere(
				`bulb_arm_${i}`,
				{ diameter: 0.065, segments: 10 },
				this.scene,
			);
			b.position = new Vector3(v.x * armT, surfaceY, v.z * armT);
			b.material = armMat;
			b.metadata = { category: "arm", index: i } satisfies BulbMetadata;
			bulbs.push(b);
		}

		// 5 DIAGONAL bulbs — inner valley vertices (odd indices), accent only
		for (let i = 0; i < points; i++) {
			const v = verts[i * 2 + 1];
			const b = MeshBuilder.CreateSphere(
				`bulb_diag_${i}`,
				{ diameter: 0.07, segments: 10 },
				this.scene,
			);
			b.position = new Vector3(v.x, surfaceY + 0.02, v.z);
			b.material = diagMat;
			b.metadata = { category: "diagonal", index: i } satisfies BulbMetadata;
			bulbs.push(b);
		}

		return bulbs;
	}

	private makeBulbMat(
		name: string,
		color: Color3,
		emissiveIntensity: number,
		metallic: number,
		roughness: number,
	): PBRMaterial {
		const mat = new PBRMaterial(name, this.scene);
		mat.albedoColor = color;
		mat.emissiveColor = color;
		mat.emissiveIntensity = emissiveIntensity;
		mat.metallic = metallic;
		mat.roughness = roughness;
		return mat;
	}

	private attachBulbLights(): void {
		// One point light per tip bulb + one center — keeps light count low
		this.bulbs
			.filter((b) => (b.metadata as BulbMetadata).category === "tip")
			.forEach((b, i) => {
				const l = new PointLight(`tipLight_${i}`, b.position, this.scene);
				l.diffuse = VIOLET;
				l.specular = VIOLET.scale(0.4);
				l.intensity = 0.35;
				l.range = 1.2;
			});

		const cl = new PointLight("centerLight", Vector3.Zero(), this.scene);
		cl.diffuse = VIOLET;
		cl.specular = VIOLET.scale(0.4);
		cl.intensity = 0.5;
		cl.range = 1.5;
	}

	private attachGlowLayer(): void {
		this.glow = new GlowLayer("glow", this.scene, { mainTextureSamples: 2 });
		// Fixed intensity — nav surface is always dark regardless of page mode
		this.glow.intensity = 1.2;
		// Star body excluded from glow — stays matte
		this.glow.referenceMeshToUseItsOwnMaterial(this.star);
	}

	// ── Per-bulb animation ────────────────────────────────────────────────────
	// Keyframe curve matches liora led-blink stop points:
	//   0%: bright → 28%: hold → 42%: dim → 62%: cold floor → 78%: warming → 100%: bright
	// Phase offset applied as fractional frame start via beginAnimation `from`.
	// Arm scale-shimmer removed — contributed to blob at small CSS size.

	private attachAnimations(): void {
		const fps = 30;
		const ease = new SineEase();
		ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

		for (const bulb of this.bulbs) {
			const meta = bulb.metadata as BulbMetadata;
			const { cycleFrames, minEmissive, maxEmissive } =
				CATEGORY_RHYTHM[meta.category];

			const anim = new Animation(
				`emissive_${bulb.name}`,
				"material.emissiveIntensity",
				fps,
				Animation.ANIMATIONTYPE_FLOAT,
				Animation.ANIMATIONLOOPMODE_CYCLE,
			);

			anim.setKeys([
				{ frame: 0,                                  value: maxEmissive },
				{ frame: Math.round(cycleFrames * 0.28),     value: maxEmissive * 0.95 },
				{ frame: Math.round(cycleFrames * 0.42),     value: maxEmissive * 0.55 },
				{ frame: Math.round(cycleFrames * 0.62),     value: minEmissive },
				{ frame: Math.round(cycleFrames * 0.78),     value: maxEmissive * 0.7 },
				{ frame: cycleFrames,                        value: maxEmissive },
			]);
			anim.setEasingFunction(ease);

			const phaseFraction = PHASE_OFFSETS[meta.category][meta.index] ?? 0;
			const fromFrame = Math.round(phaseFraction * cycleFrames);

			bulb.animations = [anim];
			// beginAnimation(target, from, to, loop) — Babylon.js 9.x
			this.scene.beginAnimation(bulb, fromFrame, cycleFrames + fromFrame, true);
		}

		// Star idle Y-rotation — star body spin is sufficient, no bulb counter-rotation
		if (this.opts.autoRotate) {
			this.scene.registerBeforeRender(() => {
				this.star.rotation.y += 0.003;
			});
		}
	}
}
