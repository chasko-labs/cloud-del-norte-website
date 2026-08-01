// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import JitsiEmbed from "../../../pages/meetings/components/jitsi-embed";
import AwsugLayout from "../_layout";
import {
	type AuthState,
	isMember,
	isModerator,
	requireAuth,
} from "../_shared/auth";
import MyTickets from "./components/my-tickets";
import "../rsvp/styles.css";

const MEETUP_URL = "https://www.meetup.com/cloud-del-norte/";

/**
 * Deterministic shared room name. Every attendee who joins the same
 * calendar date (UTC) gets the same room. The JWT grants room "*" so any
 * name is valid — this just ensures everyone lands together.
 */
function sharedRoomName(): string {
	const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
	return `cdn-awsug-${today}`;
}

function MeetingsContent({ auth }: { auth: AuthState }) {
	const { t } = useTranslation();
	const [inCall, setInCall] = useState(false);
	const embedRef = useRef<HTMLDivElement | null>(null);

	// FP-021 guard: after joining, assert the iframe actually points at jitsi
	useEffect(() => {
		if (!inCall) return;
		const timer = setTimeout(() => {
			if (!embedRef.current) return;
			const iframe = embedRef.current.querySelector("iframe");
			if (iframe && !iframe.src.includes("meet.clouddelnorte.org")) {
				// embed mounted but not actually pointing at jitsi — surface error
				console.error("[cdn] jitsi embed iframe src mismatch:", iframe.src);
			}
		}, 8000);
		return () => clearTimeout(timer);
	}, [inCall]);

	if (inCall) {
		return (
			<SpaceBetween size="l">
				<Container
					header={
						<Header
							variant="h1"
							actions={
								<Button onClick={() => setInCall(false)}>
									{t("awsug.meetings.leaveCall")}
								</Button>
							}
						>
							{t("awsug.meetings.roomHeader")}
						</Header>
					}
				>
					<div ref={embedRef}>
						<JitsiEmbed
							roomName={sharedRoomName()}
							onClose={() => setInCall(false)}
						/>
					</div>
				</Container>
			</SpaceBetween>
		);
	}

	return (
		<SpaceBetween size="l">
			<MyTickets auth={auth} />
			<Container
				header={<Header variant="h1">{t("awsug.meetings.header")}</Header>}
			>
				<SpaceBetween size="m">
					<Box>{t("awsug.meetings.description")}</Box>
					<SpaceBetween direction="horizontal" size="s">
						<Button variant="primary" onClick={() => setInCall(true)}>
							{t("awsug.meetings.openCallRoom")}
						</Button>
						<Button href={MEETUP_URL} target="_blank" iconName="external">
							{t("awsug.meetings.viewOnMeetup")}
						</Button>
					</SpaceBetween>
				</SpaceBetween>
			</Container>
			{isModerator(auth) && (
				<Container
					header={
						<Header variant="h2">{t("awsug.meetings.scheduleHeader")}</Header>
					}
				>
					<SpaceBetween size="s">
						<Box>{t("awsug.meetings.scheduleDescription")}</Box>
						<Button href="/create-meeting/index.html">
							{t("awsug.meetings.createMeeting")}
						</Button>
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
