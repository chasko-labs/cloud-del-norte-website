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
const EVENT_IMAGE =
	"https://secure.meetupstatic.com/photos/event/b/5/4/5/600_533746405.jpeg";
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
						color="text-status-success"
						fontWeight="bold"
						fontSize="body-s"
						className="feed-upcoming-virtual-event__badge"
					>
						{t("feedPage.upcomingVirtualEventBadge")}
					</Box>
					<img
						src={EVENT_IMAGE}
						alt={t("feedPage.upcomingVirtualEventImageAlt")}
						className="feed-upcoming-virtual-event__image"
						width={600}
						height={450}
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
