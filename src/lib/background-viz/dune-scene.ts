// Legacy entry point — preserved so existing imports from
// src/lib/background-viz/index.ts and src/pages/dune-test/scene.ts keep
// working unchanged. The real implementation lives in src/dune/.
//
// Refactor history (2026-05-02):
//   - 700+ line monolith broken into testable OO components in src/dune/:
//       SceneBootstrap, AnimationController, AudioAdapter,
//       DuneGround, DuneMaterial, Skybox, Atmosphere, dune-colors
//   - 4-phase palette stops hoisted to dune-colors.ts (TS), JS-side mixing
//     replaces per-fragment 4-quadrant weight computation in both shaders
//   - sun wobble + camera breathe amplitudes reduced 30% (spec)
//   - sparkle threshold raised + lavender tint mix bumped (brand violet)
//   - cloud-shadow + fog factor moved to vertex shader
//   - high pow() exponents replaced with squaring-tree polynomial approx
//   - logo-pulse uniform: 24s cycle, sparkle envelope echoes star-logo bulb
//   - ?dune=static query param forces static-cream-fallback path (rollout
//     safety)
//   - reduced-motion gating consolidated in AnimationController + AudioAdapter
//
// External contract is unchanged:
//   mountDuneScene(container)    — wallpaper integration
//   mountDuneSceneOnCanvas(c)    — /dune-test/ standalone page
//   ensureDuneFallback(c)        — brand-palette gradient div, idempotent
//   DuneSceneHandle              — { destroy, resize, getPerfMedian }
//   DuneSceneCanvasHandle        — adds { engine, scene, getLastFrameMs,
//                                          isPerfDegraded }

export {
	type DuneSceneCanvasHandle,
	type DuneSceneHandle,
	ensureDuneFallback,
	mountDuneScene,
	mountDuneSceneOnCanvas,
} from "../../dune/index.js";
