// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import ContentLayout from "@cloudscape-design/components/content-layout";
import type React from "react";
import { useState } from "react";
import Shell from "../../../layouts/shell";
import { HelpPanelHome } from "../../../pages/create-meeting/components/help-panel-home";
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
import AuthNavigation from "./navigation";
import "./styles.css";

export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const [theme, setTheme] = useState<Theme>(() => initializeTheme());
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

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
			navigation={<AuthNavigation />}
			tools={<HelpPanelHome />}
			contentType="form"
			identityHref="https://clouddelnorte.org/feed/index.html"
		>
			<ContentLayout>
				<div className="cdn-card cdn-auth-card">{children}</div>
			</ContentLayout>
		</Shell>
	);
}
