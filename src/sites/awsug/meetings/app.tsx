// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import JitsiEmbed from "../../../pages/meetings/components/jitsi-embed";
import AwsugLayout from "../_layout";
import {
	type AuthState,
	isMember,
	isModerator,
	requireAuth,
} from "../_shared/auth";

const MEETUP_URL = "https://www.meetup.com/cloud-del-norte/";
const ROOM_NAME = "cloud-del-norte-awsug";

function MeetingsContent({ auth }: { auth: AuthState }) {
	const { t } = useTranslation();
	const [inCall, setInCall] = useState(false);

	return (
		<SpaceBetween size="l">
			<Container header={<Header variant="h1">meetings</Header>}>
				<SpaceBetween size="m">
					<Box>
						Join the active Cloud Del Norte call or check meetup.com for
						upcoming events.
					</Box>
					<SpaceBetween direction="horizontal" size="s">
						<Button variant="primary" onClick={() => setInCall(true)}>
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
			<Modal
				visible={inCall}
				onDismiss={() => setInCall(false)}
				size="max"
				header="Cloud Del Norte — live call"
				closeAriaLabel="leave meeting"
			>
				<JitsiEmbed roomName={ROOM_NAME} onClose={() => setInCall(false)} />
			</Modal>
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
