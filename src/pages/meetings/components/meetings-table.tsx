// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useCollection } from "@cloudscape-design/collection-hooks";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import CollectionPreferences, {
	type CollectionPreferencesProps,
} from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { type ReactNode, useState } from "react";
import TimezoneSelect from "../../../components/meetings/TimezoneSelect";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "../../../hooks/useTranslation";
import type { meeting } from "../data";
import { generateRoomPassword } from "../data";
import { formatInTz, getStoredTimezone } from "../util/timezone";
import JitsiEmbed from "./jitsi-embed";

function generateInstantRoomName(): string {
	const bytes = new Uint8Array(3);
	crypto.getRandomValues(bytes);
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
		"",
	);
	return `instant-${hex}`;
}

/** Join window: opens 30 min before scheduledTime, closes 60 min after.
 *  If no scheduledTime provided, falls back to all-day on scheduledDate. */
function isJoinWindowOpen(
	scheduledDate?: string,
	scheduledTime?: string,
): boolean {
	if (!scheduledDate) return false;
	const now = new Date();
	const [y, m, d] = scheduledDate.split("-").map(Number);

	if (!scheduledTime) {
		// No time specified — allow all day
		return (
			now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d
		);
	}

	const [h, min] = scheduledTime.split(":").map(Number);
	// Build scheduled datetime in local timezone
	const scheduled = new Date(y, m - 1, d, h, min, 0);
	const openAt = new Date(scheduled.getTime() - 30 * 60_000);
	const closeAt = new Date(scheduled.getTime() + 60 * 60_000);
	return now >= openAt && now <= closeAt;
}

const getFilterCounterText = (count = 0, t: (key: string) => string) =>
	`${count} ${count === 1 ? t("meetings.filterCounter.match") : t("meetings.filterCounter.matches")}`;
const getHeaderCounterText = (
	items: readonly meeting[] = [],
	selectedItems: readonly meeting[] = [],
) => {
	return selectedItems && selectedItems.length > 0
		? `(${selectedItems.length}/${items.length})`
		: `(${items.length})`;
};

const columnDefinitions = (
	t: (key: string) => string,
	onJoin: (m: meeting) => void,
	isAuthenticated: boolean,
	selectedTz: string,
): TableProps<meeting>["columnDefinitions"] => [
	{
		header: t("meetings.tableHeaders.meetupTitle"),
		cell: (m) =>
			m.scheduledDate && m.scheduledTime ? (
				<SpaceBetween size="xxs">
					<span>{m.name}</span>
					<Box variant="small" color="text-body-secondary">
						{formatInTz(m.scheduledDate, m.scheduledTime, selectedTz)}
					</Box>
				</SpaceBetween>
			) : (
				m.name
			),
		sortingField: "name",
		minWidth: 175,
	},
	{
		header: t("meetings.tableHeaders.presenters"),
		cell: ({ presenters, speakerBioUrl, speakerBio }) => (
			<SpaceBetween size="xxs">
				{speakerBioUrl ? (
					<SpaceBetween size="xxs" direction="horizontal">
						<span>{presenters}</span>
						<Link href={speakerBioUrl} external>
							bio
						</Link>
					</SpaceBetween>
				) : (
					<span>{presenters}</span>
				)}
				{speakerBio && (
					<span
						style={{
							display: "-webkit-box",
							fontStyle: "italic",
							fontSize: "var(--font-size-body-s, 12px)",
							color: "var(--color-text-body-secondary)",
							WebkitLineClamp: 3,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
						title={speakerBio}
					>
						{speakerBio}
					</span>
				)}
			</SpaceBetween>
		),
		sortingField: "presenters",
		minWidth: 160,
	},
	{
		header: t("meetings.tableHeaders.happened"),
		cell: ({ happened }) => happened,
		sortingField: "happened",
		minWidth: 90,
	},
	{
		header: t("meetings.tableHeaders.onDemand"),
		cell: ({ ondemand }) => ondemand,
		sortingField: "ondemand",
		minWidth: 140,
	},
	{
		header: t("meetings.tableHeaders.eventPage"),
		cell: ({ eventlink }) => eventlink,
		sortingField: "eventlink",
		minWidth: 160,
	},
	{
		id: "rsvp",
		header: t("meetings.tableHeaders.rsvp"),
		cell: ({ meetupRsvpUrl, eventlink }) => {
			const isMeetupUrl = !!meetupRsvpUrl;
			const url = meetupRsvpUrl || eventlink;
			if (!url) return null;
			return (
				<Button
					variant="link"
					href={url}
					target="_blank"
					iconAlign="right"
					iconName="external"
				>
					{isMeetupUrl ? t("meetings.rsvpOnMeetup") : t("meetings.rsvpButton")}
				</Button>
			);
		},
		minWidth: 80,
	},
	{
		// Join column — only shown for meetings scheduled today (scheduledDate
		// matches the user's local calendar day) and with a roomName.
		id: "join",
		header: "Join",
		cell: (m) => {
			if (!m.roomName || !isJoinWindowOpen(m.scheduledDate, m.scheduledTime))
				return "";
			if (!isAuthenticated) {
				return (
					<Button
						variant="link"
						href="https://auth.clouddelnorte.org/login/index.html"
					>
						sign in to join
					</Button>
				);
			}
			return (
				<Button variant="primary" onClick={() => onJoin(m)}>
					Join
				</Button>
			);
		},
		minWidth: 90,
	},
];

const EmptyState = ({
	title,
	subtitle,
	action,
}: {
	title: string;
	subtitle: string;
	action: ReactNode;
}) => {
	return (
		<Box textAlign="center" color="inherit">
			<Box variant="strong" textAlign="center" color="inherit">
				{title}
			</Box>
			<Box variant="p" padding={{ bottom: "s" }} color="inherit">
				{subtitle}
			</Box>
			{action}
		</Box>
	);
};

export interface VariationTableProps {
	meetings: meeting[];
}

export default function VariationTable({ meetings }: VariationTableProps) {
	const { t } = useTranslation();
	const auth = useAuth();
	const [preferences, setPreferences] = useState<
		CollectionPreferencesProps["preferences"]
	>({ pageSize: 20 });
	const [activeRoom, setActiveRoom] = useState<meeting | null>(null);
	const [selectedTz, setSelectedTz] = useState<string>(() =>
		getStoredTimezone(),
	);

	const hasCallToday = meetings.some(
		(m) => m.roomName && isJoinWindowOpen(m.scheduledDate, m.scheduledTime),
	);
	const {
		items,
		filterProps,
		actions,
		filteredItemsCount,
		paginationProps,
		collectionProps,
	} = useCollection<meeting>(meetings, {
		filtering: {
			noMatch: (
				<EmptyState
					title={t("meetings.empty.noMatches")}
					subtitle={t("meetings.empty.noMatchesSubtitle")}
					action={
						<Button onClick={() => actions.setFiltering("")}>
							{}
							{t("meetings.empty.clearFilter")}
						</Button>
					}
				/>
			),
			empty: (
				<EmptyState
					title={t("meetings.empty.noMeetings")}
					subtitle={t("meetings.empty.noMeetingsSubtitle")}
					action={<Button>{t("meetings.createButton")}</Button>}
				/>
			),
		},
		pagination: { pageSize: preferences?.pageSize },
		sorting: {
			defaultState: {
				sortingColumn: columnDefinitions(
					t,
					setActiveRoom,
					auth.isAuthenticated,
					selectedTz,
				)[0],
			},
		},
		selection: {},
	});

	return (
		<>
			{!hasCallToday && (
				<Box
					padding={{ vertical: "s", horizontal: "l" }}
					color="text-status-inactive"
					textAlign="center"
				>
					No active calls scheduled for today.
				</Box>
			)}
			{/* Wrapper enables horizontal scroll under 720px so the wide
			    cloudscape table does not push the shell off the viewport on
			    phones. Desktop is untouched — wrapper is width:100%. */}
			<div className="cdn-meetings-table-wrap">
				<Table<meeting>
					{...collectionProps}
					enableKeyboardNavigation={false}
					items={items}
					columnDefinitions={columnDefinitions(
						t,
						setActiveRoom,
						auth.isAuthenticated,
						selectedTz,
					)}
					stickyHeader={true}
					resizableColumns={true}
					variant="full-page"
					//selectionType="single"
					ariaLabels={{
						selectionGroupLabel: t("meetings.aria.selectionGroup"),
						itemSelectionLabel: ({ selectedItems }, item) => {
							const isItemSelected = selectedItems.filter(
								(i) => i.name === item.name,
							).length;
							return `${item.name} is ${isItemSelected ? "" : "not "}selected`;
						},
						tableLabel: t("meetings.aria.tableLabel"),
					}}
					header={
						<Header
							variant="awsui-h1-sticky"
							counter={getHeaderCounterText(
								meetings,
								collectionProps.selectedItems,
							)}
							actions={
								<SpaceBetween size="xs" direction="horizontal">
									<TimezoneSelect value={selectedTz} onChange={setSelectedTz} />
									{auth.isAuthenticated && auth.isModerator && (
										<Button
											variant="primary"
											onClick={() => {
												const roomName = generateInstantRoomName();
												const roomPassword = generateRoomPassword();
												setActiveRoom({
													name: "instant meeting (ask participants to join)",
													presenters: "",
													happened: "false",
													ondemand: "no",
													eventlink: "",
													roomName,
													roomPassword,
												});
											}}
										>
											instant meet
										</Button>
									)}
									{auth.isAuthenticated && auth.isModerator && (
										<>
											<Button
												disabled={collectionProps.selectedItems?.length === 0}
											>
												{t("meetings.editButton")}
											</Button>
											<Button
												disabled={collectionProps.selectedItems?.length === 0}
												href="/create-meeting/index.html"
												variant="primary"
											>
												{t("meetings.createButton")}
											</Button>
										</>
									)}
								</SpaceBetween>
							}
						>
							{t("meetings.header")}
						</Header>
					}
					pagination={<Pagination {...paginationProps} />}
					filter={
						<TextFilter
							{...filterProps}
							filteringPlaceholder={t("meetings.findPlaceholder")}
							countText={getFilterCounterText(filteredItemsCount, t)}
						/>
					}
					preferences={
						<CollectionPreferences
							preferences={preferences}
							pageSizePreference={{
								title: t("meetings.preferences.pageSize"),
								options: [
									{ value: 10, label: t("meetings.preferences.resources10") },
									{ value: 20, label: t("meetings.preferences.resources20") },
									{ value: 50, label: t("meetings.preferences.resources50") },
									{ value: 100, label: t("meetings.preferences.resources100") },
								],
							}}
							onConfirm={({ detail }) => setPreferences(detail)}
							title={t("meetings.preferences.title")}
							confirmLabel={t("meetings.preferences.confirm")}
							cancelLabel={t("meetings.preferences.cancel")}
						/>
					}
				/>
			</div>
			<Modal
				visible={!!activeRoom}
				onDismiss={() => setActiveRoom(null)}
				size="max"
				header={activeRoom?.name ?? ""}
				closeAriaLabel="close meeting"
			>
				{activeRoom?.roomPassword && (
					<Box
						variant="small"
						color="text-body-secondary"
						margin={{ bottom: "s" }}
					>
						room password:{" "}
						<Box variant="code" display="inline">
							{activeRoom.roomPassword}
						</Box>
					</Box>
				)}
				{activeRoom?.roomName && (
					<JitsiEmbed
						roomName={activeRoom.roomName}
						roomPassword={activeRoom.roomPassword}
						onClose={() => setActiveRoom(null)}
					/>
				)}
			</Modal>
		</>
	);
}
