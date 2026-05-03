// Dune ground mesh — subdivided plane the displacement vertex shader chews.
//
// 60×40 with 150 subdivisions: ~22.5k vertices, comfortably within budget on
// integrated GPUs. Subdivision count tuned in the original monolith — going
// lower lets the noise field's smaller octave (wavelength ~2.4u) under-resolve;
// going higher pushes vertex shading past 1ms on the slowest hardware we
// support. Don't change without measuring.

import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";

import {
	DuneMaterial,
	type DuneMaterialOptions,
	type DuneMaterialUpdateContext,
} from "./DuneMaterial.js";

export class DuneGround {
	readonly mesh: Mesh;
	private readonly duneMaterial: DuneMaterial;

	constructor(scene: Scene, options: DuneMaterialOptions = {}) {
		this.mesh = MeshBuilder.CreateGround(
			"dune-ground",
			{ width: 60, height: 40, subdivisions: 150 },
			scene,
		);
		this.duneMaterial = new DuneMaterial(scene, options);
		this.duneMaterial.attach(this.mesh);
	}

	update(context: DuneMaterialUpdateContext): void {
		this.duneMaterial.update(context);
	}

	dispose(): void {
		this.duneMaterial.dispose();
		this.mesh.dispose();
	}
}
