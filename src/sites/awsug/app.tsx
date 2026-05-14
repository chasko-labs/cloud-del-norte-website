// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { loadPlayerState } from "../../lib/player-persist";
import { STREAMS } from "../../lib/streams";
import AwsugLayout from "./_layout";
import {
	type AuthState,
	isBanned,
	isMember,
	requireAuth,
} from "./_shared/auth";

function PendingScreen(_: { auth: AuthState }) {
	const { t } = useTranslation();
	return (
		<Container
			header={<Header variant="h1">{t("awsug.pending.title")}</Header>}
		>
			<SpaceBetween size="m">
				<Alert type="info">{t("awsug.pending.description")}</Alert>
			</SpaceBetween>
		</Container>
	);
}

function BannedScreen() {
	return (
		<Container>
			<Alert type="error">
				Your account has been suspended. Contact the organizers if you believe
				this is an error.
			</Alert>
		</Container>
	);
}

interface NextMeetup {
	summary: string;
	dtstart: string;
	url: string;
}

function greeting(): string {
	const h = new Date().getHours();
	if (h < 12) return "good morning";
	if (h < 17) return "good afternoon";
	return "good evening";
}

function firstName(email: string): string {
	return email.split("@")[0].split(/[._-]/)[0];
}

function MemberHome({ auth }: { auth: AuthState }) {
	const [meetup, setMeetup] = useState<NextMeetup | null | "loading">(
		"loading",
	);
	const player = loadPlayerState();
	const visibleStreams = STREAMS.filter((s) => !s.hidden);

	useEffect(() => {
		fetch("/data/next-meetup.json")
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => setMeetup(d as NextMeetup | null))
			.catch(() => setMeetup(null));
	}, []);

	const name = auth.name?.split(" ")[0] || firstName(auth.email);
	const isMod = auth.groups.includes("moderators");

	return (
		<SpaceBetween size="l">
			{/* Greeting + quick actions */}
			<Container
				header={
					<Header variant="h1">
						{greeting()}, {name} ☁️
					</Header>
				}
			>
				<SpaceBetween direction="horizontal" size="s">
					<Button href="/meetings/index.html" variant="primary">
						join a call
					</Button>
					{isMod && <Button href="/admin/index.html">admin panel</Button>}
					{isMod && (
						<Button href="/create-meeting/index.html">create meeting</Button>
					)}
				</SpaceBetween>
			</Container>

			{/* Next meetup + now playing */}
			<ColumnLayout columns={2}>
				{/* Next meetup */}
				<Container header={<Header variant="h2">next meetup</Header>}>
					{meetup === "loading" ? (
						<Spinner />
					) : meetup ? (
						<SpaceBetween size="s">
							<Box fontWeight="bold">{meetup.summary}</Box>
							<Box color="text-body-secondary">
								{new Date(meetup.dtstart).toLocaleDateString(undefined, {
									weekday: "long",
									month: "long",
									day: "numeric",
									hour: "numeric",
									minute: "2-digit",
								})}
							</Box>
							<Link href={meetup.url} external>
								RSVP on meetup.com
							</Link>
						</SpaceBetween>
					) : (
						<SpaceBetween size="s">
							<Box color="text-body-secondary">
								No upcoming event scheduled.
							</Box>
							<Link href="https://www.meetup.com/cloud-del-norte/" external>
								check meetup.com for upcoming events
							</Link>
						</SpaceBetween>
					)}
				</Container>

				{/* Now playing */}
				<Container header={<Header variant="h2">now playing</Header>}>
					{player ? (
						<SpaceBetween size="s">
							<Box fontWeight="bold">{player.stationLabel}</Box>
							<Box color="text-body-secondary">currently streaming</Box>
						</SpaceBetween>
					) : (
						<SpaceBetween size="s">
							<Box color="text-body-secondary">
								{visibleStreams.length} stations available
							</Box>
							<Link href="https://clouddelnorte.org/feed/index.html" external>
								tune in →
							</Link>
						</SpaceBetween>
					)}
				</Container>
			</ColumnLayout>

			{/* Profile */}
			<Container header={<Header variant="h2">your profile</Header>}>
				<SpaceBetween direction="horizontal" size="xs">
					<Box color="text-body-secondary">{auth.email}</Box>
					{auth.groups.map((g) => (
						<Badge key={g} color={g === "moderators" ? "blue" : "grey"}>
							{g}
						</Badge>
					))}
				</SpaceBetween>
			</Container>
		</SpaceBetween>
	);
}

function AwsugHome() {
	const [auth, setAuth] = useState<AuthState | null>(null);
	const params = new URLSearchParams(window.location.search);
	const statusParam = params.get("status");

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

	if (statusParam === "banned" || isBanned(auth)) return <BannedScreen />;
	if (isMember(auth)) return <MemberHome auth={auth} />;
	return <PendingScreen auth={auth} />;
}

function AwsugHomeWithLayout() {
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
			<AwsugHome />
		</AwsugLayout>
	);
}

export default function App() {
	return <AwsugHomeWithLayout />;
}
