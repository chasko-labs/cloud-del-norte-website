// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { Component, type ErrorInfo, type ReactNode } from "react";
import MeetupRsvpButton from "../../../components/brand-button/meetup-rsvp";
import { useTranslation } from "../../../hooks/useTranslation";

const RSVP_URL = "https://www.meetup.com/awsugclouddelnorte/";
const BRAKET_LEARNING_URL =
	"https://aws.amazon.com/blogs/quantum-computing/introducing-the-amazon-braket-learning-plan-and-digital-badge/";
const EVENT_DATE = "2026-08-30T15:00:00-06:00";

function FeaturedEventInner() {
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
				<div className="feed-featured-event__layout">
					<Box
						fontWeight="bold"
						fontSize="heading-m"
						className="feed-featured-event__title"
					>
						<Link href={RSVP_URL}>{t("feedPage.featuredEventTitle")}</Link>
					</Box>
					<div className="feed-featured-event__date">
						<span className="feed-featured-event__date-plate">
							{formattedDate}
						</span>
					</div>
					<Box
						color="text-body-secondary"
						fontSize="body-s"
						className="feed-featured-event__in-person-pill"
					>
						{t("feedPage.featuredEventLocation")}
					</Box>
					<Box
						color="inherit"
						fontSize="body-m"
						className="feed-featured-event__description"
					>
						{t("feedPage.featuredEventDescription")}
					</Box>
					<Box fontSize="body-s" className="feed-featured-event__secondary">
						<Link href={BRAKET_LEARNING_URL} external>
							{t("feedPage.featuredEventSecondaryLink")}
						</Link>
					</Box>
					<div className="cdn-brand-btn-stack">
						<MeetupRsvpButton
							href={RSVP_URL}
							label={t("feedPage.featuredEventRsvpMeetup")}
							variant="violet"
						/>
					</div>
				</div>
			</Container>
		</div>
	);
}

/**
 * Error boundary scoped to the FeaturedEvent card.
 */
interface FeaturedEventErrorBoundaryState {
	hasError: boolean;
}

export class FeaturedEventErrorBoundary extends Component<
	{ children: ReactNode; fallbackHeader: string; fallbackMessage: string },
	FeaturedEventErrorBoundaryState
> {
	state: FeaturedEventErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(): FeaturedEventErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		console.error("[FeaturedEvent] render failure", error, info);
	}

	render(): ReactNode {
		if (this.state.hasError) {
			return (
				<div className="feed-featured-event">
					<Container
						header={<Header variant="h2">{this.props.fallbackHeader}</Header>}
					>
						<Box color="text-body-secondary" fontSize="body-s">
							{this.props.fallbackMessage}
						</Box>
					</Container>
				</div>
			);
		}
		return this.props.children;
	}
}

export default function FeaturedEvent() {
	const { t } = useTranslation();
	return (
		<FeaturedEventErrorBoundary
			fallbackHeader={t("feedPage.featuredEventHeader")}
			fallbackMessage="Event details temporarily unavailable. Please refresh the page."
		>
			<FeaturedEventInner />
		</FeaturedEventErrorBoundary>
	);
}
