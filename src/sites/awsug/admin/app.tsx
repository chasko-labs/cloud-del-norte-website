// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import AwsugLayout from "../_layout";
import {
	type AdminUser,
	approveUser,
	banUser,
	listUsers,
	unbanUser,
} from "../_shared/api";
import { type AuthState, isMember, requireAuth } from "../_shared/auth";

type TabFilter = "pending" | "members" | "banned";

interface BanTarget {
	sub: string;
	email: string;
}

function UserTable({
	filter,
	onAction,
}: {
	filter: TabFilter;
	onAction: () => void;
}) {
	const { t } = useTranslation();
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [banTarget, setBanTarget] = useState<BanTarget | null>(null);
	const [successMsg, setSuccessMsg] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			setUsers(await listUsers(filter));
		} catch {
			setError("Failed to load users. Try refreshing.");
		} finally {
			setLoading(false);
		}
	}, [filter]);

	useEffect(() => {
		void load();
	}, [load]);

	async function handleApprove(user: AdminUser) {
		setActionLoading(user.sub);
		setSuccessMsg("");
		try {
			await approveUser(user.sub);
			setSuccessMsg(`${user.email} approved`);
			void load();
			onAction();
		} catch {
			setError(`Failed to approve ${user.email}`);
		} finally {
			setActionLoading(null);
		}
	}

	async function handleBanConfirm() {
		if (!banTarget) return;
		setActionLoading(banTarget.sub);
		setSuccessMsg("");
		try {
			await banUser(banTarget.sub);
			setSuccessMsg(
				`${banTarget.email} banned — they cannot join future sessions. To remove from an active call, join as moderator and use participant controls.`,
			);
			setBanTarget(null);
			void load();
			onAction();
		} catch {
			setError(`Failed to ban ${banTarget.email}`);
			setBanTarget(null);
		} finally {
			setActionLoading(null);
		}
	}

	async function handleUnban(user: AdminUser) {
		setActionLoading(user.sub);
		setSuccessMsg("");
		try {
			await unbanUser(user.sub);
			setSuccessMsg(`${user.email} unbanned and added to members`);
			void load();
			onAction();
		} catch {
			setError(`Failed to unban ${user.email}`);
		} finally {
			setActionLoading(null);
		}
	}

	const columns = [
		{
			id: "email",
			header: t("awsug.admin.colEmail"),
			cell: (u: AdminUser) => u.email,
			minWidth: 200,
		},
		{
			id: "memberType",
			header: t("awsug.admin.colMemberType"),
			cell: (u: AdminUser) => u.memberType ?? "—",
			minWidth: 160,
		},
		{
			id: "location",
			header: t("awsug.admin.colLocation"),
			cell: (u: AdminUser) => u.location ?? "—",
			minWidth: 120,
		},
		{
			id: "topics",
			header: t("awsug.admin.colTopics"),
			cell: (u: AdminUser) => u.topics ?? "—",
			minWidth: 160,
		},
		{
			id: "background",
			header: t("awsug.admin.colBackground"),
			cell: (u: AdminUser) => u.background ?? "—",
			minWidth: 160,
		},
		{
			id: "joined",
			header: t("awsug.admin.colJoined"),
			cell: (u: AdminUser) => new Date(u.createdAt).toLocaleDateString(),
			minWidth: 100,
		},
		{
			id: "actions",
			header: t("awsug.admin.colActions"),
			minWidth: 160,
			cell: (u: AdminUser) => (
				<SpaceBetween direction="horizontal" size="xs">
					{filter === "pending" && (
						<Button
							variant="primary"
							loading={actionLoading === u.sub}
							onClick={() => {
								void handleApprove(u);
							}}
						>
							{t("awsug.admin.approveButton")}
						</Button>
					)}
					{(filter === "pending" || filter === "members") && (
						<Button
							loading={actionLoading === u.sub}
							onClick={() => setBanTarget({ sub: u.sub, email: u.email })}
						>
							{t("awsug.admin.banButton")}
						</Button>
					)}
					{filter === "banned" && (
						<Button
							loading={actionLoading === u.sub}
							onClick={() => {
								void handleUnban(u);
							}}
						>
							{t("awsug.admin.unbanButton")}
						</Button>
					)}
				</SpaceBetween>
			),
		},
	];

	const emptyMap: Record<TabFilter, string> = {
		pending: t("awsug.admin.emptyPending"),
		members: t("awsug.admin.emptyMembers"),
		banned: t("awsug.admin.emptyBanned"),
	};

	return (
		<>
			<Modal
				visible={banTarget !== null}
				onDismiss={() => setBanTarget(null)}
				header={t("awsug.admin.banButton")}
				footer={
					<SpaceBetween direction="horizontal" size="xs">
						<Button onClick={() => setBanTarget(null)}>Cancel</Button>
						<Button
							variant="primary"
							loading={actionLoading === banTarget?.sub}
							onClick={() => {
								void handleBanConfirm();
							}}
						>
							Confirm ban
						</Button>
					</SpaceBetween>
				}
			>
				Ban <strong>{banTarget?.email}</strong>? They will be blocked from
				future sessions.
			</Modal>

			<SpaceBetween size="m">
				{error && (
					<Alert type="error" dismissible onDismiss={() => setError("")}>
						{error}
					</Alert>
				)}
				{successMsg && (
					<Alert type="success" dismissible onDismiss={() => setSuccessMsg("")}>
						{successMsg}
					</Alert>
				)}
				<Table
					items={users}
					columnDefinitions={columns}
					loading={loading}
					loadingText="Loading users"
					empty={<Box textAlign="center">{emptyMap[filter]}</Box>}
					header={
						<Header
							counter={`(${users.length})`}
							actions={
								<Button
									iconName="refresh"
									onClick={() => {
										void load();
									}}
								/>
							}
						>
							{filter === "pending"
								? t("awsug.admin.filterPending")
								: filter === "members"
									? t("awsug.admin.filterMembers")
									: t("awsug.admin.filterBanned")}
						</Header>
					}
				/>
			</SpaceBetween>
		</>
	);
}

function AdminPanel() {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState("pending");
	const [refreshKey, setRefreshKey] = useState(0);

	return (
		<Container header={<Header variant="h1">{t("awsug.admin.title")}</Header>}>
			<Tabs
				activeTabId={activeTab}
				onChange={({ detail }) => setActiveTab(detail.activeTabId)}
				tabs={[
					{
						id: "pending",
						label: t("awsug.admin.filterPending"),
						content: (
							<UserTable
								filter="pending"
								onAction={() => setRefreshKey((k) => k + 1)}
								key={`pending-${refreshKey}`}
							/>
						),
					},
					{
						id: "members",
						label: t("awsug.admin.filterMembers"),
						content: (
							<UserTable
								filter="members"
								onAction={() => setRefreshKey((k) => k + 1)}
								key={`members-${refreshKey}`}
							/>
						),
					},
					{
						id: "banned",
						label: t("awsug.admin.filterBanned"),
						content: (
							<UserTable
								filter="banned"
								onAction={() => setRefreshKey((k) => k + 1)}
								key={`banned-${refreshKey}`}
							/>
						),
					},
				]}
			/>
		</Container>
	);
}

function AdminWithLayout() {
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

	if (!isMember(auth)) {
		return (
			<AwsugLayout>
				<Container>
					<Alert type="info">
						Admin access requires member approval. Your application is still
						pending.
					</Alert>
				</Container>
			</AwsugLayout>
		);
	}

	return (
		<AwsugLayout>
			<AdminPanel />
		</AwsugLayout>
	);
}

export default function App() {
	return <AdminWithLayout />;
}
