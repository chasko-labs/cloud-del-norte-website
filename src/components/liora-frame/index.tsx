import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { loadVisitorInfo, type VisitorInfo } from "../../utils/visitor";
import Weather from "../weather";
import "../navigation/liora.css";

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

export default function LioraFrame() {
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
					t("liora.welcomeGreeting"),
					"liora.welcomeGreeting",
					"qué onda",
				)
			: (GREETING_BY_COUNTRY[countryCode] ??
				withFallback(
					t("liora.welcomeGreeting"),
					"liora.welcomeGreeting",
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
			const canvasEl = document.getElementById("liora-canvas");
			if (canvasEl?.dataset.lioraMounted === "1") return;
			canvasEl?.setAttribute("data-liora-mounted", "1");
			try {
				const origin = window.location.origin;
				const mod = (await (
					Function("u", "return import(u)") as (
						u: string,
					) => Promise<{ mountLioraPanel: (base: string) => Promise<void> }>
				)(`${origin}/liora-embed/liora-embed.js`)) as {
					mountLioraPanel: (base: string) => Promise<void>;
				};
				if (cancelled) return;
				await mod.mountLioraPanel(`${origin}/liora`);
			} catch (err) {
				console.warn('[liora-frame] mount failed:', err);
				canvasEl?.removeAttribute("data-liora-mounted");
			}
		}

		function tryMount() {
			if (cancelled) return;
			const canvas = document.getElementById(
				"liora-canvas",
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
				<div
					id="liora-status-bar"
					className="liora-status-bar liora-status--green"
					aria-hidden="true"
				>
					<span id="liora-device-info">{deviceInfo}</span>
					<span id="liora-sys-status"> SYS:▓▓▓</span>
				</div>
			</div>
			<div className="liora-notes-row">
				<button
					key={stickyKey}
					type="button"
					className={`liora-stickynote${stickyZoomed ? " liora-stickynote--zoomed" : ""}`}
					onClick={() => {
						const bezel = document.querySelector(".liora-bezel");
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
					<span className="liora-stickynote-line liora-stickynote-line-1">
						{withFallback(
							t("liora.stickynoteLine1"),
							"liora.stickynoteLine1",
							locale === "mx" ? "no aguanta" : "non load",
						)}
					</span>
					<span className="liora-stickynote-line liora-stickynote-line-2">
						{withFallback(
							t("liora.stickynoteLine2"),
							"liora.stickynoteLine2",
							locale === "mx" ? "nada" : "bearing",
						)}
					</span>
					<span className="liora-stickynote-sig">- ^.^</span>
				</button>
				<button
					type="button"
					className={`liora-stickynote-2${sticky2Fallen ? " liora-stickynote-2--fallen" : ""}${sticky2Zoomed ? " liora-stickynote-2--zoomed" : ""}`}
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
					<span className="liora-stickynote-2-line">
						{sticky2Zoomed ? getTimeOfDayGreeting(locale) : greetingPrefix},{" "}
						{visitor?.greeting ?? ""}
					</span>
					{visitor?.flag ? (
						<span className="liora-stickynote-2-flag" aria-hidden="true">
							{visitor.flag}
						</span>
					) : null}
					{visitor?.ip ? (
						<span className="liora-stickynote-2-ip">{visitor.ip}</span>
					) : null}
				</button>
			</div>
			<Weather />
		</div>
	);
}
