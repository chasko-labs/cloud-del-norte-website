// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// React must be a value import — tsconfig jsx:"react" requires it in scope as the JSX factory
import { useEffect, useMemo, useState } from "react";
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

interface FionaEmbedModule {
	mountFionaPanel: (assetBase: string) => Promise<void>;
}

function scheduleIdle(fn: () => void): void {
	if ("requestIdleCallback" in window) {
		requestIdleCallback(fn, { timeout: 4000 });
	} else {
		setTimeout(fn, 200);
	}
}

export function FionaPanel() {
	const deviceInfo = useMemo(() => buildDeviceInfo(), []);
	// sticky note interaction — tiny by default, zoom + replay handwriting on click.
	// stickyKey forces React to re-mount the element so the clip-path keyframes
	// restart from 0% (cleanest cross-browser way to replay an in-progress animation).
	// during sway (screen-tap-1) or fall (screen-tap-2) the embed's fly-out listener
	// owns the click — this handler bails out so the two paths don't conflict.
	const [stickyZoomed, setStickyZoomed] = useState(false);
	const [stickyKey, setStickyKey] = useState(0);
	const handleStickyToggle = () => {
		// bail if the bezel is in a tap state — embed handles fly-out in that path
		const bezel = document.querySelector(".fiona-bezel");
		if (
			bezel instanceof HTMLElement &&
			(bezel.classList.contains("screen-tap-1") ||
				bezel.classList.contains("screen-tap-2"))
		) {
			return;
		}
		setStickyZoomed((z) => !z);
		setStickyKey((k) => k + 1);
	};

	// Opt-in gate — require user consent before loading the Sumerian scene.
	// Persisted in sessionStorage so the prompt doesn't repeat within a tab
	// session but resets on new tabs.
	const [userConsent, setUserConsent] = useState<"pending" | "yes" | "no">(
		() => {
			const stored = sessionStorage.getItem("cdn-fiona-optin");
			if (stored === "yes") return "yes";
			if (stored === "no") return "no";
			return "pending";
		},
	);

	useEffect(() => {
		// Only mount fiona-embed when user has opted in
		if (userConsent !== "yes") return;

		let cancelled = false;
		let drawerObserver: ResizeObserver | null = null;

		// Use origin-relative URLs at runtime so dev.clouddelnorte.org loads from
		// its own fiona-embed.js rather than the production domain baked into env vars.
		const envSrc = import.meta.env.VITE_FIONA_SCRIPT_URL as string | undefined;
		const envBase = import.meta.env.VITE_FIONA_ASSET_BASE as string | undefined;
		const origin = window.location.origin;
		const src = envSrc
			? envSrc.replace(/^https:\/\/[^/]+/, origin)
			: `${origin}/fiona-embed/fiona-embed.js`;
		const base = envBase
			? envBase.replace(/^https:\/\/[^/]+/, origin)
			: `${origin}/fiona`;

		function doMount() {
			if (cancelled) return;
			void (async () => {
				try {
					const mod = (await import(
						/* @vite-ignore */ src
					)) as FionaEmbedModule;
					if (cancelled) return;
					await mod.mountFionaPanel(base);
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
				"fiona-canvas",
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
	}, [userConsent]);

	return (
		<div className="fiona-frame">
			<div className="fiona-bezel">
				<div className="fiona-panel-wrap">
					{/* Opt-in prompt — require consent before loading scene */}
					{userConsent === "pending" && (
						<div
							id="fiona-shimmer"
							className="fiona-placeholder"
							aria-hidden="true"
						>
							<div className="fiona-optin-prompt">
								<span className="fiona-placeholder-label">
									load Amazon Sumerian scene?
								</span>
								<div className="fiona-optin-actions">
									<button
										type="button"
										className="fiona-optin-btn fiona-optin-btn--yes"
										onClick={() => {
											sessionStorage.setItem("cdn-fiona-optin", "yes");
											setUserConsent("yes");
										}}
									>
										[Y] yes
									</button>
									<button
										type="button"
										className="fiona-optin-btn fiona-optin-btn--no"
										onClick={() => {
											sessionStorage.setItem("cdn-fiona-optin", "no");
											setUserConsent("no");
										}}
									>
										[N] no
									</button>
								</div>
							</div>
						</div>
					)}
					{/* User declined — show static poster fallback */}
					{userConsent === "no" && (
						<div
							id="fiona-shimmer"
							className="fiona-placeholder fiona-placeholder--static"
							role="img"
							aria-label="Fiona avatar - scene declined by user"
						>
							<img
								src="/assets/fiona-poster.webp"
								alt=""
								className="fiona-poster"
								draggable={false}
								onError={(e) => {
									(e.currentTarget as HTMLImageElement).style.display = "none";
								}}
							/>
						</div>
					)}
					{/* Loading shimmer + canvas — only after consent */}
					{userConsent === "yes" && (
						<>
							<div
								id="fiona-shimmer"
								className="fiona-placeholder"
								aria-hidden="true"
							>
								<span className="fiona-placeholder-label">
									modem connecting
									<span className="fiona-block-stream">
										<span className="fiona-block">▓</span>
										<span className="fiona-block">▓</span>
										<span className="fiona-block">▓</span>
									</span>
								</span>
							</div>
							<canvas
								id="fiona-canvas"
								className="fiona-canvas"
								aria-hidden="true"
								tabIndex={-1}
							/>
						</>
					)}
				</div>
				<div
					id="fiona-status-bar"
					className="fiona-status-bar fiona-status--green"
					aria-hidden="true"
				>
					<span id="fiona-device-info">{deviceInfo}</span>
					<span id="fiona-sys-status"> SYS:▓▓▓</span>
				</div>
			</div>
			{/* sticky note — physical-paper note TAPED to the bottom edge of the
			    monitor console, hangs DOWN below the bezel. tiny default, click to
			    zoom + replay handwriting, click again to shrink back.
			    screen click-1: note swings (sway, stays attached).
			    screen click-2: note swings harder then tape rips + falls.
			    clicking the note itself during sway or fall: fly-out 5x zoom
			    (embed-owned; handleStickyToggle bails out during tap states) */}
			{userConsent === "yes" && (
				<button
					key={stickyKey}
					type="button"
					className={`fiona-stickynote${stickyZoomed ? " fiona-stickynote--zoomed" : ""}`}
					onClick={handleStickyToggle}
					aria-label={
						stickyZoomed ? "shrink sticky note" : "zoom into sticky note"
					}
				>
					<span className="fiona-stickynote-line fiona-stickynote-line-1">
						non load
					</span>
					<span className="fiona-stickynote-line fiona-stickynote-line-2">
						bearing
					</span>
					<span className="fiona-stickynote-sig">- ^.^</span>
				</button>
			)}
			{/* scene-over "skip credits" button is appended into the bezel by fiona-embed.ts
			    at credits-time; this frame slot is reserved for future stage chrome */}
		</div>
	);
}
