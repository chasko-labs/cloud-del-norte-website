// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import React, { useEffect, useState } from "react";
import { LocaleProvider } from "../../../contexts/locale-context";
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../../utils/locale";
import AwsugLayout from "../_layout";
import { fetchJitsiToken, type JitsiTokenResponse } from "../_shared/api";
import { type AuthState, isMember, requireAuth } from "../_shared/auth";

const MEETUP_URL = "https://www.meetup.com/cloud-del-norte/";

function MeetingsContent() {
	const [jitsiToken, setJitsiToken] = useState<JitsiTokenResponse | null>(null);
	const [joining, setJoining] = useState(false);
	const [joinError, setJoinError] = useState("");

	async function handleJoinCall() {
		setJoining(true);
		setJoinError("");
		try {
			const tokenData = await fetchJitsiToken();
			setJitsiToken(tokenData);
			window.open(
				`https://${tokenData.domain}?jwt=${tokenData.token}`,
				"_blank",
				"noopener",
			);
		} catch (err) {
			if (err instanceof Error && err.message === "banned") {
				setJoinError("Your account does not have access to join calls.");
			} else {
				setJoinError("Failed to get call token. Try again.");
			}
		} finally {
			setJoining(false);
		}
	}

	return (
		<SpaceBetween size="l">
			<Container header={<Header variant="h1">Meetings</Header>}>
				<SpaceBetween size="m">
					<Box>
						Join the active Cloud Del Norte call or check meetup.com for
						upcoming events.
					</Box>
					{joinError && <Alert type="error">{joinError}</Alert>}
					{jitsiToken && (
						<Alert type="success">
							Call token generated — if the window did not open, click Join
							again.
						</Alert>
					)}
					<SpaceBetween direction="horizontal" size="s">
						<Button
							variant="primary"
							loading={joining}
							onClick={() => {
								void handleJoinCall();
							}}
						>
							Join call
						</Button>
						<Button href={MEETUP_URL} target="_blank" iconName="external">
							View on meetup.com
						</Button>
					</SpaceBetween>
				</SpaceBetween>
			</Container>
			<Container header={<Header variant="h2">Schedule a session</Header>}>
				<SpaceBetween size="s">
					<Box>
						Organizers can schedule new sessions from the create meeting page.
					</Box>
					<Button href="/create-meeting/index.html">Create meeting</Button>
				</SpaceBetween>
			</Container>
		</SpaceBetween>
	);
}

function MeetingsPage({ auth }: { auth: AuthState }) {
	if (!isMember(auth)) {
		return (
			<Container>
				<Alert type="info">
					Your application is pending approval. Meetings are available once
					approved.
				</Alert>
			</Container>
		);
	}
	return <MeetingsContent />;
}

function MeetingsWithLayout() {
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
			<MeetingsPage auth={auth} />
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
			<MeetingsWithLayout />
		</LocaleProvider>
	);
}
