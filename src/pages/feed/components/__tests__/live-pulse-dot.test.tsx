// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 38b — LivePulseDot regression coverage.
 *
 * The wave 38b uplift adds a small inline pulsing-dot SVG before the
 * next-meetup date-plate as a "next live session" microcue (the
 * idiosyncratic personality detail mirroring featured-event's
 * AsciiSmirk after "game"). This test asserts the structural contract
 * the wave 38b CSS targets:
 *
 *   - The wrapper span carries .cdn-live-pulse-dot + aria-hidden="true"
 *     so the description / date string carries meaning, not the glyph.
 *   - The inner SVG renders with role="img" + aria-label so AT that
 *     traverse roles can still discover the indicator's purpose.
 *   - Two circle elements (halo + core) render — the halo is the
 *     animated outer ring, the core is the static solid dot.
 *
 * jsdom does not apply external CSS to the cascade, so we don't assert
 * computed-style values for the pulse animation. The animation contract
 * lives in live-pulse-dot.css and is verified via the prefers-reduced-
 * motion gate covered in next-meetup.test.tsx (CSS text scan).
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LivePulseDot from "../live-pulse-dot";

describe("LivePulseDot — wave 38b inline microcue", () => {
	it("renders the wrapper span as aria-hidden so the date-plate text carries meaning", () => {
		const { container } = render(<LivePulseDot />);
		const span = container.querySelector("span.cdn-live-pulse-dot");
		expect(span).not.toBeNull();
		expect(span?.getAttribute("aria-hidden")).toBe("true");
	});

	it("renders an inline SVG with role=img and aria-label='live indicator'", () => {
		const { container } = render(<LivePulseDot />);
		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute("role")).toBe("img");
		expect(svg?.getAttribute("aria-label")).toBe("live indicator");
	});

	it("contains a halo ring + a solid core (two circle elements)", () => {
		const { container } = render(<LivePulseDot />);
		const circles = container.querySelectorAll("circle");
		expect(circles.length).toBe(2);
		// halo carries the animated class hook the CSS pulses
		const halo = container.querySelector("circle.cdn-live-pulse-dot__halo");
		expect(halo).not.toBeNull();
		// core is the inner solid dot
		const core = container.querySelector("circle.cdn-live-pulse-dot__core");
		expect(core).not.toBeNull();
	});

	it("includes a title element labelling the SVG 'live indicator' for AT that traverse roles", () => {
		const { container } = render(<LivePulseDot />);
		const title = container.querySelector("svg title");
		expect(title?.textContent).toBe("live indicator");
	});
});
