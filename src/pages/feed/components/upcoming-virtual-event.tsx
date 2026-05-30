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
	useState,
} from "react";
import MeetupRsvpButton from "../../../components/brand-button/meetup-rsvp";
import { useTranslation } from "../../../hooks/useTranslation";
import EventBulbsOverlay from "./event-bulbs-overlay";
import GlobalGlobe from "./global-globe";

const RSVP_URL = "https://www.meetup.com/bostonblender/events/314929344";
const EVENT_IMAGE_LIGHT = "/events/boston-blender-petoi.webp";
const EVENT_IMAGE_DARK = "/events/boston-blender-petoi.webp";
const EVENT_DATE = "2026-06-27T07:00:00-06:00";
/**
 * Wave 38c — anchor inside the description string after which the inline
 * GlobalGlobe SVG renders. "global" sits in the second word of the en-US
 * + es-MX strings; placing the glyph immediately after it ties the icon
 * to the word it qualifies (analogous to wave 27a featured-event smirk
 * after "game"). If the anchor is absent (defensive fallback for any
 * future copy revision that drops it), the description renders raw.
 */
const GLOBE_ANCHOR = "global";

/**
 * Wave 33b — twinkle-star count rendered behind the marquee headline.
 * 14 stars distributed across the marquee backplate via deterministic
 * percentage positions (the data array below). Per-star animation-delay
 * + animation-duration are computed in CSS from the inline `--star-index`
 * custom property so all stars share one keyframes rule with a staggered
 * fade-in/out cycle. Reduced-motion gates the chase off and renders the
 * stars statically dim instead of twinkling.
 */
const TWINKLE_STARS: ReadonlyArray<{ left: number; top: number; size: 2 | 3 }> =
	[
		// Top row — sparse string above the headline letters
		{ left: 6, top: 22, size: 2 },
		{ left: 18, top: 12, size: 3 },
		{ left: 32, top: 28, size: 2 },
		{ left: 46, top: 14, size: 2 },
		{ left: 58, top: 24, size: 3 },
		{ left: 72, top: 10, size: 2 },
		{ left: 86, top: 22, size: 2 },
		// Bottom row — sparse string below the headline
		{ left: 10, top: 76, size: 2 },
		{ left: 24, top: 84, size: 3 },
		{ left: 38, top: 72, size: 2 },
		{ left: 54, top: 86, size: 2 },
		{ left: 68, top: 74, size: 3 },
		{ left: 82, top: 88, size: 2 },
		{ left: 94, top: 78, size: 2 },
	];

/**
 * Wave 37b — onLoad handler that flags the <img> as `is-loaded` so the
 * CSS opacity transition can fade the binary in over 320ms. The CSS rule
 * gates this behind prefers-reduced-motion so reduced-motion users see
 * the image at full opacity immediately.
 */
function markImageLoaded(event: SyntheticEvent<HTMLImageElement>) {
	event.currentTarget.classList.add("is-loaded");
}

/**
 * Wave 33b — Starfield-twinkle marquee header.
 *
 * Replaces Cloudscape's <Header variant="h2"> with a custom JSX block so the
 * "Upcoming virtual AWS community event" string sits inside a violet+lavender
 * marquee backplate flecked with subtly twinkling stars. Differentiated from
 * the wave 32a featured-event amber-tungsten chasing-bulbs marquee — same
 * structural pattern (rounded backplate, 1px rim, depth shadow, bold tight-
 * tracked text), different palette + decoration to keep the cosmic/global
 * mood of an international virtual event.
 *
 * The wrapper announces itself as an h2 to screen readers via
 * role="heading" + aria-level=2 — Cloudscape only renders an actual <h2>
 * via its Header component; the explicit ARIA role keeps the AT semantics
 * intact when we trade Cloudscape heading chrome for custom marquee chrome
 * (mirrors the wave 32a featured-event approach).
 *
 * Stars render as decorative children (aria-hidden) and lean on a shared
 * keyframes animation; per-star animation-delay is computed via the
 * `--star-index` custom property so all 14 stars share one rule. Reduced
 * motion is handled in CSS — stars render statically dim instead of
 * twinkling.
 */
function MarqueeHeader({ text }: { text: string }) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: marquee is visually styled; heading semantics provided via role="heading"+aria-level to avoid h2 default-style/layout conflict
		<div
			className="feed-upcoming-virtual-event__marquee"
			role="heading"
			aria-level={2}
		>
			<span className="feed-upcoming-virtual-event__marquee-text">{text}</span>
			<div
				className="feed-upcoming-virtual-event__twinkle-wrapper"
				aria-hidden="true"
			>
				{TWINKLE_STARS.map((star, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: stars are a fixed-length decorative field
						key={i}
						className={`feed-upcoming-virtual-event__twinkle-star feed-upcoming-virtual-event__twinkle-star--s${star.size}`}
						style={
							{
								"--star-index": i,
								left: `${star.left}%`,
								top: `${star.top}%`,
							} as CSSProperties
						}
					/>
				))}
			</div>
		</div>
	);
}

/**
 * Wave 38c — render the description splicing the GlobalGlobe SVG in
 * after the GLOBE_ANCHOR ("global") substring. Returns a single span
 * wrapper so the parent Cloudscape Box receives one child (avoids
 * React.Children "missing key" array iteration warnings). If the
 * anchor is absent in the localized string (defensive), the raw text
 * renders unchanged.
 */
function renderDescription(text: string): ReactNode {
	const idx = text.indexOf(GLOBE_ANCHOR);
	if (idx < 0) return text;
	const head = text.slice(0, idx + GLOBE_ANCHOR.length);
	const tail = text.slice(idx + GLOBE_ANCHOR.length);
	return (
		<span className="feed-upcoming-virtual-event__description-inner">
			{head}
			<GlobalGlobe />
			{tail}
		</span>
	);
}

function UpcomingVirtualEventInner() {
	const { t, locale } = useTranslation();
	const [brandMarkBroken, setBrandMarkBroken] = useState(false);
	const [lightImageBroken, setLightImageBroken] = useState(false);
	const [darkImageBroken, setDarkImageBroken] = useState(false);

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
					<MarqueeHeader text={t("feedPage.upcomingVirtualEventHeader")} />
				}
			>
				{/* Wave 38c — replaces the wave 33b <SpaceBetween size="s"> stack
				    with a custom layout div. SpaceBetween's uniform 12px gap was
				    too flat for the card's narrative arc — every step read the
				    same. The new __layout div sets gap:0 and each direct child
				    carries its own margin-block-end token in styles.css so the
				    spacing hierarchy reads as deliberate beats: smaller gaps
				    cluster related metadata (date→location), the largest gaps
				    set off the secondary primary action (description→featured-
				    talk callout) and the CTA (callout→buttons). Mirrors the
				    wave 37c featured-event pattern (which uses CSS Grid named
				    areas — this card stays in DOM order without grid since the
				    wave 33b/29a featured-talk callout block is its own visual
				    anchor that doesn't need re-flow at tablet+ breakpoints). */}
				<div className="feed-upcoming-virtual-event__layout">
					{/* Wave 42a — the wave 33b "UPCOMING" badge JSX block + its
					    locale key (feedPage.upcomingVirtualEventBadge) was
					    removed at Bryan's direction: the marquee header copy
					    was renamed from "Virtual AWS Community Events" to
					    "Free & Open Virtual AWS Community Events", and the
					    redundant ALL-CAPS "UPCOMING" pill below the marquee
					    no longer earns its visual weight. The
					    .feed-upcoming-virtual-event__badge CSS rule remains
					    in styles.css as orphaned chrome (no JSX consumer);
					    leaving it in place keeps the diff minimal and avoids
					    spelunking through the badge backplate VFX in this
					    copy-only batch. */}
					{/* Wave 33c — both visible image variants are wrapped in
					    anchors pointing at the AWS Global Community Gatherings
					    Meetup page (target=_blank since this is an external
					    Meetup destination, mirroring the RSVP button below).
					    The image alt text describes the image content; the
					    wrapping anchor's aria-label describes the link action
					    via a new locale key so AT users hear both. The bulbs-
					    wrapper anchor sits ABOVE the dark img + EventBulbsOverlay
					    so the entire wrapper (including the bulb overlay area)
					    is one click target. */}
					<a
						href={RSVP_URL}
						aria-label={t("feedPage.upcomingVirtualEventImageLinkLabel")}
						target="_blank"
						rel="noreferrer"
						className="feed-upcoming-virtual-event__image-link"
					>
						{!lightImageBroken && (
							<img
								src={EVENT_IMAGE_LIGHT}
								alt={t("feedPage.upcomingVirtualEventImageAlt")}
								className="feed-upcoming-virtual-event__image feed-upcoming-virtual-event__image--light"
								width={1200}
								height={630}
								loading="lazy"
								onLoad={markImageLoaded}
								onError={() => setLightImageBroken(true)}
							/>
						)}
					</a>
					<a
						href={RSVP_URL}
						aria-label={t("feedPage.upcomingVirtualEventImageLinkLabel")}
						target="_blank"
						rel="noreferrer"
						className="feed-upcoming-virtual-event__image-link"
					>
						<div className="feed-upcoming-virtual-event__bulbs-wrapper">
							{!darkImageBroken && (
								<img
									src={EVENT_IMAGE_DARK}
									alt={t("feedPage.upcomingVirtualEventImageAlt")}
									className="feed-upcoming-virtual-event__image feed-upcoming-virtual-event__image--dark"
									width={1200}
									height={630}
									loading="lazy"
									onLoad={markImageLoaded}
									onError={() => setDarkImageBroken(true)}
								/>
							)}
							<EventBulbsOverlay />
						</div>
					</a>
					<Box
						fontWeight="bold"
						fontSize="heading-m"
						className="feed-upcoming-virtual-event__title"
					>
						<Link href={RSVP_URL} external>
							{t("feedPage.upcomingVirtualEventTitle")}
						</Link>
					</Box>
					{/* Wave 33b — date VFX backplate. Same pattern as wave 27a v2 on the
					    featured-event card but violet-tinted. The Intl.DateTimeFormat
					    output stays plain text inside the inner span; the wrapper div
					    carries the layout margin and the inner span carries the
					    backplate gradient + shimmer pseudo-element. */}
					<div className="feed-upcoming-virtual-event__date">
						<span className="feed-upcoming-virtual-event__date-plate">
							{formattedDate}
						</span>
					</div>
					<Box
						color="text-body-secondary"
						fontSize="body-s"
						className="feed-upcoming-virtual-event__location"
					>
						{t("feedPage.upcomingVirtualEventLocation")}
					</Box>
					{/* Wave 38c — description copy gets the wave 37c personality
					    uplift (mirrors featured-event): color="inherit" so the
					    .feed-upcoming-virtual-event__description CSS rule below
					    — which sets color: var(--cdn-color-text) — actually
					    paints (Cloudscape's "text-body-secondary" was muting the
					    prose to fine-print gray). fontSize="body-m" bumps the
					    inherited size onto the --cdn-text-base tier; the same
					    CSS rule layers an explicit font-size + line-height: 1.65
					    + 64ch max-width on top so the prose reads as the
					    deliberate voice the card hangs its narrative on rather
					    than secondary metadata. The inline GlobalGlobe SVG
					    splices in after the word "global" via renderDescription
					    (the upcoming-virtual-event signature personality detail
					    — in-family with the featured-event AsciiSmirk). */}
					<Box
						color="inherit"
						fontSize="body-m"
						className="feed-upcoming-virtual-event__description"
					>
						{renderDescription(t("feedPage.upcomingVirtualEventDescription"))}
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
				</div>
			</Container>
		</div>
	);
}

/**
 * Wave 33b — error boundary scoped to the UpcomingVirtualEvent card.
 *
 * The card now stacks several sustained animations + perspective/preserve-3d
 * + Intl.DateTimeFormat. If any of those throw at render time, this boundary
 * catches it locally so the rest of the feed (FeaturedEvent, NextMeetup,
 * BuilderCenterCard, the live hero, the shuffled grid) keeps rendering. The
 * fallback UI is a quiet, accessible notice so users still know an event was
 * meant to be here without the page going blank. Mirrors the wave 30a
 * FeaturedEventErrorBoundary in featured-event.tsx.
 */
interface UpcomingVirtualEventErrorBoundaryState {
	hasError: boolean;
}

export class UpcomingVirtualEventErrorBoundary extends Component<
	{ children: ReactNode; fallbackHeader: string; fallbackMessage: string },
	UpcomingVirtualEventErrorBoundaryState
> {
	state: UpcomingVirtualEventErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(): UpcomingVirtualEventErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		// Single console.error so the failure is visible in devtools without
		// piping crash data to a third-party endpoint. The boundary's render
		// fallback is the user-visible signal; this is the developer signal.
		console.error("[UpcomingVirtualEvent] render failure", error, info);
	}

	render(): ReactNode {
		if (this.state.hasError) {
			return (
				<div className="feed-upcoming-virtual-event">
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
 * Default export: UpcomingVirtualEvent wrapped in its own error boundary.
 * The header copy resolves through the existing locale key so the empty
 * state stays in the user's language; the body fallback message is hard-
 * coded English (mirroring wave 30a FeaturedEvent — this path only fires
 * on render errors, exceptional and primarily a dev-visible signal in
 * console.error).
 */
export default function UpcomingVirtualEvent() {
	const { t } = useTranslation();
	return (
		<UpcomingVirtualEventErrorBoundary
			fallbackHeader={t("feedPage.upcomingVirtualEventHeader")}
			fallbackMessage="Event details temporarily unavailable. Please refresh the page."
		>
			<UpcomingVirtualEventInner />
		</UpcomingVirtualEventErrorBoundary>
	);
}
