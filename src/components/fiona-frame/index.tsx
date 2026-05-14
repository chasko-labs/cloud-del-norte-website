import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { loadVisitorInfo, type VisitorInfo } from "../../utils/visitor";
import Weather from "../weather";
import "../navigation/fiona.css";

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

	useEffect(() => {
		let cancelled = false;
		let observer: ResizeObserver | null = null;

		async function mount() {
			if (cancelled) return;
			const canvasEl = document.getElementById("fiona-canvas");
			if (canvasEl?.dataset.fionaMounted === "1") return;
			canvasEl?.setAttribute("data-fiona-mounted", "1");
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
			if (canvas && canvas.clientWidth === 0) {
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
	}, []);

	return (
		<div className="fiona-frame">
			<div className="fiona-bezel">
				<div className="fiona-panel-wrap">
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
			<Weather />
		</div>
	);
}
