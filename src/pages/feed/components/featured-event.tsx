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
	useEffect,
	useState,
} from "react";
import { useTranslation } from "../../../hooks/useTranslation";

const BRAKET_LEARNING_URL =
	"https://aws.amazon.com/blogs/quantum-computing/introducing-the-amazon-braket-learning-plan-and-digital-badge/";
const EVENT_DATE = "2026-08-30T15:00:00-06:00";
const SIGNUP_URL =
	"https://auth.clouddelnorte.org/signup/index.html?event=quantum";

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

function FeaturedEventInner() {
	const { t, locale } = useTranslation();
	const [countdown, setCountdown] = useState<CountdownValues>(getCountdown);

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
						<Link href={SIGNUP_URL}>{t("feedPage.featuredEventTitle")}</Link>
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
					<Box color="text-body-secondary" fontSize="body-s">
						{t("feedPage.featuredEventSeriesNote")}
					</Box>
					<Box fontSize="body-s" className="feed-featured-event__secondary">
						<Link href={BRAKET_LEARNING_URL} external>
							{t("feedPage.featuredEventSecondaryLink")}
						</Link>
					</Box>
					<div className="cdn-brand-btn-stack">
						<Button variant="primary" href={SIGNUP_URL}>
							{t("feedPage.featuredEventJoinCta")}
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
