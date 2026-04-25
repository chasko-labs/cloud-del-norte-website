// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import type React from "react";
import { useState } from "react";
import generatedData from "../../data/releases.generated.json";
import { useTranslation } from "../../hooks/useTranslation";
import type {
	Confidence,
	ProjectedEntry,
	ReleaseEntry,
	TechCalendar,
} from "./types";
import { downloadICS, generateICS, generateICSForTech } from "./utils/ical";

const allTechs = generatedData as TechCalendar[];

// ── helpers ──────────────────────────────────────────────────────────────────

function confidenceBadge(
	confidence: Confidence | string | undefined,
): React.ReactNode {
	if (!confidence) return null;
	const colorMap: Record<string, "green" | "blue" | "grey" | "red"> = {
		announced: "green",
		high: "blue",
		medium: "grey",
		low: "red",
		insufficient: "red",
	};
	return <Badge color={colorMap[confidence] ?? "grey"}>{confidence}</Badge>;
}

function dataSourceBadge(source: TechCalendar["dataSource"]): React.ReactNode {
	const colorMap: Record<
		TechCalendar["dataSource"],
		"green" | "blue" | "grey"
	> = {
		api: "green",
		rss: "blue",
		manual: "grey",
	};
	return <Badge color={colorMap[source]}>{source}</Badge>;
}

function releaseCell(
	entry: ReleaseEntry | null,
	t: (key: string) => string,
): React.ReactNode {
	if (!entry) return "—";
	return (
		<SpaceBetween size="xxs" direction="vertical">
			<Box fontWeight="bold">{entry.version}</Box>
			<Box variant="small" color="text-body-secondary">
				{entry.date}
			</Box>
			{entry.releaseNotesUrl && (
				<Link href={entry.releaseNotesUrl} external fontSize="body-s">
					{t("maintenanceCalendar.releaseNotes")}
				</Link>
			)}
		</SpaceBetween>
	);
}

function projectedCell(
	entry: ProjectedEntry | null,
	t: (key: string) => string,
): React.ReactNode {
	if (!entry) return "—";
	return (
		<SpaceBetween size="xxs" direction="vertical">
			<Box fontWeight="bold">{entry.projectedDate}</Box>
			{confidenceBadge(entry.confidence)}
			<Box variant="small" color="text-body-secondary">
				{entry.basedOn}
			</Box>
			{entry.sourceUrl && (
				<Link href={entry.sourceUrl} external fontSize="body-s">
					{t("maintenanceCalendar.source")}
				</Link>
			)}
		</SpaceBetween>
	);
}

// ── row type for the single-row table ────────────────────────────────────────

interface CalendarRow {
	id: string;
	mostRecentLTS: React.ReactNode;
	priorLTS: React.ReactNode;
	secondPriorLTS: React.ReactNode;
	mostRecentAny: React.ReactNode;
	projectedNextVersion: React.ReactNode;
	projectedNextLTS: React.ReactNode;
}

function techToRow(
	tech: TechCalendar,
	t: (key: string) => string,
): CalendarRow {
	return {
		id: tech.id,
		mostRecentLTS: releaseCell(tech.mostRecentLTS, t),
		priorLTS: releaseCell(tech.priorLTS, t),
		secondPriorLTS: releaseCell(tech.secondPriorLTS, t),
		mostRecentAny: releaseCell(tech.mostRecentAny, t),
		projectedNextVersion: projectedCell(tech.projectedNextVersion, t),
		projectedNextLTS: projectedCell(tech.projectedNextLTS, t),
	};
}

const TABLE_COLUMNS = (t: (key: string) => string) => [
	{
		id: "mostRecentLTS",
		header: t("maintenanceCalendar.tableHeaders.mostRecentLTS"),
		cell: (r: CalendarRow) => r.mostRecentLTS,
	},
	{
		id: "priorLTS",
		header: t("maintenanceCalendar.tableHeaders.priorLTS"),
		cell: (r: CalendarRow) => r.priorLTS,
	},
	{
		id: "secondPriorLTS",
		header: t("maintenanceCalendar.tableHeaders.secondPriorLTS"),
		cell: (r: CalendarRow) => r.secondPriorLTS,
	},
	{
		id: "mostRecentAny",
		header: t("maintenanceCalendar.tableHeaders.mostRecentRelease"),
		cell: (r: CalendarRow) => r.mostRecentAny,
	},
	{
		id: "projectedNextVersion",
		header: t("maintenanceCalendar.tableHeaders.projectedNextRelease"),
		cell: (r: CalendarRow) => r.projectedNextVersion,
	},
	{
		id: "projectedNextLTS",
		header: t("maintenanceCalendar.tableHeaders.projectedNextLTS"),
		cell: (r: CalendarRow) => r.projectedNextLTS,
	},
];

// ── unique categories in seed-data order ────────────────────────────────────

const CATEGORY_ORDER = [
	"Language",
	"Framework",
	"AI Model",
	"AWS Service",
	"Tool",
	"Standard",
] as const;

function uniqueCategories(techs: TechCalendar[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const cat of CATEGORY_ORDER) {
		if (techs.some((t) => t.category === cat)) {
			seen.add(cat);
			result.push(cat);
		}
	}
	// catch any category not in our static order
	for (const t of techs) {
		if (!seen.has(t.category)) {
			seen.add(t.category);
			result.push(t.category);
		}
	}
	return result;
}

// ── per-tech section ─────────────────────────────────────────────────────────

function TechSection({
	tech,
	t,
}: {
	tech: TechCalendar;
	t: (key: string) => string;
}) {
	const handleExport = () => {
		const content = generateICSForTech(tech);
		downloadICS(`${tech.id}.ics`, content);
	};

	return (
		<section id={tech.id} style={{ marginBottom: "2rem" }}>
			<Table
				columnDefinitions={TABLE_COLUMNS(t)}
				items={[techToRow(tech, t)]}
				variant="container"
				header={
					<Header
						variant="h2"
						actions={
							<SpaceBetween size="xs" direction="horizontal">
								{dataSourceBadge(tech.dataSource)}
								<Button onClick={handleExport} iconName="download">
									{t("maintenanceCalendar.export")}
								</Button>
							</SpaceBetween>
						}
					>
						<Link href={tech.sourceUrl} external>
							{tech.name}
						</Link>
					</Header>
				}
				empty={<Box>{t("maintenanceCalendar.noDataAvailable")}</Box>}
			/>
		</section>
	);
}

// ── main component ────────────────────────────────────────────────────────────

export default function MaintenanceCalendar() {
	const { t } = useTranslation();
	const categories = uniqueCategories(allTechs);
	const categoryOptions = [
		{ value: "all", label: t("maintenanceCalendar.allCategories") },
		...categories.map((c) => ({ value: c, label: c })),
	];

	const [selectedCategory, setSelectedCategory] = useState<{
		value: string;
		label: string;
	}>(categoryOptions[0]);

	const visibleTechs =
		selectedCategory.value === "all"
			? allTechs
			: allTechs.filter((t) => t.category === selectedCategory.value);

	const handleExportAll = () => {
		const content = generateICS(visibleTechs);
		const suffix =
			selectedCategory.value === "all"
				? "all"
				: selectedCategory.value.toLowerCase().replace(/\s+/g, "-");
		downloadICS(`maintenance-calendar-${suffix}.ics`, content);
	};

	return (
		<ContentLayout
			header={
				<Header
					variant="h1"
					description={t("maintenanceCalendar.description")}
					actions={
						<SpaceBetween size="xs" direction="horizontal">
							<Select
								selectedOption={selectedCategory}
								onChange={({ detail }) =>
									setSelectedCategory(
										detail.selectedOption as { value: string; label: string },
									)
								}
								options={categoryOptions}
								ariaLabel={t("maintenanceCalendar.filterByCategory")}
							/>
							<Button
								onClick={handleExportAll}
								iconName="download"
								variant="primary"
							>
								{t("maintenanceCalendar.exportAll")}
							</Button>
						</SpaceBetween>
					}
				>
					{t("maintenanceCalendar.header")}
				</Header>
			}
		>
			<SpaceBetween size="l">
				{visibleTechs.map((tech) => (
					<TechSection key={tech.id} tech={tech} t={t} />
				))}
			</SpaceBetween>
		</ContentLayout>
	);
}
