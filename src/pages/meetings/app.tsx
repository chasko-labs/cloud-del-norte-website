// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from "react";
import Breadcrumbs from "../../components/breadcrumbs";
import Navigation from "../../components/navigation";
import { RequireAuth } from "../../components/require-auth";
import { useTranslation } from "../../hooks/useTranslation";
import ShellLayout from "../../layouts/shell";
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../utils/locale";
import {
	applyTheme,
	initializeTheme,
	setStoredTheme,
	type Theme,
} from "../../utils/theme";
import { HelpPanelHome } from "../create-meeting/components/help-panel-home";
import VariationsTable from "./components/meetings-table";
import { variationsData } from "./data";

function BreadcrumbsContent() {
	const { t } = useTranslation();
	return (
		<Breadcrumbs
			active={{ text: t("meetings.breadcrumb"), href: "/meetings/index.html" }}
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
		<ShellLayout
			contentType="table"
			theme={theme}
			onThemeChange={handleThemeChange}
			locale={locale}
			onLocaleChange={handleLocaleChange}
			pageTitle="pages.meetings.title"
			breadcrumbs={<BreadcrumbsContent />}
			navigation={<Navigation />}
			tools={<HelpPanelHome />}
		>
			<RequireAuth>
				<VariationsTable meetings={variationsData} />
			</RequireAuth>
		</ShellLayout>
	);
}
