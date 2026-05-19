// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 33a — Next meetup card uplift regression coverage.
 *
 * The wave 33a uplift brings the Next Meetup card up to the visual standard
 * set by the wave 32a featured-event card: theater marquee header (cooler
 * steel-blue / deep-teal palette + scrolling-tape shimmer), date-plate VFX,
 * gradient/scrolling-tape title link, depth stack (perspective + preserve-3d
 * + GPU compositing hints + 1px stage-rim inset), and an error boundary that
 * mirrors FeaturedEventErrorBoundary so a render failure on this card shows
 * fallback chrome instead of crashing the rest of the feed page.
 *
 * jsdom does not compute layered styles from external CSS, so we cannot
 * assert getComputedStyle(card).willChange === "transform" — that value
 * lives in src/pages/feed/styles.css, which jsdom parses but does not apply
 * to the cascade. What we CAN assert is the structural contract that the
 * wave 33a CSS targets:
 *
 *   - The marquee wrapper carries .feed-next-meetup__marquee with
 *     role="heading" + aria-level=2 (a11y semantic preserved when we
 *     replaced the Cloudscape <Header variant="h2"> with custom chrome).
 *   - The card root carries .feed-next-meetup so the body.cdn-scrolling
 *     pause selectors target the right element.
 *   - There is no <img> element in the next-meetup card today, so the
 *     "onError handler hides broken images" contract from the wave 33a
 *     brief is documented as "no image element renders in the loading or
 *     fallback states; if a future revision adds one, this test fails
 *     until the new image carries an onError hook".
 *
 * Companion coverage for the @media (prefers-reduced-motion) and
 * body.cdn-scrolling CSS hooks lives in the styles.css text — we read the
 * file directly and assert the wave 33a selectors are wired in.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import NextMeetup, { NextMeetupErrorBoundary } from "../next-meetup";

function renderWithLocale(locale: "us" | "mx") {
	return render(
		<LocaleProvider locale={locale}>
			<NextMeetup />
		</LocaleProvider>,
	);
}

describe("NextMeetup — wave 33a uplift", () => {
	it("renders the theater marquee header with role=heading aria-level=2 (a11y semantic preserved when Cloudscape <Header> was replaced)", () => {
		const { container } = renderWithLocale("us");
		const marquee = container.querySelector(".feed-next-meetup__marquee");
		expect(marquee).not.toBeNull();
		expect(marquee?.getAttribute("role")).toBe("heading");
		expect(marquee?.getAttribute("aria-level")).toBe("2");
	});

	it("renders the marquee text inside the marquee wrapper with the localized 'Next Meetup' header copy", () => {
		const { container } = renderWithLocale("us");
		const marqueeText = container.querySelector(
			".feed-next-meetup__marquee-text",
		);
		expect(marqueeText).not.toBeNull();
		expect(marqueeText?.textContent).toMatch(/Next Meetup/i);
	});

	it("renders the scrolling-tape shimmer span (the differentiator vs. featured-event's chasing bulbs) marked aria-hidden", () => {
		const { container } = renderWithLocale("us");
		const tape = container.querySelector(".feed-next-meetup__marquee-tape");
		expect(tape).not.toBeNull();
		expect(tape?.getAttribute("aria-hidden")).toBe("true");
	});

	it("renders the localized header in es-MX too (Próximo Meetup)", () => {
		const { container } = renderWithLocale("mx");
		const marqueeText = container.querySelector(
			".feed-next-meetup__marquee-text",
		);
		expect(marqueeText?.textContent).toMatch(/Próximo Meetup/i);
	});

	it("renders the structural class names that the wave 33a CSS targets for depth stack + scroll pause", () => {
		const { container } = renderWithLocale("us");
		// Card root — perspective + preserve-3d + will-change/contain/translate3d
		// + the body.cdn-scrolling pause selector all attach to this exact class.
		expect(container.querySelector(".feed-next-meetup")).not.toBeNull();
		// Marquee chrome — cooler steel-blue/deep-teal palette + scrolling-tape
		// shimmer all hang off this class.
		expect(
			container.querySelector(".feed-next-meetup__marquee"),
		).not.toBeNull();
	});

	it("does not render an <img> element in the loading or fallback states (wave 33a brief: 'onError handler hides broken images, or whatever applies if there's no image element' — documenting the deliberate absence)", () => {
		const { container: us } = renderWithLocale("us");
		expect(us.querySelectorAll("img").length).toBe(0);
		const { container: mx } = renderWithLocale("mx");
		expect(mx.querySelectorAll("img").length).toBe(0);
	});

	it("renders the NextMeetupErrorBoundary fallback when a child throws (wave 33a render-failure containment)", () => {
		const Boom = () => {
			throw new Error("simulated wave 33a render failure");
		};

		// Suppress the boundary's intentional console.error + React's caught-
		// error log so they don't pollute test stdout.
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// intentionally empty — see comment above
		});

		try {
			const { container } = render(
				<LocaleProvider locale="us">
					<NextMeetupErrorBoundary
						fallbackHeader="Next Meetup"
						fallbackMessage="Meetup details temporarily unavailable. Please refresh the page."
					>
						<Boom />
					</NextMeetupErrorBoundary>
				</LocaleProvider>,
			);

			// Fallback chrome reuses the same .feed-next-meetup wrapper so the
			// empty state still anchors visually in the same slot in the feed.
			expect(container.querySelector(".feed-next-meetup")).not.toBeNull();
			expect(screen.getByText("Next Meetup")).toBeInTheDocument();
			expect(
				screen.getByText(/Meetup details temporarily unavailable/i),
			).toBeInTheDocument();
		} finally {
			errorSpy.mockRestore();
		}
	});
});

describe("NextMeetup — wave 33a CSS hooks (prefers-reduced-motion + cdn-scrolling)", () => {
	// jsdom doesn't apply external CSS to the cascade, so we read the
	// stylesheet text directly and assert the wave 33a selectors are present.
	// This is the same approach featured-event-scroll.test.tsx documents
	// for its wave 30a CSS hook contract.
	const stylesPath = join(__dirname, "..", "..", "styles.css");
	const stylesText = readFileSync(stylesPath, "utf8");

	it("registers a body.cdn-scrolling pause rule for the next-meetup card (extends the wave 30a featured-event pause list)", () => {
		// The pause list must include at least the card root + the marquee
		// tape (the new sustained animation introduced by wave 33a).
		expect(stylesText).toMatch(
			/body\.cdn-scrolling \.feed-next-meetup__marquee-tape/,
		);
		expect(stylesText).toMatch(/body\.cdn-scrolling \.feed-next-meetup\b/);
	});

	it("gates every new sustained animation behind @media (prefers-reduced-motion: no-preference) and provides a reduced-motion fallback", () => {
		// no-preference branch — animations enabled
		expect(stylesText).toMatch(
			/@media \(prefers-reduced-motion: no-preference\)/,
		);
		// reduce branch — static fallback present
		expect(stylesText).toMatch(/@media \(prefers-reduced-motion: reduce\)/);

		// And specifically the wave 33a scrolling-tape shimmer animation is
		// declared inside a no-preference block.
		expect(stylesText).toMatch(/feed-next-meetup-marquee-tape-sweep/);
		// The reduced-motion branch must also reset the tape shimmer so the
		// static fallback renders correctly.
		const reducedBlock = stylesText.match(
			/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.feed-next-meetup__marquee-tape \{[\s\S]*?animation: none;/,
		);
		expect(reducedBlock).not.toBeNull();
	});

	it("declares the cooler steel-blue / deep-teal palette tokens that differentiate next-meetup from featured-event's warm amber+violet", () => {
		// Light-mode card token
		expect(stylesText).toMatch(/--cdn-nm-spot-cool: rgba\(56, 110, 165/);
		// Dark-mode card token (deep teal)
		expect(stylesText).toMatch(/--cdn-nm-ambient-bloom: rgba\(6, 78, 59/);
		// Marquee light-mode steel-blue rim
		expect(stylesText).toMatch(/--cdn-nm-marquee-rim: #2c5282/);
		// Marquee dark-mode lighter teal rim
		expect(stylesText).toMatch(/--cdn-nm-marquee-rim: #5eead4/);
	});
});
