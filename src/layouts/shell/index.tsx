// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import AppLayout, {
	type AppLayoutProps,
} from "@cloudscape-design/components/app-layout";
import TopNavigation, {
	type TopNavigationProps,
} from "@cloudscape-design/components/top-navigation";
import { useCallback, useEffect, useState } from "react";
import { CdnWallpaper } from "../../components/cdn-wallpaper";
import Footer from "../../components/footer";
import LogoSvg from "../../components/logo-svg";
import PersistentPlayer from "../../components/persistent-player";
import { AuthProvider } from "../../contexts/auth-context";
import { LocaleProvider } from "../../contexts/locale-context";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../hooks/useTranslation";
import { AUTH_LOGIN_URL } from "../../lib/auth";
import {
	getStoredNavState,
	type Locale,
	setStoredNavState,
} from "../../utils/locale";

import "./styles.css";

/* ── Custom celestial + flag SVGs for top-nav utility toggles ────────────────
   Replaces stock emoji 🇲🇽 🇺🇸 ☀️ 🌙 with hand-drawn inline SVG so the
   icons can carry brand glow, breathing animations, and hover amplification.
   Each component renders a 22×22 viewbox — sized to match emoji optical weight
   in the Cloudscape utility button. Animations live in styles.css and are
   keyed off classes the parent <span> sets. */

function SunSvg() {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative; aria-hidden inside button which carries ariaLabel
		<svg
			className="cdn-svg-sun"
			width="22"
			height="22"
			viewBox="0 0 22 22"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
		>
			{/* eight rays — group rotates as a unit */}
			<g className="cdn-svg-sun__rays">
				<line x1="11" y1="1.5" x2="11" y2="4.5" />
				<line x1="11" y1="17.5" x2="11" y2="20.5" />
				<line x1="1.5" y1="11" x2="4.5" y2="11" />
				<line x1="17.5" y1="11" x2="20.5" y2="11" />
				<line x1="3.9" y1="3.9" x2="6.0" y2="6.0" />
				<line x1="16.0" y1="16.0" x2="18.1" y2="18.1" />
				<line x1="3.9" y1="18.1" x2="6.0" y2="16.0" />
				<line x1="16.0" y1="6.0" x2="18.1" y2="3.9" />
			</g>
			{/* warm gold core — pulses via CSS */}
			<circle className="cdn-svg-sun__core" cx="11" cy="11" r="4.4" />
		</svg>
	);
}

function MoonSvg() {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative; aria-hidden inside button which carries ariaLabel
		<svg
			className="cdn-svg-moon"
			width="22"
			height="22"
			viewBox="0 0 22 22"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
		>
			{/* crescent — even-odd fill: outer disc minus offset disc */}
			<path
				className="cdn-svg-moon__crescent"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M14.6 17.5a7.5 7.5 0 1 1 0-13.0 5.6 5.6 0 0 0 0 13.0z"
			/>
			{/* faint craters — cluster on the lit edge */}
			<circle
				className="cdn-svg-moon__crater cdn-svg-moon__crater--a"
				cx="9.4"
				cy="8.0"
				r="0.7"
			/>
			<circle
				className="cdn-svg-moon__crater cdn-svg-moon__crater--b"
				cx="11.2"
				cy="13.4"
				r="0.55"
			/>
			<circle
				className="cdn-svg-moon__crater cdn-svg-moon__crater--c"
				cx="8.0"
				cy="12.0"
				r="0.4"
			/>
			{/* twinkling sidekick star — 4-point sparkle */}
			<path
				className="cdn-svg-moon__star"
				d="M17.5 5.5 L18.0 7.0 L19.5 7.5 L18.0 8.0 L17.5 9.5 L17.0 8.0 L15.5 7.5 L17.0 7.0 Z"
			/>
		</svg>
	);
}

/* MX flag — three equal vertical bands of green / white / red (official
   PMS 3415 #006847, white #ffffff, PMS 186 #ce1126) with the national coat
   of arms (eagle on cactus devouring serpent) centered on the white band.
   Full Wikipedia Commons SVG embeds a 200+ path heraldic seal — at 26×18
   that detail collapses to noise, so we render a stylized but
   structurally-faithful silhouette: green laurel wreath ring, brown
   amber-headed eagle profile facing dexter (left), green cactus pad at the
   base, dark serpent curve in the beak. Reads correctly at 26-32px. No
   clipPath — Cloudscape iconSvg clones the SVG to multiple DOM positions
   so id-based clip refs collide. Rounded corners come from CSS
   border-radius on the SVG element. */
function MxFlagSvg() {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative; aria-hidden inside button which carries ariaLabel
		<svg
			className="cdn-svg-flag cdn-svg-flag--mx"
			width="26"
			height="18"
			viewBox="0 0 26 18"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
		>
			<g className="cdn-svg-flag__stripe cdn-svg-flag__stripe--a">
				<rect x="0" y="0" width="8.667" height="18" fill="#006847" />
			</g>
			<g className="cdn-svg-flag__stripe cdn-svg-flag__stripe--b">
				<rect x="8.667" y="0" width="8.666" height="18" fill="#ffffff" />
			</g>
			<g className="cdn-svg-flag__stripe cdn-svg-flag__stripe--c">
				<rect x="17.333" y="0" width="8.667" height="18" fill="#ce1126" />
			</g>
			<g className="cdn-svg-flag__emblem">
				{/* laurel/oak wreath — split green ring at base, open at top */}
				<path
					d="M 10.7 9.4 A 2.45 2.45 0 0 0 13 11.85 A 2.45 2.45 0 0 0 15.3 9.4"
					stroke="#006847"
					strokeWidth="0.55"
					fill="none"
					strokeLinecap="round"
				/>
				{/* cactus pad — small green oval below eagle */}
				<ellipse cx="13" cy="11.0" rx="0.95" ry="0.55" fill="#4a8a3f" />
				<ellipse cx="12.35" cy="10.55" rx="0.4" ry="0.55" fill="#4a8a3f" />
				<ellipse cx="13.65" cy="10.55" rx="0.4" ry="0.55" fill="#4a8a3f" />
				{/* eagle body — brown silhouette, wing raised, profile facing left */}
				<path
					d="M 13.4 8.4
					   Q 14.6 8.0 14.9 8.6
					   Q 15.0 9.2 14.5 9.6
					   Q 14.0 10.0 13.2 10.0
					   Q 12.4 10.0 12.0 9.6
					   Q 11.6 9.1 12.0 8.5
					   Q 12.4 8.1 13.0 8.2 Z"
					fill="#6b3410"
				/>
				{/* eagle wing — slightly lighter brown, raised */}
				<path
					d="M 13.4 8.5
					   Q 14.0 7.4 14.6 7.5
					   Q 14.7 8.1 14.4 8.7
					   Q 14.0 9.0 13.5 8.9 Z"
					fill="#8b5a2b"
				/>
				{/* eagle head — amber/gold profile to left of body */}
				<path
					d="M 12.0 8.55
					   Q 11.4 8.4 11.3 8.85
					   Q 11.4 9.15 11.95 9.1
					   Q 12.15 8.95 12.0 8.55 Z"
					fill="#d4a017"
				/>
				{/* eagle beak tip */}
				<path d="M 11.3 8.85 L 10.95 8.95 L 11.3 9.05 Z" fill="#3a1a05" />
				{/* serpent — dark curve from beak */}
				<path
					d="M 10.95 8.95 Q 10.5 9.15 10.7 9.5 Q 10.95 9.7 11.25 9.55"
					stroke="#2a1605"
					strokeWidth="0.28"
					fill="none"
					strokeLinecap="round"
				/>
				{/* eagle eye dot */}
				<circle cx="11.85" cy="8.75" r="0.09" fill="#000000" />
			</g>
			<rect
				x="0.5"
				y="0.5"
				width="25"
				height="17"
				fill="none"
				stroke="rgba(0,0,0,0.35)"
				strokeWidth="1"
			/>
		</svg>
	);
}

/* US flag — 13 alternating red/white horizontal stripes, blue canton in
   the upper hoist covering 7 stripes tall × 40% of the fly, 50 white
   five-pointed stars in the canonical 9-row staggered grid (rows of
   6+5+6+5+6+5+6+5+6 = 50). Colors: Old Glory Red #b22234, Old Glory Blue
   #3c3b6e, white #ffffff. Aspect ratio at 26×18 is ~1.44 (true flag is
   1.9) but stripe count + canton ratio are preserved. No clipPath
   (Cloudscape iconSvg duplicates the DOM and id refs collide); rounded
   corners come from CSS border-radius on the SVG. Stars render as small
   white circles for legibility at 26px — finer-than-circle detail blurs
   to a smudge anyway at this size. */
function UsFlagSvg() {
	// 9-row staggered star grid inside canton (width 10.4, height 9.695).
	// Long rows: 6 stars at xs = [0.867, 2.6, 4.333, 6.067, 7.8, 9.533].
	// Short rows: 5 stars at xs = [1.733, 3.467, 5.2, 6.933, 8.667].
	// Rows alternate long/short across 9 vertical positions.
	const xLong = [0.867, 2.6, 4.333, 6.067, 7.8, 9.533];
	const xShort = [1.733, 3.467, 5.2, 6.933, 8.667];
	const ys = [0.539, 1.616, 2.693, 3.77, 4.848, 5.925, 7.002, 8.079, 9.156];
	const stars: { cx: number; cy: number }[] = [];
	for (let row = 0; row < 9; row++) {
		const xs = row % 2 === 0 ? xLong : xShort;
		for (const cx of xs) stars.push({ cx, cy: ys[row] });
	}
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative; aria-hidden inside button which carries ariaLabel
		<svg
			className="cdn-svg-flag cdn-svg-flag--us"
			width="26"
			height="18"
			viewBox="0 0 26 18"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
		>
			{/* 13 horizontal stripes (red/white alternating). Wave applied
			   per-stripe via nth-child phase offset in CSS. */}
			<g className="cdn-svg-flag__stripes-h">
				<rect x="0" y="0" width="26" height="1.385" fill="#b22234" />
				<rect x="0" y="1.385" width="26" height="1.385" fill="#ffffff" />
				<rect x="0" y="2.77" width="26" height="1.385" fill="#b22234" />
				<rect x="0" y="4.155" width="26" height="1.385" fill="#ffffff" />
				<rect x="0" y="5.54" width="26" height="1.385" fill="#b22234" />
				<rect x="0" y="6.925" width="26" height="1.385" fill="#ffffff" />
				<rect x="0" y="8.31" width="26" height="1.385" fill="#b22234" />
				<rect x="0" y="9.695" width="26" height="1.385" fill="#ffffff" />
				<rect x="0" y="11.08" width="26" height="1.385" fill="#b22234" />
				<rect x="0" y="12.465" width="26" height="1.385" fill="#ffffff" />
				<rect x="0" y="13.85" width="26" height="1.385" fill="#b22234" />
				<rect x="0" y="15.235" width="26" height="1.385" fill="#ffffff" />
				<rect x="0" y="16.62" width="26" height="1.385" fill="#b22234" />
			</g>
			{/* canton — covers stripes 1–7 (height 9.695), width 40% of fly */}
			<rect x="0" y="0" width="10.4" height="9.695" fill="#3c3b6e" />
			{/* 50 stars — 9 rows of 6/5/6/5/6/5/6/5/6 staggered */}
			<g className="cdn-svg-flag__stars">
				{stars.map((s) => (
					<circle
						key={`${s.cx}-${s.cy}`}
						cx={s.cx}
						cy={s.cy}
						r="0.32"
						fill="#ffffff"
					/>
				))}
			</g>
			<rect
				x="0.5"
				y="0.5"
				width="25"
				height="17"
				fill="none"
				stroke="rgba(0,0,0,0.35)"
				strokeWidth="1"
			/>
		</svg>
	);
}

export interface ShellProps {
	breadcrumbs?: AppLayoutProps["breadcrumbs"];
	contentType?: Extract<
		AppLayoutProps.ContentType,
		"default" | "table" | "form"
	>;
	tools?: AppLayoutProps["tools"];
	/** Controlled tools-panel open state. If provided Shell becomes a controlled
	 *  component for the tools panel — caller must also supply onToolsChange.
	 *  If omitted Shell self-manages tools state as before (backward compatible). */
	toolsOpen?: boolean;
	onToolsChange?: (open: boolean) => void;
	children?: AppLayoutProps["content"];
	navigation?: AppLayoutProps["navigation"];
	notifications?: AppLayoutProps["notifications"];
	theme?: "light" | "dark";
	onThemeChange?: (theme: "light" | "dark") => void;
	locale?: Locale;
	onLocaleChange?: (locale: Locale) => void;
	pageTitle?: string;
	/** Override the identity link href — use absolute URL when Shell renders on a subdomain */
	identityHref?: string;
	/** Hide the side-nav drawer + its toggle entirely. Used on the auth subdomain
	 *  where the standard meetings/roadmap nav is irrelevant + would just be noise. */
	navigationHide?: boolean;
	/** Hide the tools drawer + its toggle entirely. Used on the auth subdomain
	 *  so the create-meeting help panel can't leak into login/signup. */
	toolsHide?: boolean;
	/** Hide the "sign in" button in the top-nav utilities. Used on the auth subdomain
	 *  itself so the button isn't recursive (clicking it from /login goes to /login). */
	hideSignInUtility?: boolean;
}

function ShellContent({
	children,
	contentType,
	breadcrumbs,
	tools,
	toolsOpen: toolsOpenProp,
	onToolsChange,
	navigation,
	notifications,
	theme,
	onThemeChange,
	locale,
	onLocaleChange,
	pageTitle,
	identityHref = "/feed/index.html",
	navigationHide,
	toolsHide,
	hideSignInUtility,
}: ShellProps) {
	const { t } = useTranslation();
	const auth = useAuth();
	const [animating, setAnimating] = useState(false);
	const [animatingLocale, setAnimatingLocale] = useState(false);
	// internal tools state — used only when caller does not pass toolsOpen (uncontrolled)
	const [toolsOpenInternal, setToolsOpenInternal] = useState(false);
	const isControlled = toolsOpenProp !== undefined;
	const toolsOpen = isControlled ? toolsOpenProp : toolsOpenInternal;
	const handleToolsChange = useCallback(
		(event: { detail: { open: boolean } }) => {
			if (isControlled) {
				onToolsChange?.(event.detail.open);
			} else {
				setToolsOpenInternal(event.detail.open);
			}
		},
		[isControlled, onToolsChange],
	);

	// Initialize nav state from localStorage OR viewport (Cloudscape breakpoint: 688px)
	const [navOpen, setNavOpen] = useState(() => {
		const stored = getStoredNavState();
		if (stored !== null) return stored;
		return typeof window !== "undefined" && window.innerWidth >= 688;
	});

	const handleNavigationChange = useCallback(
		(event: { detail: { open: boolean } }) => {
			const newState = event.detail.open;
			setNavOpen(newState);
			setStoredNavState(newState);
		},
		[],
	);

	// Wallpaper + cdn-star-logo lifecycle now owned by <CdnWallpaper />.
	// See src/components/cdn-wallpaper/index.tsx.

	// Add resize listener to handle viewport changes
	useEffect(() => {
		function handleResize() {
			const isDesktop = window.innerWidth >= 688;
			const stored = getStoredNavState();

			// Only auto-adjust if user hasn't set a preference
			if (stored === null) {
				setNavOpen(isDesktop);
			}
		}

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// Tools-panel open/close → body class so the Volunteer pill (the
	// repurposed Cloudscape Info popover anchor) can fade out when the
	// help drawer is open and fade back in when it's closed.
	useEffect(() => {
		if (typeof document === "undefined") return;
		document.body.classList.toggle("cdn-tools-open", !!toolsOpen);
		return () => {
			document.body.classList.remove("cdn-tools-open");
		};
	}, [toolsOpen]);

	useEffect(() => {
		document.documentElement.lang = locale === "mx" ? "es" : "en";
		if (pageTitle) {
			document.title = t(pageTitle);
		}
	}, [locale, pageTitle, t]);

	const handleToggleTheme = useCallback(() => {
		onThemeChange?.(theme === "dark" ? "light" : "dark");
		setAnimating(true);
		setTimeout(() => setAnimating(false), 400);
	}, [theme, onThemeChange]);

	const handleToggleLocale = useCallback(() => {
		onLocaleChange?.(locale === "mx" ? "us" : "mx");
		setAnimatingLocale(true);
		setTimeout(() => setAnimatingLocale(false), 400);
	}, [locale, onLocaleChange]);

	return (
		<>
			<CdnWallpaper />
			<div
				id="top-nav"
				data-cdn-animating={animating || undefined}
				data-cdn-animating-locale={animatingLocale || undefined}
			>
				{/* Custom logo — absolutely positioned so it's free of Cloudscape's identity sizing constraints.
				    <cdn-star-logo> is the 3D version (kicks in once the custom element registers via :defined CSS).
				    <img> is the always-rendered fallback for SSR / no-JS / WebGL failure. */}
				<a
					href={identityHref}
					className="cdn-logo-hero"
					aria-label="Cloud Del Norte — home"
				>
					{/* @ts-ignore — custom element from /lib/cdn-star-logo */}
					<cdn-star-logo transparent="" no-rotate=""></cdn-star-logo>
					<LogoSvg className="cdn-logo-img" aria-hidden="true" />
				</a>
				{/* AWS USER GROUP tagline — sits to the right of the star logo.
				    "AWS" in aws-orange, "USER GROUP" in brand violet. Lit-sign
				    treatment matching the star (text-shadow glow + slow pulse). */}
				<div className="cdn-ugtag" aria-hidden="true">
					<span className="cdn-ugtag-aws">AWS</span>
					<span className="cdn-ugtag-ug">USER GROUP</span>
				</div>
				<TopNavigation
					identity={{ href: identityHref }}
					utilities={
						[
							{
								type: "button",
								// disableUtilityCollapse: keep flag + theme + sign-in always
								// visible on the top-nav row. Default Cloudscape collapses
								// utilities into a "More" dropdown on narrow viewports —
								// hides our locale + theme toggles behind a click on phones.
								disableUtilityCollapse: true,
								iconSvg: (
									<span
										className={`cdn-flag-toggle cdn-flag-toggle--${locale === "mx" ? "us" : "mx"}`}
										aria-hidden="true"
									>
										{locale === "mx" ? <UsFlagSvg /> : <MxFlagSvg />}
									</span>
								),
								ariaLabel:
									locale === "mx"
										? t("shell.switchToUs")
										: t("shell.switchToMx"),
								title:
									locale === "mx"
										? t("shell.switchToUs")
										: t("shell.switchToMx"),
								onClick: handleToggleLocale,
							},
							{
								type: "button",
								disableUtilityCollapse: true,
								iconSvg: (
									<span
										className={`cdn-celestial-toggle cdn-celestial-toggle--${theme === "dark" ? "sun" : "moon"}`}
										aria-hidden="true"
									>
										{theme === "dark" ? <SunSvg /> : <MoonSvg />}
									</span>
								),
								ariaLabel:
									theme === "dark"
										? t("shell.switchToLightMode")
										: t("shell.switchToDarkMode"),
								title:
									theme === "dark"
										? t("shell.switchToLightMode")
										: t("shell.switchToDarkMode"),
								onClick: handleToggleTheme,
							},
							...(auth.isAuthenticated
								? [
										{
											type: "menu-dropdown" as const,
											// disableUtilityCollapse — the user dropdown shouldn't hide
											// behind a "More" trigger; identity affordances need to be
											// always visible.
											disableUtilityCollapse: true,
											text: auth.email ?? auth.name ?? "account",
											description: auth.isModerator ? "moderator" : undefined,
											iconName: "user-profile",
											items: [{ id: "signout", text: "sign out" }],
											onItemClick: (e: { detail: { id: string } }) => {
												if (e.detail.id === "signout") auth.signOut();
											},
										},
									]
								: hideSignInUtility
									? []
									: [
											{
												type: "button" as const,
												// Bryan v0.0.0058: "sign in" was hiding behind "More"
												// (Cloudscape's overflow collapse) on mobile even
												// though "sign in" is shorter than "more ▼". Force
												// always visible.
												disableUtilityCollapse: true,
												text: "sign in",
												onClick: () => {
													window.location.assign(AUTH_LOGIN_URL);
												},
											},
										]),
						] as TopNavigationProps.Utility[]
					}
					i18nStrings={{
						overflowMenuTriggerText: t("shell.more"),
						overflowMenuTitleText: t("shell.all"),
					}}
				/>
			</div>
			<AppLayout
				contentType={contentType}
				navigation={navigation}
				navigationHide={navigationHide}
				navigationOpen={navOpen}
				onNavigationChange={handleNavigationChange}
				breadcrumbs={breadcrumbs}
				notifications={notifications}
				stickyNotifications={true}
				tools={tools}
				toolsHide={toolsHide}
				toolsOpen={toolsOpen}
				onToolsChange={handleToolsChange}
				content={children}
				headerSelector="#top-nav"
				ariaLabels={{
					navigation: t("shell.navigationDrawer"),
					navigationClose: t("shell.closeNavigationDrawer"),
					navigationToggle: t("shell.openNavigationDrawer"),
					notifications: t("shell.notifications"),
					tools: t("shell.helpPanel"),
					toolsClose: t("shell.closeHelpPanel"),
					toolsToggle: t("shell.openHelpPanel"),
				}}
			/>
			{/* Cloudscape's awsui_info_ popover anchor ("Info" pill next to the
			    page title) is repurposed as the Volunteer link via CSS — see
			    cdn-glass-streaks.css. No floating React button: Bryan eyes-on
			    v0.0.0046 found the floating pill landed in "no-mansland". */}
			<Footer />
			<PersistentPlayer />
		</>
	);
}

export default function Shell(props: ShellProps) {
	return (
		<AuthProvider>
			<LocaleProvider locale={props.locale ?? "us"}>
				<ShellContent {...props} />
			</LocaleProvider>
		</AuthProvider>
	);
}
