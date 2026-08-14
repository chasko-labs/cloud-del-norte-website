// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";
import Tabs from "@cloudscape-design/components/tabs";
import { useCallback, useEffect, useState } from "react";
import Breadcrumbs from "../../components/breadcrumbs";
import Navigation from "../../components/navigation";
import { useTranslation } from "../../hooks/useTranslation";
import ShellLayout from "../../layouts/shell";
import {
	listScheduledMeetings,
	type ScheduledMeeting,
} from "../../lib/scheduled-meetings";
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
import type { meeting } from "./data";
import { variationsData } from "./data";

/** Convert a ScheduledMeeting from the API into the local `meeting` shape. */
function toLocalMeeting(s: ScheduledMeeting): meeting {
	const startDate = s.scheduled_start
		? s.scheduled_start.slice(0, 10)
		: undefined;
	const startTime = s.scheduled_start
		? s.scheduled_start.slice(11, 16)
		: undefined;
	return {
		name: s.title,
		presenters: "",
		happened: s.status === "ended" ? "true" : "false",
		ondemand: "no",
		eventlink: s.meetup_rsvp_url || "",
		roomName: s.room_hash || undefined,
		scheduledDate: startDate,
		scheduledTime: startTime,
		speakerBioUrl: s.speaker_bio_url || undefined,
		meetupRsvpUrl: s.meetup_rsvp_url || undefined,
		meetingId: s.meeting_id,
		description: s.description,
		durationMinutes: s.duration_minutes,
		status: s.status,
	};
}

function BreadcrumbsContent() {
	const { t } = useTranslation();
	return (
		<Breadcrumbs
			active={{ text: t("meetings.breadcrumb"), href: "/meetings/index.html" }}
		/>
	);
}

function MeetingsTabs() {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState("upcoming");
	const [upcoming, setUpcoming] = useState<meeting[]>([]);
	const [past, setPast] = useState<meeting[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchMeetings = useCallback(async () => {
		setLoading(true);
		try {
			const [apiUpcoming, apiPast] = await Promise.all([
				listScheduledMeetings("upcoming").catch(() => []),
				listScheduledMeetings("past").catch(() => []),
			]);
			const upcomingFromApi = apiUpcoming.map(toLocalMeeting);
			const pastFromApi = apiPast.map(toLocalMeeting);

			// Merge with hardcoded data (legacy static entries)
			const today = new Date().toISOString().slice(0, 10);
			const staticUpcoming = variationsData.filter(
				(m) =>
					!m.scheduledDate ||
					m.scheduledDate >= today ||
					m.happened === "false",
			);
			const staticPast = variationsData.filter(
				(m) =>
					m.happened === "true" || (m.scheduledDate && m.scheduledDate < today),
			);

			setUpcoming([...upcomingFromApi, ...staticUpcoming]);
			setPast([...pastFromApi, ...staticPast]);
		} catch {
			// On complete failure, fall back to hardcoded data
			const today = new Date().toISOString().slice(0, 10);
			setUpcoming(
				variationsData.filter(
					(m) =>
						!m.scheduledDate ||
						m.scheduledDate >= today ||
						m.happened === "false",
				),
			);
			setPast(
				variationsData.filter(
					(m) =>
						m.happened === "true" ||
						(m.scheduledDate && m.scheduledDate < today),
				),
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchMeetings();
	}, [fetchMeetings]);

	if (loading) {
		return (
			<Box textAlign="center" padding="xxl">
				<Spinner size="large" />
			</Box>
		);
	}

	return (
		<Tabs
			activeTabId={activeTab}
			onChange={({ detail }) => setActiveTab(detail.activeTabId)}
			tabs={[
				{
					id: "upcoming",
					label: t("meetings.tabs.upcoming"),
					content: (
						<VariationsTable meetings={upcoming} onRefresh={fetchMeetings} />
					),
				},
				{
					id: "history",
					label: t("meetings.tabs.history"),
					content:
						past.length === 0 ? (
							<Box textAlign="center" padding="l" color="text-status-inactive">
								{t("meetings.noPastMeetings")}
							</Box>
						) : (
							<VariationsTable meetings={past} onRefresh={fetchMeetings} />
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
			<MeetingsTabs />
		</ShellLayout>
	);
}
