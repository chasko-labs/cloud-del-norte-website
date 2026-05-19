// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { type SyntheticEvent, useState } from "react";
import MeetupRsvpButton from "../../../components/brand-button/meetup-rsvp";
import { useTranslation } from "../../../hooks/useTranslation";
import EventBulbsOverlay from "./event-bulbs-overlay";

const RSVP_URL =
	"https://www.meetup.com/awsglobalcommunitygatherings/events/314332142/";
const EVENT_IMAGE_LIGHT = "/events/global-community-gatherings-light.webp";
const EVENT_IMAGE_DARK = "/events/global-community-gatherings-dark.webp";
const EVENT_DATE = "2026-05-22T22:00:00+09:00";

/**
 * Hide a broken event image gracefully — used as the onError handler for the
 * light + dark .webp banners so a missing asset doesn't leave a broken-image
 * icon visible on the card.
 */
function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
	const target = event.currentTarget;
	target.style.display = "none";
}

export default function UpcomingVirtualEvent() {
	const { t, locale } = useTranslation();
	const [brandMarkBroken, setBrandMarkBroken] = useState(false);

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
	}).format(new Date(EVENT_DATE));

	return (
		<div className="feed-upcoming-virtual-event">
			<Container
				header={
					<Header variant="h2">
						{t("feedPage.upcomingVirtualEventHeader")}
					</Header>
				}
			>
				<SpaceBetween size="s">
					<Box
						fontWeight="bold"
						fontSize="body-s"
						className="feed-upcoming-virtual-event__badge"
					>
						{t("feedPage.upcomingVirtualEventBadge")}
					</Box>
					<img
						src={EVENT_IMAGE_LIGHT}
						alt={t("feedPage.upcomingVirtualEventImageAlt")}
						className="feed-upcoming-virtual-event__image feed-upcoming-virtual-event__image--light"
						width={1200}
						height={630}
						loading="lazy"
						onError={hideBrokenImage}
					/>
					<div className="feed-upcoming-virtual-event__bulbs-wrapper">
						<img
							src={EVENT_IMAGE_DARK}
							alt={t("feedPage.upcomingVirtualEventImageAlt")}
							className="feed-upcoming-virtual-event__image feed-upcoming-virtual-event__image--dark"
							width={1200}
							height={630}
							loading="lazy"
							onError={hideBrokenImage}
						/>
						<EventBulbsOverlay />
					</div>
					<Box fontWeight="bold" fontSize="heading-m">
						<Link href={RSVP_URL} external>
							{t("feedPage.upcomingVirtualEventTitle")}
						</Link>
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{formattedDate}
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{t("feedPage.upcomingVirtualEventLocation")}
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{t("feedPage.upcomingVirtualEventDescription")}
					</Box>
					<div className="feed-upcoming-virtual-event__featured-talk">
						<span
							className="feed-upcoming-virtual-event__brand-mark"
							role="img"
							aria-label={t("feedPage.upcomingVirtualEventUgMarkLabel")}
						>
							{!brandMarkBroken && (
								<img
									src="/brand/logo.svg"
									alt=""
									aria-hidden="true"
									className="feed-upcoming-virtual-event__brand-mark-img"
									width={40}
									height={40}
									onError={() => setBrandMarkBroken(true)}
								/>
							)}
							{/* When /brand/logo.svg 404s the parent <span> still has its
							    purple→violet gradient + AWS-orange ring background from
							    .feed-upcoming-virtual-event__brand-mark, so the slot
							    keeps its visual weight on the card without showing a
							    broken-image glyph. The aria-label on the wrapper still
							    announces "AWS User Group mark" for AT users. */}
						</span>
						<div className="feed-upcoming-virtual-event__featured-talk-body">
							<span className="feed-upcoming-virtual-event__featured-talk-badge">
								{t("feedPage.upcomingVirtualEventFeaturedTalkBadge")}
							</span>
							<p className="feed-upcoming-virtual-event__featured-talk-speaker">
								{t("feedPage.upcomingVirtualEventFeaturedTalkSpeaker")}
							</p>
							<p className="feed-upcoming-virtual-event__featured-talk-title">
								{t("feedPage.upcomingVirtualEventFeaturedTalkTitle")}
							</p>
						</div>
					</div>
					<div className="cdn-brand-btn-stack">
						<MeetupRsvpButton
							href={RSVP_URL}
							label={t("feedPage.upcomingVirtualEventRsvp")}
							variant="violet"
						/>
					</div>
				</SpaceBetween>
			</Container>
		</div>
	);
}
