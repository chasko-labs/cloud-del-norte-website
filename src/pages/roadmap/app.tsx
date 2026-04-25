// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import React, { useEffect, useState } from "react";
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
import { boardColumns } from "./data";
import "./styles.css";

function AppContent() {
	const { t, locale } = useTranslation();

	useEffect(() => {
		document.title = `${t("roadmap.title")} — AWS UG Cloud Del Norte`;
	}, [t]);

	return (
		<ContentLayout header={<Header variant="h1">{t("roadmap.title")}</Header>}>
			<div className="cdn-roadmap-board">
				{boardColumns.map((column) => (
					<div
						key={column.key}
						className="cdn-roadmap-column"
						data-column={column.key}
					>
						<div className="cdn-roadmap-column-header">
							<span className="cdn-roadmap-column-title">
								{t(column.translationKey)}
							</span>
							<span className="cdn-roadmap-column-count">
								{column.cards.length}
							</span>
						</div>
						{column.cards.length === 0 ? (
							<div className="cdn-roadmap-empty-state">
								{t("roadmap.emptyColumn")}
							</div>
						) : (
							column.cards.map((card) => (
								<div key={card.id} className="cdn-roadmap-card">
									<span className="cdn-roadmap-card-id">{card.id}</span>
									<span className="cdn-roadmap-card-title">
										{locale === "mx" && card.titleEs
											? card.titleEs
											: card.title}
									</span>
								</div>
							))
						)}
					</div>
				))}
			</div>
		</ContentLayout>
	);
}

function BreadcrumbsContent() {
	const { t } = useTranslation();
	return (
		<Breadcrumbs
			active={{ text: t("roadmap.breadcrumb"), href: "/roadmap/index.html" }}
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
		>
			<AppContent />
		</Shell>
	);
}
