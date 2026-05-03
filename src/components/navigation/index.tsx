// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import SideNavigation, {
	type SideNavigationProps,
} from "@cloudscape-design/components/side-navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../hooks/useTranslation";
import Weather from "../weather";
import "./liora.css";

// Silence the dynamically-loaded liora-embed bundle's [gestureQueue]
// console.info chatter (30+ lines per gesture.glb load). We can't edit the
// vendor bundle directly, so install a console.info filter at module load
// BEFORE mountLioraPanel runs. Only swallow messages whose first arg starts
// with "[gestureQueue]" — every other info call passes through unchanged.
// Not restored: gestureQueue calls fire across the panel lifetime.
if (typeof console !== "undefined") {
	const originalInfo = console.info.bind(console);
	console.info = (...args: unknown[]) => {
		const first = args[0];
		if (typeof first === "string" && first.startsWith("[gestureQueue]")) return;
		originalInfo(...args);
	};
}

// Translation fallback — useTranslation's t() returns the key string itself
// when a key is missing from the locale JSON. Wrap calls so a default text
// is shown instead of the literal "liora.welcomeGreeting" leaking to the UI.
function withFallback(value: string, key: string, fallback: string): string {
	return value === key ? fallback : value;
}

// Time-of-day greeting based on the visitor's local clock. Used on
// stickynote 2 when zoomed — pairs with the country name for a moment of
// recognition ("good morning, Pakistan"). Locale-aware. Falls back to
// "good evening" / "buenas tardes" if the system clock gives a value
// outside the expected ranges.
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

// ISO 3166-1 alpha-2 → regional-indicator pair → flag emoji.
// 65 (charCode 'A') → 0x1F1E6 (regional indicator A) requires offset 127397.
function countryToFlag(code: string): string {
	if (!/^[A-Za-z]{2}$/.test(code)) return "";
	return code
		.toUpperCase()
		.split("")
		.map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
		.join("");
}

// Common ISO codes → display country names. Falls back to the raw country
// code if not in this map. Keeps bundle slim vs shipping a full ISO 3166 dict.
const COUNTRY_NAME: Record<string, string> = {
	US: "USA",
	MX: "Mexico",
	CA: "Canada",
	GB: "the UK",
	DE: "Germany",
	FR: "France",
	ES: "Spain",
	BR: "Brazil",
	JP: "Japan",
	IN: "India",
	AU: "Australia",
	NZ: "New Zealand",
	IE: "Ireland",
	IT: "Italy",
	NL: "the Netherlands",
	SE: "Sweden",
	NO: "Norway",
	DK: "Denmark",
	FI: "Finland",
	PL: "Poland",
	RU: "Russia",
	UA: "Ukraine",
	CN: "China",
	KR: "Korea",
	TH: "Thailand",
	VN: "Vietnam",
	ID: "Indonesia",
	PH: "the Philippines",
	TR: "Turkey",
	GR: "Greece",
	IL: "Israel",
	SA: "Saudi Arabia",
	AE: "the UAE",
	EG: "Egypt",
	NG: "Nigeria",
	ZA: "South Africa",
	KE: "Kenya",
	AR: "Argentina",
	CL: "Chile",
	CO: "Colombia",
	PE: "Peru",
	VE: "Venezuela",
	PK: "Pakistan",
};

// Native-language welcome by visitor country. Missing entries fall back to
// the locale-default greeting ("welcome" for us, "qué onda" for mx).
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

interface VisitorInfo {
	ip: string;
	country: string;
	greeting: string;
	flag: string;
}

const VISITOR_CACHE_KEY = "cdn.visitor.v2";
const VISITOR_TTL_MS = 24 * 60 * 60 * 1000;

async function loadVisitorInfo(): Promise<VisitorInfo | null> {
	try {
		const cached = localStorage.getItem(VISITOR_CACHE_KEY);
		if (cached) {
			const parsed = JSON.parse(cached) as {
				ts: number;
				data: VisitorInfo;
			};
			if (Date.now() - parsed.ts < VISITOR_TTL_MS) {
				return parsed.data;
			}
		}
	} catch {
		// fall through to fetch
	}
	try {
		const res = await fetch("https://ipinfo.io/json", {
			headers: { accept: "application/json" },
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { ip?: string; country?: string };
		if (!data.ip || !data.country) return null;
		const code = data.country.toUpperCase();
		const info: VisitorInfo = {
			ip: data.ip,
			country: code,
			greeting: COUNTRY_NAME[code] ?? code,
			flag: countryToFlag(code),
		};
		try {
			localStorage.setItem(
				VISITOR_CACHE_KEY,
				JSON.stringify({ ts: Date.now(), data: info }),
			);
		} catch {
			// localStorage disabled — non-fatal
		}
		return info;
	} catch {
		return null;
	}
}

function LioraFrame() {
	const { t, locale } = useTranslation();
	const deviceInfo = useMemo(() => detectDeviceInfo(), []);
	const [stickyZoomed, setStickyZoomed] = useState(false);
	const [stickyKey, setStickyKey] = useState(0);
	const [sticky2Fallen, setSticky2Fallen] = useState(false);
	const [sticky2Zoomed, setSticky2Zoomed] = useState(false);
	const [visitor, setVisitor] = useState<VisitorInfo | null>(null);

	// Locale=mx forces Norte greeting regardless of detected country.
	// Otherwise pick a country-native greeting; missing entries → "welcome".
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
			// data-liora-mounted guard — React StrictMode reuses the same DOM element
			// across simulated unmount/remount; this persists where a module-level flag
			// would be left true by a cancelled first run and block the second.
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
			} catch {
				canvasEl?.removeAttribute("data-liora-mounted");
				// embed unavailable — canvas stays as shimmer
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
						// Bryan ask: tap to zoom (mimics stickynote 1) when sticky 1
						// isn't already zoomed; show time-of-day greeting when zoomed.
						// If sticky 1 is currently zoomed, ignore tap so the user
						// finishes that interaction first.
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

export default function Navigation() {
	const { t } = useTranslation();
	const { isModerator } = useAuth();

	const currentPath = location.pathname;
	const isOnPlans =
		currentPath.startsWith("/roadmap") || currentPath.startsWith("/theme");
	const isOnReferences =
		currentPath.startsWith("/learning") ||
		currentPath.startsWith("/maintenance-calendar");

	// home (feed) is reachable via the "cloud del norte" header above and the top-nav title.
	// about is reachable from the right-side info panel only — not duplicated in the left nav.
	const items: SideNavigationProps["items"] = [
		{
			type: "link",
			text: t("navigation.meetings"),
			href: "/meetings/index.html",
		},
		...(isModerator
			? [
					{
						type: "link" as const,
						text: t("navigation.admin"),
						href: "/admin/index.html",
					},
				]
			: []),
		{ type: "divider" },
		{
			type: "section",
			text: t("navigation.resources"),
			defaultExpanded: isOnPlans,
			items: [
				{
					type: "link",
					text: t("navigation.ugRoadmap"),
					href: "/roadmap/index.html",
				},
				{
					type: "link",
					text: t("navigation.designSystem"),
					href: "/theme/index.html",
				},
			],
		},
		{ type: "divider" },
		{
			type: "section",
			text: t("navigation.learning"),
			defaultExpanded: isOnReferences,
			items: [
				{
					type: "link",
					text: t("navigation.techDebtCountdowns"),
					// Trailing-slash routes hit the S3+CloudFront default fallback
					// and serve the feed bundle instead of the page. Always link
					// to /…/index.html explicitly (matches /meetings/index.html).
					href: "/maintenance-calendar/index.html",
				},
				{
					type: "expandable-link-group",
					text: t("navigation.apiGuide"),
					href: "/learning/api/index.html",
					defaultExpanded: currentPath.startsWith("/learning"),
					items: [
						// Submenu hashes match Container id="" anchors in
						// src/pages/learning/api/RiftRewindDashboard.tsx.
						// Removed nav links to #rest-overview / #cheat-sheet /
						// #how-it-works / #resources — no Container on the page
						// to scroll to. Re-add when content lands.
						{
							type: "link",
							text: t("navigation.uniformInterface"),
							href: "/learning/api/index.html#uniform-interface",
						},
						{
							type: "link",
							text: t("navigation.clientServer"),
							href: "/learning/api/index.html#client-server",
						},
						{
							type: "link",
							text: t("navigation.stateless"),
							href: "/learning/api/index.html#stateless",
						},
						{
							type: "link",
							text: t("navigation.cacheable"),
							href: "/learning/api/index.html#cacheable",
						},
						{
							type: "link",
							text: t("navigation.layeredSystem"),
							href: "/learning/api/index.html#layered-system",
						},
						{
							type: "link",
							text: t("navigation.codeOnDemand"),
							href: "/learning/api/index.html#code-on-demand",
						},
					],
				},
			],
		},
	];

	return (
		<>
			<SideNavigation
				activeHref={location.pathname + location.hash}
				items={items}
				onFollow={(event) => {
					if (event.detail.type === "section-header") return;
					const href = event.detail.href;
					if (!event.detail.external && href && href !== "#") {
						event.preventDefault();
						window.location.href = href;
					}
				}}
			/>
			<LioraFrame />
		</>
	);
}
