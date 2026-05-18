// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useTranslation } from "../../../hooks/useTranslation";

const RSVP_URL =
	"https://www.meetup.com/awsglobalcommunitygatherings/events/314332142/";
const EVENT_IMAGE_LIGHT = "/events/global-community-gatherings-light.webp";
const EVENT_IMAGE_DARK = "/events/global-community-gatherings-dark.webp";
const EVENT_DATE = "2026-05-22T22:00:00+09:00";

export default function UpcomingVirtualEvent() {
	const { t, locale } = useTranslation();

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
					/>
					<img
						src={EVENT_IMAGE_DARK}
						alt={t("feedPage.upcomingVirtualEventImageAlt")}
						className="feed-upcoming-virtual-event__image feed-upcoming-virtual-event__image--dark"
						width={1200}
						height={630}
						loading="lazy"
					/>
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
							className="feed-upcoming-virtual-event__ug-mark"
							role="img"
							aria-label={t("feedPage.upcomingVirtualEventUgMarkLabel")}
						>
							<span aria-hidden="true">UG</span>
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
					<Button
						variant="primary"
						href={RSVP_URL}
						target="_blank"
						iconAlign="right"
						iconName="external"
					>
						{t("feedPage.upcomingVirtualEventRsvp")}
					</Button>
				</SpaceBetween>
			</Container>
		</div>
	);
}
