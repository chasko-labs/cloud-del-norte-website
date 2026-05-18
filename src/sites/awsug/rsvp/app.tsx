// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import {
	addRsvp,
	buildTicketPayload,
	getEvent,
	getRsvp,
	type RsvpRecord,
	spotsRemaining,
} from "../../../lib/rsvp";
import AwsugLayout from "../_layout";
import { type AuthState, requireAuth } from "../_shared/auth";

function getEventIdFromQuery(): string {
	const params = new URLSearchParams(window.location.search);
	return params.get("event") ?? "happy-hour-2026-06-03";
}

function RsvpFlow({ auth }: { auth: AuthState }) {
	const { t, locale } = useTranslation();
	const [eventId] = useState<string>(() => getEventIdFromQuery());
	const event = getEvent(eventId);
	const [ticket, setTicket] = useState<RsvpRecord | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [remaining, setRemaining] = useState<number>(() =>
		event ? spotsRemaining(eventId) : 0,
	);

	// Auto-confirm RSVP on first visit (single-click flow once authenticated).
	// Idempotent — repeat visits to /rsvp/?event=... show the existing ticket.
	useEffect(() => {
		if (!event) return;
		const existing = getRsvp(eventId, auth.sub);
		if (existing) {
			setTicket(existing);
			setRemaining(spotsRemaining(eventId));
			return;
		}
		if (remaining <= 0) return;
		setSubmitting(true);
		const record = addRsvp({
			eventId,
			userSub: auth.sub,
			name: auth.name ?? null,
			email: auth.email,
		});
		setTicket(record);
		setRemaining(spotsRemaining(eventId));
		setSubmitting(false);
	}, [event, auth.sub, auth.name, auth.email, eventId, remaining]);

	if (!event) {
		return (
			<Container
				header={<Header variant="h2">{t("rsvp.eventNotFound")}</Header>}
			>
				<SpaceBetween size="m">
					<Box>{t("rsvp.eventNotFoundDesc")}</Box>
					<Button href="/meetings/index.html" variant="primary">
						{t("rsvp.viewMyTickets")}
					</Button>
				</SpaceBetween>
			</Container>
		);
	}

	if (submitting) {
		return (
			<Container>
				<Box padding="xxl" textAlign="center">
					<SpaceBetween size="l" alignItems="center">
						<Spinner size="large" />
						<Box>{t("rsvp.rsvpingNow")}</Box>
					</SpaceBetween>
				</Box>
			</Container>
		);
	}

	if (!ticket && remaining <= 0) {
		return (
			<Container
				header={<Header variant="h2">{t("rsvp.soldOutHeader")}</Header>}
			>
				<SpaceBetween size="m">
					<Alert type="info">{t("rsvp.soldOutBody")}</Alert>
					<Button
						href={event.meetupRsvpUrl}
						target="_blank"
						iconAlign="right"
						iconName="external"
					>
						{t("rsvp.fallbackMeetupCta")}
					</Button>
				</SpaceBetween>
			</Container>
		);
	}

	if (!ticket) {
		return (
			<Container>
				<Box padding="xxl" textAlign="center">
					<Spinner size="large" />
				</Box>
			</Container>
		);
	}

	const langTag = locale === "mx" ? "es-MX" : "en-US";
	const formattedDate = new Intl.DateTimeFormat(langTag, {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
		timeZone: "America/Denver",
	}).format(new Date(`${event.scheduledDate}T18:00:00-06:00`));
	const ticketPayload = buildTicketPayload(ticket);

	return (
		<Container header={<Header variant="h2">{t("rsvp.ticketHeader")}</Header>}>
			<SpaceBetween size="l">
				<Alert type="success">{t("rsvp.ticketSubheader")}</Alert>
				<div className="cdn-ticket">
					<div className="cdn-ticket__qr">
						<QRCodeSVG
							value={ticketPayload}
							size={232}
							level="M"
							marginSize={2}
							fgColor="#5a1f8a"
							bgColor="#ffffff"
							title="Cloud Del Norte ticket QR code"
						/>
					</div>
					<dl className="cdn-ticket__meta">
						<dt>{t("rsvp.ticketEvent")}</dt>
						<dd>{event.title}</dd>
						<dt>{t("rsvp.ticketDate")}</dt>
						<dd>{formattedDate}</dd>
						<dt>{t("rsvp.ticketLocation")}</dt>
						<dd>{event.location}</dd>
						<dt>{t("rsvp.ticketHolder")}</dt>
						<dd>{ticket.name ?? ticket.email ?? auth.sub}</dd>
						<dt>{t("rsvp.ticketCode")}</dt>
						<dd>
							<code>{ticketPayload}</code>
						</dd>
					</dl>
				</div>
				<Box>
					<Link href="/meetings/index.html">{t("rsvp.viewMyTickets")}</Link>
				</Box>
			</SpaceBetween>
		</Container>
	);
}

function RsvpWithAuth() {
	const [auth, setAuth] = useState<AuthState | null>(null);

	useEffect(() => {
		// requireAuth() either returns the AuthState or redirects to
		// auth.clouddelnorte.org/login/?return_to=<this path>. The login form
		// has a "Don't have an account? Sign up" link; when reached via signup
		// + redeem the user lands here authenticated.
		setAuth(requireAuth());
	}, []);

	if (!auth) {
		return (
			<Box padding="xxl" textAlign="center">
				<Spinner size="large" />
			</Box>
		);
	}

	return <RsvpFlow auth={auth} />;
}

export default function App() {
	return (
		<AwsugLayout>
			<RsvpWithAuth />
		</AwsugLayout>
	);
}
