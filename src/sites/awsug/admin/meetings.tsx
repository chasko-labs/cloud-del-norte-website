// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import DatePicker from "@cloudscape-design/components/date-picker";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import Textarea from "@cloudscape-design/components/textarea";
import TimeInput from "@cloudscape-design/components/time-input";
import { useState } from "react";

export interface ScheduledMeeting {
	meetingId: string;
	title: string;
	date: string; // YYYY-MM-DD
	time: string; // HH:MM
	description: string;
	roomHash: string;
}

// TODO: replace with GET /admin/scheduled-meetings
const MOCK_MEETINGS: ScheduledMeeting[] = [
	{
		meetingId: "mock-1",
		title: "AWS UG May Meetup",
		date: "2026-05-20",
		time: "18:00",
		description: "Monthly meetup — cloud networking topics",
		roomHash: "abc123def456",
	},
	{
		meetingId: "mock-2",
		title: "Re:Invent Watch Party",
		date: "2026-06-01",
		time: "09:00",
		description: "Live stream watch party",
		roomHash: "xyz789uvw012",
	},
];

const SHARE_BASE = "https://cloudnorte.dev/meetings/join/";

interface CreateForm {
	title: string;
	date: string;
	time: string;
	description: string;
}

const EMPTY_FORM: CreateForm = {
	title: "",
	date: "",
	time: "",
	description: "",
};

export function MeetingsTable() {
	const [meetings, setMeetings] = useState<ScheduledMeeting[]>(MOCK_MEETINGS);
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	async function handleCreate() {
		if (!form.title || !form.date || !form.time) {
			setError("Title, date, and time are required.");
			return;
		}
		setSaving(true);
		setError("");
		try {
			// TODO: POST /admin/scheduled-meetings with form data
			// const res = await apiRequest("/admin/scheduled-meetings", "POST", form);
			// if (!res.ok) throw new Error(`create failed: ${res.status}`);
			// const created: ScheduledMeeting = await res.json();
			// setMeetings((prev) => [...prev, created]);

			// Mock: generate a fake entry until Lambda exists
			const mockCreated: ScheduledMeeting = {
				meetingId: `mock-${Date.now()}`,
				roomHash: Math.random().toString(36).slice(2, 14),
				...form,
			};
			setMeetings((prev) => [...prev, mockCreated]);
			setShowCreate(false);
			setForm(EMPTY_FORM);
		} catch {
			setError("Failed to create meeting.");
		} finally {
			setSaving(false);
		}
	}

	const columns = [
		{
			id: "title",
			header: "Title",
			cell: (m: ScheduledMeeting) => m.title,
			minWidth: 180,
		},
		{
			id: "date",
			header: "Date",
			cell: (m: ScheduledMeeting) => m.date,
			minWidth: 110,
		},
		{
			id: "time",
			header: "Time",
			cell: (m: ScheduledMeeting) => m.time,
			minWidth: 80,
		},
		{
			id: "description",
			header: "Description",
			cell: (m: ScheduledMeeting) => m.description,
			minWidth: 200,
		},
		{
			id: "shareUrl",
			header: "Share URL",
			cell: (m: ScheduledMeeting) => (
				<a
					href={`${SHARE_BASE}${m.roomHash}`}
					target="_blank"
					rel="noreferrer"
				>{`${SHARE_BASE}${m.roomHash}`}</a>
			),
			minWidth: 260,
		},
	];

	return (
		<>
			<Modal
				visible={showCreate}
				onDismiss={() => {
					setShowCreate(false);
					setForm(EMPTY_FORM);
					setError("");
				}}
				header="Create Meeting"
				footer={
					<SpaceBetween direction="horizontal" size="xs">
						<Button
							onClick={() => {
								setShowCreate(false);
								setForm(EMPTY_FORM);
								setError("");
							}}
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							loading={saving}
							onClick={() => {
								void handleCreate();
							}}
						>
							Create
						</Button>
					</SpaceBetween>
				}
			>
				<SpaceBetween size="m">
					{error && <Alert type="error">{error}</Alert>}
					<FormField label="Title">
						<Input
							value={form.title}
							onChange={({ detail }) =>
								setForm((f) => ({ ...f, title: detail.value }))
							}
							placeholder="Meeting title"
						/>
					</FormField>
					<FormField label="Date">
						<DatePicker
							value={form.date}
							onChange={({ detail }) =>
								setForm((f) => ({ ...f, date: detail.value }))
							}
							placeholder="YYYY/MM/DD"
						/>
					</FormField>
					<FormField label="Time">
						<TimeInput
							value={form.time}
							onChange={({ detail }) =>
								setForm((f) => ({ ...f, time: detail.value }))
							}
							format="hh:mm"
							placeholder="hh:mm"
						/>
					</FormField>
					<FormField label="Description">
						<Textarea
							value={form.description}
							onChange={({ detail }) =>
								setForm((f) => ({ ...f, description: detail.value }))
							}
							placeholder="Optional description"
						/>
					</FormField>
				</SpaceBetween>
			</Modal>

			<Table
				items={meetings}
				columnDefinitions={columns}
				empty={<Box textAlign="center">No meetings scheduled.</Box>}
				header={
					<Header
						counter={`(${meetings.length})`}
						actions={
							<Button variant="primary" onClick={() => setShowCreate(true)}>
								Create meeting
							</Button>
						}
					>
						Scheduled Meetings
					</Header>
				}
			/>
		</>
	);
}
