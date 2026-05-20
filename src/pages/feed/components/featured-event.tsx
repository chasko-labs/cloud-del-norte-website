// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import {
	Component,
	type CSSProperties,
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
const RSVP_RETURN_PATH = `/rsvp/index.html?event=${EVENT_ID}`;
const RSVP_PAGE_URL = `https://auth.clouddelnorte.org/signup/index.html?return_to=${encodeURIComponent(RSVP_RETURN_PATH)}`;
/** Anchor inside the description string after which the inline smirk renders. */
const SMIRK_ANCHOR = "game";
/** Wave 32a — bulb count traced around the marquee perimeter. 16 spaces evenly
 *  on a top + bottom row (8 each) so the chase sweep reads as a clean ring at
 *  every container-query breakpoint without crowding the trapezoid corners. */
const MARQUEE_BULB_COUNT = 16;

/**
 * Render the description, splicing the AsciiSmirk SVG in after the
 * smirk-line hook (`game`). If the anchor is absent (defensive fallback
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
 * Wave 37b — onLoad handler that flags the <img> as `is-loaded` so the
 * CSS opacity transition can fade the binary in over 320ms. Avoids the
 * harder skeleton-to-content snap when the image arrives. The CSS rule
 * gates this behind prefers-reduced-motion so reduced-motion users see
 * the image at full opacity immediately.
 */
function markImageLoaded(event: SyntheticEvent<HTMLImageElement>) {
	event.currentTarget.classList.add("is-loaded");
}

/**
 * Wave 32a — Theater marquee header.
 *
 * Replaces Cloudscape's <Header variant="h2"> with a custom JSX block so
 * the "FEATURED EVENT" string sits inside a vintage marquee sign with
 * chasing perimeter bulbs. The wrapper still announces itself as an h2 to
 * screen readers via role="heading" + aria-level=2 — Cloudscape only
 * renders an actual <h2> element via its Header component, so the explicit
 * ARIA role keeps the AT semantics intact when we trade the Cloudscape
 * heading chrome for custom marquee chrome.
 *
 * The bulbs render as decorative children (aria-hidden) and lean on a
 * shared keyframes animation; per-bulb animation-delay is computed via the
 * `--bulb-index` custom property so all 16 bulbs share one keyframes rule.
 * Reduced-motion is handled in CSS — bulbs render statically lit instead
 * of chasing.
 */
function MarqueeHeader({ text }: { text: string }) {
	return (
		<div className="feed-featured-event__marquee" role="heading" aria-level={2}>
			<span className="feed-featured-event__marquee-text">{text}</span>
			<div className="feed-featured-event__marquee-bulbs" aria-hidden="true">
				{Array.from({ length: MARQUEE_BULB_COUNT }).map((_, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: bulbs are a fixed-length decorative ring
						key={i}
						className="feed-featured-event__marquee-bulb"
						style={{ "--bulb-index": i } as CSSProperties}
					/>
				))}
			</div>
		</div>
	);
}

function FeaturedEventInner() {
	const { t, locale } = useTranslation();
	const event = getEvent(EVENT_ID);
	const [remaining, setRemaining] = useState<number | null>(null);
	const [lightImageBroken, setLightImageBroken] = useState(false);
	const [darkImageBroken, setDarkImageBroken] = useState(false);

	useEffect(() => {
		// spotsRemaining now talks to the public cdn-rsvp API. It returns NaN
		// on any error (network, 404, parse) so the UI's `remaining > 0`
		// gating already fail-safes — we just store whatever it produces.
		// Effect is fire-and-forget; if the user navigates away before the
		// fetch resolves the cancelled flag prevents a no-op setState warning.
		let cancelled = false;
		(async () => {
			const value = await spotsRemaining(EVENT_ID);
			if (!cancelled) setRemaining(value);
		})();
		return () => {
			cancelled = true;
		};
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
		event && remaining !== null && Number.isFinite(remaining)
			? t("feedPage.featuredEventSpotsRemaining")
					.replace("{count}", String(remaining))
					.replace("{capacity}", String(event.capacity))
			: "";

	return (
		<div className="feed-featured-event">
			<Container
				header={<MarqueeHeader text={t("feedPage.featuredEventHeader")} />}
			>
				{/* Wave 31a — responsive CSS Grid layout. Replaces the previous
				    single-column SpaceBetween stack so the card fills available
				    horizontal space at tablet + desktop breakpoints (Bryan: "tons
				    of white space that we could responsively fill with some grid
				    type thinking"). DOM order is the logical reading order
				    (image → title → date → in-person → desc → spots →
				    buttons); CSS Grid named areas in styles.css remap the visual
				    placement per breakpoint while keeping screen-reader and tab
				    order intact. Container queries (`container-type: inline-size`
				    on .feed-featured-event) drive the breakpoints off the card's
				    rendered width — the right tool for component-level responsive
				    layout when the parent grid varies the card's own track size.
				    Wave 32a — the "DON'T MISS" badge slot was removed; locale
				    key feedPage.featuredEventBadge is preserved for parity but
				    no longer referenced in this component. */}
				<div className="feed-featured-event__layout">
					{/* Image area wraps both light + dark variants so the grid cell
					    only owns one logical slot — the existing wave 28a theme-
					    swap CSS (display:none on the off-theme variant) still
					    decides which one paints. onError handlers from wave 30a
					    remain on each <img> so a 404 on either asset is still
					    handled per-image without dropping the wrapping cell.
					    Wave 33c — the entire image pair is wrapped in an anchor
					    pointing at the same speakeasy RSVP URL as the primary
					    CTA button, so clicking the photo (light or dark variant)
					    routes to /signup?return_to=/rsvp/. The <img> alt
					    attributes describe the image content; the wrapping <a>
					    aria-label describes the link action via a new locale
					    key so screen readers announce both axes correctly. */}
					<a
						href={RSVP_PAGE_URL}
						aria-label={t("feedPage.featuredEventImageLinkLabel")}
						className="feed-featured-event__image-link"
					>
						<div
							className="feed-featured-event__image-area"
							role="img"
							aria-label={t("feedPage.featuredEventImageAlt")}
						>
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
					</a>
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
					    pill. The class previously named __location was generic;
					    __in-person-pill makes the semantic role explicit. */}
					<Box
						color="text-body-secondary"
						fontSize="body-s"
						className="feed-featured-event__in-person-pill"
					>
						{t("feedPage.featuredEventInPersonLabel")}
					</Box>
					{/* Wave 37c — description copy gets the personality uplift:
					    color="inherit" (was "text-body-secondary" muted gray) so the
					    .feed-featured-event__description CSS rule below — which sets
					    color: var(--cdn-color-text) — actually paints. fontSize="body-m"
					    (was body-s) bumps the inherited text size onto the
					    --cdn-text-base tier; the same CSS rule layers an explicit
					    var(--cdn-text-base) font-size + line-height: 1.65 + 64ch
					    max-width on top so the prose reads as the deliberate voice
					    the card hangs its narrative on rather than fine-print
					    metadata. Cloudscape Box.Color does not expose a
					    "text-body-default" enum member; "inherit" is the canonical
					    way to opt out of Cloudscape's secondary-color override. */}
					<Box
						color="inherit"
						fontSize="body-m"
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
