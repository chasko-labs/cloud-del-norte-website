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
import Breadcrumbs from "../../components/breadcrumbs";
import Navigation from "../../components/navigation";
import { RequireAuth } from "../../components/require-auth";
import { LocaleProvider } from "../../contexts/locale-context";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../hooks/useTranslation";
import ShellLayout from "../../layouts/shell";
import {
	addRsvp,
	buildTicketPayload,
	getEvent,
	getRsvp,
	type RsvpRecord,
	spotsRemaining,
} from "../../lib/rsvp";
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../utils/locale";
import {
	applyTheme,
	initializeTheme,
	setStoredTheme,
	type Theme,
} from "../../utils/theme";

function getEventIdFromQuery(): string {
	const params = new URLSearchParams(window.location.search);
	return params.get("event") ?? "happy-hour-2026-06-03";
}

function RsvpFlow() {
	const { t, locale } = useTranslation();
	const auth = useAuth();
	const [eventId] = useState<string>(() => getEventIdFromQuery());
	const event = getEvent(eventId);
	const [ticket, setTicket] = useState<RsvpRecord | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [remaining, setRemaining] = useState<number>(() =>
		event ? spotsRemaining(eventId) : 0,
	);

	// Auto-confirm RSVP on first authenticated visit (single-click flow once
	// the user has signed in via the upstream beginSilentLogin redirect).
	useEffect(() => {
		if (!event || !auth.isAuthenticated || !auth.sub) return;
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
			name: auth.name,
			email: auth.email,
		});
		setTicket(record);
		setRemaining(spotsRemaining(eventId));
		setSubmitting(false);
	}, [
		event,
		auth.isAuthenticated,
		auth.sub,
		auth.name,
		auth.email,
		eventId,
		remaining,
	]);

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
		// Edge: authenticated but addRsvp didn't run yet (StrictMode dev double-mount, etc.).
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

export default function App() {
	const [theme, setTheme] = useState<Theme>(() => initializeTheme());
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

	const handleThemeChange = (newTheme: Theme) => {
		setTheme(newTheme);
		applyTheme(newTheme);
		setStoredTheme(newTheme);
	};
	const handleLocaleChange = (newLocale: Locale) => {
		setLocale(newLocale);
		applyLocale(newLocale);
		setStoredLocale(newLocale);
	};

	return (
		<LocaleProvider locale={locale}>
			<ShellLayout
				theme={theme}
				onThemeChange={handleThemeChange}
				locale={locale}
				onLocaleChange={handleLocaleChange}
				breadcrumbs={
					<Breadcrumbs active={{ text: "RSVP", href: "/rsvp/index.html" }} />
				}
				navigation={<Navigation />}
			>
				<RequireAuth>
					<SpaceBetween size="l">
						<Header variant="h1" description="">
							Cloud Del Norte UG
						</Header>
						<RsvpFlow />
					</SpaceBetween>
				</RequireAuth>
			</ShellLayout>
		</LocaleProvider>
	);
}
