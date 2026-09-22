// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import {
	Component,
	type ErrorInfo,
	type ReactNode,
	type SyntheticEvent,
	useEffect,
	useState,
} from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "../../../hooks/useTranslation";

const MEETUP_EVENT_URL =
	"https://www.meetup.com/awsugclouddelnorte/events/316669721/";
const MEET_LINK = "https://meet.clouddelnorte.org/sep292026";
const SIGN_IN_URL = "/signup/index.html";
const EVENT_DATE = "2026-09-29T18:30:00-06:00";
// Bespoke light/dark artwork pair for the Bowl. The theme swap is pure CSS
// off .awsui-dark-mode (mirrors upcoming-virtual-event); the wave 37b
// fade-in contract requires onLoad to add `is-loaded` — without it the
// image keeps opacity: 0 and the card shows a blank box.
const EVENT_IMAGE_LIGHT = "/events/muse-big-data-bowl-light.svg";
const EVENT_IMAGE_DARK = "/events/muse-big-data-bowl-dark.svg";

interface CountdownValues {
	days: number;
	hours: number;
	minutes: number;
	passed: boolean;
}

function getCountdown(): CountdownValues {
	const now = Date.now();
	const target = new Date(EVENT_DATE).getTime();
	const diff = target - now;

	if (diff <= 0) {
		return { days: 0, hours: 0, minutes: 0, passed: true };
	}

	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

	return { days, hours, minutes, passed: false };
}

function markImageLoaded(event: SyntheticEvent<HTMLImageElement>): void {
	event.currentTarget.classList.add("is-loaded");
}

function FeaturedEventInner() {
	const { t, locale } = useTranslation();
	const { isAuthenticated } = useAuth();
	const [countdown, setCountdown] = useState<CountdownValues>(getCountdown);
	const [lightImageBroken, setLightImageBroken] = useState(false);
	const [darkImageBroken, setDarkImageBroken] = useState(false);

	useEffect(() => {
		const interval = setInterval(() => {
			setCountdown(getCountdown());
		}, 60_000);
		return () => clearInterval(interval);
	}, []);

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
						<Link href={MEETUP_EVENT_URL}>
							{t("feedPage.featuredEventTitle")}
						</Link>
					</Box>
					<div className="feed-featured-event__date">
						<span className="feed-featured-event__date-plate">
							{formattedDate}
						</span>
					</div>
					<div className="feed-featured-event__image-area">
						{!lightImageBroken && (
							<img
								src={EVENT_IMAGE_LIGHT}
								alt={t("feedPage.featuredEventImageAlt")}
								className="feed-featured-event__image feed-featured-event__image--light"
								width={1200}
								height={630}
								loading="lazy"
								onLoad={markImageLoaded}
								onError={() => setLightImageBroken(true)}
							/>
						)}
						{!darkImageBroken && (
							<img
								src={EVENT_IMAGE_DARK}
								alt={t("feedPage.featuredEventImageAlt")}
								className="feed-featured-event__image feed-featured-event__image--dark"
								width={1200}
								height={630}
								loading="lazy"
								onLoad={markImageLoaded}
								onError={() => setDarkImageBroken(true)}
							/>
						)}
					</div>
					<Box
						color="text-body-secondary"
						fontSize="body-s"
						className="feed-featured-event__in-person-pill"
					>
						{t("feedPage.featuredEventLocation")}
					</Box>

					{!countdown.passed && (
						<div className="feed-featured-event__countdown">
							<Box color="text-body-secondary" fontSize="body-s">
								{t("feedPage.featuredEventCountdownLabel")}
							</Box>
							<Box fontWeight="bold" fontSize="heading-s">
								{countdown.days} {t("feedPage.featuredEventCountdownDays")} ·{" "}
								{countdown.hours} {t("feedPage.featuredEventCountdownHours")} ·{" "}
								{countdown.minutes}{" "}
								{t("feedPage.featuredEventCountdownMinutes")}
							</Box>
						</div>
					)}

					<Box
						color="inherit"
						fontSize="body-m"
						className="feed-featured-event__description"
					>
						{t("feedPage.featuredEventDescription")}
					</Box>
					<div className="cdn-brand-btn-stack">
						{isAuthenticated ? (
							<Button
								variant="primary"
								href={MEET_LINK}
								target="_blank"
								rel="noopener noreferrer"
								iconName="external"
								iconAlign="right"
							>
								{t("feedPage.featuredEventJoinCta")}
							</Button>
						) : (
							<Button variant="primary" href={SIGN_IN_URL}>
								{t("feedPage.featuredEventSignInCta")}
							</Button>
						)}
						<Button
							variant="link"
							href={MEETUP_EVENT_URL}
							target="_blank"
							rel="noopener noreferrer"
						>
							{t("feedPage.featuredEventRsvp")}
						</Button>
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
