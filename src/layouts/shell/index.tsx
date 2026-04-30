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

	// logo lazy-load — blank during load, logo on success, fallback text only on failure
	const [logoState, setLogoState] = useState<"loading" | "ready" | "failed">("loading");
	useEffect(() => {
		const img = new Image();
		img.onload = () => setLogoState("ready");
		img.onerror = () => setLogoState("failed");
		img.src = "/brand/logo.svg";
	}, []);

	// background-viz canvas — mounts once per page load, cleans up on unmount
	useEffect(() => {
		let cleanup: (() => void) | null = null;
		void import("../../lib/background-viz/index").then((mod) => {
			cleanup = mod.mount();
		});
		return () => {
			cleanup?.();
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
				<TopNavigation
					identity={
						logoState === "ready"
							? {
									logo: {
										src: "/brand/logo.svg",
										alt: "Cloud Del Norte",
									},
									href: identityHref,
								}
							: logoState === "failed"
								? { title: t("shell.siteTitle"), href: identityHref }
								: { href: identityHref }
					}
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
