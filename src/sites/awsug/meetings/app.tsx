// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import JitsiEmbed from "../../../pages/meetings/components/jitsi-embed";
import AwsugLayout from "../_layout";
import {
	type AuthState,
	isBanned,
	isMember,
	isModerator,
	requireAuth,
} from "../_shared/auth";
import "../rsvp/styles.css";

const MEETUP_URL = "https://www.meetup.com/cloud-del-norte/";
const ROOM_NAME = "cloud-del-norte-awsug";
const JITSI_DOMAIN = "meet.clouddelnorte.org";

/**
 * FP-021 guard: verify the jitsi iframe src contains meet.clouddelnorte.org.
 * Auto-join makes this guard MORE important — no click for the user to
 * correlate with a failure. Returns true if a valid jitsi iframe is found.
 */
function verifyJitsiIframe(): boolean {
	const host = document.querySelector('[data-testid="jitsi-iframe-host"]');
	if (!host) return false;
	const iframe = host.querySelector("iframe");
	if (!iframe) return false;
	return iframe.src.includes(JITSI_DOMAIN);
}

function MeetingsContent({
	auth,
	onImmersiveChange,
}: {
	auth: AuthState;
	onImmersiveChange: (immersive: boolean) => void;
}) {
	const { t } = useTranslation();
	const [inCall, setInCall] = useState(false);
	const [autoJoinFailed, setAutoJoinFailed] = useState(false);
	const [autoJoinError, setAutoJoinError] = useState("");
	const [isAutoJoining, setIsAutoJoining] = useState(true);
	const fp021CheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleLeaveCall = useCallback(() => {
		setInCall(false);
		setIsAutoJoining(false);
		onImmersiveChange(false);
		if (fp021CheckRef.current) {
			clearTimeout(fp021CheckRef.current);
			fp021CheckRef.current = null;
		}
	}, [onImmersiveChange]);

	const handleManualJoin = useCallback(() => {
		setAutoJoinFailed(false);
		setAutoJoinError("");
		setInCall(true);
		onImmersiveChange(true);
	}, [onImmersiveChange]);

	// Auto-join on mount for permitted users
	useEffect(() => {
		if (isBanned(auth)) {
			setIsAutoJoining(false);
			onImmersiveChange(false);
			return;
		}
		// Mount the embed immediately — JitsiEmbed handles token fetch internally
		setInCall(true);
		onImmersiveChange(true);
	}, [auth, onImmersiveChange]);

	// FP-021 guard: after the embed has had time to initialize (15s),
	// verify that the iframe src contains the jitsi domain. If not, surface
	// an error so the user knows they are stranded.
	useEffect(() => {
		if (!inCall) return;
		fp021CheckRef.current = setTimeout(() => {
			if (!verifyJitsiIframe()) {
				setAutoJoinFailed(true);
				setAutoJoinError(t("awsug.meetings.fp021Error"));
				setInCall(false);
				onImmersiveChange(false);
			}
		}, 15_000);
		return () => {
			if (fp021CheckRef.current) {
				clearTimeout(fp021CheckRef.current);
				fp021CheckRef.current = null;
			}
		};
	}, [inCall, t, onImmersiveChange]);

	// If the embed reports an error via onClose while auto-joining, treat as failure
	const handleEmbedClose = useCallback(() => {
		if (isAutoJoining) {
			setAutoJoinFailed(true);
			setAutoJoinError(t("awsug.meetings.autoJoinFailed"));
		}
		setInCall(false);
		onImmersiveChange(false);
	}, [isAutoJoining, t, onImmersiveChange]);

	if (inCall) {
		return (
			<SpaceBetween size="m">
				<Box>
					<Button variant="link" iconName="close" onClick={handleLeaveCall}>
						{t("awsug.meetings.leaveCall")}
					</Button>
				</Box>
				<JitsiEmbed roomName={ROOM_NAME} onClose={handleEmbedClose} />
			</SpaceBetween>
		);
	}

	if (isAutoJoining && !autoJoinFailed) {
		return (
			<Container>
				<Box padding="xxl" textAlign="center">
					<SpaceBetween size="s" alignItems="center">
						<Spinner size="large" />
						<Box variant="p">{t("awsug.meetings.joiningRoom")}</Box>
					</SpaceBetween>
				</Box>
			</Container>
		);
	}

	return (
		<SpaceBetween size="l">
			{autoJoinFailed && (
				<Alert type="error" header={t("awsug.meetings.autoJoinErrorHeader")}>
					{autoJoinError || t("awsug.meetings.autoJoinFailed")}
				</Alert>
			)}
			<Container
				header={<Header variant="h1">{t("awsug.meetings.header")}</Header>}
			>
				<SpaceBetween size="m">
					<Box>{t("awsug.meetings.openRoomDescription")}</Box>
					<SpaceBetween direction="horizontal" size="s">
						<Button variant="primary" onClick={handleManualJoin}>
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
						<Header variant="h2">{t("awsug.meetings.scheduleSession")}</Header>
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

function MeetingsPage({
	auth,
	onImmersiveChange,
}: {
	auth: AuthState;
	onImmersiveChange: (immersive: boolean) => void;
}) {
	const { t } = useTranslation();
	if (isBanned(auth)) {
		return (
			<Container>
				<Alert type="error">{t("awsug.meetings.bannedMessage")}</Alert>
			</Container>
		);
	}
	if (!isMember(auth)) {
		return (
			<Container>
				<Alert type="info">{t("awsug.meetings.pendingApproval")}</Alert>
			</Container>
		);
	}
	return <MeetingsContent auth={auth} onImmersiveChange={onImmersiveChange} />;
}

function MeetingsWithLayout() {
	const [auth, setAuth] = useState<AuthState | null>(null);
	const [immersive, setImmersive] = useState(false);
	const [navOpen, setNavOpen] = useState(true);

	const handleImmersiveChange = useCallback((active: boolean) => {
		setImmersive(active);
		// Collapse navigation when entering the call; user can still reopen via hamburger
		setNavOpen(!active);
	}, []);

	const handleNavigationChange = useCallback((open: boolean) => {
		setNavOpen(open);
	}, []);

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
		<AwsugLayout
			toolsHide={immersive}
			navigationOpen={navOpen}
			onNavigationChange={handleNavigationChange}
		>
			<MeetingsPage auth={auth} onImmersiveChange={handleImmersiveChange} />
		</AwsugLayout>
	);
}

export default function App() {
	return <MeetingsWithLayout />;
}
