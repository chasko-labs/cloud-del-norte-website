// CdnWallpaper — root component of the CdnWallpaper Suite.
//
// The suite is a Cloudscape extension package — like AppLayout, but for
// animated wallpaper backgrounds. Multiple geographic scenes plug in as "layers".
//
// Layer registry (name-keyed):
//   gypsum-sands   — light mode. White Sands NM dune scene (BabylonJS).
//   el-paso-nights — dark mode. Music-viz + stars canvas (Canvas 2D).
//
// Future layers: chihuahuan-storm, tularosa-aurora, etc. All follow the
// Cloud Del Norte geographic convention (NM / El Paso TX north-border region).
//
// Lifecycle:
//   - mounts on parent mount
//   - disposes on unmount
//   - theme switching is handled internally by background-viz/index.ts via
//     MutationObserver on <html> class (awsui-dark-mode)
//   - respects prefers-reduced-motion (delegated to each layer)
//
// Shell renders <CdnWallpaper /> at the top of the tree. No other component
// should import background-viz/index.ts for wallpaper lifecycle purposes.

import type { ReactElement } from "react";
import { useEffect } from "react";
// GypsumSandsLayer is rendered via the el-paso-nights mount (background-viz/index.ts
// owns the dune-scene lifecycle internally). Import here for future explicit use.
import type { WallpaperTheme } from "../../hooks/useWallpaperTheme";
import { useWallpaperTheme } from "../../hooks/useWallpaperTheme";
import { ElPasoNightsLayer } from "./layers/el-paso-nights";

export type { WallpaperTheme };

// cdn-star-logo custom element registration — kept here alongside wallpaper
// because both are decorative enhancement layers owned by the shell.
function useCdnStarLogo(): void {
	useEffect(() => {
		let imported = false;
		const tryImport = () => {
			if (imported) return;
			if (!document.querySelector("cdn-star-logo")) return;
			imported = true;
			void import("../../lib/cdn-star-logo/index").catch(() => {
				// fallback: inline SVG stays visible — no action needed
			});
		};
		tryImport();
		if (imported) return;
		const obs = new MutationObserver(tryImport);
		obs.observe(document.body, { childList: true, subtree: true });
		return () => obs.disconnect();
	}, []);
}

export interface CdnWallpaperProps {
	/** Override layer selection — defaults to theme-driven auto-select */
	layer?: WallpaperTheme;
}

/**
 * CdnWallpaper — mounts the active wallpaper layer based on theme.
 * The canvas-2D + babylon scenes inject themselves imperatively into
 * document.body. The Franklin Mountains static SVG overlay (v0.0.0081+) is
 * a React node returned by ElPasoNightsLayer and renders inline here.
 */
export function CdnWallpaper({
	layer: _layer,
}: CdnWallpaperProps = {}): ReactElement {
	// Theme tracking — exposed via useWallpaperTheme for external consumers.
	// The actual theme-switching logic is internal to background-viz/index.ts
	// (MutationObserver on <html> class), so we don't need to act on the value
	// here. The hook is called to keep the subscription alive for any consumer
	// that imports useWallpaperTheme() from this tree.
	useWallpaperTheme();

	// cdn-star-logo registration (decorative enhancement, same lifecycle tier)
	useCdnStarLogo();

	// The el-paso-nights layer owns the full wallpaper lifecycle:
	// - imperative: music-viz + stars canvas (always-on); dune-scene swap
	//   via tryMountDune() inside background-viz/index.ts
	// - React: static Franklin Mountains SVG overlay (dark mode only — the
	//   component self-gates on theme via useWallpaperTheme).
	return <ElPasoNightsLayer />;
}

export default CdnWallpaper;
