// el-paso-nights — dark mode wallpaper layer for Cloud Del Norte.
//
// Geographic convention: El Paso TX sits at the northern edge of the Chihuahuan
// desert, directly across from Ciudad Juárez. This layer renders the music-viz +
// star canvas scene: deep navy sky with audio-reactive nebula that the night
// skyline of El Paso deserves. Future dark-mode layers follow this convention:
//   chihuahuan-storm, tularosa-aurora, etc.
//
// Composition (v0.0.0081):
//   - canvas-2D dark starfield (z:-2) — managed imperatively via the
//     background-viz mount in src/lib/background-viz/index.ts
//   - franklin-overlay static SVG silhouette (z:-1) — React component below.
//     Replaces the retired BabylonJS franklin scene.
// The overlay component self-gates on theme via useWallpaperTheme() so it
// returns null in light mode without us doing extra branching here.

import type { ReactElement } from "react";
import { useEffect } from "react";

import { FranklinOverlay } from "../../franklin-overlay";

/** el-paso-nights layer — mounts the canvas-2D background-viz (music-viz + stars)
 *  scene imperatively, AND renders the static Franklin Mountains SVG overlay
 *  on top of it via React. The canvas injects itself directly into document.body
 *  at z-index:-2; the SVG overlay sits at z-index:-1 above it. */
export function ElPasoNightsLayer(): ReactElement {
	useEffect(() => {
		let cleanup: (() => void) | null = null;
		let cancelled = false;

		const idleTask = () => {
			if (cancelled) return;
			void import("../../../lib/background-viz/index").then((mod) => {
				if (cancelled) return;
				cleanup = mod.mount();
			});
		};

		const w = window as unknown as {
			requestIdleCallback?: (
				cb: () => void,
				opts?: { timeout: number },
			) => number;
			cancelIdleCallback?: (h: number) => void;
			setTimeout: (cb: () => void, ms: number) => number;
			clearTimeout: (h: number) => void;
		};

		const usingIdle = typeof w.requestIdleCallback === "function";
		const handle: number = usingIdle
			? (
					w.requestIdleCallback as (
						cb: () => void,
						opts?: { timeout: number },
					) => number
				)(idleTask, { timeout: 2000 })
			: w.setTimeout(idleTask, 200);

		return () => {
			cancelled = true;
			if (usingIdle && typeof w.cancelIdleCallback === "function") {
				w.cancelIdleCallback(handle);
			} else {
				w.clearTimeout(handle);
			}
			cleanup?.();
		};
	}, []);

	return <FranklinOverlay />;
}
