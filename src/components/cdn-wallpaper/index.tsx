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

import { useEffect } from "react";
import { useWallpaperTheme } from "../../hooks/useWallpaperTheme";
import { ElPasoNightsLayer } from "./layers/el-paso-nights";
// GypsumSandsLayer is rendered via the el-paso-nights mount (background-viz/index.ts
// owns the dune-scene lifecycle internally). Import here for future explicit use.
import type { WallpaperTheme } from "../../hooks/useWallpaperTheme";

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
 * Renders null — all visuals are injected imperatively into document.body
 * at z-index: var(--cdn-wallpaper-z-index, -3).
 */
export function CdnWallpaper({ layer: _layer }: CdnWallpaperProps = {}): null {
	// Theme tracking — exposed via useWallpaperTheme for external consumers.
	// The actual theme-switching logic is internal to background-viz/index.ts
	// (MutationObserver on <html> class), so we don't need to act on the value
	// here. The hook is called to keep the subscription alive for any consumer
	// that imports useWallpaperTheme() from this tree.
	useWallpaperTheme();

	// cdn-star-logo registration (decorative enhancement, same lifecycle tier)
	useCdnStarLogo();

	// The el-paso-nights layer owns the full wallpaper lifecycle (both scenes):
	// - dark mode: music-viz + stars
	// - light mode: dune-scene (via tryMountDune() inside background-viz/index.ts)
	// Both are switched internally via MutationObserver on awsui-dark-mode class.
	ElPasoNightsLayer();

	return null;
}

export default CdnWallpaper;
