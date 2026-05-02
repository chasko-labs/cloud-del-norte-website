// Procedural 3D Cloud Del Norte star scene.
// 5-pointed extruded star + 6 bulbs: 5 tips + 1 steady center.
// Arm and diagonal bulbs removed — they contributed to blob at nav thumbnail size.
//
// 3D renders only when host element is >=200px (container query in styles.css).
// At nav size (60-80px) the SVG underneath is the visible logo.
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

import { Animation } from "@babylonjs/core/Animations/animation";
import { EasingFunction, SineEase } from "@babylonjs/core/Animations/easing";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";

// ── Brand palette (nav-surface — always dark) ─────────────────────────────────

const VIOLET = new Color3(0.628, 0.392, 0.956); // #A064F4 — bulbs + glow
const PURPLE = new Color3(0.353, 0.122, 0.541); // #5A1F8A — star body
const NAVY = new Color4(0.0, 0.0, 0.165, 1.0); // #00002A — scene clear
// WHITE_VIOLET removed with diagonal bulbs

// ── Types ─────────────────────────────────────────────────────────────────────

export type BulbCategory = "tip" | "center";

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
	// Tip: primary visual anchors — slow heartbeat, dimmer max so glow never blows out silhouette
	tip: { cycleFrames: 140, minEmissive: 0.3, maxEmissive: 1.6 },
	// Center: steady — min == max, no pulse
	center: { cycleFrames: 100, minEmissive: 1.0, maxEmissive: 1.0 },
};

// Per-category phase offsets as fractions of cycle (mirrors liora nth-child delays)
const PHASE_OFFSETS: Record<BulbCategory, number[]> = {
	tip: [0.0, 0.18, 0.4, 0.6, 0.8],
	center: [0.0],
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
		// Default FOV — telephoto was a bandaid for unreadable silhouette at small size
		cam.fov = 0.8;
		cam.attachControl(canvas, true);
		return cam;
	}

	// ── Lighting ──────────────────────────────────────────────────────────────

	private makeAmbient(): void {
		const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
		hemi.intensity = 0.35;
		hemi.diffuse = new Color3(0.7, 0.6, 0.95);
		hemi.groundColor = new Color3(0.2, 0.1, 0.3);
		// Rim DirectionalLight removed — hemi alone is sufficient at >=200px render size
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
		const tipMat = this.makeBulbMat("tipMat", VIOLET, 1.6, 0.0, 0.35);
		const centerMat = this.makeBulbMat("centerMat", VIOLET, 1.0, 0.0, 0.4);
		// armMat + diagMat removed with arm/diagonal bulb loops

		// 5 TIP bulbs — outer vertices (even indices), smaller so star points show through
		for (let i = 0; i < points; i++) {
			const v = verts[i * 2];
			const b = MeshBuilder.CreateSphere(
				`bulb_tip_${i}`,
				{ diameter: 0.12, segments: 12 },
				this.scene,
			);
			b.position = new Vector3(v.x, surfaceY, v.z);
			b.material = tipMat;
			b.metadata = { category: "tip", index: i } satisfies BulbMetadata;
			bulbs.push(b);
		}

		// 1 CENTER bulb — steady, no pulse (min==max in CATEGORY_RHYTHM)
		const cb = MeshBuilder.CreateSphere(
			"bulb_center",
			{ diameter: 0.15, segments: 12 },
			this.scene,
		);
		cb.position = new Vector3(0, surfaceY, 0);
		cb.material = centerMat;
		cb.metadata = { category: "center", index: 0 } satisfies BulbMetadata;
		bulbs.push(cb);

		// Arm bulbs (5) and diagonal bulbs (5) removed — contributed to blob at small size

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
		// Reduced from 1.2 — fewer emitters means less bloom needed to read
		this.glow.intensity = 0.6;
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
				{ frame: 0, value: maxEmissive },
				{ frame: Math.round(cycleFrames * 0.28), value: maxEmissive * 0.95 },
				{ frame: Math.round(cycleFrames * 0.42), value: maxEmissive * 0.55 },
				{ frame: Math.round(cycleFrames * 0.62), value: minEmissive },
				{ frame: Math.round(cycleFrames * 0.78), value: maxEmissive * 0.7 },
				{ frame: cycleFrames, value: maxEmissive },
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
