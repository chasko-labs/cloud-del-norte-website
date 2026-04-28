// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Textarea from "@cloudscape-design/components/textarea";
import type React from "react";
import { useEffect, useState } from "react";
import { LocaleProvider } from "../../../contexts/locale-context";
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../../utils/locale";
import AwsugLayout from "../_layout";
import { type AuthState, isMember, requireAuth } from "../_shared/auth";

const API_BASE = "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com";

function CreateMeetingForm({ auth }: { auth: AuthState }) {
	const [meetupLink, setMeetupLink] = useState("");
	const [speakers, setSpeakers] = useState("");
	const [notes, setNotes] = useState("");
	const [meetupLinkError, setMeetupLinkError] = useState("");
	const [formError, setFormError] = useState("");
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);

	if (!isMember(auth)) {
		return (
			<Container>
				<Alert type="info">
					Your application is pending approval. Meeting creation is available
					once approved.
				</Alert>
			</Container>
		);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setMeetupLinkError("");
		setFormError("");
		if (!meetupLink.trim()) {
			setMeetupLinkError("Meetup link is required");
			return;
		}
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
					<Button href="/meetings/index.html">Back to meetings</Button>
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
						<FormField
							label="Meetup link"
							errorText={meetupLinkError || undefined}
						>
							<Input
								type="url"
								value={meetupLink}
								onChange={({ detail }) => setMeetupLink(detail.value)}
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
		<AwsugLayout auth={auth}>
			<CreateMeetingForm auth={auth} />
		</AwsugLayout>
	);
}

export default function App() {
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

	function handleLocaleChange(next: Locale) {
		setLocale(next);
		applyLocale(next);
		setStoredLocale(next);
	}
	void handleLocaleChange;

	return (
		<LocaleProvider locale={locale}>
			<CreateMeetingWithLayout />
		</LocaleProvider>
	);
}
