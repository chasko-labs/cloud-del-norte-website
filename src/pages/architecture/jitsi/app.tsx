// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useState } from "react";
import Breadcrumbs from "../../../components/breadcrumbs";
import Navigation from "../../../components/navigation";
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
import JitsiArchitectureContent from "./jitsi-architecture-content";

function BreadcrumbsContent() {
	const { t } = useTranslation();
	return (
		<Breadcrumbs
			active={{
				text: t("jitsiArchitecture.breadcrumb"),
				href: "/architecture/jitsi/index.html",
			}}
		/>
	);
}

export default function App() {
	const [theme, setTheme] = useState<Theme>(() => initializeTheme());
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

	const handleThemeChange = (newTheme: Theme) => {
		setTheme(newTheme);
		applyTheme(newTheme);
		setStoredTheme(newTheme);
	};

	const handleLocaleChange = (newLocale: Locale) => {
		setLocale(newLocale);
		applyLocale(newLocale);
		setStoredLocale(newLocale);
	};

	return (
		<Shell
			theme={theme}
			onThemeChange={handleThemeChange}
			locale={locale}
			onLocaleChange={handleLocaleChange}
			pageTitle="jitsiArchitecture.pageTitle"
			breadcrumbs={<BreadcrumbsContent />}
			navigation={<Navigation />}
		>
			<JitsiArchitectureContent />
		</Shell>
	);
}
