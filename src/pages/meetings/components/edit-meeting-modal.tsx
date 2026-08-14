import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import DatePicker from "@cloudscape-design/components/date-picker";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import TimeInput from "@cloudscape-design/components/time-input";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import {
	deleteScheduledMeeting,
	updateScheduledMeeting,
} from "../../../lib/scheduled-meetings";
import type { meeting } from "../data";

const TIMEZONE_OPTIONS = [
	{ value: "America/Denver", label: "El Paso (America/Denver)" },
	{ value: "America/New_York", label: "Boston (America/New_York)" },
	{ value: "America/Los_Angeles", label: "Seattle (America/Los_Angeles)" },
	{ value: "Europe/London", label: "Greenwich (Europe/London)" },
	{ value: "Asia/Tashkent", label: "Shahrisabz (Asia/Tashkent)" },
];

export interface EditMeetingModalProps {
	meeting: meeting | null;
	visible: boolean;
	onDismiss: () => void;
	onSave: () => void;
}

export default function EditMeetingModal({
	meeting: m,
	visible,
	onDismiss,
	onSave,
}: EditMeetingModalProps) {
	const { t } = useTranslation();

	const [name, setName] = useState("");
	const [presenters, setPresenters] = useState("");
	const [eventlink, setEventlink] = useState("");
	const [scheduledDate, setScheduledDate] = useState("");
	const [scheduledTime, setScheduledTime] = useState("20:00");
	const [timezone, setTimezone] = useState("America/Denver");
	const [speakerBioUrl, setSpeakerBioUrl] = useState("");
	const [meetupRsvpUrl, setMeetupRsvpUrl] = useState("");
	const [notes, setNotes] = useState("");
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState("");

	// Reset form when meeting changes
	useEffect(() => {
		if (m && visible) {
			setName(m.name);
			setPresenters(m.presenters);
			setEventlink(m.eventlink);
			setScheduledDate(m.scheduledDate ?? "");
			setScheduledTime(m.scheduledTime ?? "20:00");
			setSpeakerBioUrl(m.speakerBioUrl ?? "");
			setMeetupRsvpUrl(m.meetupRsvpUrl ?? "");
			setNotes(m.description ?? "");
			setError("");
		}
	}, [m, visible]);

	const meetupRsvpError =
		meetupRsvpUrl && !/^https:\/\/(www\.)?meetup\.com\//.test(meetupRsvpUrl)
			? t("meetings.editModal.meetupRsvpUrlError") ||
				"Must be a valid meetup.com URL."
			: "";

	async function handleSave() {
		if (!m) return;
		setError("");
		setSaving(true);
		try {
			if (m.meetingId) {
				// Build scheduled_start from date + time
				const scheduledStart =
					scheduledDate && scheduledTime
						? `${scheduledDate}T${scheduledTime}:00`
						: undefined;
				await updateScheduledMeeting(m.meetingId, {
					title: name || undefined,
					description: notes || undefined,
					scheduled_start: scheduledStart,
					speaker_bio_url: speakerBioUrl || undefined,
					meetup_rsvp_url: meetupRsvpUrl || undefined,
				});
			}
			onSave();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to update meeting.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete() {
		if (!m?.meetingId) return;
		setError("");
		setDeleting(true);
		try {
			await deleteScheduledMeeting(m.meetingId);
			onSave();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to delete meeting.",
			);
		} finally {
			setDeleting(false);
		}
	}

	return (
		<Modal
			visible={visible}
			onDismiss={onDismiss}
			size="medium"
			header={t("meetings.editModal.title")}
			footer={
				<Box float="right">
					<SpaceBetween direction="horizontal" size="xs">
						{m?.meetingId && (
							<Button
								variant="link"
								onClick={() => {
									void handleDelete();
								}}
								loading={deleting}
							>
								{t("meetings.editModal.delete") || "Delete"}
							</Button>
						)}
						<Button variant="link" onClick={onDismiss}>
							{t("meetings.editModal.cancel")}
						</Button>
						<Button
							variant="primary"
							disabled={!!meetupRsvpError}
							loading={saving}
							onClick={() => {
								void handleSave();
							}}
						>
							{t("meetings.editModal.save")}
						</Button>
					</SpaceBetween>
				</Box>
			}
		>
			<SpaceBetween size="m">
				{error && (
					<Box color="text-status-error" variant="small">
						{error}
					</Box>
				)}
				<FormField label={t("meetings.editModal.speakers")}>
					<Input
						value={presenters}
						onChange={({ detail }) => setPresenters(detail.value)}
					/>
				</FormField>

				<FormField label={t("meetings.editModal.meetupLink")}>
					<Input
						value={eventlink}
						onChange={({ detail }) => setEventlink(detail.value)}
					/>
				</FormField>

				<FormField label={t("meetings.editModal.scheduledDate")}>
					<DatePicker
						value={scheduledDate}
						onChange={({ detail }) => setScheduledDate(detail.value)}
						placeholder="YYYY/MM/DD"
					/>
				</FormField>

				<SpaceBetween size="s" direction="horizontal">
					<FormField label={t("meetings.editModal.scheduledTime")}>
						<TimeInput
							value={scheduledTime}
							onChange={({ detail }) => setScheduledTime(detail.value)}
							format="hh:mm"
							placeholder="HH:MM"
						/>
					</FormField>
					<FormField label={t("scheduledMeetings.form.timezoneLabel")}>
						<Select
							selectedOption={
								TIMEZONE_OPTIONS.find((o) => o.value === timezone) ??
								TIMEZONE_OPTIONS[0]
							}
							onChange={({ detail }) =>
								setTimezone(detail.selectedOption.value ?? "America/Denver")
							}
							options={TIMEZONE_OPTIONS}
						/>
					</FormField>
				</SpaceBetween>

				<FormField label={t("meetings.editModal.speakerBioUrl")}>
					<Input
						value={speakerBioUrl}
						onChange={({ detail }) => setSpeakerBioUrl(detail.value)}
						placeholder="https://linkedin.com/in/..."
					/>
				</FormField>

				<FormField
					label={t("meetings.editModal.meetupRsvpUrl")}
					errorText={meetupRsvpError}
				>
					<Input
						value={meetupRsvpUrl}
						onChange={({ detail }) => setMeetupRsvpUrl(detail.value)}
						placeholder="https://meetup.com/..."
					/>
				</FormField>

				<FormField label={t("meetings.editModal.notes")}>
					<Textarea
						value={notes}
						onChange={({ detail }) => setNotes(detail.value)}
						rows={3}
					/>
				</FormField>
			</SpaceBetween>
		</Modal>
	);
}
