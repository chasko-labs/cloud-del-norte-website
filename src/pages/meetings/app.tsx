// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Tabs from "@cloudscape-design/components/tabs";
import { useState } from "react";
import Breadcrumbs from "../../components/breadcrumbs";
import Navigation from "../../components/navigation";
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
import MyTickets from "./components/my-tickets";
import { variationsData } from "./data";
import "../rsvp/styles.css";

function BreadcrumbsContent() {
	const { t } = useTranslation();
	return (
		<Breadcrumbs
			active={{ text: t("meetings.breadcrumb"), href: "/meetings/index.html" }}
		/>
	);
}

const today = new Date().toISOString().slice(0, 10);

const upcomingMeetings = variationsData.filter(
	(m) => !m.scheduledDate || m.scheduledDate >= today || m.happened === "false",
);

const pastMeetings = variationsData.filter(
	(m) => m.happened === "true" || (m.scheduledDate && m.scheduledDate < today),
);

function MeetingsTabs() {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState("upcoming");

	return (
		<Tabs
			activeTabId={activeTab}
			onChange={({ detail }) => setActiveTab(detail.activeTabId)}
			tabs={[
				{
					id: "upcoming",
					label: t("meetings.tabs.upcoming"),
					content: <VariationsTable meetings={upcomingMeetings} />,
				},
				{
					id: "history",
					label: t("meetings.tabs.history"),
					content:
						pastMeetings.length === 0 ? (
							<Box textAlign="center" padding="l" color="text-status-inactive">
								{t("meetings.noPastMeetings")}
							</Box>
						) : (
							<VariationsTable meetings={pastMeetings} />
						),
				},
			]}
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
			{/* Guests can browse meetings; the join action inside VariationsTable
			    gates on auth — guests see the list, must sign in to RSVP. */}
			<SpaceBetween size="l">
				<MyTickets />
				<MeetingsTabs />
			</SpaceBetween>
		</ShellLayout>
	);
}
