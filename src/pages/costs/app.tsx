// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import TextContent from "@cloudscape-design/components/text-content";
import { useEffect, useState } from "react";
import Breadcrumbs from "../../components/breadcrumbs";
import Navigation from "../../components/navigation";
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
// Reuse the cost-table styles defined for the plans page so both surfaces
// render the same grid. The styles are scoped with the .cdn-costs-tab wrapper
// for the 5-column variant used here.
import "../plans/styles.css";
import "./styles.css";

// ── costs tab ─────────────────────────────────────────────────────────────────

function CostsTab() {
	const [data, setData] = useState<{
		meta: {
			lastUpdated: string;
			periodStart: string;
			periodEnd: string;
			totalMonthlyCost: number;
			accounts: number;
		};
		services: {
			name: string;
			purpose: string;
			monthlyCost: number;
			dailyAverage: number;
			trend: string;
		}[];
	} | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/data/costs/latest.json")
			.then((r) => {
				if (!r.ok) throw new Error(`${r.status}`);
				return r.json();
			})
			.then(setData)
			.catch(() =>
				setError(
					"We couldn\u2019t load cost data right now. This updates daily \u2014 check back in a bit.",
				),
			)
			.finally(() => setLoading(false));
	}, []);

	if (loading)
		return (
			<Box padding="l" textAlign="center">
				<Spinner size="large" />
			</Box>
		);
	if (error)
		return (
			<Container>
				<Box variant="p" color="text-status-error">
					{error}
				</Box>
			</Container>
		);
	if (!data) return null;

	const stale =
		Date.now() - new Date(data.meta.lastUpdated).getTime() > 172800000;

	return (
		<div className="cdn-costs-tab">
			<SpaceBetween size="l">
				<Container
					header={
						<Header
							variant="h2"
							description="updated daily from 3 AWS accounts"
							counter={`$${data.meta.totalMonthlyCost.toFixed(2)}/mo`}
						>
							what it costs to run this
						</Header>
					}
				>
					<SpaceBetween size="m">
						<TextContent>
							<p>
								Cloud Del Norte runs on AWS. This page shows exactly what we
								spend \u2014 updated daily, no rounding, no hiding. We\u2019re a
								community user group, not a company. If you\u2019re curious what
								it actually costs to keep a community platform online, here it
								is.
							</p>
						</TextContent>
						{stale && (
							<Box variant="p" color="text-status-warning">
								Heads up \u2014 this data is a couple days old. The daily update
								may have hit a snag.
							</Box>
						)}
						<div className="cdn-plans-cost-table">
							<div className="cdn-plans-cost-row cdn-plans-cost-header">
								<span>what</span>
								<span>what it does for you</span>
								<span>last 30 days</span>
								<span>per day</span>
								<span>direction</span>
							</div>
							{data.services
								.sort((a, b) => b.monthlyCost - a.monthlyCost)
								.map((s) => (
									<div key={s.name} className="cdn-plans-cost-row">
										<span>{s.name}</span>
										<span>{s.purpose}</span>
										<span>${s.monthlyCost.toFixed(2)}</span>
										<span>${s.dailyAverage.toFixed(2)}</span>
										<span>
											{s.trend === "up"
												? "\u2191"
												: s.trend === "down"
													? "\u2193"
													: "\u2192"}
										</span>
									</div>
								))}
							<div className="cdn-plans-cost-row cdn-plans-cost-total">
								<span>total</span>
								<span />
								<span>${data.meta.totalMonthlyCost.toFixed(2)}</span>
								<span>${(data.meta.totalMonthlyCost / 30).toFixed(2)}</span>
								<span />
							</div>
						</div>
						<Box variant="small" color="text-body-secondary">
							Last updated:{" "}
							{new Date(data.meta.lastUpdated).toLocaleDateString()} \u00b7
							Period: {data.meta.periodStart} \u2192 {data.meta.periodEnd}
						</Box>
					</SpaceBetween>
				</Container>
			</SpaceBetween>
		</div>
	);
}

// ── shell ─────────────────────────────────────────────────────────────────────

function CostsContent() {
	useEffect(() => {
		document.title = "Costs \u2014 Cloud Del Norte";
	}, []);

	return (
		<ContentLayout
			header={
				<Header
					variant="h1"
					description="what it costs to run cloud del norte, updated daily"
				>
					costs on aws
				</Header>
			}
		>
			<CostsTab />
		</ContentLayout>
	);
}

function BreadcrumbsContent() {
	return <Breadcrumbs active={{ text: "costs", href: "/costs/index.html" }} />;
}

export default function App() {
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
			breadcrumbs={<BreadcrumbsContent />}
			navigation={<Navigation />}
		>
			<CostsContent />
		</Shell>
	);
}
