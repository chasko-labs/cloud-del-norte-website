// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * NextMeetup — fetches the next upcoming AWS UG Cloud del Norte event from
 * the meetup.com iCal feed and renders it above the rotating sections grid.
 *
 * CORS note: meetup.com does not serve CORS headers for direct browser fetches.
 * The iCal fetch will fail in production with a CORS error (no-cors mode returns
 * an opaque response that cannot be read). The component handles this gracefully
 * by falling back to a "Visit meetup.com" CTA card.
 *
 * Proposed CI step (follow-up for Harald):
 *   - Add a Woodpecker pipeline step that runs on a schedule (weekly or on push)
 *   - Step fetches https://www.meetup.com/awsugclouddelnorte/events/ical/ from
 *     the CI environment (no CORS restriction server-side)
 *   - Parses the first future VEVENT and writes the result to
 *     public/data/next-meetup.json as a static file
 *   - The component can then try /data/next-meetup.json first, fall back to
 *     the CTA card if the file is absent or stale (>30 days old)
 *   - File schema: { summary, dtstart (ISO 8601), location, url, description }
 *   - Dispatch to Harald as issue: "feat(feed): CI step for next-meetup.json static gen"
 *
 * Wave 33a — visual uplift to match the wave 32a featured-event card. The
 * card now carries:
 *   - A theater-marquee header (cooler steel-blue / deep-teal palette) with
 *     a scrolling-tape shimmer across the backplate (no chasing bulbs — the
 *     adjacent-but-distinct mood vs. featured's warm amber + bulb chase).
 *   - A date-plate VFX backplate behind the meetup date string in the same
 *     cooler palette.
 *   - The title link gets a steel-blue → cyan gradient with the same
 *     scrolling-tape treatment used on the featured-event title.
 *   - The same depth stack: perspective(1200px) + preserve-3d on the card
 *     root, will-change/contain/translate3d compositing hints, and a 1px
 *     stage-rim inset in the box-shadow.
 *   - An error boundary mirroring FeaturedEventErrorBoundary so a render
 *     failure shows fallback chrome instead of crashing the feed.
 *   - All animations gated behind prefers-reduced-motion: no-preference;
 *     reduced-motion users see a static, fully-legible fallback.
 *   - The body.cdn-scrolling pause integration is extended to cover the
 *     new sustained animations (marquee shimmer, title tape, date breathe).
 */

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import {
	Component,
	type ErrorInfo,
	type ReactNode,
	useEffect,
	useState,
} from "react";
import { SkeletonLine, SkeletonTitle } from "../../../components/skeleton";
import { useTranslation } from "../../../hooks/useTranslation";
import LivePulseDot from "./live-pulse-dot";

const MEETUP_GROUP = "awsugclouddelnorte";
const MEETUP_ICAL = `https://www.meetup.com/${MEETUP_GROUP}/events/ical/`;
const MEETUP_GROUP_URL = `https://www.meetup.com/${MEETUP_GROUP}/`;
const STATIC_DATA_URL = "/data/next-meetup.json";
const MAX_DESCRIPTION_CHARS = 200;
const EVENT_IMAGE = "/events/cowork-wednesday.webp";

// Static past-meetup payload — surfaces in es-MX locale when no upcoming event
// is available. Hard-coded per bryan: simpler than another data-source while
// the iCal fetch path is CORS-blocked + the CI static-gen step is pending.
const PAST_MEETUP_MX_URL =
	"https://www.meetup.com/awsugclouddelnorte/events/312780239/?eventOrigin=group_past_events";
const PAST_MEETUP_MX_SPEAKERS = [
	{ key: "1", linkLabel: "Sessionize", linkUrl: undefined },
	{
		key: "2",
		linkLabel: "@veroniica · AWS Builder Center",
		linkUrl: undefined,
	},
	{ key: "3", linkLabel: "LinkedIn", linkUrl: undefined },
	{ key: "4", linkLabel: "DEV.to", linkUrl: undefined },
] as const;

interface MeetupEvent {
	summary: string;
	dtstart: string; // ISO 8601
	location?: string;
	url?: string;
	description?: string;
	isPast: boolean;
}

/**
 * Wave 39c — render a meetup description that may contain markdown links
 * (`[text](url)`) as a React fragment with clickable <a> elements for the
 * link spans and plain strings for the surrounding prose.
 *
 * Why a tiny in-component helper instead of a markdown library: the only
 * markdown construct the static JSON (or the in-browser iCal fallback)
 * meaningfully carries today is `[text](url)` link syntax. Other inline
 * markdown (`**bold**`, `*list*`, `>` blockquotes) survives as raw text —
 * acceptable per wave 39c brief: "the card displays it as plain text;
 * markdown can land in a follow-up". A markdown dep would be heavier than
 * the carry it earns at this surface area.
 *
 * Security: only http(s) URLs render as links; any other scheme falls
 * back to the original `[text](url)` literal so we don't accidentally
 * surface javascript: or data: URIs from upstream content. The <a> uses
 * target="_blank" rel="noopener noreferrer" so the meetup-hosted link
 * opens in a new tab without leaking the opener context.
 */
/**
 * Wave 43a — strip markdown noise before link extraction:
 * - Drop placeholder google-search spans: [text](https://www.google.com/search?...)
 * - Strip leading `* ` bullet markers (per line)
 * - Strip leading `> ` blockquote markers (per line)
 * - Strip **bold** and *italic* asterisk markers (keep inner text)
 * - Collapse repeated whitespace
 */
export function stripMarkdown(raw: string): string {
	return (
		raw
			// Drop entire [text](https://www.google.com/search?...) spans — keep label only
			.replace(
				/\[([^\]]+)\]\(https?:\/\/www\.google\.com\/search[^)]*\)/g,
				"$1",
			)
			// Drop entire `* ...` bullet lines (marker + content to end of line)
			.replace(/(^|\n)\* [^\n]*/g, "$1")
			// Drop entire `> ...` blockquote lines
			.replace(/(^|\n)> [^\n]*/g, "$1")
			// Strip **bold** (non-greedy)
			.replace(/\*\*(.+?)\*\*/g, "$1")
			// Strip *italic* (non-greedy, single asterisk)
			.replace(/\*(.+?)\*/g, "$1")
			// Collapse repeated whitespace
			.replace(/\s+/g, " ")
			.trim()
	);
}

function renderDescriptionWithLinks(text: string): ReactNode[] {
	const cleaned = stripMarkdown(text);
	// Fresh regex per call (stateful global flag would otherwise survive
	// between renders / event changes).
	const re = /\[([^\]]+)\]\(([^)]+)\)/g;
	const out: ReactNode[] = [];
	let lastIdx = 0;
	let key = 0;
	let match: RegExpExecArray | null = re.exec(cleaned);
	while (match !== null) {
		if (match.index > lastIdx) {
			out.push(cleaned.slice(lastIdx, match.index));
		}
		const [, label, url] = match;
		if (/^https?:\/\//i.test(url)) {
			out.push(
				<a
					key={`md-link-${key++}`}
					href={url}
					target="_blank"
					rel="noopener noreferrer"
				>
					{label}
				</a>,
			);
		} else {
			// Unknown scheme — preserve the literal so the user can still see
			// the URL text and copy it manually if they need to.
			out.push(`[${label}](${url})`);
		}
		lastIdx = re.lastIndex;
		match = re.exec(cleaned);
	}
	if (lastIdx < cleaned.length) {
		out.push(cleaned.slice(lastIdx));
	}
	return out;
}

/** Parse a VEVENT block from an iCal string. Returns the single event
 *  with the nearest future DTSTART, or the most recent past event as fallback. */
function parseIcal(text: string): MeetupEvent | null {
	const events: Array<Omit<MeetupEvent, "isPast">> = [];
	const veventBlocks = text.split("BEGIN:VEVENT").slice(1);

	for (const block of veventBlocks) {
		const end = block.indexOf("END:VEVENT");
		const body = end !== -1 ? block.slice(0, end) : block;

		const getField = (name: string): string => {
			// iCal fields can be folded (continuation lines start with space/tab)
			const regex = new RegExp(`^${name}[^:]*:(.+?)(?=\\r?\\n[^ \\t]|$)`, "ms");
			const m = body.match(regex);
			if (!m) return "";
			// unfold: join continuation lines
			return m[1].replace(/\r?\n[ \t]/g, "").trim();
		};

		const rawDtstart = getField("DTSTART");
		if (!rawDtstart) continue;

		// iCal DATE or DATETIME formats: 20260415T180000Z or 20260415
		const iso = rawDtstart.replace(
			/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z?))?$/,
			(_m, y, mo, d, _t, h = "00", mi = "00", s = "00", z = "") =>
				`${y}-${mo}-${d}T${h}:${mi}:${s}${z || "+00:00"}`,
		);

		const rawSummary = getField("SUMMARY");
		const rawUrl = getField("URL");
		const rawLocation = getField("LOCATION");
		const rawDesc = getField("DESCRIPTION");

		events.push({
			summary: rawSummary || "AWS UG Cloud del Norte Meetup",
			dtstart: iso,
			location: rawLocation || undefined,
			url: rawUrl || MEETUP_GROUP_URL,
			description: rawDesc
				? rawDesc
						.replace(/\\n/g, " ")
						.replace(/\\,/g, ",")
						.slice(0, MAX_DESCRIPTION_CHARS)
				: undefined,
		});
	}

	if (events.length === 0) return null;

	const now = Date.now();
	const future = events.filter((e) => new Date(e.dtstart).getTime() >= now);
	const past = events.filter((e) => new Date(e.dtstart).getTime() < now);

	if (future.length > 0) {
		// nearest upcoming
		future.sort(
			(a, b) => new Date(a.dtstart).getTime() - new Date(b.dtstart).getTime(),
		);
		return { ...future[0], isPast: false };
	}
	// most recent past
	past.sort(
		(a, b) => new Date(b.dtstart).getTime() - new Date(a.dtstart).getTime(),
	);
	return past.length > 0 ? { ...past[0], isPast: true } : null;
}

type LoadState = "loading" | "loaded" | "fallback";

/**
 * Wave 33a — Theater marquee header (steel-blue / deep-teal palette).
 *
 * Mirrors the spirit of the wave 32a featured-event marquee but with a
 * deliberately different mood: cooler palette + a scrolling-tape shimmer
 * sweep instead of chasing bulbs. The header still announces itself as
 * an h2 to assistive tech via role="heading" + aria-level=2.
 *
 * The scrolling-tape shimmer is a single ::after gradient band defined
 * in styles.css; it travels horizontally across the marquee backplate on
 * a slow loop. Reduced-motion gates the keyframes off and the shimmer
 * settles to a static centered glow.
 */
function MarqueeHeader({ text }: { text: string }) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: marquee is visually styled; heading semantics provided via role="heading"+aria-level to avoid h2 default-style/layout conflict
		<div className="feed-next-meetup__marquee" role="heading" aria-level={2}>
			<span className="feed-next-meetup__marquee-text">{text}</span>
			<div className="feed-next-meetup__marquee-tape" aria-hidden="true" />
		</div>
	);
}

function NextMeetupInner() {
	const { t, locale } = useTranslation();
	const [state, setState] = useState<LoadState>("loading");
	const [event, setEvent] = useState<MeetupEvent | null>(null);
	const [imageBroken, setImageBroken] = useState(false);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			// 1. try static JSON (CI-generated, no CORS issue)
			try {
				const res = await fetch(STATIC_DATA_URL);
				if (res.ok) {
					const data = (await res.json()) as Omit<MeetupEvent, "isPast">;
					if (!cancelled && data.summary && data.dtstart) {
						const isPast = new Date(data.dtstart).getTime() < Date.now();
						setEvent({ ...data, isPast });
						setState("loaded");
						return;
					}
				}
			} catch {
				// static file absent — continue to iCal attempt
			}

			// 2. try iCal feed (will fail with CORS in browser — handled below)
			try {
				const res = await fetch(MEETUP_ICAL, { mode: "cors" });
				if (res.ok) {
					const text = await res.text();
					const parsed = parseIcal(text);
					if (!cancelled) {
						setEvent(parsed);
						setState(parsed ? "loaded" : "fallback");
					}
					return;
				}
			} catch {
				// CORS block or network failure — fall through to CTA
			}

			if (!cancelled) setState("fallback");
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	const langTag = locale === "mx" ? "es-MX" : "en-US";
	const formatDate = (iso: string) => {
		try {
			return new Intl.DateTimeFormat(langTag, {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				timeZoneName: "short",
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	};

	const header = <MarqueeHeader text={t("feedPage.nextMeetupHeader")} />;

	let content: ReactNode;

	if (state === "loading") {
		content = (
			<>
				<SkeletonTitle />
				<SkeletonLine />
				<SkeletonLine />
				<SkeletonLine />
			</>
		);
	} else if (state === "fallback" || !event) {
		// es-MX gets a rich past-event spotlight card instead of the bare CTA.
		// English locale keeps the existing minimal fallback so non-Spanish
		// readers aren't shown Spanish-only speaker copy.
		if (locale === "mx") {
			content = (
				<SpaceBetween size="s">
					<Box color="text-body-secondary" fontSize="body-s" fontWeight="bold">
						{t("feedPage.pastMeetupBadge")}
					</Box>
					<Box
						fontWeight="bold"
						fontSize="heading-m"
						className="feed-next-meetup__title"
					>
						<Link href={PAST_MEETUP_MX_URL} external>
							{t("feedPage.pastMeetupTitle")}
						</Link>
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{t("feedPage.pastMeetupIntroP1")}
					</Box>
					<Box color="text-body-secondary" fontSize="body-s">
						{t("feedPage.pastMeetupIntroP2")}
					</Box>
					<Box fontWeight="bold" fontSize="body-s">
						{t("feedPage.pastMeetupSpeakersHeader")}
					</Box>
					<ul className="feed-past-meetup__speakers">
						{PAST_MEETUP_MX_SPEAKERS.map((s) => (
							<li key={s.key} className="feed-past-meetup__speaker">
								<span className="feed-past-meetup__speaker-name">
									{t(`feedPage.pastMeetupSpeaker${s.key}Name`)}
								</span>
								<span className="feed-past-meetup__speaker-role">
									{t(`feedPage.pastMeetupSpeaker${s.key}Role`)}
								</span>
								{s.linkLabel && (
									<span className="feed-past-meetup__speaker-link">
										{s.linkLabel}
									</span>
								)}
							</li>
						))}
					</ul>
					<Button
						variant="link"
						href={PAST_MEETUP_MX_URL}
						target="_blank"
						iconAlign="right"
						iconName="external"
					>
						{t("feedPage.pastMeetupViewEvent")}
					</Button>
				</SpaceBetween>
			);
		} else {
			content = (
				<SpaceBetween size="s">
					<Box color="text-body-secondary" fontSize="body-s">
						{t("feedPage.nextMeetupFallback")}
					</Box>
					<Button
						variant="link"
						href={MEETUP_GROUP_URL}
						target="_blank"
						iconAlign="right"
						iconName="external"
					>
						{t("feedPage.nextMeetupCta")}
					</Button>
				</SpaceBetween>
			);
		}
	} else {
		// Wave 38b — loaded-event branch is rebuilt as a flex column layout
		// with per-element margin-block-end so the spacing hierarchy mirrors
		// the wave 37c featured-event treatment:
		//   past-label → title    : --cdn-space-sm  (8px)  small cluster step
		//   title     → date     : --cdn-space-12  (12px) hero hierarchy
		//   date      → location : --cdn-space-sm  (8px)  meta cluster
		//   location  → desc     : --cdn-space-12  (12px) close prose to context
		// SpaceBetween size="s" (the wave 33a primitive) gave a uniform 12px
		// gap which read as flat — the wave 37c hierarchy is what gives the
		// cluster a deliberate ladder. The loading + en-US fallback + es-MX
		// past-meetup-spotlight branches keep their SpaceBetween primitives
		// — those are simpler stacks where uniform 12px reads correctly.
		content = (
			<div className="feed-next-meetup__layout">
				<span
					className="feed-next-meetup__image-slot"
					role="img"
					aria-label={t("feedPage.nextMeetupHeader")}
				>
					{!imageBroken && (
						<img
							src={EVENT_IMAGE}
							alt="Website (co)Work Wednesday meetup event"
							className="feed-next-meetup__image"
							width={1200}
							height={675}
							loading="lazy"
							onError={() => setImageBroken(true)}
						/>
					)}
				</span>
				{event.isPast && (
					<Box
						color="text-status-inactive"
						fontSize="body-s"
						className="feed-next-meetup__past-label"
					>
						{t("feedPage.nextMeetupPastLabel")}
					</Box>
				)}
				<Box
					fontWeight="bold"
					fontSize="heading-m"
					className="feed-next-meetup__title"
				>
					{event.url ? (
						<Link href={event.url} external>
							{event.summary}
						</Link>
					) : (
						event.summary
					)}
				</Box>
				{/* Wave 33a — date-plate VFX + wave 38b — inline LivePulseDot
				    microcue. Date string itself is plain HTML output from
				    Intl.DateTimeFormat (no SVG, no canvas, no string
				    splitting). The wrapper div carries the layout margin;
				    the LivePulseDot sits inline before the plate as a
				    "next live session" indicator; the plate span is the
				    steel-blue / deep-teal backplate with the breathe + sweep
				    VFX defined in styles.css. */}
				<div className="feed-next-meetup__date">
					<LivePulseDot />
					<span className="feed-next-meetup__date-plate">
						{formatDate(event.dtstart)}
					</span>
				</div>
				{event.location && (
					<Box
						color="text-body-secondary"
						fontSize="body-s"
						className="feed-next-meetup__location"
					>
						{event.location}
					</Box>
				)}
				{/* Wave 38b — description copy gets the wave 37c personality
				    uplift: color="inherit" (was "text-body-secondary" muted
				    gray) so the .feed-next-meetup__description CSS rule —
				    which sets color: var(--cdn-color-text) — actually
				    paints. fontSize="body-m" (was body-s) bumps the inherited
				    text size onto the --cdn-text-base tier; the same CSS
				    rule layers an explicit var(--cdn-text-base) font-size +
				    line-height: 1.65 + 64ch max-width on top so the prose
				    reads as deliberate voice rather than fine-print metadata.

				    Wave 39c — description body now carries the FULL meetup
				    copy (script bumped 240→2000 chars in
				    scripts/fetch-next-meetup.mjs) and is rendered through
				    renderDescriptionWithLinks() so `[text](url)` markdown
				    spans surface as clickable <a> elements. The wave 38b
				    ellipsis indicator (length >= MAX_DESCRIPTION_CHARS) is
				    dropped: with full-text in the static JSON the check
				    would always fire, becoming a misleading "more on meetup"
				    cue when the entire body is already on-card. The header
				    title link still anchors to the meetup event for users
				    who want the canonical page. */}
				{event.description && (
					<Box
						color="inherit"
						fontSize="body-m"
						className="feed-next-meetup__description"
					>
						{renderDescriptionWithLinks(event.description)}
					</Box>
				)}
			</div>
		);
	}

	return (
		<div className="feed-next-meetup">
			<Container header={header}>{content}</Container>
		</div>
	);
}

/**
 * Wave 33a — error boundary scoped to the NextMeetup card.
 *
 * Mirrors FeaturedEventErrorBoundary in featured-event.tsx. The card now
 * carries the same depth stack + sustained animations as the featured
 * event card, plus the iCal/static-JSON fetch path + Intl.DateTimeFormat;
 * if any of those pieces throw at render time, this boundary catches it
 * locally so the rest of the feed (FeaturedEvent, UpcomingVirtualEvent,
 * BuilderCenterCard, the live hero, the shuffled grid) keeps rendering.
 *
 * The fallback UI reuses the standard Cloudscape Container + Header chrome
 * so the empty state still anchors visually in the same slot. The header
 * resolves through the existing locale key (no new locale strings); the
 * body fallback message is hard-coded English (the wave 33a hard scope
 * forbids new locale keys, and this path only fires on render errors —
 * exceptional, brief, primarily a dev-visible signal in console.error).
 */
interface NextMeetupErrorBoundaryState {
	hasError: boolean;
}

export class NextMeetupErrorBoundary extends Component<
	{ children: ReactNode; fallbackHeader: string; fallbackMessage: string },
	NextMeetupErrorBoundaryState
> {
	state: NextMeetupErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(): NextMeetupErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		// Single console.error so the failure is visible in devtools without
		// piping crash data to a third-party endpoint. The boundary's render
		// fallback is the user-visible signal; this is the developer signal.
		console.error("[NextMeetup] render failure", error, info);
	}

	render(): ReactNode {
		if (this.state.hasError) {
			return (
				<div className="feed-next-meetup">
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
 * Default export: NextMeetup wrapped in its own error boundary.
 */
export default function NextMeetup() {
	const { t } = useTranslation();
	return (
		<NextMeetupErrorBoundary
			fallbackHeader={t("feedPage.nextMeetupHeader")}
			fallbackMessage="Meetup details temporarily unavailable. Please refresh the page."
		>
			<NextMeetupInner />
		</NextMeetupErrorBoundary>
	);
}
