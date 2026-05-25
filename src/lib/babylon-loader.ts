// Shared deep-import loader for ambient Babylon scenes.
// Replaces `await import("@babylonjs/core")` (bare barrel) with deep
// imports so the bundler can tree-shake and split into manualChunks.

import "@babylonjs/core/Animations/animatable.js";

import { Animation } from "@babylonjs/core/Animations/animation";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";

export interface BabylonCommon {
	Engine: typeof Engine;
	Scene: typeof Scene;
	Color3: typeof Color3;
	Color4: typeof Color4;
	Vector3: typeof Vector3;
	ArcRotateCamera: typeof ArcRotateCamera;
	HemisphericLight: typeof HemisphericLight;
	DirectionalLight: typeof DirectionalLight;
	MeshBuilder: typeof MeshBuilder;
	StandardMaterial: typeof StandardMaterial;
	Texture: typeof Texture;
	Animation: typeof Animation;
}

export async function loadBabylonCommon(): Promise<BabylonCommon> {
	return {
		Engine,
		Scene,
		Color3,
		Color4,
		Vector3,
		ArcRotateCamera,
		HemisphericLight,
		DirectionalLight,
		MeshBuilder,
		StandardMaterial,
		Texture,
		Animation,
	};
}
