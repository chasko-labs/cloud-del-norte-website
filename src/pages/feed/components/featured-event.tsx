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
	"https://www.meetup.com/awsugclouddelnorte/events/314839263/rsvp/";
const EVENT_IMAGE =
	"https://secure.meetupstatic.com/photos/event/c/8/5/3/600_534291283.jpeg";
const EVENT_DATE = "2026-06-03T18:00:00-06:00";

export default function FeaturedEvent() {
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
		<div className="feed-featured-event">
			<Container
				header={
					<Header variant="h2">{t("feedPage.featuredEventHeader")}</Header>
				}
			>
				<SpaceBetween size="s">
					<Box
						color="text-status-info"
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
						width={600}
						height={450}
						loading="lazy"
					/>
					<Box fontWeight="bold" fontSize="heading-m">
						<Link href={RSVP_URL} external>
							{t("feedPage.featuredEventTitle")}
						</Link>
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{formattedDate}
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{t("feedPage.featuredEventLocation")}
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{t("feedPage.featuredEventDescription")}
					</Box>
					<Button
						variant="primary"
						href={RSVP_URL}
						target="_blank"
						iconAlign="right"
						iconName="external"
					>
						{t("feedPage.featuredEventRsvp")}
					</Button>
				</SpaceBetween>
			</Container>
		</div>
	);
}
