// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import DatePicker from "@cloudscape-design/components/date-picker";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import TimeInput from "@cloudscape-design/components/time-input";
import { useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import { formatInTz, TZ_ZONES } from "../../meetings/util/timezone";
import { BasicValidationContext } from "../validation/basic-validation";

export interface MeetingDetailsValues {
	meetupLink: string;
	speakers: string;
	speakerBioUrl: string;
	meetupRsvpUrl: string;
	notes: string;
	scheduledDate: string;
	scheduledTime: string;
}

interface Props {
	onChange?: (values: MeetingDetailsValues) => void;
}

export default function MeetingDetails({ onChange }: Props) {
	const { t } = useTranslation();
	const [meetupLink, setMeetupLink] = useState("");
	const [speakers, setSpeakers] = useState("");
	const [speakerBioUrl, setSpeakerBioUrl] = useState("");
	const [meetupRsvpUrl, setMeetupRsvpUrl] = useState("");
	const [notes, setNotes] = useState("");
	const [scheduledDate, setScheduledDate] = useState("");
	const [scheduledTime, setScheduledTime] = useState("20:00");

	const notify = (patch: Partial<MeetingDetailsValues>) => {
		onChange?.({
			meetupLink,
			speakers,
			speakerBioUrl,
			meetupRsvpUrl,
			notes,
			scheduledDate,
			scheduledTime,
			...patch,
		});
	};

	const showPreview =
		scheduledDate.length === 10 && /^\d{2}:\d{2}$/.test(scheduledTime);

	const isEmptyString = (value: string) => !value?.length;

	return (
		<BasicValidationContext.Consumer>
			{({ isFormSubmitted, addErrorField }) => {
				const meetupLinkError =
					isEmptyString(meetupLink) &&
					t("createMeeting.meetingDetails.linkRequired");
				const speakersError =
					isEmptyString(speakers) &&
					t("createMeeting.meetingDetails.presenterRequired");

				return (
					<Container
						header={
							<Header variant="h2">
								{t("createMeeting.meetingDetails.header")}
							</Header>
						}
					>
						<SpaceBetween size="l">
							{/* Date + Time */}
							<ColumnLayout columns={2}>
								<FormField
									label={t("createMeeting.meetingDetails.scheduledDateLabel")}
									description="YYYY-MM-DD"
								>
									<DatePicker
										value={scheduledDate}
										onChange={({ detail }) => {
											setScheduledDate(detail.value);
											notify({ scheduledDate: detail.value });
										}}
										placeholder="YYYY/MM/DD"
									/>
								</FormField>
								<FormField
									label={t("createMeeting.meetingDetails.scheduledTimeLabel")}
									description="24h — America/Denver (El Paso)"
								>
									<TimeInput
										value={scheduledTime}
										onChange={({ detail }) => {
											setScheduledTime(detail.value);
											notify({ scheduledTime: detail.value });
										}}
										format="hh:mm"
										placeholder="20:00"
									/>
								</FormField>
							</ColumnLayout>

							{/* Live timezone preview */}
							{showPreview && (
								<SpaceBetween size="xxs">
									{TZ_ZONES.map(({ label, tz }) => (
										<Box key={tz}>
											<Box variant="awsui-key-label" display="inline">
												{label}:{" "}
											</Box>
											<Box variant="span">
												{formatInTz(scheduledDate, scheduledTime, tz)}
											</Box>
										</Box>
									))}
								</SpaceBetween>
							)}

							{/* Meetup link + Speaker names */}
							<ColumnLayout columns={2}>
								<FormField
									label={t("createMeeting.meetingDetails.meetupLinkLabel")}
									stretch={true}
									errorText={isFormSubmitted && meetupLinkError}
									i18nStrings={{
										errorIconAriaLabel: t(
											"createMeeting.meetingDetails.errorIconAriaLabel",
										),
									}}
								>
									<Input
										type="url"
										value={meetupLink}
										onChange={({ detail }) => {
											setMeetupLink(detail.value);
											notify({ meetupLink: detail.value });
										}}
										ref={(ref) => {
											addErrorField("meetupLink", {
												isValid: !meetupLinkError,
												ref,
											});
										}}
									/>
								</FormField>
								<FormField
									label={t("createMeeting.meetingDetails.speakerNamesLabel")}
									stretch={true}
									errorText={isFormSubmitted && speakersError}
									i18nStrings={{
										errorIconAriaLabel: t(
											"createMeeting.meetingDetails.errorIconAriaLabel",
										),
									}}
								>
									<Input
										value={speakers}
										onChange={({ detail }) => {
											setSpeakers(detail.value);
											notify({ speakers: detail.value });
										}}
										ref={(ref) => {
											addErrorField("speakers", {
												isValid: !speakersError,
												ref,
											});
										}}
									/>
								</FormField>
							</ColumnLayout>

							{/* Speaker bio URL */}
							<FormField
								label={
									<>
										{t("createMeeting.meetingDetails.speakerBioUrlLabel")}
										<i>{t("createMeeting.meetingDetails.optional")}</i>
									</>
								}
								stretch={true}
							>
								<Input
									type="url"
									value={speakerBioUrl}
									onChange={({ detail }) => {
										setSpeakerBioUrl(detail.value);
										notify({ speakerBioUrl: detail.value });
									}}
									placeholder="https://"
								/>
							</FormField>

							{/* Meetup RSVP URL */}
							<FormField
								label={
									<>
										Meetup RSVP URL
										<i>{t("createMeeting.meetingDetails.optional")}</i>
									</>
								}
								description="Takes precedence over the general event link for the RSVP button"
								stretch={true}
							>
								<Input
									type="url"
									value={meetupRsvpUrl}
									onChange={({ detail }) => {
										setMeetupRsvpUrl(detail.value);
										notify({ meetupRsvpUrl: detail.value });
									}}
									placeholder="https://www.meetup.com/cloud-del-norte/events/..."
								/>
							</FormField>

							{/* Additional notes */}
							<FormField
								label={
									<>
										{t("createMeeting.meetingDetails.additionalNotesLabel")}
										<i>{t("createMeeting.meetingDetails.optional")}</i>
									</>
								}
								stretch={true}
							>
								<Textarea
									value={notes}
									onChange={({ detail }) => {
										setNotes(detail.value);
										notify({ notes: detail.value });
									}}
								/>
							</FormField>
						</SpaceBetween>
					</Container>
				);
			}}
		</BasicValidationContext.Consumer>
	);
}
