// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 36b — FeedCardShell primitive.
 *
 * Bryan kept calling out that the feed page felt inconsistent: the three
 * event cards (featured-event, next-meetup, upcoming-virtual-event) had
 * been promoted in waves 32a/33a/33b to a depth-stack treatment with a
 * marquee-style header, scroll-pause integration, prefers-reduced-motion
 * gates, and a per-card error boundary, but the *other* cards on the feed
 * (arrowhead-news, andres-medium, andres-youtube-live, builder-center,
 * twitch panes, featured-video, andmore/awsml/readysetcloud feed-section
 * variants) were still vanilla Cloudscape Containers with a default h2
 * header.
 *
 * Rather than bespoke-design every non-event card, this primitive lifts
 * the shared chrome into one component:
 *   - Renders a Cloudscape Container so existing inner content keeps its
 *     padding / border / surface-color behaviour.
 *   - Replaces the Cloudscape <Header variant="h2"> with a custom marquee
 *     div carrying role="heading" + aria-level=2 (matches the wave 32a /
 *     33a / 33b ARIA contract — Cloudscape's Header renders a real <h2>;
 *     trading that for custom chrome means we re-assert the role on the
 *     replacement element so AT semantics stay intact).
 *   - Applies perspective(1200px) + transform-style: preserve-3d on the
 *     wrapper so any child transforms can pop in z without loading a
 *     runtime 3D engine, plus the will-change / contain / translate3d
 *     compositor hints from waves 30a/33a so the card lives on its own
 *     GPU layer (mirrors the tearing-mitigation idiom proven on the
 *     featured-event card during scroll).
 *   - Accepts a small palette enum so each card can pick a distinct hue
 *     and read distinguishably in the feed without introducing per-card
 *     CSS files. CSS custom properties drive the gradient / rim / text /
 *     glow — the .feed-card-shell--* class swaps the variable values.
 *   - Wraps in a local error boundary so a render failure in one card's
 *     inner content (typically Intl.DateTimeFormat throwing on a malformed
 *     date or a fetch path resolving to undefined) shows quiet fallback
 *     chrome instead of blanking the rest of the feed. Mirrors the wave
 *     30a FeaturedEventErrorBoundary pattern; fallback copy resolves
 *     through the existing rsvp.error.generic locale key (no new keys
 *     introduced this wave).
 *
 * NOT used for the three event cards. featured-event, next-meetup, and
 * upcoming-virtual-event keep their bespoke wave 32a/33a/33b chrome
 * (chasing bulbs, scrolling-tape shimmer, twinkle stars). The shell is
 * the leveling-up mechanism for the simpler feed cards only.
 */

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import {
	Component,
	type CSSProperties,
	type ErrorInfo,
	type ReactNode,
} from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import "./feed-card-shell.css";

/**
 * Available palette hues. Each maps to a `.feed-card-shell--<palette>`
 * modifier class defined in feed-card-shell.css that overrides the eight
 * `--fcs-*` custom properties (gradient endpoints, rim, text, glow, stage
 * rim, ambient bloom). Light + dark mode parity is provided per palette
 * inside the CSS file.
 *
 * Editorial intent (wave 36b mapping):
 *   amber   → warm dev/casual  (feed-section andmore)
 *   teal    → cool ML/technical (feed-section awsml)
 *   violet  → twitch brand purple (twitch-section)
 *   sage    → research / academic green (arrowhead-news)
 *   rose    → warm presence (andres-youtube-live)
 *   navy    → long-form / publication / serious (andres-medium,
 *             feed-section readysetcloud — both are bylined long-form
 *             tech blogs; intentional duplicate to keep the family read
 *             cohesive across two related sources)
 *   gold    → AWS Builder Center
 *   lavender → women in tech / featured (featured-video-card)
 */
export type FeedCardShellPalette =
	| "amber"
	| "teal"
	| "violet"
	| "sage"
	| "rose"
	| "navy"
	| "gold"
	| "lavender";

interface FeedCardShellProps {
	/** Header copy. Strings are most common; ReactNode is supported so
	 *  cards that need inline JSX in the header (e.g. arrowhead-news's
	 *  "at NMSU" subtitle, andres-youtube-live's leading live-dot) can
	 *  pass it through without wrapping the whole shell. */
	headerText: ReactNode;
	/** Optional right-aligned slot inside the marquee header — preserves
	 *  Cloudscape Header's `actions` prop semantics for cards that surface
	 *  a "View all posts" / channel link (andres-medium, builder-center,
	 *  feed-section variants, featured-video, andres-youtube-live). */
	headerActions?: ReactNode;
	/** Palette modifier — see FeedCardShellPalette JSDoc above for the
	 *  per-card mapping established in wave 36b. */
	palette: FeedCardShellPalette;
	/** Optional extra class on the outer .feed-card-shell wrapper for
	 *  per-card layout adjustments that don't justify a new modifier. */
	className?: string;
	/** The inner card body — typically a Cloudscape SpaceBetween / div
	 *  carrying the existing card content. Rendered inside the wrapped
	 *  Cloudscape Container so existing padding / surface tokens apply. */
	children: ReactNode;
}

/**
 * Marquee header — replacement for Cloudscape <Header variant="h2">.
 *
 * Renders the headline copy on a palette-tinted backplate with a 2px rim,
 * a subtle inset highlight, and a soft drop shadow so the sign reads as
 * an emissive marquee against the card surface. role="heading" +
 * aria-level=2 announces the equivalent semantic role to assistive tech,
 * matching the wave 32a / 33a / 33b approach.
 *
 * Header actions (e.g. "All posts →" link) render in a right-aligned
 * slot inside the marquee. They sit on the same plane as the headline
 * so screen readers encounter them after the heading text in the natural
 * tab order — this matches Cloudscape Header's actions slot ordering.
 */
function FeedCardShellMarquee({
	headerText,
	headerActions,
}: {
	headerText: ReactNode;
	headerActions?: ReactNode;
}) {
	return (
		<div className="feed-card-shell__marquee" role="heading" aria-level={2}>
			<span className="feed-card-shell__marquee-text">{headerText}</span>
			{headerActions && (
				<span className="feed-card-shell__marquee-actions">
					{headerActions}
				</span>
			)}
		</div>
	);
}

interface FeedCardShellInnerProps extends FeedCardShellProps {}

function FeedCardShellInner({
	headerText,
	headerActions,
	palette,
	className,
	children,
}: FeedCardShellInnerProps) {
	const wrapperClass = ["feed-card-shell", `feed-card-shell--${palette}`]
		.concat(className ? [className] : [])
		.join(" ");

	// translate3d(0,0,0) is applied via CSS, but expose the palette as a
	// data-attribute too so devtools / tests can introspect the palette
	// without parsing the className string.
	const wrapperStyle: CSSProperties = {};

	return (
		<div
			className={wrapperClass}
			data-feed-card-palette={palette}
			style={wrapperStyle}
		>
			<Container
				header={
					<FeedCardShellMarquee
						headerText={headerText}
						headerActions={headerActions}
					/>
				}
			>
				{children}
			</Container>
		</div>
	);
}

/**
 * Error boundary scoped to a single feed card.
 *
 * Mirrors the wave 30a FeaturedEventErrorBoundary pattern: a render-time
 * failure inside the wrapped card content is contained locally so the
 * rest of the feed page stays mounted. The fallback UI reuses the same
 * shell chrome (palette, marquee header) so the empty slot still anchors
 * visually in the same place — only the body swaps to a quiet, accessible
 * notice.
 *
 * Class component (rather than a hook-based boundary) because React still
 * doesn't expose a hook equivalent to componentDidCatch /
 * getDerivedStateFromError. The fallback message is passed in as a string
 * prop because class components cannot use the useTranslation hook
 * directly — the parent FeedCardShell function component resolves the
 * locale key and forwards the string.
 */
interface FeedCardShellErrorBoundaryProps {
	headerText: ReactNode;
	palette: FeedCardShellPalette;
	fallbackMessage: string;
	children: ReactNode;
}

interface FeedCardShellErrorBoundaryState {
	hasError: boolean;
}

export class FeedCardShellErrorBoundary extends Component<
	FeedCardShellErrorBoundaryProps,
	FeedCardShellErrorBoundaryState
> {
	state: FeedCardShellErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(): FeedCardShellErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		// Single console.error so the failure is visible in devtools without
		// piping crash data to a third-party endpoint. The boundary's render
		// fallback is the user-visible signal; this is the developer signal.
		// Mirrors FeaturedEventErrorBoundary in featured-event.tsx.
		console.error("[FeedCardShell] render failure", error, info);
	}

	render(): ReactNode {
		if (this.state.hasError) {
			const { headerText, palette, fallbackMessage } = this.props;
			return (
				<div
					className={`feed-card-shell feed-card-shell--${palette}`}
					data-feed-card-palette={palette}
				>
					<Container header={<FeedCardShellMarquee headerText={headerText} />}>
						<Box color="text-body-secondary" fontSize="body-s">
							{fallbackMessage}
						</Box>
					</Container>
				</div>
			);
		}
		return this.props.children;
	}
}

/**
 * Default export — FeedCardShell with the error boundary always wrapped.
 *
 * Consumers pass the headerText / palette / children and get back a card
 * with the wave-36b shared chrome plus the error containment for free.
 * The boundary fallback message resolves through the rsvp.error.generic
 * locale key (already present in en-US + es-MX from earlier waves), so
 * this PR introduces zero new locale keys.
 */
export default function FeedCardShell(props: FeedCardShellProps) {
	const { t } = useTranslation();
	const fallbackMessage = t("rsvp.error.generic");

	return (
		<FeedCardShellErrorBoundary
			headerText={props.headerText}
			palette={props.palette}
			fallbackMessage={fallbackMessage}
		>
			<FeedCardShellInner {...props} />
		</FeedCardShellErrorBoundary>
	);
}
