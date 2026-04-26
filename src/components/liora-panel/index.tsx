// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// React must be a value import — tsconfig jsx:"react" requires it in scope as the JSX factory
import { useEffect, useMemo } from "react";
import "./styles.css";

function buildDeviceInfo(): string {
	const ua = navigator.userAgent;
	const isAndroid = /android/i.test(ua);
	const isIPhone = /iphone/i.test(ua);
	const isIPad =
		/ipad/i.test(ua) || (/macintosh/i.test(ua) && "ontouchend" in document);

	let os: string;
	if (isAndroid) os = "android";
	else if (isIPhone) os = "ios";
	else if (isIPad) os = "ipados";
	else if (/windows/i.test(ua)) os = "windows";
	else if (/mac os x/i.test(ua)) os = "macos";
	else os = "linux";

	const w = window.screen.width;
	const h = window.screen.height;

	return `os:${os}  ${w}×${h}`;
}

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
	const deviceInfo = useMemo(() => buildDeviceInfo(), []);

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
		<div className="liora-frame">
			<div className="liora-bezel">
				<div className="liora-panel-wrap">
					<div
						id="liora-shimmer"
						className="liora-placeholder"
						aria-hidden="true"
					>
						<span className="liora-placeholder-label">
							modem connecting
							<span className="liora-block-stream">
								<span className="liora-block">▓</span>
								<span className="liora-block">▓</span>
								<span className="liora-block">▓</span>
							</span>
						</span>
					</div>
					<canvas
						id="liora-canvas"
						className="liora-canvas"
						aria-hidden="true"
						tabIndex={-1}
					/>
				</div>
				{/* sticky note — physical-paper warning taped to the bezel chrome
				    above the screen, dangling onto the panel. tap-1 sways the note;
				    tap-2 rips the tape and the note falls off and disappears */}
				<div className="liora-stickynote" aria-hidden="true">
					<span className="liora-stickynote-line">not load bearing</span>
					<span className="liora-stickynote-sig">- ^.^</span>
				</div>
				<div
					id="liora-status-bar"
					className="liora-status-bar liora-status--green"
					aria-hidden="true"
				>
					<span id="liora-device-info">{deviceInfo}</span>
					<span id="liora-sys-status"> SYS:▓▓▓</span>
				</div>
			</div>
			{/* scene-over "skip credits" button is appended into the bezel by liora-embed.ts
			    at credits-time; this frame slot is reserved for future stage chrome */}
		</div>
	);
}
