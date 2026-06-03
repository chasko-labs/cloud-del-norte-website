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
	getRsvpForCurrentUser,
	type RsvpRecord,
	spotsRemaining,
} from "../../../lib/rsvp";
import AwsugLayout from "../_layout";
import { type AuthState, requireAuth } from "../_shared/auth";

function getEventIdFromQuery(): string {
	const params = new URLSearchParams(window.location.search);
	return params.get("event") ?? "happy-hour-2026-06-03";
}

/**
 * Map an Error.message thrown by the rsvp lib to a localized i18n key under
 * the `rsvp.error.*` namespace. Unknown messages fall through to the generic
 * bucket. Kept as a pure function so the test bench (and future error
 * boundaries) can reuse it.
 */
function errorKeyFor(message: string): string {
	switch (message) {
		case "capacity_full":
			return "rsvp.error.capacityFull";
		case "network":
			return "rsvp.error.network";
		case "not_authenticated":
		case "unauthorized":
			return "rsvp.error.unauthorized";
		default:
			return "rsvp.error.generic";
	}
}

function RsvpFlow({ auth }: { auth: AuthState }) {
	const { t, locale } = useTranslation();
	const [eventId] = useState<string>(() => getEventIdFromQuery());
	const event = getEvent(eventId);
	const [ticket, setTicket] = useState<RsvpRecord | null>(null);
	const [submitting, setSubmitting] = useState(true);
	const [remaining, setRemaining] = useState<number>(Number.NaN);
	const [errorKey, setErrorKey] = useState<string | null>(null);

	// Auto-confirm RSVP on first visit (single-click flow once authenticated).
	// Idempotent — repeat visits to /rsvp/?event=... show the existing ticket.
	useEffect(() => {
		if (!event) {
			setSubmitting(false);
			return;
		}

		let cancelled = false;
		(async () => {
			try {
				// Refresh the public spots counter alongside the auth'd lookup.
				// Both kick off in parallel; spotsRemaining never throws (returns
				// NaN on error) so we can Promise.all freely.
				const [existing, freshSpots] = await Promise.all([
					getRsvpForCurrentUser(eventId),
					spotsRemaining(eventId),
				]);
				if (cancelled) return;
				setRemaining(freshSpots);

				if (existing) {
					setTicket(existing);
					setSubmitting(false);
					return;
				}

				// No existing ticket — try to RSVP. The backend returns 409 with
				// {error:'capacity_full'} when the event is full; we let that
				// bubble up to the catch block which renders the localized alert.
				const record = await addRsvp({
					eventId,
					name: auth.name ?? null,
					email: auth.email,
				});
				if (cancelled) return;
				setTicket(record);
				// Refresh spots after our successful RSVP so the chip reflects
				// the post-write count.
				const after = await spotsRemaining(eventId);
				if (cancelled) return;
				setRemaining(after);
				setSubmitting(false);
			} catch (err) {
				if (cancelled) return;
				const message = err instanceof Error ? err.message : "generic";
				setErrorKey(errorKeyFor(message));
				setSubmitting(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [event, auth.name, auth.email, eventId]);

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

	// Error state — render an Alert with the localized message and offer
	// the Meetup fallback. capacity_full also lands here.
	if (errorKey) {
		return (
			<Container
				header={<Header variant="h2">{t("rsvp.soldOutHeader")}</Header>}
			>
				<SpaceBetween size="m">
					<Alert
						type={errorKey === "rsvp.error.capacityFull" ? "info" : "error"}
					>
						{t(errorKey)}
					</Alert>
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

	// remaining is NaN when the public spots endpoint failed; treat that as
	// "unknown but not-yet-error" only when we already have a ticket. If we
	// have no ticket and remaining is 0, render the sold-out fallback.
	if (!ticket && remaining === 0) {
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
							title="Cloud del Norte ticket QR code"
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
