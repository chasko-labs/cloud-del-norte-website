// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "../../../hooks/useTranslation";
import {
	buildTicketPayload,
	getEvent,
	listUserRsvps,
	type RsvpRecord,
} from "../../../lib/rsvp";

export default function MyTickets() {
	const { t } = useTranslation();
	const auth = useAuth();
	const [tickets, setTickets] = useState<RsvpRecord[]>([]);

	useEffect(() => {
		if (!auth.isAuthenticated || !auth.sub) return;
		setTickets(listUserRsvps(auth.sub));
	}, [auth.isAuthenticated, auth.sub]);

	if (!auth.isAuthenticated) return null;

	return (
		<Container
			header={<Header variant="h2">{t("meetings.myTicketsHeader")}</Header>}
		>
			{tickets.length === 0 ? (
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
