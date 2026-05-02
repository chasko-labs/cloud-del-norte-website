// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import ContentLayout from "@cloudscape-design/components/content-layout";
import type React from "react";
import { useEffect, useState } from "react";
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
 * Side effect: tags <body> with cdn-auth-subdomain so the dune wallpaper
 * canvas tapers to 0.6 alpha — keeps the form as the focal point with the
 * dunes/stars as ambient backdrop. Cleaned up on unmount so the class
 * doesn't leak into other contexts (HMR, tests).
 */
export default function AuthLayout({
	children,
	pageContext,
}: {
	children: React.ReactNode;
	pageContext?: string;
}) {
	const [theme, setTheme] = useState<Theme>(() => initializeTheme());
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

	useEffect(() => {
		document.body.classList.add("cdn-auth-subdomain");
		return () => {
			document.body.classList.remove("cdn-auth-subdomain");
		};
	}, []);

	const contextLine = pageContext ?? "Cloud Del Norte";

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
				<header className="cdn-auth-page-header" aria-label="Cloud Del Norte">
					<div className="cdn-auth-wordmark">Cloud Del Norte</div>
					<div className="cdn-auth-context">{contextLine}</div>
				</header>
				<div className="cdn-card cdn-auth-card cdn-glass">{children}</div>
			</ContentLayout>
		</Shell>
	);
}
