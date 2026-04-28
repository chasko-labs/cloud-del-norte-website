// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import ContentLayout from "@cloudscape-design/components/content-layout";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { useState } from "react";
import Breadcrumbs from "../../components/breadcrumbs";
import Navigation from "../../components/navigation";
import { useTranslation } from "../../hooks/useTranslation";
import Shell from "../../layouts/shell";
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
import Meetings from "./components/meetings";
import ProductionOverview from "./components/production-overview";
import QualityReport from "./components/quality-report";
import {
	breakdownItems,
	notes,
	productionMetrics,
	variationData,
} from "./data";

function AppContent({
	theme,
	onThemeChange,
	locale,
	onLocaleChange,
}: {
	theme: Theme;
	onThemeChange: (t: Theme) => void;
	locale: Locale;
	onLocaleChange: (l: Locale) => void;
}) {
	const { t } = useTranslation();

	return (
		<ContentLayout
			header={
				<Header
					variant="h1"
					info={<Link variant="info">{t("dashboardPage.infoLink")}</Link>}
				>
					{t("dashboardPage.header")}
				</Header>
			}
		>
			<Grid
				gridDefinition={[
					{ colspan: 12 },
					{ colspan: { default: 12, m: 8 } },
					{ colspan: { default: 12, m: 4 } },
				]}
			>
				<ProductionOverview metrics={productionMetrics} />
				<Meetings data={variationData} items={breakdownItems} />
				<QualityReport notes={notes} />
			</Grid>
		</ContentLayout>
	);
}

function BreadcrumbsContent() {
	const { t } = useTranslation();
	return (
		<Breadcrumbs
			active={{ text: t("dashboardPage.breadcrumb"), href: "/home/index.html" }}
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
			breadcrumbs={<BreadcrumbsContent />}
			navigation={<Navigation />}
			tools={<HelpPanelHome />}
		>
			<AppContent
				theme={theme}
				onThemeChange={handleThemeChange}
				locale={locale}
				onLocaleChange={handleLocaleChange}
			/>
		</Shell>
	);
}
