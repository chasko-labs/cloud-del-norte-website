// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
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
import MeetupRsvpButton from "../../../components/brand-button/meetup-rsvp";
import SpeakeasyRsvpButton from "../../../components/brand-button/speakeasy-rsvp";
import { useTranslation } from "../../../hooks/useTranslation";
import { getEvent, spotsRemaining } from "../../../lib/rsvp";
import AsciiSmirk from "./ascii-smirk";

const EVENT_ID = "happy-hour-2026-06-03";
const EVENT_IMAGE_LIGHT = "/events/featured-2026-06-03.webp";
const EVENT_IMAGE_DARK = "/events/featured-2026-06-03-dark.webp";
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

/**
 * Hide a broken event image gracefully. Used as the onError handler for the
 * light + dark .webp event banners. If the asset 404s (e.g. missing from
 * the deploy bucket) we fail silently — the rest of the card still RSVPs
 * the user, which is the conversion goal.
 */
function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
	const target = event.currentTarget;
	target.style.display = "none";
}

function FeaturedEventInner() {
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
				{/* Wave 31a — responsive CSS Grid layout. Replaces the previous
				    single-column SpaceBetween stack so the card fills available
				    horizontal space at tablet + desktop breakpoints (Bryan: "tons
				    of white space that we could responsively fill with some grid
				    type thinking"). DOM order is the logical reading order
				    (badge → image → title → date → in-person → location → desc →
				    spots → buttons); CSS Grid named areas in styles.css remap the
				    visual placement per breakpoint while keeping screen-reader
				    and tab order intact. Container queries (`container-type:
				    inline-size` on .feed-featured-event) drive the breakpoints
				    off the card's rendered width — the right tool for
				    component-level responsive layout when the parent grid varies
				    the card's own track size. */}
				<div className="feed-featured-event__layout">
					<Box
						fontWeight="bold"
						fontSize="body-s"
						className="feed-featured-event__badge"
					>
						{t("feedPage.featuredEventBadge")}
					</Box>
					{/* Image area wraps both light + dark variants so the grid cell
					    only owns one logical slot — the existing wave 28a theme-
					    swap CSS (display:none on the off-theme variant) still
					    decides which one paints. onError handlers from wave 30a
					    remain on each <img> so a 404 on either asset is still
					    handled per-image without dropping the wrapping cell. */}
					<div className="feed-featured-event__image-area">
						<img
							src={EVENT_IMAGE_LIGHT}
							alt={t("feedPage.featuredEventImageAlt")}
							className="feed-featured-event__image feed-featured-event__image--light"
							width={1200}
							height={630}
							loading="lazy"
							onError={hideBrokenImage}
						/>
						<img
							src={EVENT_IMAGE_DARK}
							alt={t("feedPage.featuredEventImageAlt")}
							className="feed-featured-event__image feed-featured-event__image--dark"
							width={1200}
							height={630}
							loading="lazy"
							onError={hideBrokenImage}
						/>
					</div>
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
					{/* Wave 31a rename: this amber tungsten chip is the IN-PERSON
					    pill, not the secondary location text. The class previously
					    named __location was generic; __in-person-pill makes the
					    semantic role explicit and frees __location-text below for
					    the fine-print address row. */}
					<Box
						color="text-body-secondary"
						fontSize="body-s"
						className="feed-featured-event__in-person-pill"
					>
						{t("feedPage.featuredEventInPersonLabel")}
					</Box>
					<Box
						color="text-body-secondary"
						fontSize="body-s"
						className="feed-featured-event__location-text"
					>
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
				</div>
			</Container>
		</div>
	);
}

/**
 * Wave 30a — error boundary scoped to the FeaturedEvent card.
 *
 * The featured event card is the most rizzed-up component on the feed page
 * (perspective+preserve-3d, multiple stacked animations, Intl.DateTimeFormat,
 * localStorage RSVP state lookup). If any of those upstream pieces throw at
 * render time, this boundary catches it locally so the rest of the feed —
 * NextMeetup, UpcomingVirtualEvent, BuilderCenterCard, the live hero, the
 * shuffled grid — keeps rendering. The fallback UI is a quiet, accessible
 * notice so users know an event was meant to be here without the page going
 * blank.
 *
 * Lives inside this file (rather than app.tsx) so the boundary travels with
 * the component — anyone who imports FeaturedEvent gets the protection by
 * default. The Cloudscape Container/Header chrome is reused so the empty
 * state still anchors visually in the same slot.
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
		// Single console.error so the failure is visible in devtools without
		// piping crash data to a third-party endpoint. The boundary's render
		// fallback is the user-visible signal; this is the developer signal.
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

/**
 * Default export: the FeaturedEvent component wrapped in its own error
 * boundary. The header copy resolves through the existing locale key so the
 * empty state stays in the user's language; the body fallback message is
 * hard-coded English (the wave 30a hard scope forbids adding new locale
 * keys, and this path only fires on render errors — exceptional, brief,
 * and primarily a dev-visible signal in console.error).
 */
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
