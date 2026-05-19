// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 30a — scroll-jank mitigation for the feed page.
 *
 * The wave 27a v2 featured event card stacks several sustained animations
 * (::after spotlight sweep, title gradient tape, date-plate breathe + shimmer,
 * spots-remaining pulse + outer ring) on top of perspective/preserve-3d.
 * On its own each animation is fine; together, when the card scrolls into or
 * out of view, the compositor was visibly tearing as it re-rasterized the
 * card's GPU layers per frame.
 *
 * The styles.css fix promotes the card and its animated descendants onto
 * dedicated GPU layers via will-change + contain. This module is the
 * complementary layer — during fast scrolling we add `cdn-scrolling` to
 * <body> so the CSS can pause every sustained animation on the card. When
 * the scroll burst settles (250ms of quiet), the class is removed and
 * animations resume from their paused state. Net effect: the compositor
 * is free to focus on scrolling smoothly, and the moment the user stops
 * scrolling the card resumes its dimensional rizz.
 *
 * Scroll listener is rAF-throttled (one class toggle per frame) and
 * registered with `passive: true` so it never blocks the scroll thread.
 *
 * Skipped entirely when:
 *   - The user has `prefers-reduced-motion: reduce` set (the animations
 *     are already off in that branch — pausing already-stopped animations
 *     is a no-op, and we save the listener overhead).
 *   - We're on the server (no `window`).
 */

const SCROLLING_CLASS = "cdn-scrolling";
const SCROLL_END_DEBOUNCE_MS = 250;

export function initScrollJankMitigation(): () => void {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return () => {
			// no-op on the server
		};
	}

	// Respect the user's motion preference. matchMedia is widely supported
	// in every browser we ship to. On older browsers without it, we fall
	// through to the listener install (better safe than sorry).
	const prefersReducedMotion =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (prefersReducedMotion) {
		return () => {
			// no-op — animations were never running, no scroll-pause needed
		};
	}

	let scrolling = false;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let rafId: number | null = null;

	const setScrolling = (next: boolean) => {
		if (scrolling === next) return;
		scrolling = next;
		document.body.classList.toggle(SCROLLING_CLASS, next);
	};

	const onScroll = () => {
		// rAF-throttle the "scroll started" signal — one class add per frame
		// max, no matter how many scroll events fire in between.
		if (rafId === null) {
			rafId = window.requestAnimationFrame(() => {
				rafId = null;
				setScrolling(true);
			});
		}
		// Debounce the "scroll ended" signal — fires 250ms after the last
		// scroll event in the burst.
		if (timeoutId !== null) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			timeoutId = null;
			setScrolling(false);
		}, SCROLL_END_DEBOUNCE_MS);
	};

	window.addEventListener("scroll", onScroll, { passive: true });

	return () => {
		window.removeEventListener("scroll", onScroll);
		if (rafId !== null) {
			window.cancelAnimationFrame(rafId);
			rafId = null;
		}
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		setScrolling(false);
	};
}
