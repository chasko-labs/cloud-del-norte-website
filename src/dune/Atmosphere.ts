// Atmosphere — directional sun + hemispheric fill.
//
// Lambert in the dune fragment shader is what the eye actually reads (it
// uses the sunDir uniform, wobbled per frame). The DirectionalLight here is
// kept for any future material that DOESN'T sample sunDir directly; it stays
// at the constant SUN_DIR_WORLD-derived light vector. Fill light gives a
// warm cream ground-bounce so undersides don't go gray.
//
// Aerial-perspective haze is implemented in DuneMaterial as a horizonTint
// uniform mix; no fog post-process here. Sun-disc + halo are in Skybox.
// This component owns only the fixed-vector lights, so it's small.

import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

import { SUN_DIR_WORLD } from "./AnimationController.js";

export class Atmosphere {
	private readonly sun: DirectionalLight;
	private readonly fill: HemisphericLight;

	constructor(scene: Scene) {
		// DirectionalLight direction is the LIGHT-TRAVEL vector — opposite the
		// "toward sun" sunDir we expose to shaders.
		this.sun = new DirectionalLight(
			"dune-sun",
			new Vector3(-SUN_DIR_WORLD.x, -SUN_DIR_WORLD.y, -SUN_DIR_WORLD.z),
			scene,
		);
		this.sun.intensity = 1.4;
		this.sun.diffuse = new Color3(1.0, 0.97, 0.88);
		this.sun.specular = new Color3(0, 0, 0);

		this.fill = new HemisphericLight("dune-fill", new Vector3(0, 1, 0), scene);
		this.fill.intensity = 0.45;
		this.fill.diffuse = new Color3(0.86, 0.88, 0.92);
		this.fill.groundColor = new Color3(0.97, 0.94, 0.88);
	}

	dispose(): void {
		this.sun.dispose();
		this.fill.dispose();
	}
}
