// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
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

function MemberHome({ auth }: { auth: AuthState }) {
	return (
		<SpaceBetween size="l">
			<Container header={<Header variant="h1">Welcome back</Header>}>
				<SpaceBetween size="m">
					<Box>You have full access to Cloud Del Norte member content.</Box>
					<SpaceBetween direction="horizontal" size="s">
						<Button href="/meetings/index.html" variant="primary">
							Meetings
						</Button>
						<Button href="/admin/index.html">Admin panel</Button>
					</SpaceBetween>
				</SpaceBetween>
			</Container>
			<Container header={<Header variant="h2">Your profile</Header>}>
				<KeyValuePairs
					columns={2}
					items={[
						{ label: "Email", value: auth.email },
						{ label: "Groups", value: auth.groups.join(", ") || "none" },
					]}
				/>
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
