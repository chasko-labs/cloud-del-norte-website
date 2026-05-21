// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../../hooks/useTranslation";
import {
	buildTicketPayload,
	getEvent,
	listMyRsvps,
	type RsvpRecord,
} from "../../../../lib/rsvp";
import type { AuthState } from "../../_shared/auth";

/** Map a thrown error message to the locale key the UI should render. */
function errorKeyFor(message: string): string {
	switch (message) {
		case "network":
			return "rsvp.error.network";
		case "not_authenticated":
		case "unauthorized":
			return "rsvp.error.unauthorized";
		default:
			return "rsvp.error.generic";
	}
}

export default function MyTickets({ auth }: { auth: AuthState }) {
	const { t } = useTranslation();
	const [tickets, setTickets] = useState<RsvpRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [errorKey, setErrorKey] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const list = await listMyRsvps();
				if (cancelled) return;
				// Defensive filter: the cache fallback inside listMyRsvps may have
				// returned records belonging to a different sub from a prior
				// session on a shared device. The server response is already
				// scoped, but the cache is not.
				setTickets(list.filter((r) => r.userSub === auth.sub));
				setLoading(false);
			} catch (err) {
				if (cancelled) return;
				const message = err instanceof Error ? err.message : "generic";
				setErrorKey(errorKeyFor(message));
				setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [auth.sub]);

	return (
		<Container
			header={<Header variant="h2">{t("meetings.myTicketsHeader")}</Header>}
		>
			{loading ? (
				<Box padding="m" textAlign="center">
					<Spinner />
				</Box>
			) : errorKey ? (
				<Alert type={errorKey === "rsvp.error.unauthorized" ? "info" : "error"}>
					{t(errorKey)}
				</Alert>
			) : tickets.length === 0 ? (
				<Box color="text-status-inactive">{t("meetings.myTicketsEmpty")}</Box>
			) : (
				<SpaceBetween size="m">
					{tickets.map((ticket) => {
						const event = getEvent(ticket.eventId);
						if (!event) return null;
						const payload = buildTicketPayload(ticket);
						return (
							<div
								key={ticket.eventId}
								className="cdn-ticket cdn-ticket--compact"
							>
								<div className="cdn-ticket__qr">
									<QRCodeSVG
										value={payload}
										size={160}
										level="M"
										marginSize={2}
										fgColor="#5a1f8a"
										bgColor="#ffffff"
										title={`${event.title} ticket QR`}
									/>
								</div>
								<dl className="cdn-ticket__meta">
									<dt>{t("rsvp.ticketEvent")}</dt>
									<dd>{event.title}</dd>
									<dt>{t("rsvp.ticketDate")}</dt>
									<dd>{event.scheduledDate}</dd>
									<dt>{t("rsvp.ticketLocation")}</dt>
									<dd>{event.location}</dd>
									<dt>{t("rsvp.ticketHolder")}</dt>
									<dd>{ticket.name ?? ticket.email ?? ticket.userSub}</dd>
									<dt>{t("rsvp.ticketCode")}</dt>
									<dd>
										<code>{payload}</code>
									</dd>
								</dl>
							</div>
						);
					})}
					<Box color="text-status-inactive" fontSize="body-s">
						<Link href="/rsvp/index.html">
							{t("meetings.myTicketsShowAtDoor")}
						</Link>
					</Box>
				</SpaceBetween>
			)}
		</Container>
	);
}
