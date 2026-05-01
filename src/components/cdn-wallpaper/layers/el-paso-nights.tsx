// el-paso-nights — dark mode wallpaper layer for Cloud Del Norte.
//
// Geographic convention: El Paso TX sits at the northern edge of the Chihuahuan
// desert, directly across from Ciudad Juárez. This layer renders the music-viz +
// star canvas scene: deep navy sky with audio-reactive nebula that the night
// skyline of El Paso deserves. Future dark-mode layers follow this convention:
//   chihuahuan-storm, tularosa-aurora, etc.
//
// This is a structural refactor only — the rendered output is identical to the
// existing background-viz mount in shell/index.tsx. The original
// src/lib/background-viz/index.ts is preserved so other consumers can still
// import it directly. <CdnWallpaper> is now the canonical lifecycle owner for
// shell contexts.

import { useEffect } from "react";

/** el-paso-nights layer — mounts the existing background-viz (music-viz + stars)
 *  canvas. Returns null — the canvas injects itself directly into document.body
 *  at z-index:-1, matching the prior shell/index.tsx behaviour exactly. */
export function ElPasoNightsLayer(): null {
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

	return null;
}
