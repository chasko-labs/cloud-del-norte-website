// src/dune/ — modular dune scene refactor.
//
// Public API mirrors the legacy src/lib/background-viz/dune-scene.ts:
//   mountDuneScene(container)  — wallpaper integration handle
//   mountDuneSceneOnCanvas(c)  — test-page handle (engine/scene refs)
//   ensureDuneFallback(c)      — brand-palette gradient fallback div
//
// The legacy file at src/lib/background-viz/dune-scene.ts re-exports from
// here so existing imports keep working without churn.

export {
	type DuneSceneCanvasHandle,
	type DuneSceneHandle,
	ensureDuneFallback,
	median,
	mountDuneScene,
	mountDuneSceneOnCanvas,
} from "./SceneBootstrap.js";
