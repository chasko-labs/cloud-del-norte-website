// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useCollection } from "@cloudscape-design/collection-hooks";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import CollectionPreferences, {
	type CollectionPreferencesProps,
} from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { type ReactNode, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "../../../hooks/useTranslation";
import type { meeting } from "../data";
import JitsiEmbed from "./jitsi-embed";

function generateInstantRoomName(): string {
	const bytes = new Uint8Array(3);
	crypto.getRandomValues(bytes);
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
		"",
	);
	return `instant-${hex}`;
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
): TableProps<meeting>["columnDefinitions"] => [
	{
		header: t("meetings.tableHeaders.meetupTitle"),
		cell: ({ name }) => name,
		sortingField: "name",
		minWidth: 175,
	},
	{
		header: t("meetings.tableHeaders.presenters"),
		cell: ({ presenters }) => presenters,
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
		// Join column — renders a button only for meetings with a roomName (upcoming events).
		id: "join",
		header: "Join",
		cell: (m) =>
			m.roomName ? (
				<Button variant="primary" onClick={() => onJoin(m)}>
					Join
				</Button>
			) : (
				""
			),
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
			defaultState: { sortingColumn: columnDefinitions(t, setActiveRoom)[0] },
		},
		selection: {},
	});

	return (
		<>
			{/* Wrapper enables horizontal scroll under 720px so the wide
			    cloudscape table does not push the shell off the viewport on
			    phones. Desktop is untouched — wrapper is width:100%. */}
			<div className="cdn-meetings-table-wrap">
				<Table<meeting>
					{...collectionProps}
					enableKeyboardNavigation={false}
					items={items}
					columnDefinitions={columnDefinitions(t, setActiveRoom)}
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
									{auth.isModerator && (
										<Button
											variant="primary"
											onClick={() => {
												const roomName = generateInstantRoomName();
												setActiveRoom({
													name: "instant meeting (ask participants to join)",
													presenters: "",
													happened: "false",
													ondemand: "no",
													eventlink: "",
													roomName,
												});
											}}
										>
											instant meet
										</Button>
									)}
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
				{activeRoom?.roomName && (
					<JitsiEmbed
						roomName={activeRoom.roomName}
						onClose={() => setActiveRoom(null)}
					/>
				)}
			</Modal>
		</>
	);
}
