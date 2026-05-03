// src/franklin/ — Franklin Mountains dark-mode wallpaper module.
//
// Mirrors src/dune/ for symmetry. Public API:
//   mountFranklinScene(container)         — wallpaper integration
//   mountFranklinSceneOnCanvas(canvas)    — standalone test-page mount
//
// Architecture: the franklin scene AUGMENTS the existing canvas-2D dark
// layer rather than replacing it. The 2D layer paints stars + nebula at
// z:-2; the franklin canvas at z:-1 with alpha:true draws the mountain
// silhouette, on-mountain pulsing stars (trippy mode only), and the always-
// lit El Paso "Star on the Mountain". The silhouette occludes the back-
// plane stars to give the negative-space effect Bryan asked for.

export {
	type FranklinSceneCanvasHandle,
	type FranklinSceneHandle,
	median,
	mountFranklinScene,
	mountFranklinSceneOnCanvas,
} from "./SceneBootstrap.js";
