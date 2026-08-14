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
import { useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
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
	onSave: (updated: meeting) => void;
}

export default function EditMeetingModal({
	meeting: m,
	visible,
	onDismiss,
	onSave,
}: EditMeetingModalProps) {
	const { t } = useTranslation();

	const [name, setName] = useState(m?.name ?? "");
	const [presenters, setPresenters] = useState(m?.presenters ?? "");
	const [eventlink, setEventlink] = useState(m?.eventlink ?? "");
	const [scheduledDate, setScheduledDate] = useState(m?.scheduledDate ?? "");
	const [scheduledTime, setScheduledTime] = useState(
		m?.scheduledTime ?? "20:00",
	);
	const [timezone, setTimezone] = useState("America/Denver");
	const [speakerBioUrl, setSpeakerBioUrl] = useState(m?.speakerBioUrl ?? "");
	const [meetupRsvpUrl, setMeetupRsvpUrl] = useState(m?.meetupRsvpUrl ?? "");
	const [notes, setNotes] = useState("");

	// Reset form when meeting changes
	if (m && name !== m.name && visible) {
		setName(m.name);
		setPresenters(m.presenters);
		setEventlink(m.eventlink);
		setScheduledDate(m.scheduledDate ?? "");
		setScheduledTime(m.scheduledTime ?? "20:00");
		setSpeakerBioUrl(m.speakerBioUrl ?? "");
		setMeetupRsvpUrl(m.meetupRsvpUrl ?? "");
	}

	const meetupRsvpError =
		meetupRsvpUrl && !/^https:\/\/(www\.)?meetup\.com\//.test(meetupRsvpUrl)
			? t("meetings.editModal.meetupRsvpUrlError") ||
				"Must be a valid meetup.com URL."
			: "";

	return (
		<Modal
			visible={visible}
			onDismiss={onDismiss}
			size="medium"
			header={t("meetings.editModal.title")}
			footer={
				<Box float="right">
					<SpaceBetween direction="horizontal" size="xs">
						<Button variant="link" onClick={onDismiss}>
							{t("meetings.editModal.cancel")}
						</Button>
						<Button
							variant="primary"
							disabled={!!meetupRsvpError}
							onClick={() => {
								if (!m) return;
								onSave({
									...m,
									name,
									presenters,
									eventlink,
									scheduledDate: scheduledDate || undefined,
									scheduledTime: scheduledTime || undefined,
									speakerBioUrl: speakerBioUrl || undefined,
									meetupRsvpUrl: meetupRsvpUrl || undefined,
								});
								onDismiss();
							}}
						>
							{t("meetings.editModal.save")}
						</Button>
					</SpaceBetween>
				</Box>
			}
		>
			<SpaceBetween size="m">
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
