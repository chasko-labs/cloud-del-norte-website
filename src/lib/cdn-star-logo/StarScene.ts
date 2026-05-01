// Procedural 3D Cloud Del Norte star scene.
// 5-pointed extruded star + 12-bulb ring with per-bulb point lights, glow layer,
// and staggered breathing animation. No external assets — built from VertexData
// and primitives at runtime.

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Animation } from "@babylonjs/core/Animations/animation";
import { SineEase, EasingFunction } from "@babylonjs/core/Animations/easing";

// Brand palette
const VIOLET = new Color3(0.628, 0.392, 0.956); // #A064F4 — bulbs + glow
const PURPLE = new Color3(0.353, 0.122, 0.541); // #5A1F8A — star body
const NAVY = new Color4(0.0, 0.0, 0.165, 1.0); // #00002A — scene clear

export interface StarSceneOptions {
	autoRotate?: boolean;
	bulbCount?: number;
	transparentBackground?: boolean;
}

export class StarScene {
	readonly engine: Engine;
	readonly scene: Scene;
	readonly camera: ArcRotateCamera;
	readonly star: Mesh;
	readonly bulbs: Mesh[];
	private readonly opts: Required<StarSceneOptions>;

	constructor(canvas: HTMLCanvasElement, options: StarSceneOptions = {}) {
		this.opts = {
			autoRotate: options.autoRotate ?? true,
			bulbCount: options.bulbCount ?? 12,
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
		this.bulbs = this.makeBulbRing();
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

	// ── Scene composition ────────────────────────────────────────────────

	private makeCamera(canvas: HTMLCanvasElement): ArcRotateCamera {
		const cam = new ArcRotateCamera(
			"cam",
			-Math.PI / 2, // alpha — face front
			Math.PI / 2.1, // beta — slight downward tilt
			4.2, // radius
			Vector3.Zero(),
			this.scene,
		);
		cam.lowerRadiusLimit = 2.5;
		cam.upperRadiusLimit = 8;
		cam.wheelDeltaPercentage = 0.01;
		cam.attachControl(canvas, true);
		return cam;
	}

	private makeAmbient(): void {
		const hemi = new HemisphericLight(
			"hemi",
			new Vector3(0, 1, 0),
			this.scene,
		);
		hemi.intensity = 0.35;
		hemi.diffuse = new Color3(0.7, 0.6, 0.95);
		hemi.groundColor = new Color3(0.2, 0.1, 0.3);
	}

	private makeStar(): Mesh {
		const points = 5;
		const outer = 1.0;
		const inner = 0.42;
		const depth = 0.18;

		const positions: number[] = [];
		const indices: number[] = [];

		// 0: front center, 1: back center
		positions.push(0, depth / 2, 0);
		positions.push(0, -depth / 2, 0);

		// Front ring (indices 2..2+10) and back ring (indices 12..12+10)
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

		// Front face — fan from center
		for (let i = 0; i < ringLen; i++) {
			const a = frontStart + i;
			const b = frontStart + ((i + 1) % ringLen);
			indices.push(0, a, b);
		}
		// Back face — fan from center, reverse winding
		for (let i = 0; i < ringLen; i++) {
			const a = backStart + i;
			const b = backStart + ((i + 1) % ringLen);
			indices.push(1, b, a);
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
		mat.emissiveColor = PURPLE.scale(0.45);
		mat.emissiveIntensity = 0.5;
		mesh.material = mat;

		return mesh;
	}

	private makeBulbRing(): Mesh[] {
		const radius = 1.32;
		const bulbs: Mesh[] = [];
		const mat = new PBRMaterial("bulbMat", this.scene);
		mat.albedoColor = VIOLET;
		mat.emissiveColor = VIOLET;
		mat.emissiveIntensity = 2.4;
		mat.metallic = 0.0;
		mat.roughness = 0.35;

		for (let i = 0; i < this.opts.bulbCount; i++) {
			const angle = (i / this.opts.bulbCount) * Math.PI * 2 - Math.PI / 2;
			const bulb = MeshBuilder.CreateSphere(
				`bulb_${i}`,
				{ diameter: 0.16, segments: 16 },
				this.scene,
			);
			bulb.position = new Vector3(
				Math.cos(angle) * radius,
				0,
				Math.sin(angle) * radius,
			);
			bulb.material = mat;
			bulbs.push(bulb);
		}
		return bulbs;
	}

	private attachBulbLights(): void {
		this.bulbs.forEach((bulb, i) => {
			const light = new PointLight(`bulbLight_${i}`, bulb.position, this.scene);
			light.diffuse = VIOLET;
			light.specular = VIOLET.scale(0.5);
			light.intensity = 0.45;
			light.range = 1.4;
		});
	}

	private attachGlowLayer(): void {
		const glow = new GlowLayer("glow", this.scene, { mainTextureSamples: 2 });
		glow.intensity = 1.5;
		// Only the bulbs contribute to glow; star body stays matte
		glow.referenceMeshToUseItsOwnMaterial(this.star);
	}

	private attachAnimations(): void {
		// Bulb pulse — staggered 30 frame cycle, each bulb offset by (i / count) * 30
		const fps = 30;
		const cycleFrames = 60;
		const ease = new SineEase();
		ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

		this.bulbs.forEach((bulb, i) => {
			const baseScale = bulb.scaling.clone();
			const peak = baseScale.scale(1.4);

			const scaleAnim = new Animation(
				`pulse_${i}`,
				"scaling",
				fps,
				Animation.ANIMATIONTYPE_VECTOR3,
				Animation.ANIMATIONLOOPMODE_CYCLE,
			);
			scaleAnim.setKeys([
				{ frame: 0, value: baseScale },
				{ frame: cycleFrames / 2, value: peak },
				{ frame: cycleFrames, value: baseScale },
			]);
			scaleAnim.setEasingFunction(ease);

			// Per-bulb stagger via per-bulb starting frame offset
			const offsetFrame =
				(i / this.opts.bulbCount) * cycleFrames;
			bulb.animations = [scaleAnim];
			this.scene.beginAnimation(bulb, offsetFrame, cycleFrames + offsetFrame, true);
		});

		// Star idle rotation — slow Y spin
		if (this.opts.autoRotate) {
			this.scene.registerBeforeRender(() => {
				this.star.rotation.y += 0.003;
				// Bulb ring counter-rotates slightly for visual depth
				this.bulbs.forEach((bulb) => {
					const p = bulb.position;
					const angle = Math.atan2(p.z, p.x);
					const r = Math.sqrt(p.x * p.x + p.z * p.z);
					const next = angle - 0.0015;
					bulb.position.x = Math.cos(next) * r;
					bulb.position.z = Math.sin(next) * r;
				});
			});
		}
	}
}
