// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 37a — mobile ghosting/tearing regression coverage on the
 * featured-event + next-meetup + upcoming-virtual-event cards.
 *
 * Bryan reported (verbatim): "visually skipping I'm seeing is only mobile
 * devices - I checked mobile width on desktop device & didn't have the
 * issue - like a ghosting of the content tearing onto the screen for a
 * split second continually when you go to clouddelnorte.org & especially
 * when you scroll - only evident when next meetup or featured event are
 * visible on screen so it would seem one of these two are to blame."
 *
 * Root cause — waves 30a + 33a + 33b promoted these three cards to GPU
 * compositor layers (will-change + translate3d + contain + perspective +
 * preserve-3d) and stacked multiple sustained animations (::after sweep,
 * title tape, date plate breathe, spots ring pulse, twinkle stars). On
 * desktop GPUs the promotion is a net win and fixes scroll tearing. On
 * iOS Safari + Android Chrome the simultaneous compositor layer cap +
 * limited VRAM causes the browser to fall back to software rendering,
 * and the fallback transition surfaces as the ghosting/tearing.
 *
 * The fix lives in src/pages/feed/styles.css — a new @media (min-width:
 * 768px) block at the bottom carries the GPU promotion (the base rules
 * no longer carry it), and a new @media (max-width: 767.98px) block
 * uses !important to disable will-change + sustained animations on the
 * three event cards. prefers-reduced-motion gates upstream are
 * preserved verbatim so the accessibility contract is unchanged.
 *
 * jsdom does not compute layered styles from external CSS, so we cannot
 * assert getComputedStyle(card).willChange — that value lives in
 * styles.css, which jsdom parses but does not apply to the cascade.
 * What we CAN assert is that the relevant CSS rules exist as text in
 * the file. This mirrors the wave-30a featured-event-scroll regression
 * test pattern (which asserts on structural class names) and the wave
 * 32a / 33a regression patterns that read styles.css as a string and
 * assert on substring presence to lock the visual contract.
 *
 * If any of these substrings disappear (someone deletes the desktop
 * gate, or removes the mobile animation: none overrides, or accidentally
 * strips the prefers-reduced-motion gates), this test fails and the
 * mobile ghosting fix has silently regressed.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Read styles.css as a single text blob. The fix is asserted at the CSS
 * source level rather than the computed-style level because jsdom does
 * not apply external CSS during tests, and because the contract we want
 * to lock is "the CSS file contains these rules" — exactly what a code
 * reviewer would check by eye.
 */
const stylesCss = readFileSync(
	join(__dirname, "..", "..", "styles.css"),
	"utf8",
);

describe("Wave 37a — mobile ghosting fix regression contract", () => {
	it("disables will-change on .feed-featured-event under @media (max-width: 767.98px)", () => {
		// The mobile override block must explicitly clamp will-change to auto
		// on the featured-event card root. This is the core of the fix —
		// without it, the iOS/Android compositor cap is hit and the browser
		// falls back to software rendering (the visible ghosting Bryan saw).
		const mobileBlock = extractMediaBlock(stylesCss, "max-width: 767.98px");
		expect(mobileBlock).toContain(".feed-featured-event");
		expect(mobileBlock).toMatch(
			/\.feed-featured-event[^{]*\{[^}]*will-change:\s*auto\s*!important/,
		);
	});

	it("disables the .feed-featured-event::after spotlight sweep animation under @media (max-width: 767.98px)", () => {
		// The 7s spotlight-sweep ::after animation was identified as the most
		// expensive sustained mobile animation in the root-cause analysis.
		// The mobile override must set animation: none !important on the
		// ::after pseudo so the sweep stops compounding repaint pressure.
		const mobileBlock = extractMediaBlock(stylesCss, "max-width: 767.98px");
		expect(mobileBlock).toContain(".feed-featured-event::after");
		// Match the rule that targets ::after and contains animation: none —
		// the rule groups all three card ::afters together, so we look for
		// the ::after token and the animation: none in the same block.
		expect(mobileBlock).toMatch(
			/\.feed-featured-event::after[\s\S]*?animation:\s*none\s*!important/,
		);
	});

	it("disables will-change on .feed-next-meetup under @media (max-width: 767.98px)", () => {
		// Same contract as featured-event but for the wave 33a next-meetup
		// card — Bryan named both cards as the visible offenders.
		const mobileBlock = extractMediaBlock(stylesCss, "max-width: 767.98px");
		expect(mobileBlock).toContain(".feed-next-meetup");
		expect(mobileBlock).toMatch(
			/\.feed-next-meetup[^{]*\{[^}]*will-change:\s*auto\s*!important/,
		);
	});

	it("preserves the @media (prefers-reduced-motion: ...) gates regardless of the new mobile gate", () => {
		// The prefers-reduced-motion gates are the accessibility contract —
		// they MUST continue to disable animations on reduced-motion users
		// at every viewport. The wave 37a fix adds a mobile-hardware gate
		// alongside (not in place of) the motion-preference gate, so both
		// no-preference and reduce variants must still appear in the file.
		expect(stylesCss).toContain(
			"@media (prefers-reduced-motion: no-preference)",
		);
		expect(stylesCss).toContain("@media (prefers-reduced-motion: reduce)");
		// And the existing reduce-block rules that strip animations on
		// featured-event must still be present (a sanity check that the
		// fix did not accidentally delete the upstream a11y fallback).
		expect(stylesCss).toMatch(
			/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.feed-featured-event::after[\s\S]*?animation:\s*none/,
		);
	});

	it("preserves the desktop @media (min-width: 768px) GPU promotion rules on all three event cards", () => {
		// The desktop side of the wave 37a fix re-applies the wave 30a /
		// 33a / 33b GPU compositor layer promotion stack on the three
		// event cards. Without this block, desktop loses the original
		// scroll-tearing mitigation. The block must mention all three
		// card roots and carry the will-change / translate3d / perspective
		// / preserve-3d / contain stack.
		const desktopBlock = extractMediaBlock(stylesCss, "min-width: 768px");
		expect(desktopBlock).toContain(".feed-featured-event");
		expect(desktopBlock).toContain(".feed-next-meetup");
		expect(desktopBlock).toContain(".feed-upcoming-virtual-event");
		expect(desktopBlock).toMatch(/will-change:\s*transform/);
		expect(desktopBlock).toMatch(/transform:\s*translate3d\(0,\s*0,\s*0\)/);
		expect(desktopBlock).toMatch(/perspective:\s*1200px/);
		expect(desktopBlock).toMatch(/transform-style:\s*preserve-3d/);
		expect(desktopBlock).toMatch(/contain:\s*layout paint style/);
	});
});

/**
 * Walk the CSS string and return the body of the first top-level
 * @media (...) {...} block whose condition substring matches `condition`.
 *
 * The search is anchored on the opening brace (`@media (...) {`) so a
 * mention of the same condition inside a /* comment * / does not match.
 * Comments referencing the gate (e.g. "see the @media (min-width: 768px)
 * gate at the bottom") are common in this file's documentation comments,
 * and a naive indexOf("@media (...)") would match the comment first.
 *
 * Brace-aware: counts opening + closing braces so nested blocks (e.g.
 * @keyframes inside the media block) don't trip the closing-brace match.
 *
 * Returns "" if no matching media block is found — the caller's
 * subsequent assertions then fail informatively.
 */
function extractMediaBlock(css: string, condition: string): string {
	const needle = `@media (${condition}) {`;
	const start = css.indexOf(needle);
	if (start === -1) {
		return "";
	}
	const openBrace = start + needle.length - 1;
	let depth = 1;
	let i = openBrace + 1;
	while (i < css.length && depth > 0) {
		const ch = css[i];
		if (ch === "{") {
			depth += 1;
		} else if (ch === "}") {
			depth -= 1;
		}
		i += 1;
	}
	return css.slice(openBrace + 1, i - 1);
}
