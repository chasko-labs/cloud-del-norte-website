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
import { useCallback, useEffect, useState } from "react";
import {
	type AdminMeeting,
	createMeeting,
	deleteMeeting,
	listAdminMeetings,
	listMeetings,
	type ScheduledMeetingApi,
	updateAdminMeeting,
} from "../_shared/api";

const SHARE_BASE = "https://clouddelnorte.org/m/";

interface CreateForm {
	title: string;
	date: string;
	time: string;
	description: string;
	duration_minutes: string;
}

const EMPTY_FORM: CreateForm = {
	title: "",
	date: "",
	time: "",
	description: "",
	duration_minutes: "60",
};

interface EditForm {
	meetupLink: string;
	speakers: string;
	notes: string;
	scheduledDate: string;
	scheduledTime: string;
	speakerBioUrl: string;
	meetupRsvpUrl: string;
}

const EMPTY_EDIT: EditForm = {
	meetupLink: "",
	speakers: "",
	notes: "",
	scheduledDate: "",
	scheduledTime: "",
	speakerBioUrl: "",
	meetupRsvpUrl: "",
};

export function MeetingsTable() {
	const [meetings, setMeetings] = useState<ScheduledMeetingApi[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [invitees, setInvitees] = useState("");

	// Edit state
	const [editTarget, setEditTarget] = useState<AdminMeeting | null>(null);
	const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
	const [editSaving, setEditSaving] = useState(false);
	const [adminMeetings, setAdminMeetings] = useState<AdminMeeting[]>([]);
	const [adminLoading, setAdminLoading] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			setMeetings(await listMeetings());
		} catch {
			setError("Failed to load meetings.");
		} finally {
			setLoading(false);
		}
	}, []);

	const loadAdminMeetings = useCallback(async () => {
		setAdminLoading(true);
		try {
			setAdminMeetings(await listAdminMeetings("upcoming"));
		} catch {
			// non-fatal
		} finally {
			setAdminLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
		void loadAdminMeetings();
	}, [load, loadAdminMeetings]);

	async function handleCreate() {
		if (!form.title || !form.date || !form.time) {
			setError("Title, date, and time are required.");
			return;
		}
		setSaving(true);
		setError("");
		try {
			const scheduled_start = `${form.date}T${form.time}:00`;
			const created = await createMeeting({
				title: form.title,
				scheduled_start,
				description: form.description,
				duration_minutes: Number(form.duration_minutes) || 60,
				invitees: invitees.trim()
					? invitees
							.split(",")
							.map((e) => e.trim())
							.filter(Boolean)
					: undefined,
			});
			setMeetings((prev) => [...prev, created]);
			setShowCreate(false);
			setForm(EMPTY_FORM);
			setInvitees("");
		} catch {
			setError("Failed to create meeting.");
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(m: ScheduledMeetingApi) {
		setDeletingId(m.meeting_id);
		setError("");
		try {
			await deleteMeeting(m.meeting_id, m.scheduled_start);
			setMeetings((prev) => prev.filter((x) => x.meeting_id !== m.meeting_id));
		} catch {
			setError("Failed to delete meeting.");
		} finally {
			setDeletingId(null);
		}
	}

	function openEdit(m: AdminMeeting) {
		setEditTarget(m);
		setEditForm({
			meetupLink: m.meetup_link ?? "",
			speakers: m.speakers ?? "",
			notes: m.notes ?? "",
			scheduledDate: m.scheduled_date ?? "",
			scheduledTime: m.scheduled_time ?? "",
			speakerBioUrl: m.speaker_bio_url ?? "",
			meetupRsvpUrl: m.meetup_rsvp_url ?? "",
		});
		setError("");
	}

	async function handleEditSave() {
		if (!editTarget) return;
		setEditSaving(true);
		setError("");
		try {
			await updateAdminMeeting(editTarget.meeting_id, editForm);
			setEditTarget(null);
			setEditForm(EMPTY_EDIT);
			void loadAdminMeetings();
		} catch {
			setError("Failed to save meeting.");
		} finally {
			setEditSaving(false);
		}
	}

	const columns = [
		{
			id: "title",
			header: "Title",
			cell: (m: ScheduledMeetingApi) => m.title,
			minWidth: 180,
		},
		{
			id: "scheduled_start",
			header: "Scheduled Start",
			cell: (m: ScheduledMeetingApi) =>
				new Date(m.scheduled_start).toLocaleString(),
			minWidth: 180,
		},
		{
			id: "duration",
			header: "Duration (min)",
			cell: (m: ScheduledMeetingApi) => m.duration_minutes,
			minWidth: 100,
		},
		{
			id: "description",
			header: "Description",
			cell: (m: ScheduledMeetingApi) => m.description,
			minWidth: 200,
		},
		{
			id: "shareUrl",
			header: "Share URL",
			cell: (m: ScheduledMeetingApi) => (
				<a
					href={`${SHARE_BASE}${m.room_hash}`}
					target="_blank"
					rel="noreferrer"
				>{`${SHARE_BASE}${m.room_hash}`}</a>
			),
			minWidth: 260,
		},
		{
			id: "actions",
			header: "Actions",
			minWidth: 100,
			cell: (m: ScheduledMeetingApi) => (
				<Button
					loading={deletingId === m.meeting_id}
					onClick={() => {
						void handleDelete(m);
					}}
				>
					Delete
				</Button>
			),
		},
	];

	const adminColumns = [
		{
			id: "speakers",
			header: "Speakers",
			cell: (m: AdminMeeting) => m.speakers ?? "",
			minWidth: 160,
		},
		{
			id: "date",
			header: "Date",
			cell: (m: AdminMeeting) =>
				m.scheduled_date
					? `${m.scheduled_date}${m.scheduled_time ? ` ${m.scheduled_time}` : ""}`
					: "",
			minWidth: 140,
		},
		{
			id: "meetupLink",
			header: "Meetup",
			cell: (m: AdminMeeting) =>
				m.meetup_link ? (
					<a href={m.meetup_link} target="_blank" rel="noreferrer">
						link
					</a>
				) : null,
			minWidth: 80,
		},
		{
			id: "rsvpUrl",
			header: "RSVP URL",
			cell: (m: AdminMeeting) => m.meetup_rsvp_url ?? "",
			minWidth: 140,
		},
		{
			id: "edit",
			header: "Edit",
			minWidth: 80,
			cell: (m: AdminMeeting) => (
				<Button onClick={() => openEdit(m)}>Edit</Button>
			),
		},
	];

	return (
		<>
			{/* Edit modal */}
			<Modal
				visible={!!editTarget}
				onDismiss={() => {
					setEditTarget(null);
					setEditForm(EMPTY_EDIT);
					setError("");
				}}
				header="Edit Meeting"
				footer={
					<SpaceBetween direction="horizontal" size="xs">
						<Button
							onClick={() => {
								setEditTarget(null);
								setEditForm(EMPTY_EDIT);
								setError("");
							}}
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							loading={editSaving}
							onClick={() => {
								void handleEditSave();
							}}
						>
							Save
						</Button>
					</SpaceBetween>
				}
			>
				<SpaceBetween size="m">
					{error && <Alert type="error">{error}</Alert>}
					<FormField label="Meetup link">
						<Input
							value={editForm.meetupLink}
							onChange={({ detail }) =>
								setEditForm((f) => ({ ...f, meetupLink: detail.value }))
							}
						/>
					</FormField>
					<FormField label="Speakers">
						<Input
							value={editForm.speakers}
							onChange={({ detail }) =>
								setEditForm((f) => ({ ...f, speakers: detail.value }))
							}
						/>
					</FormField>
					<FormField label="Scheduled date">
						<DatePicker
							value={editForm.scheduledDate}
							onChange={({ detail }) =>
								setEditForm((f) => ({ ...f, scheduledDate: detail.value }))
							}
							placeholder="YYYY/MM/DD"
						/>
					</FormField>
					<FormField label="Scheduled time">
						<TimeInput
							value={editForm.scheduledTime}
							onChange={({ detail }) =>
								setEditForm((f) => ({ ...f, scheduledTime: detail.value }))
							}
							format="hh:mm"
							placeholder="hh:mm"
						/>
					</FormField>
					<FormField label="Speaker bio URL">
						<Input
							value={editForm.speakerBioUrl}
							onChange={({ detail }) =>
								setEditForm((f) => ({ ...f, speakerBioUrl: detail.value }))
							}
							placeholder="https://linkedin.com/in/..."
						/>
					</FormField>
					<FormField label="Meetup RSVP URL">
						<Input
							value={editForm.meetupRsvpUrl}
							onChange={({ detail }) =>
								setEditForm((f) => ({ ...f, meetupRsvpUrl: detail.value }))
							}
							placeholder="https://meetup.com/..."
						/>
					</FormField>
					<FormField label="Notes">
						<Textarea
							value={editForm.notes}
							onChange={({ detail }) =>
								setEditForm((f) => ({ ...f, notes: detail.value }))
							}
							placeholder="Optional notes"
						/>
					</FormField>
				</SpaceBetween>
			</Modal>

			{/* Create modal */}
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
					<FormField label="Duration (minutes)">
						<Input
							value={form.duration_minutes}
							onChange={({ detail }) =>
								setForm((f) => ({ ...f, duration_minutes: detail.value }))
							}
							type="number"
							placeholder="60"
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
					<FormField
						label="invite (emails, comma-separated)"
						description="optional — sends email invites with meeting link"
					>
						<Input
							value={invitees}
							onChange={({ detail }) => setInvitees(detail.value)}
							placeholder="alice@example.com, bob@example.com"
						/>
					</FormField>
				</SpaceBetween>
			</Modal>

			<SpaceBetween size="m">
				{error && !showCreate && (
					<Alert type="error" dismissible onDismiss={() => setError("")}>
						{error}
					</Alert>
				)}
				<Table
					items={meetings}
					columnDefinitions={columns}
					loading={loading}
					loadingText="Loading meetings"
					empty={<Box textAlign="center">No meetings scheduled.</Box>}
					header={
						<Header
							counter={`(${meetings.length})`}
							actions={
								<SpaceBetween direction="horizontal" size="xs">
									<Button
										iconName="refresh"
										onClick={() => {
											void load();
										}}
									/>
									<Button variant="primary" onClick={() => setShowCreate(true)}>
										Create meeting
									</Button>
								</SpaceBetween>
							}
						>
							Scheduled Meetings
						</Header>
					}
				/>

				{/* Portal admin meetings (editable via /admin/meetings) */}
				<Table
					items={adminMeetings}
					columnDefinitions={adminColumns}
					loading={adminLoading}
					loadingText="Loading portal meetings"
					empty={<Box textAlign="center">No portal meetings.</Box>}
					header={
						<Header
							counter={`(${adminMeetings.length})`}
							actions={
								<Button
									iconName="refresh"
									onClick={() => {
										void loadAdminMeetings();
									}}
								/>
							}
						>
							Portal Meetings (editable)
						</Header>
					}
				/>
			</SpaceBetween>
		</>
	);
}
