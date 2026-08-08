// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 37b — image fade-in + date-string fade-in regression tests.
 *
 * Verifies the four CSS hooks that ship in this wave:
 *  1. `.feed-featured-event__image` and `.feed-upcoming-virtual-event__image`
 *     start at opacity:0 (so the binary fades in instead of popping).
 *  2. The `markImageLoaded` onLoad handler adds an `is-loaded` class to the
 *     <img> when the binary loads, which the CSS rule keys off of to flip
 *     opacity to 1.
 *  3. A shared `@keyframes feed-fade-in { from opacity:0 to opacity:1 }`
 *     definition exists for the date plates + image wrappers.
 *  4. `prefers-reduced-motion: reduce` disables both the transition and the
 *     keyframes animation so reduced-motion users see content immediately.
 *
 * The CSS-rule assertions read the styles.css file off disk because jsdom
 * does not actually evaluate or compute the styles for this stylesheet
 * during the component test environment. Reading the file text is the same
 * approach used elsewhere in the test tree to lock CSS contracts.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import FeaturedEvent from "../featured-event";
import UpcomingVirtualEvent from "../upcoming-virtual-event";

const STYLES_CSS_PATH = resolve(__dirname, "..", "..", "styles.css");
const stylesCss = readFileSync(STYLES_CSS_PATH, "utf8");

// FeaturedEvent no longer renders images (quantum event card),
// so the fetch mock is only needed by UpcomingVirtualEvent.
const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	fetchMock.mockResolvedValue(
		new Response(JSON.stringify({}), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
	);
	globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
	fetchMock.mockReset();
});

describe("Wave 37b — image fade-in CSS rules", () => {
	it("declares opacity:0 + 320ms opacity transition on featured-event + upcoming-virtual-event images", () => {
		// Single combined selector block with both image classes.
		expect(stylesCss).toMatch(
			/\.feed-featured-event__image\s*,\s*\.feed-upcoming-virtual-event__image\s*\{[^}]*opacity:\s*0[^}]*transition:\s*opacity\s+320ms/,
		);
	});

	it("declares opacity:1 once the .is-loaded class is added", () => {
		expect(stylesCss).toMatch(
			/\.feed-featured-event__image\.is-loaded\s*,\s*\.feed-upcoming-virtual-event__image\.is-loaded\s*\{[^}]*opacity:\s*1/,
		);
	});

	it("defines the @keyframes feed-fade-in 0→1 opacity ramp", () => {
		expect(stylesCss).toMatch(
			/@keyframes\s+feed-fade-in\s*\{\s*from\s*\{\s*opacity:\s*0[^}]*\}\s*to\s*\{\s*opacity:\s*1[^}]*\}\s*\}/,
		);
	});

	it("applies the feed-fade-in animation to the date plates + image wrappers (with the 60ms delay + backwards fill)", () => {
		// Find the rule that targets the five wrapper selectors and check it
		// uses the feed-fade-in keyframes with the 320ms / 60ms / backwards
		// signature spelled in the styles.
		expect(stylesCss).toMatch(
			/\.feed-featured-event__date,\s*\.feed-next-meetup__date,\s*\.feed-upcoming-virtual-event__date,\s*\.feed-featured-event__image-area,\s*\.feed-upcoming-virtual-event__bulbs-wrapper\s*\{\s*animation:\s*feed-fade-in\s+320ms\s+ease-out\s+60ms\s+backwards/,
		);
	});

	it("disables both the image transition and the keyframes animation under prefers-reduced-motion", () => {
		// Find the @media (prefers-reduced-motion: reduce) block at the end
		// of the file. Both image opacity:1 + transition:none + animation:
		// none on the wrapper selectors must appear inside it.
		const reducedMotionMatch = stylesCss.match(
			/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.feed-featured-event__image[\s\S]*?\}\s*\}\s*$/m,
		);
		expect(reducedMotionMatch).not.toBeNull();
		const block = reducedMotionMatch?.[0] ?? "";
		expect(block).toMatch(/opacity:\s*1/);
		expect(block).toMatch(/transition:\s*none/);
		expect(block).toMatch(/animation:\s*none/);
	});
});

describe("Wave 37b — onLoad handler adds is-loaded class", () => {
	it("FeaturedEvent: renders without images (quantum event card)", () => {
		const { container } = render(
			<LocaleProvider locale="us">
				<FeaturedEvent />
			</LocaleProvider>,
		);
		// Quantum event card does not render images
		const lightImg = container.querySelector(
			".feed-featured-event__image--light",
		);
		const darkImg = container.querySelector(
			".feed-featured-event__image--dark",
		);
		expect(lightImg).toBeNull();
		expect(darkImg).toBeNull();
	});

	it("UpcomingVirtualEvent: each <img> picks up the is-loaded class after firing the load event", () => {
		const { container } = render(
			<LocaleProvider locale="us">
				<UpcomingVirtualEvent />
			</LocaleProvider>,
		);
		const lightImg = container.querySelector(
			".feed-upcoming-virtual-event__image--light",
		);
		const darkImg = container.querySelector(
			".feed-upcoming-virtual-event__image--dark",
		);
		expect(lightImg).not.toBeNull();
		expect(darkImg).not.toBeNull();

		expect(lightImg?.classList.contains("is-loaded")).toBe(false);
		expect(darkImg?.classList.contains("is-loaded")).toBe(false);

		if (lightImg) fireEvent.load(lightImg);
		if (darkImg) fireEvent.load(darkImg);

		expect(lightImg?.classList.contains("is-loaded")).toBe(true);
		expect(darkImg?.classList.contains("is-loaded")).toBe(true);
	});
});
