// Test-page entry — delegates to the shared dune-scene module under
// src/lib/background-viz/. Kept as a thin shim so /dune-test/main.ts and the
// wallpaper integration share a single source of shader, sky, lighting, and
// perf instrumentation. See src/lib/background-viz/dune-scene.ts.

export {
	type DuneSceneCanvasHandle as DuneSceneHandle,
	mountDuneSceneOnCanvas as mountDuneScene,
} from "../../lib/background-viz/dune-scene";
