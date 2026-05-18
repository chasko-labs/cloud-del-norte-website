// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useEffect, useState } from "react";
import MeetupRsvpButton from "../../../components/brand-button/meetup-rsvp";
import SpeakeasyRsvpButton from "../../../components/brand-button/speakeasy-rsvp";
import { useTranslation } from "../../../hooks/useTranslation";
import { getEvent, spotsRemaining } from "../../../lib/rsvp";

const EVENT_ID = "happy-hour-2026-06-03";
const EVENT_IMAGE = "/events/featured-2026-06-03.webp";
const RSVP_PAGE_URL = `/rsvp/index.html?event=${EVENT_ID}`;

export default function FeaturedEvent() {
	const { t, locale } = useTranslation();
	const event = getEvent(EVENT_ID);
	const [remaining, setRemaining] = useState<number | null>(null);

	useEffect(() => {
		// localStorage is browser-only; compute on mount to avoid hydration drift.
		setRemaining(spotsRemaining(EVENT_ID));
	}, []);

	const langTag = locale === "mx" ? "es-MX" : "en-US";
	const eventDate = event ? `${event.scheduledDate}T18:00:00-06:00` : null;
	const formattedDate = eventDate
		? new Intl.DateTimeFormat(langTag, {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				timeZoneName: "short",
				timeZone: "America/Denver",
			}).format(new Date(eventDate))
		: "";

	const meetupUrl =
		event?.meetupRsvpUrl ??
		"https://www.meetup.com/awsugclouddelnorte/events/314839263/rsvp/";

	const spotsCopy =
		event && remaining !== null
			? t("feedPage.featuredEventSpotsRemaining")
					.replace("{count}", String(remaining))
					.replace("{capacity}", String(event.capacity))
			: "";

	return (
		<div className="feed-featured-event">
			<Container
				header={
					<Header variant="h2">{t("feedPage.featuredEventHeader")}</Header>
				}
			>
				<SpaceBetween size="s">
					<Box
						fontWeight="bold"
						fontSize="body-s"
						className="feed-featured-event__badge"
					>
						{t("feedPage.featuredEventBadge")}
					</Box>
					<img
						src={EVENT_IMAGE}
						alt={t("feedPage.featuredEventImageAlt")}
						className="feed-featured-event__image"
						width={1200}
						height={630}
						loading="lazy"
					/>
					<Box fontWeight="bold" fontSize="heading-m">
						<Link href={RSVP_PAGE_URL}>{t("feedPage.featuredEventTitle")}</Link>
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{formattedDate}
					</Box>
					<Box
						color="text-body-secondary"
						fontSize="body-s"
						className="feed-featured-event__location"
					>
						{t("feedPage.featuredEventInPersonLabel")}
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{t("feedPage.featuredEventLocation")}
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{t("feedPage.featuredEventDescription")}
					</Box>
					{spotsCopy && (
						<Box
							fontWeight="bold"
							fontSize="body-s"
							className="feed-featured-event__spots"
						>
							{spotsCopy}
						</Box>
					)}
					<div className="cdn-brand-btn-stack">
						<SpeakeasyRsvpButton
							href={RSVP_PAGE_URL}
							label={t("feedPage.featuredEventRsvpPrimary")}
						/>
						<MeetupRsvpButton
							href={meetupUrl}
							label={t("feedPage.featuredEventRsvpMeetup")}
						/>
					</div>
				</SpaceBetween>
			</Container>
		</div>
	);
}
