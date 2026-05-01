// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import AppLayout, {
	type AppLayoutProps,
} from "@cloudscape-design/components/app-layout";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { useCallback, useEffect, useState } from "react";
import Footer from "../../components/footer";
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


	// background-viz canvas — mounts once per page load, cleans up on unmount.
	// Decorative — defer to requestIdleCallback so it never preempts critical paint.
	// Fallback: setTimeout(200ms) on browsers without rIC (Safari pre-16.4, older WebViews)
	useEffect(() => {
		let cleanup: (() => void) | null = null;
		let cancelled = false;
		const idleTask = () => {
			if (cancelled) return;
			void import("../../lib/background-viz/index").then((mod) => {
				if (cancelled) return;
				cleanup = mod.mount();
			});
		};
		const w = window as unknown as {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (h: number) => void;
			setTimeout: (cb: () => void, ms: number) => number;
			clearTimeout: (h: number) => void;
		};
		const usingIdle = typeof w.requestIdleCallback === "function";
		const handle: number = usingIdle
			? (w.requestIdleCallback as (cb: () => void, opts?: { timeout: number }) => number)(
					idleTask,
					{ timeout: 2000 },
				)
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

	// 3D star logo — registers <cdn-star-logo> custom element. SVG <img> renders
	// while this is loading; CSS :defined swaps to canvas once the element registers.
	// Decorative — defer to idle so the 197KB Babylon-derived chunk doesn't sit on
	// the critical path. <img> fallback covers the gap.
	useEffect(() => {
		let cancelled = false;
		const idleTask = () => {
			if (cancelled) return;
			void import("../../lib/cdn-star-logo/index").catch(() => {
				// fallback: <img> stays visible — no action needed
			});
		};
		const w = window as unknown as {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (h: number) => void;
			setTimeout: (cb: () => void, ms: number) => number;
			clearTimeout: (h: number) => void;
		};
		const usingIdle = typeof w.requestIdleCallback === "function";
		const handle: number = usingIdle
			? (w.requestIdleCallback as (cb: () => void, opts?: { timeout: number }) => number)(
					idleTask,
					{ timeout: 2000 },
				)
			: w.setTimeout(idleTask, 200);
		return () => {
			cancelled = true;
			if (usingIdle && typeof w.cancelIdleCallback === "function") {
				w.cancelIdleCallback(handle);
			} else {
				w.clearTimeout(handle);
			}
		};
	}, []);

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
					<img
						src="/brand/logo.svg"
						alt=""
						aria-hidden="true"
						fetchPriority="high"
						decoding="async"
					/>
				</a>
				<TopNavigation
					identity={{ href: identityHref }}
					utilities={[
						{
							type: "button",
							text: locale === "mx" ? "🇺🇸" : "🇲🇽",
							title:
								locale === "mx" ? t("shell.switchToUs") : t("shell.switchToMx"),
							onClick: handleToggleLocale,
						},
						{
							type: "button",
							text: theme === "dark" ? "☀️" : "🌙",
							title:
								theme === "dark"
									? t("shell.switchToLightMode")
									: t("shell.switchToDarkMode"),
							onClick: handleToggleTheme,
						},
						auth.isAuthenticated
							? {
									type: "menu-dropdown",
									text: auth.email ?? auth.name ?? "account",
									description: auth.isModerator ? "moderator" : undefined,
									iconName: "user-profile",
									items: [{ id: "signout", text: "sign out" }],
									onItemClick: (e: { detail: { id: string } }) => {
										if (e.detail.id === "signout") auth.signOut();
									},
								}
							: {
									type: "button",
									text: "sign in",
									onClick: () => {
										window.location.assign(AUTH_LOGIN_URL);
									},
								},
					]}
					i18nStrings={{
						overflowMenuTriggerText: t("shell.more"),
						overflowMenuTitleText: t("shell.all"),
					}}
				/>
			</div>
			<AppLayout
				contentType={contentType}
				navigation={navigation}
				navigationOpen={navOpen}
				onNavigationChange={handleNavigationChange}
				breadcrumbs={breadcrumbs}
				notifications={notifications}
				stickyNotifications={true}
				tools={tools}
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
