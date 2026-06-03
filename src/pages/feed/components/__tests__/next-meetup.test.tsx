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
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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

	it("renders the event image with alt text and onError fallback in the loaded-event branch (wave 44 image add)", async () => {
		const futureIso = new Date(
			Date.now() + 7 * 24 * 60 * 60 * 1000,
		).toISOString();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					summary: "Website (co)Work Wednesday",
					dtstart: futureIso,
					url: "https://www.meetup.com/awsugclouddelnorte/events/test/",
					location: "Online",
					description: "Test description.",
				}),
				text: async () => "",
			}),
		);
		const { container, findByRole } = render(
			<LocaleProvider locale="us">
				<NextMeetup />
			</LocaleProvider>,
		);
		await findByRole("heading", { level: 2 });
		const start = Date.now();
		let img: HTMLImageElement | null = null;
		while (Date.now() - start < 1500) {
			img = container.querySelector(
				".feed-next-meetup__image",
			) as HTMLImageElement | null;
			if (img) break;
			await new Promise((r) => setTimeout(r, 25));
		}
		expect(img).not.toBeNull();
		expect(img?.getAttribute("alt")).toBe(
			"Website (co)Work Wednesday meetup event",
		);
		expect(img?.getAttribute("src")).toBe("/events/cowork-wednesday.webp");
		vi.unstubAllGlobals();
	});

	it("hides the image via state when onError fires (wave 44 no-image fallback)", async () => {
		const futureIso = new Date(
			Date.now() + 7 * 24 * 60 * 60 * 1000,
		).toISOString();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					summary: "Website (co)Work Wednesday",
					dtstart: futureIso,
					url: "https://www.meetup.com/awsugclouddelnorte/events/test/",
					location: "Online",
					description: "Test.",
				}),
				text: async () => "",
			}),
		);
		const { container, findByRole } = render(
			<LocaleProvider locale="us">
				<NextMeetup />
			</LocaleProvider>,
		);
		await findByRole("heading", { level: 2 });
		const start = Date.now();
		let img: HTMLImageElement | null = null;
		while (Date.now() - start < 1500) {
			img = container.querySelector(
				".feed-next-meetup__image",
			) as HTMLImageElement | null;
			if (img) break;
			await new Promise((r) => setTimeout(r, 25));
		}
		expect(img).not.toBeNull();
		if (!img) return;
		fireEvent.error(img);
		// After onError, the img should be removed from DOM
		expect(container.querySelector(".feed-next-meetup__image")).toBeNull();
		// The wrapper slot still carries aria-label for AT
		const slot = container.querySelector(".feed-next-meetup__image-slot");
		expect(slot).not.toBeNull();
		expect(slot?.getAttribute("aria-label")).toBeTruthy();
		vi.unstubAllGlobals();
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

describe("NextMeetup — wave 38b spacing redesign + description personality", () => {
	// jsdom doesn't apply external CSS to the cascade, so we read the
	// stylesheet text directly and assert the wave 38b spacing-token
	// substitutions + the new layout/description rules are wired in.
	const stylesPath = join(__dirname, "..", "..", "styles.css");
	const stylesText = readFileSync(stylesPath, "utf8");

	it("replaces the wave 33a raw-px marquee padding with --cdn-space-* tokens at all three breakpoints (mobile 12/16, tablet 12/24, desktop 16/24)", () => {
		// Mobile — 12 / 16. The mobile rule lives inside the .feed-next-
		// meetup__marquee block, not inside a media query. Match the
		// padding line within that block.
		const mobileBlock = stylesText.match(
			/\.feed-next-meetup__marquee \{[\s\S]*?padding: var\(--cdn-space-12, 12px\) var\(--cdn-space-md, 16px\);/,
		);
		expect(mobileBlock).not.toBeNull();

		// Tablet — 12 / 24
		const tabletBlock = stylesText.match(
			/@media \(min-width: 520px\)[\s\S]*?\.feed-next-meetup__marquee \{[\s\S]*?padding: var\(--cdn-space-12, 12px\) var\(--cdn-space-lg, 24px\);/,
		);
		expect(tabletBlock).not.toBeNull();

		// Desktop — 16 / 24
		const desktopBlock = stylesText.match(
			/@media \(min-width: 860px\)[\s\S]*?\.feed-next-meetup__marquee \{[\s\S]*?padding: var\(--cdn-space-md, 16px\) var\(--cdn-space-lg, 24px\);/,
		);
		expect(desktopBlock).not.toBeNull();
	});

	it("replaces the wave 33a raw-px date-plate padding with --cdn-space-sm / --cdn-space-md tokens", () => {
		const datePlateBlock = stylesText.match(
			/\.feed-next-meetup__date-plate \{[\s\S]*?padding: var\(--cdn-space-sm, 8px\) var\(--cdn-space-md, 16px\);/,
		);
		expect(datePlateBlock).not.toBeNull();
	});

	it("removes the wave 33a asymmetric date wrapper margin (4 / 0 / 2) — spacing is now owned by the layout grid hierarchy", () => {
		expect(stylesText).not.toMatch(
			/\.feed-next-meetup__date \{[\s\S]*?margin: 4px 0 2px;/,
		);
	});

	it("declares the wave 42b1 __layout grid primitive (replaces wave 38b flex-column so the desktop @container query can reflow into a 2-col image-left layout)", () => {
		const layoutBlock = stylesText.match(
			/\.feed-next-meetup__layout \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: 1fr;[\s\S]*?grid-template-areas:[\s\S]*?"image"[\s\S]*?"past-label"[\s\S]*?"title"[\s\S]*?"date"[\s\S]*?"location"[\s\S]*?"description"[\s\S]*?gap: 0;/,
		);
		expect(layoutBlock).not.toBeNull();
	});

	it("declares the wave 44 desktop @container query — 2-col image-left reflow restored with event image", () => {
		// wave 44 restored the @container cdn-feed-next-meetup (min-width: 860px)
		// 2-col grid rule now that the event image is present.
		expect(stylesText).toMatch(
			/@container cdn-feed-next-meetup \(min-width: 860px\)/,
		);
		// The wave 43a TODO comment should be gone.
		expect(stylesText).not.toMatch(
			/TODO wave 43b: re-enable 2-col reflow once image lands/,
		);
	});

	it("encodes the spacing hierarchy ladder via per-element margin-block-end on the wave 38b layout children (title→date 12, date→location 8, location→desc 12)", () => {
		// title → date : 12px
		expect(stylesText).toMatch(
			/\.feed-next-meetup__layout \.feed-next-meetup__title \{[\s\S]*?margin-block-end: var\(--cdn-space-12, 12px\);/,
		);
		// date → location : 8px
		expect(stylesText).toMatch(
			/\.feed-next-meetup__layout \.feed-next-meetup__date \{[\s\S]*?margin-block-end: var\(--cdn-space-sm, 8px\);/,
		);
		// location → description : 12px
		expect(stylesText).toMatch(
			/\.feed-next-meetup__location \{[\s\S]*?margin-block-end: var\(--cdn-space-12, 12px\);/,
		);
	});

	it("declares the wave 38b description personality rule (line-height 1.65, --cdn-text-base, var(--cdn-color-text), 64ch max-width)", () => {
		const descriptionBlock = stylesText.match(
			/\.feed-next-meetup__description \{[\s\S]*?font-size: var\(--cdn-text-base, 0\.875rem\);[\s\S]*?line-height: 1\.65;[\s\S]*?max-width: 64ch;[\s\S]*?color: var\(--cdn-color-text\);/,
		);
		expect(descriptionBlock).not.toBeNull();
	});
});

describe("NextMeetup — wave 38b LivePulseDot inline microcue integration", () => {
	// Stub the static-data fetch so the loaded-event branch renders
	// (and the LivePulseDot gets mounted). Without this, the component
	// stays in the "loading" state and the layout / dot don't render.
	function mockSuccessfulFetch() {
		const futureIso = new Date(
			Date.now() + 7 * 24 * 60 * 60 * 1000,
		).toISOString();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					summary: "AWS UG Cloud del Norte — Test Meetup",
					dtstart: futureIso,
					url: "https://www.meetup.com/awsugclouddelnorte/events/test/",
					location: "Downtown El Paso",
					description: "Test description for wave 38b layout.",
				}),
				text: async () => "",
			}),
		);
	}

	it("renders the LivePulseDot SVG inside the date wrapper as aria-hidden once the loaded-event branch mounts", async () => {
		mockSuccessfulFetch();
		const { container, findByRole } = render(
			<LocaleProvider locale="us">
				<NextMeetup />
			</LocaleProvider>,
		);
		// Wait for the date-plate to render (signals the loaded branch is up).
		// findByRole on the heading lets vitest poll until the iCal stub resolves.
		await findByRole("heading", { level: 2 });
		// Poll for the date wrapper since the static-fetch effect is async.
		// The LivePulseDot renders inside .feed-next-meetup__date.
		const start = Date.now();
		let dot: Element | null = null;
		while (Date.now() - start < 1500) {
			dot = container.querySelector(
				".feed-next-meetup__date .cdn-live-pulse-dot",
			);
			if (dot) break;
			await new Promise((r) => setTimeout(r, 25));
		}
		expect(dot).not.toBeNull();
		expect(dot?.getAttribute("aria-hidden")).toBe("true");
		// Two circles inside the dot's SVG (halo + core).
		const circles = dot?.querySelectorAll("circle");
		expect(circles?.length).toBe(2);
		vi.unstubAllGlobals();
	});
});

describe("stripMarkdown — wave 43a markdown cleanup", () => {
	// Import the exported helper directly for unit testing.
	// We use a dynamic require here so the rest of the file's vi.stubGlobal
	// calls don't interfere with a top-level import.
	let stripMarkdown: (raw: string) => string;
	beforeAll(async () => {
		const mod = await import("../next-meetup");
		stripMarkdown = mod.stripMarkdown;
	});

	it("strips **bold** asterisk markers and keeps the inner text", () => {
		const result = stripMarkdown("Hello **world** today");
		expect(result).toBe("Hello world today");
		expect(result).not.toContain("**");
	});

	it("strips leading `> ` blockquote markers and keeps the text", () => {
		const result = stripMarkdown("> Important note here");
		expect(result).toBe("");
	});

	it("drops the entire [text](https://www.google.com/search?...) span and keeps only the label text", () => {
		const input =
			"Explore the [Cloud del Norte source code](https://www.google.com/search?q=https://github.com/clouddelnorte).";
		const result = stripMarkdown(input);
		expect(result).toContain("Cloud del Norte source code");
		expect(result).not.toContain("google.com/search");
		expect(result).not.toMatch(/\[.*?\]\(https?:\/\/www\.google\.com/);
	});

	it("drops entire `* ...` bullet lines from the output (wave 44)", () => {
		const input =
			"Welcome to the meetup.\n* Rubber Ducks: Vent your frustrations\n* Lightning Talks: Share something cool\nJoin us online.";
		const result = stripMarkdown(input);
		expect(result).not.toContain("Rubber Ducks");
		expect(result).not.toContain("Lightning Talks");
		expect(result).toContain("Welcome to the meetup.");
		expect(result).toContain("Join us online.");
	});

	it("drops entire `> ...` blockquote lines from the output (wave 44)", () => {
		const input = "Hello world.\n> This is a blockquote line.\nGoodbye.";
		const result = stripMarkdown(input);
		expect(result).not.toContain("blockquote");
		expect(result).toContain("Hello world.");
		expect(result).toContain("Goodbye.");
	});

	it("collapses whitespace after dropping bullets and blockquotes (wave 44)", () => {
		const input = "Start.\n* bullet one\n* bullet two\nEnd.";
		const result = stripMarkdown(input);
		expect(result).toBe("Start. End.");
	});
});
