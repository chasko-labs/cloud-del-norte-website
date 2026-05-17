// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import DatePicker from "@cloudscape-design/components/date-picker";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Textarea from "@cloudscape-design/components/textarea";
import TimeInput from "@cloudscape-design/components/time-input";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import { formatInTz, TZ_ZONES } from "../../../pages/meetings/util/timezone";
import AwsugLayout from "../_layout";
import { type AuthState, isModerator, requireAuth } from "../_shared/auth";

const API_BASE = "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com";

function CreateMeetingForm({ auth }: { auth: AuthState }) {
	const { t } = useTranslation();
	const [meetupLink, setMeetupLink] = useState("");
	const [speakers, setSpeakers] = useState("");
	const [notes, setNotes] = useState("");
	const [meetingDate, setMeetingDate] = useState("");
	const [meetingTime, setMeetingTime] = useState("20:00");
	const [speakerBioUrl, setSpeakerBioUrl] = useState("");
	const [meetupRsvpUrl, setMeetupRsvpUrl] = useState("");
	const [meetupLinkError, setMeetupLinkError] = useState("");
	const [formError, setFormError] = useState("");
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);

	if (!isModerator(auth)) {
		return (
			<Container>
				<Alert type="info">{t("awsug.meetings.createPendingApproval")}</Alert>
			</Container>
		);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setMeetupLinkError("");
		setFormError("");

		setLoading(true);
		try {
			const res = await fetch(`${API_BASE}/admin/meetings`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${auth.idToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					meetupLink: meetupLink.trim(),
					speakers: speakers.trim(),
					notes: notes.trim(),
					scheduledDate: meetingDate || undefined,
					scheduledTime: meetingTime || undefined,
					speakerBioUrl: speakerBioUrl.trim() || undefined,
					meetupRsvpUrl: meetupRsvpUrl.trim() || undefined,
				}),
			});
			if (!res.ok) throw new Error(`api error: ${res.status}`);
			setDone(true);
		} catch {
			setFormError(
				"Failed to create meeting. The meetings API may not be available yet — contact an organizer.",
			);
		} finally {
			setLoading(false);
		}
	}

	if (done) {
		return (
			<Container>
				<SpaceBetween size="m">
					<Alert type="success">Meeting created.</Alert>
					<SpaceBetween direction="horizontal" size="xs">
						<Button href="/meetings/index.html">Back to meetings</Button>
						<Button
							variant="primary"
							onClick={() => {
								window.open(
									"https://meet.clouddelnorte.org",
									"_blank",
									"noopener",
								);
							}}
						>
							join call
						</Button>
					</SpaceBetween>
				</SpaceBetween>
			</Container>
		);
	}

	return (
		<Container header={<Header variant="h1">Create meeting</Header>}>
			<form
				onSubmit={(e) => {
					void handleSubmit(e);
				}}
				noValidate
			>
				<Form
					actions={
						<SpaceBetween direction="horizontal" size="xs">
							<Button href="/meetings/index.html">Cancel</Button>
							<Button formAction="submit" variant="primary" loading={loading}>
								Create meeting
							</Button>
						</SpaceBetween>
					}
					errorText={formError || undefined}
				>
					<SpaceBetween size="m">
						<FormField label="date">
							<DatePicker
								value={meetingDate}
								onChange={({ detail }) => setMeetingDate(detail.value)}
								placeholder="YYYY/MM/DD"
							/>
						</FormField>
						<FormField label="time (America/Denver — El Paso)">
							<TimeInput
								value={meetingTime}
								onChange={({ detail }) => setMeetingTime(detail.value)}
								format="hh:mm"
								placeholder="20:00"
							/>
						</FormField>
						{meetingDate.length === 10 && /^\d{2}:\d{2}$/.test(meetingTime) && (
							<SpaceBetween size="xxs">
								{TZ_ZONES.map(({ label, tz }) => (
									<Box key={tz}>
										<Box variant="awsui-key-label" display="inline">
											{label}:{" "}
										</Box>
										<Box variant="span">
											{formatInTz(meetingDate, meetingTime, tz)}
										</Box>
									</Box>
								))}
							</SpaceBetween>
						)}
						<FormField
							label="Meetup link"
							description="optional — add after scheduling the call"
							errorText={meetupLinkError || undefined}
						>
							<Input
								type="url"
								value={meetupLink}
								onChange={({ detail }) => setMeetupLink(detail.value)}
								placeholder="https://www.meetup.com/cloud-del-norte/events/..."
							/>
						</FormField>
						<FormField
							label="Meetup RSVP URL"
							description="optional — takes precedence over event link for RSVP button"
						>
							<Input
								type="url"
								value={meetupRsvpUrl}
								onChange={({ detail }) => setMeetupRsvpUrl(detail.value)}
								placeholder="https://www.meetup.com/cloud-del-norte/events/..."
							/>
						</FormField>
						<FormField label="Speaker names" description="optional">
							<Input
								value={speakers}
								onChange={({ detail }) => setSpeakers(detail.value)}
								placeholder="First Last, First Last"
							/>
						</FormField>
						<FormField label="Speaker bio URL" description="optional">
							<Input
								type="url"
								value={speakerBioUrl}
								onChange={({ detail }) => setSpeakerBioUrl(detail.value)}
								placeholder="https://"
							/>
						</FormField>
						<FormField label="Additional notes" description="optional">
							<Textarea
								value={notes}
								onChange={({ detail }) => setNotes(detail.value)}
								rows={3}
							/>
						</FormField>
					</SpaceBetween>
				</Form>
			</form>
		</Container>
	);
}

function CreateMeetingWithLayout() {
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

	return (
		<AwsugLayout>
			<CreateMeetingForm auth={auth} />
		</AwsugLayout>
	);
}

export default function App() {
	return <CreateMeetingWithLayout />;
}
