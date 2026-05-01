// gypsum-sands — light mode wallpaper layer for Cloud Del Norte.
//
// Geographic convention: White Sands National Monument is a gypsum dune field
// in Otero County, NM — about 80 miles north of El Paso. The blinding white
// gypsum dunes at midday are the visual anchor for this layer. Future light-mode
// layers follow the same NM geography:
//   organ-mountains-dawn, tularosa-aurora, etc.
//
// This is a structural refactor only — the rendered output is identical to the
// existing dune-scene mount in src/lib/background-viz/index.ts. The original
// files (background-viz/index.ts, dune-scene.ts) are preserved so other
// consumers can still import them directly. <CdnWallpaper> is now the canonical
// lifecycle owner for shell contexts.
//
// The BabylonJS dune scene creates its own <canvas> inside document.body at
// z-index:-2. This component does not render any DOM — it delegates entirely to
// the imperative mount API in background-viz/index.ts, which handles:
//   - software rendering detection
//   - perf gate (16ms budget, 2s + 6s two-stage)
//   - prefers-reduced-motion
//   - cream/lavender fallback gradient
//   - theme MutationObserver (handled by CdnWallpaper root instead here)

// Returns null — all rendering happens via the imperative API.
export function GypsumSandsLayer(): null {
	// No lifecycle needed here — CdnWallpaper root owns the background-viz mount
	// (el-paso-nights) and the dune scene is driven by background-viz/index.ts
	// internally via the tryMountDune() call inside mount(). The theme observer
	// in background-viz/index.ts switches between the two scenes.
	//
	// This file exists as the named layer entry point so the CdnWallpaper layer
	// registry can reference it by name for future extension (analytics events,
	// layer-specific config props, etc.) without coupling to an array index.
	return null;
}
