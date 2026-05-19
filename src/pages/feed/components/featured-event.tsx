// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { type ReactNode, useEffect, useState } from "react";
import MeetupRsvpButton from "../../../components/brand-button/meetup-rsvp";
import SpeakeasyRsvpButton from "../../../components/brand-button/speakeasy-rsvp";
import { useTranslation } from "../../../hooks/useTranslation";
import { getEvent, spotsRemaining } from "../../../lib/rsvp";
import AsciiSmirk from "./ascii-smirk";

const EVENT_ID = "happy-hour-2026-06-03";
const EVENT_IMAGE = "/events/featured-2026-06-03.webp";
const RSVP_RETURN_PATH = `/rsvp/?event=${EVENT_ID}`;
const RSVP_PAGE_URL = `https://auth.clouddelnorte.org/signup/index.html?return_to=${encodeURIComponent(RSVP_RETURN_PATH)}`;
/** Anchor inside the description string after which the inline smirk renders. */
const SMIRK_ANCHOR = '"game."';

/**
 * Render the description, splicing the AsciiSmirk SVG in after the
 * smirk-line hook (`"game."`). If the anchor is absent (defensive fallback
 * for any future copy revision that drops it), render the raw description.
 *
 * Returns a single span wrapper so the parent Cloudscape Box receives one
 * child (avoids React.Children "missing key" array iteration warnings).
 */
function renderDescription(text: string): ReactNode {
	const idx = text.indexOf(SMIRK_ANCHOR);
	if (idx < 0) return text;
	const head = text.slice(0, idx + SMIRK_ANCHOR.length);
	const tail = text.slice(idx + SMIRK_ANCHOR.length);
	return (
		<span className="feed-featured-event__description-inner">
			{head}
			<AsciiSmirk />
			{tail}
		</span>
	);
}

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
					<Box
						fontWeight="bold"
						fontSize="heading-m"
						className="feed-featured-event__title"
					>
						<Link href={RSVP_PAGE_URL}>{t("feedPage.featuredEventTitle")}</Link>
					</Box>
					{/* Date VFX — pure HTML/Intl output wrapped in a backplate that
					    carries the tungsten/indigo gradient + shimmer pseudo-element.
					    Text remains plain (no SVG, no canvas, no string-split). */}
					<div className="feed-featured-event__date">
						<span className="feed-featured-event__date-plate">
							{formattedDate}
						</span>
					</div>
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
					<Box
						color="text-body-secondary"
						fontSize="body-s"
						className="feed-featured-event__description"
					>
						{renderDescription(t("feedPage.featuredEventDescription"))}
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
							variant="violet"
						/>
					</div>
				</SpaceBetween>
			</Container>
		</div>
	);
}
