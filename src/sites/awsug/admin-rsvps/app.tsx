// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import type { SelectProps } from "@cloudscape-design/components/select";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Table from "@cloudscape-design/components/table";
import Toggle from "@cloudscape-design/components/toggle";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import AwsugLayout from "../_layout";
import { type AuthState, isModerator, requireAuth } from "../_shared/auth";
import { type AdminRsvpRecord, listEventRsvps } from "./api";

/** Known events — add new events here. Most recent first. */
const EVENT_OPTIONS: SelectProps.Option[] = [
	{
		value: "quantum-superpositions-2026-08-30",
		label: "Quantum Superpositions — 2026-08-30",
	},
	{
		value: "happy-hour-2026-06-03",
		label: "Community Happy Hour — 2026-06-03",
	},
];

const DEFAULT_EVENT = EVENT_OPTIONS[0];

function RegistrationsTable() {
	const { t } = useTranslation();
	const [selectedEvent, setSelectedEvent] = useState<SelectProps.Option | null>(
		DEFAULT_EVENT,
	);
	const [records, setRecords] = useState<AdminRsvpRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showTest, setShowTest] = useState(false);

	const load = useCallback(async () => {
		if (!selectedEvent?.value) return;
		setLoading(true);
		setError("");
		try {
			setRecords(await listEventRsvps(selectedEvent.value));
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t("awsug.adminRsvps.loadError"),
			);
		} finally {
			setLoading(false);
		}
	}, [selectedEvent, t]);

	useEffect(() => {
		void load();
	}, [load]);

	const filtered = showTest ? records : records.filter((r) => !r.is_test);

	const columns = [
		{
			id: "name",
			header: t("awsug.adminRsvps.colName"),
			cell: (r: AdminRsvpRecord) => r.name ?? t("awsug.adminRsvps.noValue"),
			sortingField: "name",
			minWidth: 160,
		},
		{
			id: "email",
			header: t("awsug.adminRsvps.colEmail"),
			cell: (r: AdminRsvpRecord) => r.email ?? t("awsug.adminRsvps.noValue"),
			sortingField: "email",
			minWidth: 200,
		},
		{
			id: "group",
			header: t("awsug.adminRsvps.colGroup"),
			cell: (r: AdminRsvpRecord) => r.group ?? t("awsug.adminRsvps.noGroup"),
			sortingField: "group",
			minWidth: 120,
		},
		{
			id: "createdAt",
			header: t("awsug.adminRsvps.colRegisteredAt"),
			cell: (r: AdminRsvpRecord) =>
				r.created_at
					? new Date(r.created_at).toLocaleString()
					: t("awsug.adminRsvps.noValue"),
			sortingField: "created_at",
			minWidth: 180,
		},
		{
			id: "migrated",
			header: t("awsug.adminRsvps.colMigrated"),
			cell: (r: AdminRsvpRecord) =>
				r.migrated ? t("awsug.adminRsvps.yes") : t("awsug.adminRsvps.no"),
			sortingField: "migrated",
			minWidth: 100,
		},
	];

	return (
		<SpaceBetween size="m">
			{error && (
				<Alert type="error" dismissible onDismiss={() => setError("")}>
					{error}
				</Alert>
			)}
			<Select
				selectedOption={selectedEvent}
				onChange={({ detail }) => setSelectedEvent(detail.selectedOption)}
				options={EVENT_OPTIONS}
				placeholder={t("awsug.adminRsvps.selectEvent")}
			/>
			<Toggle
				checked={showTest}
				onChange={({ detail }) => setShowTest(detail.checked)}
			>
				{t("awsug.adminRsvps.showTestRecords")}
			</Toggle>
			<Table
				items={filtered}
				columnDefinitions={columns}
				loading={loading}
				loadingText={t("awsug.adminRsvps.loadingText")}
				sortingDisabled={false}
				empty={<Box textAlign="center">{t("awsug.adminRsvps.emptyText")}</Box>}
				header={
					<Header
						counter={`(${filtered.length})`}
						description={t("awsug.adminRsvps.tableDescription")}
					>
						{t("awsug.adminRsvps.tableHeader")}
					</Header>
				}
			/>
		</SpaceBetween>
	);
}

function AccessDenied() {
	const { t } = useTranslation();
	return (
		<Container>
			<SpaceBetween size="m">
				<Alert type="warning">{t("awsug.admin.moderatorAccessRequired")}</Alert>
			</SpaceBetween>
		</Container>
	);
}

/** Page content rendered INSIDE AwsugLayout (which provides LocaleProvider). */
function AdminRsvpsContent() {
	const { t } = useTranslation();
	return (
		<Container
			header={<Header variant="h1">{t("awsug.adminRsvps.pageTitle")}</Header>}
		>
			<RegistrationsTable />
		</Container>
	);
}

/**
 * Wrapper component — does NOT call useTranslation() because AwsugLayout
 * (which supplies LocaleProvider via Shell) renders as its child, not its
 * parent. Matches the pattern in admin/app.tsx.
 */
function AdminRsvpsWithLayout() {
	const [auth, setAuth] = useState<AuthState | null>(null);

	useEffect(() => {
		setAuth(requireAuth());
	}, []);

	if (!auth) {
		return (
			<Box padding="xxl" textAlign="center">
				<Spinner size="large" />
			</Box>
		);
	}

	if (!isModerator(auth)) {
		return (
			<AwsugLayout>
				<AccessDenied />
			</AwsugLayout>
		);
	}

	return (
		<AwsugLayout>
			<AdminRsvpsContent />
		</AwsugLayout>
	);
}

export default function App() {
	return <AdminRsvpsWithLayout />;
}
