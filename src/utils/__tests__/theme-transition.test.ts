// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 42c — light/dark mode transition smoothness regression coverage.
 *
 * Bryan reported the transition between light and dark mode "is still not
 * smooth enough" even after the wave 25c FOUC guard + synchronous initial
 * applyMode landed. The wave 42c fix is a transition window: src/utils/
 * theme.ts adds body.cdn-theme-transitioning for ~240ms during the toggle
 * handler, and src/styles/tokens.css declares a rule that eases the theme-
 * bearing properties (background-color, background, color, border-color,
 * fill, stroke) for every descendant during that window.
 *
 * jsdom does not apply external CSS to the cascade, so we cannot assert
 * getComputedStyle(document.body).transition. What we CAN assert is the
 * structural contract on both sides:
 *
 *   1. The CSS rule exists in tokens.css with the expected transition
 *      properties + a prefers-reduced-motion: reduce override that strips
 *      the transition entirely.
 *
 *   2. The applyTheme handler in theme.ts adds the cdn-theme-transitioning
 *      class to body during a real toggle, and removes it after the
 *      THEME_TRANSITION_DURATION_MS window elapses (verified with
 *      vi.useFakeTimers + vi.advanceTimersByTime). The first apply
 *      (lastAppliedMode === null) does NOT add the class because the
 *      wave 25c FOUC guard already aligned <html>.awsui-dark-mode on
 *      parse-time, so the first applyTheme is a no-op for the surface.
 *
 * Companion coverage: theme.test.ts asserts the wave 25c FOUC guard +
 * applyMode timing contract; this file is the wave 42c transition layer
 * on top.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Wave 42c — cdn-theme-transitioning CSS rule (tokens.css)", () => {
	// Read tokens.css directly because jsdom does not apply external CSS
	// to the cascade. Same approach next-meetup.test.tsx + featured-event-
	// scroll.test.tsx use to verify CSS-only contracts.
	const tokensPath = join(__dirname, "..", "..", "styles", "tokens.css");
	const tokensText = readFileSync(tokensPath, "utf8");

	it("declares the body.cdn-theme-transitioning rule with the expected transition properties", () => {
		// The rule must apply to body.cdn-theme-transitioning AND its
		// descendants (so every surface eases simultaneously when the
		// theme flips). Match the selector list permissively (whitespace
		// and the descendant combinator vary across formatters).
		expect(tokensText).toMatch(/body\.cdn-theme-transitioning/);
		expect(tokensText).toMatch(
			/body\.cdn-theme-transitioning \*:not\(\.no-theme-transition\)/,
		);

		// The transition must cover the theme-bearing properties — the
		// brief calls out background-color, color, border-color, fill,
		// stroke. background (shorthand) is also included so cards with a
		// gradient `background:` declaration ease too.
		const transitionBlock = tokensText.match(
			/body\.cdn-theme-transitioning,[\s\S]*?body\.cdn-theme-transitioning \*:not\(\.no-theme-transition\) \{[\s\S]*?transition:[\s\S]*?\}/,
		);
		expect(transitionBlock).not.toBeNull();
		const block = transitionBlock?.[0] ?? "";
		expect(block).toMatch(/background-color\s+\d+ms/);
		expect(block).toMatch(/background\s+\d+ms/);
		expect(block).toMatch(/color\s+\d+ms/);
		expect(block).toMatch(/border-color\s+\d+ms/);
		expect(block).toMatch(/fill\s+\d+ms/);
		expect(block).toMatch(/stroke\s+\d+ms/);
		// 180-220ms ease-in-out is the brief's calibrated band; assert the
		// timing function is ease-in-out (not the default linear/ease) so
		// the swap reads as deliberate rather than abrupt.
		expect(block).toMatch(/ease-in-out/);
	});

	it("strips the transition under prefers-reduced-motion: reduce", () => {
		// The reduced-motion fallback must wrap the same selector list and
		// reset transition to none — the theme still flips on click, just
		// instantly, mirroring the rest of the site's reduced-motion contract.
		const reducedBlock = tokensText.match(
			/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?body\.cdn-theme-transitioning[\s\S]*?transition:\s*none[\s\S]*?\}/,
		);
		expect(reducedBlock).not.toBeNull();
	});
});

describe("Wave 42c — applyTheme transition-class window (theme.ts)", () => {
	beforeEach(() => {
		// Defensive cleanup so a leaked class from a previous test doesn't
		// poison the assertions below.
		document.body.classList.remove("cdn-theme-transitioning");
		document.documentElement.classList.remove("awsui-dark-mode");
		localStorage.clear();
		vi.resetModules();
		// vi.useFakeTimers must be enabled per-test to control the
		// 240ms setTimeout that removes the class. requestIdleCallback /
		// requestAnimationFrame are stubbed by jsdom but the module's
		// scheduleApplyMode runs applyMode synchronously on the first
		// apply (wave 25c) — the deferred path is exercised on subsequent
		// applies and is not the focus of this test.
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.classList.remove("cdn-theme-transitioning");
		document.documentElement.classList.remove("awsui-dark-mode");
	});

	it("does NOT add cdn-theme-transitioning on the first applyTheme call (wave 25c FOUC guard already aligned <html> at parse-time, so the first apply has nothing to ease)", async () => {
		const { applyTheme } = await import("../theme");

		// First apply — should land synchronously without queuing a
		// transition window. The body class must remain absent.
		applyTheme("dark");
		expect(document.body.classList.contains("cdn-theme-transitioning")).toBe(
			false,
		);

		// Even after advancing timers, no class should appear (the toggle
		// path was not entered).
		vi.advanceTimersByTime(500);
		expect(document.body.classList.contains("cdn-theme-transitioning")).toBe(
			false,
		);
	});

	it("adds cdn-theme-transitioning on a real toggle and removes it after the 240ms window", async () => {
		const { applyTheme } = await import("../theme");

		// First apply — primes lastAppliedMode but does not add the class
		// (covered by the test above; here we just need the priming side
		// effect so the next call enters the toggle path).
		applyTheme("dark");
		expect(document.body.classList.contains("cdn-theme-transitioning")).toBe(
			false,
		);

		// Real toggle — second apply with a different theme. The class
		// must now be present synchronously so the CSS rule in tokens.css
		// engages on the same frame the html class flips.
		applyTheme("light");
		expect(document.body.classList.contains("cdn-theme-transitioning")).toBe(
			true,
		);

		// Mid-window — class is still present (the swap is still being
		// eased). 200ms transition + 40ms slack puts removal at 240ms;
		// at 100ms we should still be inside the window.
		vi.advanceTimersByTime(100);
		expect(document.body.classList.contains("cdn-theme-transitioning")).toBe(
			true,
		);

		// End-of-window — the setTimeout fires at 240ms and removes the
		// class. Advance to 240ms total (140ms more on top of the 100ms
		// already advanced).
		vi.advanceTimersByTime(140);
		expect(document.body.classList.contains("cdn-theme-transitioning")).toBe(
			false,
		);
	});

	it("re-arms the transition window on a rapid double-toggle (the second toggle's full window is honored, not truncated by the first toggle's pending removal)", async () => {
		const { applyTheme } = await import("../theme");

		// Prime + first real toggle — class added at t=0, scheduled to
		// remove at t=240.
		applyTheme("dark");
		applyTheme("light");
		expect(document.body.classList.contains("cdn-theme-transitioning")).toBe(
			true,
		);

		// Second real toggle at t=120 (mid-window). The handler must
		// cancel the in-flight removal and re-arm a fresh 240ms window
		// from the new toggle moment — without the cancel, the original
		// timeout would still fire at t=240 and strip the class while
		// the second swap is still being eased.
		vi.advanceTimersByTime(120);
		applyTheme("dark");
		expect(document.body.classList.contains("cdn-theme-transitioning")).toBe(
			true,
		);

		// At t=240 (the original first-toggle removal moment) the class
		// must still be present because the re-arm cancelled that
		// timeout.
		vi.advanceTimersByTime(120);
		expect(document.body.classList.contains("cdn-theme-transitioning")).toBe(
			true,
		);

		// At t=240 + 240 = 480 the second toggle's fresh window has
		// elapsed and the class is removed.
		vi.advanceTimersByTime(120);
		expect(document.body.classList.contains("cdn-theme-transitioning")).toBe(
			false,
		);
	});
});
