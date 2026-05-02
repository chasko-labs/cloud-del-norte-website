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
			<circle className="cdn-svg-moon__crater cdn-svg-moon__crater--a" cx="9.4" cy="8.0" r="0.7" />
			<circle className="cdn-svg-moon__crater cdn-svg-moon__crater--b" cx="11.2" cy="13.4" r="0.55" />
			<circle className="cdn-svg-moon__crater cdn-svg-moon__crater--c" cx="8.0" cy="12.0" r="0.4" />
			{/* twinkling sidekick star — 4-point sparkle */}
			<path
				className="cdn-svg-moon__star"
				d="M17.5 5.5 L18.0 7.0 L19.5 7.5 L18.0 8.0 L17.5 9.5 L17.0 8.0 L15.5 7.5 L17.0 7.0 Z"
			/>
		</svg>
	);
}

function MxFlagSvg() {
	return (
		<svg
			className="cdn-svg-flag cdn-svg-flag--mx"
			width="26"
			height="18"
			viewBox="0 0 26 18"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
		>
			{/* clip rounds the corners */}
			<defs>
				<clipPath id="cdn-flag-mx-clip">
					<rect x="0.5" y="0.5" width="25" height="17" rx="2.5" ry="2.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#cdn-flag-mx-clip)">
				{/* three vertical stripes — each in its own group for independent wave */}
				<g className="cdn-svg-flag__stripe cdn-svg-flag__stripe--a">
					<rect x="0" y="0" width="8.67" height="18" fill="#006847" />
				</g>
				<g className="cdn-svg-flag__stripe cdn-svg-flag__stripe--b">
					<rect x="8.67" y="0" width="8.66" height="18" fill="#f5f5f5" />
				</g>
				<g className="cdn-svg-flag__stripe cdn-svg-flag__stripe--c">
					<rect x="17.33" y="0" width="8.67" height="18" fill="#ce1126" />
				</g>
				{/* eagle silhouette — abstracted spread-wing shape, brand-amber tint */}
				<g className="cdn-svg-flag__emblem">
					<ellipse cx="13" cy="9" rx="2.6" ry="1.3" fill="#8b5a2b" opacity="0.78" />
					<path
						d="M13 7.7 L13 10.3 M11.0 9 Q12 8.2 13 9 Q14 8.2 15.0 9 M11.4 10.0 Q12.2 10.7 13 10.3 Q13.8 10.7 14.6 10.0"
						stroke="#5a1f8a"
						strokeWidth="0.45"
						fill="none"
						strokeLinecap="round"
					/>
					<circle cx="13" cy="8.5" r="0.5" fill="#5a1f8a" />
				</g>
			</g>
			{/* outer hairline frame for definition on light + dark nav */}
			<rect
				x="0.5"
				y="0.5"
				width="25"
				height="17"
				rx="2.5"
				ry="2.5"
				fill="none"
				stroke="rgba(0,0,0,0.35)"
				strokeWidth="1"
			/>
		</svg>
	);
}

function UsFlagSvg() {
	return (
		<svg
			className="cdn-svg-flag cdn-svg-flag--us"
			width="26"
			height="18"
			viewBox="0 0 26 18"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
		>
			<defs>
				<clipPath id="cdn-flag-us-clip">
					<rect x="0.5" y="0.5" width="25" height="17" rx="2.5" ry="2.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#cdn-flag-us-clip)">
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
				{/* canton */}
				<rect x="0" y="0" width="11" height="9.7" fill="#3c3b6e" />
				{/* simplified star grid — 9 stars in 3×3 abstraction (legible at 26px) */}
				<g className="cdn-svg-flag__stars">
					<circle cx="2.0" cy="2.0" r="0.55" fill="#ffffff" />
					<circle cx="5.5" cy="2.0" r="0.55" fill="#ffffff" />
					<circle cx="9.0" cy="2.0" r="0.55" fill="#ffffff" />
					<circle cx="2.0" cy="4.85" r="0.55" fill="#ffffff" />
					<circle cx="5.5" cy="4.85" r="0.55" fill="#ffffff" />
					<circle cx="9.0" cy="4.85" r="0.55" fill="#ffffff" />
					<circle cx="2.0" cy="7.7" r="0.55" fill="#ffffff" />
					<circle cx="5.5" cy="7.7" r="0.55" fill="#ffffff" />
					<circle cx="9.0" cy="7.7" r="0.55" fill="#ffffff" />
				</g>
			</g>
			<rect
				x="0.5"
				y="0.5"
				width="25"
				height="17"
				rx="2.5"
				ry="2.5"
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
				<a href={identityHref} className="cdn-logo-hero" aria-label="Cloud Del Norte — home">
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
					utilities={[
						{
							type: "button",
							// Custom inline SVG flag — replaces stock emoji.
							// Wrapped in a span so the Cloudscape utility-button click target
							// still receives clicks; pointer-events: none on the SVG below.
							// Title carries the existing i18n string so the existing
							// :has([title*="Spanish"]) / [title*="Inglés"] CSS hooks
							// still match for click-flip animation. ariaLabel must be set
							// explicitly because Cloudscape derives it from `text` by default
							// — passing a ReactNode in `text` would yield a non-string label.
							text: (
								<span
									className={`cdn-flag-toggle cdn-flag-toggle--${locale === "mx" ? "us" : "mx"}`}
									aria-hidden="true"
								>
									{locale === "mx" ? <UsFlagSvg /> : <MxFlagSvg />}
								</span>
							) as unknown as string,
							title:
								locale === "mx" ? t("shell.switchToUs") : t("shell.switchToMx"),
							ariaLabel:
								locale === "mx" ? t("shell.switchToUs") : t("shell.switchToMx"),
							onClick: handleToggleLocale,
						},
						{
							type: "button",
							// Custom inline SVG sun/moon — replaces stock emoji.
							// Same wrapper-span pattern. cdn-celestial-toggle--sun shows
							// rays + warm core; cdn-celestial-toggle--moon shows crescent
							// + crater + twinkling star sidekick.
							text: (
								<span
									className={`cdn-celestial-toggle cdn-celestial-toggle--${theme === "dark" ? "sun" : "moon"}`}
									aria-hidden="true"
								>
									{theme === "dark" ? <SunSvg /> : <MoonSvg />}
								</span>
							) as unknown as string,
							title:
								theme === "dark"
									? t("shell.switchToLightMode")
									: t("shell.switchToDarkMode"),
							ariaLabel:
								theme === "dark"
									? t("shell.switchToLightMode")
									: t("shell.switchToDarkMode"),
							onClick: handleToggleTheme,
						},
						...(auth.isAuthenticated
							? [
									{
										type: "menu-dropdown" as const,
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
											text: "sign in",
											onClick: () => {
												window.location.assign(AUTH_LOGIN_URL);
											},
										},
									]),
					] as TopNavigationProps.Utility[]}
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
