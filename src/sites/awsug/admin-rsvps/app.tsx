// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Table from "@cloudscape-design/components/table";
import Toggle from "@cloudscape-design/components/toggle";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import AwsugLayout from "../_layout";
import { type AuthState, isModerator, requireAuth } from "../_shared/auth";
import { type AdminRsvpRecord, listEventRsvps } from "./api";

function RegistrationsTable() {
	const { t } = useTranslation();
	const [records, setRecords] = useState<AdminRsvpRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showTest, setShowTest] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			setRecords(await listEventRsvps("happy-hour-2026-06-03"));
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t("awsug.adminRsvps.loadError"),
			);
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void load();
	}, [load]);

	const filtered = showTest ? records : records.filter((r) => !r.is_test);

	const columns = [
		{
			id: "name",
			header: t("awsug.adminRsvps.colName"),
			cell: (r: AdminRsvpRecord) => r.name ?? "—",
			sortingField: "name",
			minWidth: 160,
		},
		{
			id: "email",
			header: t("awsug.adminRsvps.colEmail"),
			cell: (r: AdminRsvpRecord) => r.email ?? "—",
			sortingField: "email",
			minWidth: 200,
		},
		{
			id: "group",
			header: t("awsug.adminRsvps.colGroup"),
			cell: (r: AdminRsvpRecord) => r.group ?? "—",
			sortingField: "group",
			minWidth: 120,
		},
		{
			id: "createdAt",
			header: t("awsug.adminRsvps.colRegisteredAt"),
			cell: (r: AdminRsvpRecord) =>
				r.created_at ? new Date(r.created_at).toLocaleString() : "—",
			sortingField: "created_at",
			minWidth: 180,
		},
		{
			id: "migrated",
			header: t("awsug.adminRsvps.colMigrated"),
			cell: (r: AdminRsvpRecord) =>
				r.migrated ? t("awsug.adminRsvps.yes") : "—",
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

function AdminRsvpsWithLayout() {
	const { t } = useTranslation();
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
			<Container
				header={<Header variant="h1">{t("awsug.adminRsvps.pageTitle")}</Header>}
			>
				<RegistrationsTable />
			</Container>
		</AwsugLayout>
	);
}

export default function App() {
	return <AdminRsvpsWithLayout />;
}
