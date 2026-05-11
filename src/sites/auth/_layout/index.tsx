// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import ContentLayout from "@cloudscape-design/components/content-layout";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import Shell from "../../../layouts/shell";
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../../utils/locale";
import {
	applyTheme,
	initializeTheme,
	setStoredTheme,
	type Theme,
} from "../../../utils/theme";
import "./styles.css";

/**
 * AuthLayout — host shell for login / signup / verify / forgot-password.
 *
 * pageContext: per-page one-line context string rendered under the brand
 * wordmark in the auth-page-header band ("Sign in to Cloud Del Norte",
 * "Create your account", etc.). Falls back to "Cloud Del Norte" if absent.
 *
 * pageContextKey: optional i18n key (e.g. "auth.login.pageContext"). When
 * provided it takes precedence over pageContext and is resolved against the
 * current locale via useTranslation — required because pageContext values
 * like "Sign in to Cloud Del Norte" contain the brand name which differs
 * between locales ("Nube del Norte" in es-MX).
 *
 * Side effect: tags <body> with cdn-auth-subdomain so the dune wallpaper
 * canvas tapers to 0.6 alpha — keeps the form as the focal point with the
 * dunes/stars as ambient backdrop. Cleaned up on unmount so the class
 * doesn't leak into other contexts (HMR, tests).
 */

/**
 * Renders the pageContext text, translating via useTranslation when a
 * pageContextKey is supplied. Kept as a child of Shell so it sits inside
 * the LocaleProvider — the hook cannot be called in AuthLayout's own body
 * because AuthLayout is what ultimately mounts the provider.
 */
function PageContextText({
	contextKey,
	fallback,
}: {
	contextKey?: string;
	fallback?: string;
}) {
	const { t } = useTranslation();
	if (contextKey) {
		return <>{t(contextKey)}</>;
	}
	return <>{fallback || t("auth.siteTitle")}</>;
}

/**
 * Renders the brand wordmark via useTranslation so the heading localizes
 * ("Cloud Del Norte" / "Nube del Norte"). Must sit inside Shell for the
 * same LocaleProvider reason as PageContextText.
 */
function Wordmark() {
	const { t } = useTranslation();
	return <h1 className="cdn-auth-wordmark">{t("auth.siteTitle")}</h1>;
}

export default function AuthLayout({
	children,
	pageContext,
	pageContextKey,
}: {
	children: React.ReactNode;
	pageContext?: string;
	pageContextKey?: string;
}) {
	const [theme, setTheme] = useState<Theme>(() => initializeTheme());
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

	useEffect(() => {
		document.body.classList.add("cdn-auth-subdomain");
		return () => {
			document.body.classList.remove("cdn-auth-subdomain");
		};
	}, []);

	return (
		<Shell
			theme={theme}
			onThemeChange={(t) => {
				setTheme(t);
				applyTheme(t);
				setStoredTheme(t);
			}}
			locale={locale}
			onLocaleChange={(l) => {
				setLocale(l);
				applyLocale(l);
				setStoredLocale(l);
			}}
			navigationHide={true}
			toolsHide={true}
			hideSignInUtility={true}
			contentType="form"
			identityHref="https://clouddelnorte.org/feed/index.html"
		>
			<ContentLayout>
				<div className="cdn-auth-page-header">
					<Wordmark />
					<span className="cdn-auth-context">
						<PageContextText
							contextKey={pageContextKey}
							fallback={pageContext}
						/>
					</span>
				</div>
				<div className="cdn-card cdn-auth-card cdn-auth-form cdn-glass">
					{children}
				</div>
			</ContentLayout>
		</Shell>
	);
}
