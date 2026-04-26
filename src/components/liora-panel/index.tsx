// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// React must be a value import — tsconfig jsx:"react" requires it in scope as the JSX factory
import { useEffect } from "react";
import "./styles.css";

interface LioraEmbedModule {
	mountLioraPanel: (assetBase: string) => Promise<void>;
}

function scheduleIdle(fn: () => void): void {
	if ("requestIdleCallback" in window) {
		requestIdleCallback(fn, { timeout: 4000 });
	} else {
		setTimeout(fn, 200);
	}
}

export function LioraPanel() {
	useEffect(() => {
		let cancelled = false;
		let drawerObserver: ResizeObserver | null = null;

		const scriptSrc = import.meta.env.VITE_LIORA_SCRIPT_URL;
		const assetBase = import.meta.env.VITE_LIORA_ASSET_BASE;

		if (!scriptSrc || !assetBase) return;

		// Narrowed consts — safe to capture in nested async closure
		const src = scriptSrc;
		const base = assetBase;

		function doMount() {
			if (cancelled) return;
			void (async () => {
				try {
					const mod = (await import(
						/* @vite-ignore */ src
					)) as LioraEmbedModule;
					if (cancelled) return;
					await mod.mountLioraPanel(base);
				} catch {
					// mount failure — shimmer stays as permanent panel fill
				}
			})();
		}

		function mount() {
			if (cancelled) return;
			// On mobile the Cloudscape nav drawer is collapsed — canvas starts at 0×0.
			// BabylonJS creates a degenerate context when given a zero-size canvas.
			// Defer until the drawer opens and the canvas gets real dimensions.
			const canvas = document.getElementById(
				"liora-canvas",
			) as HTMLCanvasElement | null;
			if (canvas && canvas.clientWidth === 0) {
				drawerObserver = new ResizeObserver(() => {
					if (cancelled) {
						drawerObserver?.disconnect();
						return;
					}
					if (canvas.clientWidth > 0) {
						drawerObserver?.disconnect();
						drawerObserver = null;
						doMount();
					}
				});
				drawerObserver.observe(canvas);
				return;
			}
			doMount();
		}

		if (document.readyState === "complete") {
			scheduleIdle(mount);
		} else {
			window.addEventListener("load", () => scheduleIdle(mount), {
				once: true,
			});
		}

		return () => {
			cancelled = true;
			drawerObserver?.disconnect();
		};
	}, []);

	return (
		<div className="liora-bezel">
			<div className="liora-panel-wrap">
				<div
					id="liora-shimmer"
					className="liora-placeholder"
					aria-hidden="true"
				/>
				<canvas
					id="liora-canvas"
					className="liora-canvas"
					aria-hidden="true"
					tabIndex={-1}
				/>
			</div>
		</div>
	);
}
