// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import AwsugLayout from "../_layout";
import { fetchJitsiToken, type JitsiTokenResponse } from "../_shared/api";
import {
	type AuthState,
	isMember,
	isModerator,
	requireAuth,
} from "../_shared/auth";

const MEETUP_URL = "https://www.meetup.com/cloud-del-norte/";

function MeetingsContent({ auth }: { auth: AuthState }) {
	const { t } = useTranslation();
	const [jitsiToken, setJitsiToken] = useState<JitsiTokenResponse | null>(null);
	const [joining, setJoining] = useState(false);
	const [joinError, setJoinError] = useState("");

	async function handleJoinCall() {
		const win = window.open("", "_blank");
		setJoining(true);
		setJoinError("");
		try {
			const tokenData = await fetchJitsiToken();
			setJitsiToken(tokenData);
			if (win)
				win.location.href = `https://${tokenData.domain}?jwt=${tokenData.token}`;
		} catch (err) {
			if (err instanceof Error && err.message === "banned") {
				if (win) win.close();
				// 403 from the API — pending users (groups=[]) also get 403
				if (auth.groups.length === 0) {
					setJoinError(t("awsug.meetings.pendingJoinError"));
				} else {
					setJoinError("Your account does not have access to join calls.");
				}
			} else {
				if (win) win.close();
				setJoinError("Failed to get call token. Try again.");
			}
		} finally {
			setJoining(false);
		}
	}

	return (
		<SpaceBetween size="l">
			<Container header={<Header variant="h1">meetings</Header>}>
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
							join call
						</Button>
						<Button href={MEETUP_URL} target="_blank" iconName="external">
							view on meetup.com
						</Button>
					</SpaceBetween>
				</SpaceBetween>
			</Container>
			{isModerator(auth) && (
				<Container header={<Header variant="h2">schedule a session</Header>}>
					<SpaceBetween size="s">
						<Box>
							Organizers can schedule new sessions from the create meeting page.
						</Box>
						<Button href="/create-meeting/index.html">create meeting</Button>
					</SpaceBetween>
				</Container>
			)}
		</SpaceBetween>
	);
}

function MeetingsPage({ auth }: { auth: AuthState }) {
	const { t } = useTranslation();
	if (!isMember(auth)) {
		return (
			<Container>
				<Alert type="info">{t("awsug.meetings.pendingApproval")}</Alert>
			</Container>
		);
	}
	return <MeetingsContent auth={auth} />;
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
		<AwsugLayout>
			<MeetingsPage auth={auth} />
		</AwsugLayout>
	);
}

export default function App() {
	return <MeetingsWithLayout />;
}
