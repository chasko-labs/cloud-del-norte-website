import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import {
	type DeviceTier,
	getDeviceDiagnostics,
	getDeviceTier,
	prefersReducedMotion,
} from "../../lib/device-capabilities";
import { loadVisitorInfo, type VisitorInfo } from "../../utils/visitor";
import BabylonGate from "../babylon-gate";
import "../navigation/fiona.css";

// Wave 53/86 — minimum tier required for the fiona end-credit canvas.
// Mirrors the BabylonGate `tier` prop below; declared once so the timeout
// branch and the gate stay in lockstep.
const FIONA_REQUIRED_TIER: DeviceTier = "medium";

// Issue #382 — when the device tier is below the required tier the canvas
// never mounts and `#fiona-shimmer` runs its CRT animations forever. After
// this many milliseconds, replace the shimmer with a static avatar poster so
// the placeholder stops claiming "still loading" forever.
const GATE_FALLBACK_DELAY_MS = 4000;
const TIER_RANK: Record<DeviceTier, number> = { high: 2, medium: 1, low: 0 };

function withFallback(value: string, key: string, fallback: string): string {
	return value === key ? fallback : value;
}

function getTimeOfDayGreeting(locale: "us" | "mx"): string {
	const hour = new Date().getHours();
	if (locale === "mx") {
		if (hour >= 5 && hour < 12) return "buenos días";
		if (hour >= 12 && hour < 19) return "buenas tardes";
		return "buenas noches";
	}
	if (hour >= 5 && hour < 12) return "good morning";
	if (hour >= 12 && hour < 17) return "good afternoon";
	if (hour >= 17 && hour < 21) return "good evening";
	return "good night";
}

function detectDeviceInfo(): string {
	if (typeof navigator === "undefined") return "";
	const ua = navigator.userAgent;
	let os = "linux";
	if (/android/i.test(ua)) os = "android";
	else if (/iphone/i.test(ua)) os = "ios";
	else if (
		/ipad/i.test(ua) ||
		(/macintosh/i.test(ua) && "ontouchend" in document)
	)
		os = "ipados";
	else if (/windows/i.test(ua)) os = "windows";
	else if (/mac os x/i.test(ua)) os = "macos";
	const w = window.screen.width;
	const h = window.screen.height;
	return `os:${os}  ${w}×${h}`;
}

function scheduleIdle(fn: () => void): void {
	if ("requestIdleCallback" in window) {
		requestIdleCallback(fn, { timeout: 4000 });
	} else {
		setTimeout(fn, 200);
	}
}

const GREETING_BY_COUNTRY: Record<string, string> = {
	MX: "bienvenido",
	ES: "bienvenido",
	AR: "bienvenido",
	CL: "bienvenido",
	CO: "bienvenido",
	PE: "bienvenido",
	VE: "bienvenido",
	BR: "olá",
	FR: "bonjour",
	DE: "hallo",
	IT: "ciao",
	NL: "hallo",
	RU: "privyet",
	UA: "pryvit",
	TR: "merhaba",
	IL: "shalom",
	JP: "konnichiwa",
	KR: "annyeong",
	CN: "ni hao",
	TH: "sawasdee",
	IN: "namaste",
	PK: "salaam",
	SA: "salaam",
	AE: "salaam",
	EG: "salaam",
	GR: "yassas",
};

export default function FionaFrame() {
	const { t, locale } = useTranslation();
	const deviceInfo = useMemo(() => detectDeviceInfo(), []);
	const [stickyZoomed, setStickyZoomed] = useState(false);
	const [stickyKey, setStickyKey] = useState(0);
	const [sticky2Fallen, _setSticky2Fallen] = useState(false);
	const [sticky2Zoomed, setSticky2Zoomed] = useState(false);
	const [visitor, setVisitor] = useState<VisitorInfo | null>(null);

	// Wave 86 / issue #382 — capture the gate decision in component state so we
	// can drive the timeout + static-fallback UX from the same render path that
	// BabylonGate uses to decide canvas insertion.
	const gatedOut = useMemo(
		() => TIER_RANK[getDeviceTier()] < TIER_RANK[FIONA_REQUIRED_TIER],
		[],
	);

	// Opt-in gate — ask user before loading the Sumerian scene. Persisted in
	// localStorage so repeat visitors skip the prompt. Device-tier gate takes
	// priority: low-tier devices never see the prompt (they get the poster).
	const [userConsent, setUserConsent] = useState<"pending" | "yes" | "no">(
		() => {
			if (gatedOut) return "no";
			const stored = localStorage.getItem("cdn-fiona-optin");
			return stored === "yes" ? "yes" : stored === "no" ? "no" : "pending";
		},
	);
	const [gatedFallback, setGatedFallback] = useState(false);
	const diagnosticLoggedRef = useRef(false);

	const countryCode = visitor?.country ?? "";
	const greetingPrefix =
		locale === "mx"
			? withFallback(
					t("fiona.welcomeGreeting"),
					"fiona.welcomeGreeting",
					"qué onda",
				)
			: (GREETING_BY_COUNTRY[countryCode] ??
				withFallback(
					t("fiona.welcomeGreeting"),
					"fiona.welcomeGreeting",
					"welcome",
				));

	useEffect(() => {
		let cancelled = false;
		void loadVisitorInfo().then((info) => {
			if (!cancelled) setVisitor(info);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// Issue #382 — gated-out devices: log diagnostic ONCE. Then either swap
	// the shimmer immediately (reduce-motion users explicitly asked for no
	// animation — the shimmer's background drift + label pulse violate that)
	// or after GATE_FALLBACK_DELAY_MS for everyone else.
	useEffect(() => {
		if (!gatedOut) return;
		let reducedMotion = false;
		try {
			reducedMotion = prefersReducedMotion();
		} catch {
			/* matchMedia unavailable — default to non-reduced */
		}
		if (!diagnosticLoggedRef.current) {
			diagnosticLoggedRef.current = true;
			try {
				const d = getDeviceDiagnostics();
				console.log("[fiona-gate] tier=low", {
					reducedMotion: d.reducedMotion,
					softwareWebGL: d.softwareWebGL,
					lowMemory: d.lowMemory,
					fewCores: d.fewCores,
					renderer: d.renderer,
					deviceMemory: d.deviceMemory,
					hardwareConcurrency: d.hardwareConcurrency,
				});
			} catch {
				/* never let diagnostics break rendering */
			}
		}
		if (reducedMotion) {
			setGatedFallback(true);
			return;
		}
		const timer = window.setTimeout(() => {
			setGatedFallback(true);
		}, GATE_FALLBACK_DELAY_MS);
		return () => {
			window.clearTimeout(timer);
		};
	}, [gatedOut]);

	useEffect(() => {
		// Only mount fiona-embed when user has opted in
		if (userConsent !== "yes") return;

		let cancelled = false;
		let observer: ResizeObserver | null = null;

		async function mount() {
			if (cancelled) return;
			const canvasEl = document.getElementById("fiona-canvas");
			// BabylonGate (tier="medium") renders null on low-tier devices (software WebGL,
			// prefers-reduced-motion, low-mem+low-core). When that happens, the canvas is
			// never in the DOM — leave the #fiona-shimmer "modem connecting" placeholder
			// visible (it will be swapped to a static poster after GATE_FALLBACK_DELAY_MS
			// by the gated-fallback effect above) instead of mounting fiona-embed.
			if (!canvasEl) return;
			canvasEl.style.opacity = "0";
			if (canvasEl.dataset.fionaMounted === "1") return;
			canvasEl.setAttribute("data-fiona-mounted", "1");
			try {
				const origin = window.location.origin;
				const envSrc = import.meta.env.VITE_FIONA_SCRIPT_URL as
					| string
					| undefined;
				const envBase = import.meta.env.VITE_FIONA_ASSET_BASE as
					| string
					| undefined;
				const src = envSrc
					? envSrc.replace(/^https:\/\/[^/]+/, origin)
					: `${origin}/fiona-embed/fiona-embed.js`;
				const base = envBase
					? envBase.replace(/^https:\/\/[^/]+/, origin)
					: `${origin}/fiona`;
				const mod = (await import(/* @vite-ignore */ src)) as {
					mountFionaPanel: (base: string) => Promise<void>;
				};
				if (cancelled) return;
				await mod.mountFionaPanel(base);
				const shimmer = document.getElementById("fiona-shimmer");
				if (shimmer) shimmer.style.display = "none";
				const canvasEl2 = document.getElementById("fiona-canvas");
				if (canvasEl2) canvasEl2.style.opacity = "1";
			} catch (err) {
				console.warn("[fiona-frame] mount failed:", err);
				canvasEl?.removeAttribute("data-fiona-mounted");
			}
		}

		function tryMount() {
			if (cancelled) return;
			const canvas = document.getElementById(
				"fiona-canvas",
			) as HTMLCanvasElement | null;
			// Canvas absent => BabylonGate gated it out. Keep shimmer visible; don't try to mount.
			if (!canvas) return;
			if (canvas.clientWidth === 0) {
				observer = new ResizeObserver(() => {
					if (cancelled) {
						observer?.disconnect();
						return;
					}
					if ((canvas as HTMLCanvasElement).clientWidth > 0) {
						observer?.disconnect();
						observer = null;
						void mount();
					}
				});
				observer.observe(canvas);
				return;
			}
			void mount();
		}

		if (document.readyState === "complete") {
			scheduleIdle(tryMount);
		} else {
			window.addEventListener("load", () => scheduleIdle(tryMount), {
				once: true,
			});
		}

		return () => {
			cancelled = true;
			observer?.disconnect();
		};
	}, [userConsent]);

	return (
		<div className="fiona-frame">
			<div className="fiona-bezel">
				<div className="fiona-panel-wrap">
					{/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role+aria-label are co-conditional on gatedFallback */}
					<div
						id="fiona-shimmer"
						className={`fiona-placeholder${gatedFallback || userConsent === "no" ? " fiona-placeholder--static" : ""}`}
						aria-hidden={
							gatedFallback || userConsent === "no" ? undefined : true
						}
						role={gatedFallback || userConsent === "no" ? "img" : undefined}
						aria-label={
							gatedFallback || userConsent === "no"
								? "Fiona avatar - 3D view unavailable on this device"
								: undefined
						}
					>
						{gatedFallback || userConsent === "no" ? (
							<>
								<img
									src="/assets/fiona-poster.webp"
									alt=""
									className="fiona-poster"
									draggable={false}
									onError={(e) => {
										// Asset 404? Hide the broken image — the green-phosphor
										// background of .fiona-placeholder--static still reads as
										// 'CRT off' and the aria-label still labels the region.
										(e.currentTarget as HTMLImageElement).style.display =
											"none";
									}}
								/>
								{userConsent === "no" && !gatedOut && (
									<button
										type="button"
										className="fiona-wakeup-link"
										onClick={() => {
											localStorage.removeItem("cdn-fiona-optin");
											setUserConsent("pending");
										}}
									>
										wake up?
									</button>
								)}
							</>
						) : userConsent === "pending" ? (
							<div className="fiona-optin-prompt">
								<span className="fiona-placeholder-label">
									{withFallback(
										t("fiona.optinPrompt"),
										"fiona.optinPrompt",
										"load Amazon Sumerian demo?",
									)}
								</span>
								<div className="fiona-optin-actions">
									<button
										type="button"
										className="fiona-optin-btn fiona-optin-btn--yes"
										onClick={() => {
											localStorage.setItem("cdn-fiona-optin", "yes");
											setUserConsent("yes");
										}}
									>
										{withFallback(
											t("fiona.optinYes"),
											"fiona.optinYes",
											"[Y] yes",
										)}
									</button>
									<button
										type="button"
										className="fiona-optin-btn fiona-optin-btn--no"
										onClick={() => {
											localStorage.setItem("cdn-fiona-optin", "no");
											setUserConsent("no");
										}}
									>
										{withFallback(
											t("fiona.optinNo"),
											"fiona.optinNo",
											"[N] no",
										)}
									</button>
								</div>
							</div>
						) : (
							<span className="fiona-placeholder-label">
								modem connecting
								<span className="fiona-block-stream">
									<span className="fiona-block">▓</span>
									<span className="fiona-block">▓</span>
									<span className="fiona-block">▓</span>
								</span>
							</span>
						)}
					</div>
					{/* Wave 53: gate the Babylon end-credit canvas behind device tier ≥ medium */}
					{userConsent === "yes" && (
						<BabylonGate tier={FIONA_REQUIRED_TIER} fallback={null}>
							<canvas
								id="fiona-canvas"
								className="fiona-canvas"
								aria-hidden="true"
								tabIndex={-1}
							/>
						</BabylonGate>
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
			<div className="fiona-notes-row">
				<button
					key={stickyKey}
					type="button"
					className={`fiona-stickynote${stickyZoomed ? " fiona-stickynote--zoomed" : ""}`}
					onClick={() => {
						const bezel = document.querySelector(".fiona-bezel");
						if (
							bezel instanceof HTMLElement &&
							(bezel.classList.contains("screen-tap-1") ||
								bezel.classList.contains("screen-tap-2"))
						)
							return;
						setStickyZoomed((v) => !v);
						setStickyKey((k) => k + 1);
					}}
					aria-expanded={stickyZoomed}
					aria-label={
						stickyZoomed ? "shrink sticky note" : "zoom into sticky note"
					}
				>
					<span className="fiona-stickynote-line fiona-stickynote-line-1">
						{withFallback(
							t("fiona.stickynoteLine1"),
							"fiona.stickynoteLine1",
							locale === "mx" ? "no aguanta" : "non load",
						)}
					</span>
					<span className="fiona-stickynote-line fiona-stickynote-line-2">
						{withFallback(
							t("fiona.stickynoteLine2"),
							"fiona.stickynoteLine2",
							locale === "mx" ? "nada" : "bearing",
						)}
					</span>
					<span className="fiona-stickynote-sig">- ^.^</span>
				</button>
				<button
					type="button"
					className={`fiona-stickynote-2${sticky2Fallen ? " fiona-stickynote-2--fallen" : ""}${sticky2Zoomed ? " fiona-stickynote-2--zoomed" : ""}`}
					aria-expanded={sticky2Zoomed}
					aria-label={
						visitor
							? `${sticky2Zoomed ? getTimeOfDayGreeting(locale) : greetingPrefix}, ${visitor.greeting}.`
							: greetingPrefix
					}
					onClick={() => {
						if (stickyZoomed) return;
						setSticky2Zoomed((v) => !v);
					}}
				>
					<span className="fiona-stickynote-2-line">
						{sticky2Zoomed ? getTimeOfDayGreeting(locale) : greetingPrefix},{" "}
						{visitor?.greeting ?? ""}
					</span>
					{visitor?.flag ? (
						<span className="fiona-stickynote-2-flag" aria-hidden="true">
							{visitor.flag}
						</span>
					) : null}
					{visitor?.ip ? (
						<span className="fiona-stickynote-2-ip">{visitor.ip}</span>
					) : null}
				</button>
			</div>
		</div>
	);
}
