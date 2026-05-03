// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import { useEffect, useState } from "react";
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

	const totalCards = boardColumns.reduce((sum, c) => sum + c.cards.length, 0);

	return (
		<ContentLayout
			header={
				<Header
					variant="h1"
					description={t("roadmap.subtitle")}
					counter={`(${totalCards} ${t("roadmap.totalLabel")})`}
				>
					{t("roadmap.title")}
				</Header>
			}
		>
			<nav className="cdn-roadmap-legend" aria-label={t("roadmap.legendLabel")}>
				{boardColumns.map((column) => (
					<a
						key={column.key}
						href={`#cdn-roadmap-col-${column.key}`}
						className="cdn-roadmap-legend-item"
						data-column={column.key}
					>
						<span className="cdn-roadmap-legend-dot" aria-hidden="true" />
						<span className="cdn-roadmap-legend-label">
							{t(column.translationKey)}
						</span>
					</a>
				))}
			</nav>
			<div className="cdn-roadmap-board" role="list">
				{boardColumns.map((column) => (
					<section
						key={column.key}
						id={`cdn-roadmap-col-${column.key}`}
						className="cdn-roadmap-column"
						data-column={column.key}
						data-empty={column.cards.length === 0 ? "true" : undefined}
						role="listitem"
						aria-label={t(column.translationKey)}
					>
						<header className="cdn-roadmap-column-header">
							<span className="cdn-roadmap-column-title">
								{t(column.translationKey)}
							</span>
							<span className="cdn-roadmap-column-count">
								{column.cards.length}
							</span>
						</header>
						<div className="cdn-roadmap-column-body">
							{column.cards.length === 0 ? (
								<div className="cdn-roadmap-empty-state">
									<span className="cdn-roadmap-empty-glyph" aria-hidden="true">
										&#9676;
									</span>
									<span>{t("roadmap.emptyColumn")}</span>
								</div>
							) : (
								column.cards.map((card) => (
									<article key={card.id} className="cdn-roadmap-card">
										<span className="cdn-roadmap-card-id">{card.id}</span>
										<span className="cdn-roadmap-card-title">
											{locale === "mx" && card.titleEs
												? card.titleEs
												: card.title}
										</span>
									</article>
								))
							)}
						</div>
					</section>
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
