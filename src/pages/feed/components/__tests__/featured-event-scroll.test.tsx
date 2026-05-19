// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 30a — scroll-tearing regression coverage for the FeaturedEvent card.
 *
 * Bryan reported visible visual tearing/banding as the June 3 featured event
 * card scrolled into and out of view. Root cause: the wave 27a v2 visual
 * piled multiple GPU-stressing CSS effects on .feed-featured-event
 * (perspective + preserve-3d, mix-blend-mode: screen on the ::after sweep,
 * background-clip: text on the title with an animated gradient, multiple
 * sustained animations on the date plate + spots-remaining ring). Stacked,
 * they couldn't all share a single compositor layer during scroll.
 *
 * The fix lives in src/pages/feed/styles.css (will-change, contain,
 * translate3d GPU promotion, dropped mix-blend-mode on the card-sized
 * ::after sweep, text-rendering hints on the title) and the body.cdn-scrolling
 * scroll-pause class wired through scroll-jank-mitigation.ts.
 *
 * jsdom doesn't compute layered styles from external CSS, so we can't
 * directly assert getComputedStyle(card).willChange === "transform" — that
 * value lives in styles.css, which jsdom parses but doesn't apply to the
 * cascade. What we CAN assert is the structural contract that the CSS
 * targets: the card root carries .feed-featured-event, the spots-remaining
 * chip carries .feed-featured-event__spots, the date-plate carries
 * .feed-featured-event__date-plate. If any of those class names ever drift,
 * this test fails and the fix has silently regressed.
 *
 * We also exercise the scroll path itself: programmatic window.scrollTo
 * past the card MUST NOT crash the component, and the card must remain
 * mounted in the document afterward. This is the regression contract for
 * "the page didn't blow up while scrolling".
 *
 * Companion coverage: featured-event.test.tsx asserts the wave 27a v2
 * structural rendering. This file is the scroll-stability layer on top.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import FeaturedEvent, { FeaturedEventErrorBoundary } from "../featured-event";

/**
 * Mount FeaturedEvent inside a tall scrollable container so window.scrollTo
 * actually has somewhere to go. The 3000px height comfortably exceeds any
 * reasonable jsdom viewport so a scrollTo(0, 1000) lands past the card.
 */
function renderInsideTallScrollContainer() {
	return render(
		<LocaleProvider locale="us">
			<div
				data-testid="scroll-host"
				style={{ height: "3000px", overflow: "auto" }}
			>
				<FeaturedEvent />
			</div>
		</LocaleProvider>,
	);
}

describe("FeaturedEvent — wave 30a scroll-tearing regression", () => {
	beforeEach(() => {
		// Defensive — make sure no leaked .cdn-scrolling class from a previous
		// test bleeds into this one's assertions.
		document.body.classList.remove("cdn-scrolling");
	});

	afterEach(() => {
		document.body.classList.remove("cdn-scrolling");
	});

	it("renders without crashing inside a tall scrollable container", () => {
		expect(() => renderInsideTallScrollContainer()).not.toThrow();
		expect(screen.getByText("DON'T MISS")).toBeInTheDocument();
	});

	it("survives a programmatic window.scrollTo(0, 1000) without unmounting or throwing", () => {
		const { container } = renderInsideTallScrollContainer();
		const card = container.querySelector(".feed-featured-event");
		expect(card).not.toBeNull();

		expect(() => window.scrollTo(0, 1000)).not.toThrow();

		// Card is still in the document — the scroll did not blow up the tree.
		expect(container.querySelector(".feed-featured-event")).not.toBeNull();
		expect(screen.getByText("DON'T MISS")).toBeInTheDocument();
	});

	it("renders the structural class names that wave 30a CSS targets for tearing mitigation", () => {
		const { container } = renderInsideTallScrollContainer();

		// The card root is the primary GPU layer promotion target — CSS
		// applies will-change: transform + contain: layout paint style +
		// transform: translate3d(0, 0, 0) to this exact selector.
		const card = container.querySelector(".feed-featured-event");
		expect(card).not.toBeNull();

		// The date-plate carries will-change: transform, opacity (sustained
		// 4s breathe + 6.5s shimmer animation).
		const datePlate = container.querySelector(
			".feed-featured-event__date-plate",
		);
		expect(datePlate).not.toBeNull();

		// The spots-remaining chip carries will-change: transform, opacity
		// (3.4s pulse + outer ring breathe).
		const spots = container.querySelector(".feed-featured-event__spots");
		expect(spots).not.toBeNull();
	});

	it("does not leak the body.cdn-scrolling class on initial mount (added only by the scroll-jank-mitigation listener at runtime)", () => {
		renderInsideTallScrollContainer();
		// The component itself must NOT toggle the body class — that
		// responsibility lives in scroll-jank-mitigation.ts, wired from
		// main.tsx. Mounting FeaturedEvent in isolation should leave body
		// classes untouched.
		expect(document.body.classList.contains("cdn-scrolling")).toBe(false);
	});

	it("renders the FeaturedEventErrorBoundary fallback when a child throws (wave 30a error containment)", () => {
		// The boundary is what stops a render-time failure inside the wave
		// 27a v2 piece (perspective + Intl.DateTimeFormat + localStorage RSVP
		// state lookup) from blanking the rest of the feed page. We exercise
		// the contract directly by mounting the exported boundary class with
		// a deliberately-throwing child.

		const Boom = () => {
			throw new Error("simulated wave 30a render failure");
		};

		// The boundary calls console.error with the diagnostic; suppress so
		// it doesn't pollute test stdout. React also logs the caught error
		// itself; suppress that too.
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// intentionally empty — see comment above
		});

		try {
			const { container } = render(
				<LocaleProvider locale="us">
					<FeaturedEventErrorBoundary
						fallbackHeader="Featured event"
						fallbackMessage="Event details temporarily unavailable. Please refresh the page."
					>
						<Boom />
					</FeaturedEventErrorBoundary>
				</LocaleProvider>,
			);

			// Fallback chrome is present — same .feed-featured-event wrapper
			// so the empty state still anchors visually in the same slot.
			expect(container.querySelector(".feed-featured-event")).not.toBeNull();
			expect(screen.getByText("Featured event")).toBeInTheDocument();
			expect(
				screen.getByText(/Event details temporarily unavailable/i),
			).toBeInTheDocument();
		} finally {
			errorSpy.mockRestore();
		}
	});
});
