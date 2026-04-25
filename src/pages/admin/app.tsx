import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { useCallback, useEffect, useState } from "react";

import Breadcrumbs from "../../components/breadcrumbs";
import Navigation from "../../components/navigation";
import { RequireAuth } from "../../components/require-auth";
import { useTranslation } from "../../hooks/useTranslation";
import ShellLayout from "../../layouts/shell";
import { type AdminUser, approveUser, listPendingUsers } from "../../lib/admin";
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

function BreadcrumbsContent() {
	const { t } = useTranslation();
	return (
		<Breadcrumbs
			active={{ text: t("admin.breadcrumb"), href: "/admin/index.html" }}
		/>
	);
}

function AdminTable() {
	const { t } = useTranslation();
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await listPendingUsers("pending");
			setUsers(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : "unknown error");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const handleApprove = useCallback(async (user: AdminUser) => {
		setApprovingIds((prev) => new Set(prev).add(user.sub));
		try {
			await approveUser(user.sub, "members");
			setUsers((prev) => prev.filter((u) => u.sub !== user.sub));
		} catch (err) {
			setError(err instanceof Error ? err.message : "approve failed");
		} finally {
			setApprovingIds((prev) => {
				const next = new Set(prev);
				next.delete(user.sub);
				return next;
			});
		}
	}, []);

	return (
		<SpaceBetween size="m">
			{error && (
				<Alert
					type="error"
					header={t("admin.errorHeader")}
					dismissible
					onDismiss={() => setError(null)}
				>
					{error}
				</Alert>
			)}
			<Table
				loading={loading}
				loadingText={t("admin.loadingText")}
				items={users}
				columnDefinitions={[
					{
						id: "email",
						header: t("admin.columnEmail"),
						cell: (u) => u.email,
						isRowHeader: true,
					},
					{
						id: "status",
						header: t("admin.columnStatus"),
						cell: (u) => u.status,
					},
					{
						id: "createdAt",
						header: t("admin.columnCreated"),
						cell: (u) => new Date(u.createdAt).toLocaleDateString(),
					},
					{
						id: "actions",
						header: t("admin.columnActions"),
						cell: (u) => (
							<Button
								variant="primary"
								loading={approvingIds.has(u.sub)}
								onClick={() => {
									void handleApprove(u);
								}}
							>
								{t("admin.approveButton")}
							</Button>
						),
					},
				]}
				empty={
					<Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
						<SpaceBetween size="s">
							<Box variant="strong">{t("admin.emptyTitle")}</Box>
							<Box variant="p" color="inherit">
								{t("admin.emptySubtitle")}
							</Box>
						</SpaceBetween>
					</Box>
				}
				header={
					<Header counter={loading ? undefined : `(${users.length})`}>
						{t("admin.tableHeader")}
					</Header>
				}
			/>
		</SpaceBetween>
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
			pageTitle="admin.pageTitle"
			breadcrumbs={<BreadcrumbsContent />}
			navigation={<Navigation />}
		>
			<RequireAuth requireGroup="moderators">
				<AdminTable />
			</RequireAuth>
		</ShellLayout>
	);
}
