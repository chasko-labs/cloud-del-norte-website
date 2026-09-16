// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Scroll-render-pause — event-dispatch contract for scroll-jank-mitigation.
 *
 * This is the regression net for the scroll-smoothness rebuild. The prior
 * fix was never committed and was lost, so the dispatch contract that the
 * decoupled render loops depend on (2D background-viz skip in
 * lib/background-viz/canvas.ts, Babylon dune pause in dune/SceneBootstrap.ts)
 * had no test protecting it.
 *
 * Contract under test:
 *   - When a scroll burst BEGINS, initScrollJankMitigation dispatches
 *     `cdn-scroll-start` (on window AND document.body).
 *   - When the burst SETTLES (250ms debounce elapses), it dispatches
 *     `cdn-scroll-end`.
 *   - Each event fires ONLY on the transition edge — additional scroll
 *     events inside the same burst do NOT re-dispatch cdn-scroll-start, and
 *     the body.cdn-scrolling class contract is preserved.
 *
 * We drive the internals deterministically: requestAnimationFrame is stubbed
 * to invoke its callback synchronously (the module rAF-throttles the start
 * edge), and fake timers advance the 250ms end-edge debounce.
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import { initScrollJankMitigation } from "../scroll-jank-mitigation";

const SCROLL_END_DEBOUNCE_MS = 250;

describe("initScrollJankMitigation — scroll-burst event dispatch", () => {
	let rafSpy: MockInstance;
	let cafSpy: MockInstance;
	let cleanup: (() => void) | null = null;

	beforeEach(() => {
		vi.useFakeTimers();
		// Run the rAF callback synchronously so the "scroll started" edge is
		// observable within the test without a real frame. Return a numeric
		// handle the module can pass to cancelAnimationFrame.
		rafSpy = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation((cb: FrameRequestCallback): number => {
				cb(performance.now());
				return 1;
			});
		cafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
			// no-op — synchronous rAF above already ran
		});
		document.body.classList.remove("cdn-scrolling");
	});

	afterEach(() => {
		cleanup?.();
		cleanup = null;
		rafSpy.mockRestore();
		cafSpy.mockRestore();
		vi.clearAllTimers();
		vi.useRealTimers();
		document.body.classList.remove("cdn-scrolling");
	});

	it("dispatches cdn-scroll-start on the burst's leading edge and cdn-scroll-end after the settle debounce", () => {
		const startWin = vi.fn();
		const endWin = vi.fn();
		window.addEventListener("cdn-scroll-start", startWin);
		window.addEventListener("cdn-scroll-end", endWin);

		cleanup = initScrollJankMitigation();

		// Leading edge — one scroll event begins the burst.
		window.dispatchEvent(new Event("scroll"));
		expect(startWin).toHaveBeenCalledTimes(1);
		expect(endWin).toHaveBeenCalledTimes(0);
		expect(document.body.classList.contains("cdn-scrolling")).toBe(true);

		// Settle — advance past the debounce window.
		vi.advanceTimersByTime(SCROLL_END_DEBOUNCE_MS);
		expect(endWin).toHaveBeenCalledTimes(1);
		expect(document.body.classList.contains("cdn-scrolling")).toBe(false);

		window.removeEventListener("cdn-scroll-start", startWin);
		window.removeEventListener("cdn-scroll-end", endWin);
	});

	it("fires each event only on the transition edge — repeated scrolls within one burst do not re-dispatch start or end", () => {
		const startWin = vi.fn();
		const endWin = vi.fn();
		window.addEventListener("cdn-scroll-start", startWin);
		window.addEventListener("cdn-scroll-end", endWin);

		cleanup = initScrollJankMitigation();

		// Three scroll events, each landing before the debounce elapses, are a
		// single continuous burst. Only ONE cdn-scroll-start may be emitted.
		window.dispatchEvent(new Event("scroll"));
		vi.advanceTimersByTime(100);
		window.dispatchEvent(new Event("scroll"));
		vi.advanceTimersByTime(100);
		window.dispatchEvent(new Event("scroll"));

		expect(startWin).toHaveBeenCalledTimes(1);
		expect(endWin).toHaveBeenCalledTimes(0);

		// Now let the burst settle — exactly one cdn-scroll-end.
		vi.advanceTimersByTime(SCROLL_END_DEBOUNCE_MS);
		expect(startWin).toHaveBeenCalledTimes(1);
		expect(endWin).toHaveBeenCalledTimes(1);

		window.removeEventListener("cdn-scroll-start", startWin);
		window.removeEventListener("cdn-scroll-end", endWin);
	});

	it("also dispatches the events on document.body (preserves the pre-existing atmosphere-ribbon body listeners)", () => {
		const startBody = vi.fn();
		const endBody = vi.fn();
		document.body.addEventListener("cdn-scroll-start", startBody);
		document.body.addEventListener("cdn-scroll-end", endBody);

		cleanup = initScrollJankMitigation();

		window.dispatchEvent(new Event("scroll"));
		expect(startBody).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(SCROLL_END_DEBOUNCE_MS);
		expect(endBody).toHaveBeenCalledTimes(1);

		document.body.removeEventListener("cdn-scroll-start", startBody);
		document.body.removeEventListener("cdn-scroll-end", endBody);
	});

	it("emits a final cdn-scroll-end on teardown if a burst was active, and none if it was idle", () => {
		const endWin = vi.fn();
		window.addEventListener("cdn-scroll-end", endWin);

		const teardownDuringBurst = initScrollJankMitigation();
		// Begin a burst but do NOT let it settle.
		window.dispatchEvent(new Event("scroll"));
		expect(document.body.classList.contains("cdn-scrolling")).toBe(true);

		// Teardown mid-burst flips scrolling false → one trailing end edge.
		teardownDuringBurst();
		expect(endWin).toHaveBeenCalledTimes(1);
		expect(document.body.classList.contains("cdn-scrolling")).toBe(false);

		// A fresh init that never saw a scroll must NOT emit end on teardown
		// (no transition edge occurred).
		endWin.mockClear();
		const teardownIdle = initScrollJankMitigation();
		teardownIdle();
		expect(endWin).toHaveBeenCalledTimes(0);

		window.removeEventListener("cdn-scroll-end", endWin);
	});
});
