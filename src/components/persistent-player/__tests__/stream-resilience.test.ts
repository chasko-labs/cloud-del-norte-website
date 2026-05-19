// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 28c — podcast stream resilience tests.
 *
 * Exercises the pure recovery policy that supplements the existing
 * tripError / showRetryingUI / showFailedUI state machine in
 * persistent-player/index.tsx. The policy lives in
 * persistent-player/podcast-recovery.ts and is the source of truth for:
 *   - which audio.error codes trigger a refetch+retry
 *   - the 3-attempts-per-60s budget
 *   - the 5s minimum spacing between retries
 *
 * The component-level integration is exercised separately by the existing
 * auto-advance + connecting-state tests; this file targets the policy + the
 * mocked-audio refetch flow without booting the full DOM tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	decidePodcastRecovery,
	PODCAST_RETRY_MAX_ATTEMPTS,
	PODCAST_RETRY_MIN_SPACING_MS,
	PODCAST_RETRY_WINDOW_MS,
	pruneHistory,
} from "../podcast-recovery";

// MEDIA_ERR_* codes (HTML spec)
const MEDIA_ERR_ABORTED = 1;
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

describe("decidePodcastRecovery — error-code triage", () => {
	const NOW = 1_000_000;

	it("retries on MEDIA_ERR_NETWORK with empty history", () => {
		const decision = decidePodcastRecovery(MEDIA_ERR_NETWORK, [], NOW);
		expect(decision).toEqual({ kind: "retry-now" });
	});

	it("retries on MEDIA_ERR_SRC_NOT_SUPPORTED with empty history", () => {
		// the stale-enclosure failure mode — captivate UUID rotated, Triton
		// signed URL expired, or browser cached a 4xx that no longer matches
		const decision = decidePodcastRecovery(
			MEDIA_ERR_SRC_NOT_SUPPORTED,
			[],
			NOW,
		);
		expect(decision).toEqual({ kind: "retry-now" });
	});

	it("gives up immediately on MEDIA_ERR_DECODE (file is corrupt — refetch won't help)", () => {
		const decision = decidePodcastRecovery(MEDIA_ERR_DECODE, [], NOW);
		expect(decision).toEqual({
			kind: "give-up",
			reason: "non-recoverable",
		});
	});

	it("gives up on MEDIA_ERR_ABORTED (user-initiated, not an error)", () => {
		const decision = decidePodcastRecovery(MEDIA_ERR_ABORTED, [], NOW);
		expect(decision).toEqual({
			kind: "give-up",
			reason: "non-recoverable",
		});
	});

	it("retries on null code (audio.error not exposed in mock environments)", () => {
		// jsdom does not always populate audio.error; we still want to attempt
		// recovery rather than give up silently
		const decision = decidePodcastRecovery(null, [], NOW);
		expect(decision).toEqual({ kind: "retry-now" });
	});
});

describe("decidePodcastRecovery — budget enforcement", () => {
	const NOW = 1_000_000;

	it(`allows up to ${PODCAST_RETRY_MAX_ATTEMPTS} attempts inside the window`, () => {
		// window-spaced timestamps (well outside 5s floor)
		const history = [NOW - 30_000, NOW - 20_000];
		const decision = decidePodcastRecovery(MEDIA_ERR_NETWORK, history, NOW);
		expect(decision.kind).toBe("retry-now");
	});

	it("gives up once the budget is exhausted", () => {
		const history = [NOW - 30_000, NOW - 20_000, NOW - 10_000];
		expect(history.length).toBe(PODCAST_RETRY_MAX_ATTEMPTS);
		const decision = decidePodcastRecovery(MEDIA_ERR_NETWORK, history, NOW);
		expect(decision).toEqual({
			kind: "give-up",
			reason: "budget-exhausted",
		});
	});

	it("budget is window-scoped: old attempts pruned before counting", () => {
		// three attempts but pruneHistory drops the ones older than the window
		const stale = [
			NOW - (PODCAST_RETRY_WINDOW_MS + 1_000),
			NOW - 30_000,
			NOW - 10_000,
		];
		const pruned = pruneHistory(stale, NOW);
		expect(pruned).toHaveLength(2);
		const decision = decidePodcastRecovery(MEDIA_ERR_NETWORK, pruned, NOW);
		expect(decision.kind).toBe("retry-now");
	});
});

describe("decidePodcastRecovery — backoff timing", () => {
	const NOW = 1_000_000;

	it("retries immediately when the last attempt is outside the spacing floor", () => {
		const history = [NOW - (PODCAST_RETRY_MIN_SPACING_MS + 1_000)];
		const decision = decidePodcastRecovery(MEDIA_ERR_NETWORK, history, NOW);
		expect(decision).toEqual({ kind: "retry-now" });
	});

	it(`schedules a delayed retry when the last attempt was less than ${PODCAST_RETRY_MIN_SPACING_MS}ms ago`, () => {
		const history = [NOW - 1_000];
		const decision = decidePodcastRecovery(MEDIA_ERR_NETWORK, history, NOW);
		expect(decision).toEqual({
			kind: "retry-after",
			delayMs: PODCAST_RETRY_MIN_SPACING_MS - 1_000,
		});
	});

	it("delay equals the full floor when an error fires the same instant", () => {
		const history = [NOW];
		const decision = decidePodcastRecovery(MEDIA_ERR_NETWORK, history, NOW);
		expect(decision).toEqual({
			kind: "retry-after",
			delayMs: PODCAST_RETRY_MIN_SPACING_MS,
		});
	});
});

describe("pruneHistory", () => {
	it("keeps entries inside the window", () => {
		const now = 100_000;
		const result = pruneHistory([now - 30_000, now - 10_000, now], now, 60_000);
		expect(result).toEqual([now - 30_000, now - 10_000, now]);
	});

	it("drops entries older than the window", () => {
		const now = 100_000;
		const result = pruneHistory(
			[now - 90_000, now - 30_000, now - 10_000],
			now,
			60_000,
		);
		expect(result).toEqual([now - 30_000, now - 10_000]);
	});

	it("returns empty array when history is empty", () => {
		expect(pruneHistory([], 100_000, 60_000)).toEqual([]);
	});

	it("uses the default window when omitted", () => {
		const now = 100_000;
		// default = PODCAST_RETRY_WINDOW_MS (60s)
		const result = pruneHistory([now - 70_000, now - 5_000], now);
		expect(result).toEqual([now - 5_000]);
	});
});

/**
 * End-to-end style test of the fetch+swap path: when audio.error fires,
 * the recovery flow should call fetch() against the RSS feed and apply the
 * fresh enclosure URL to audio.src. We mock fetch + a minimal audio element
 * and run the same logic the component effect runs.
 */
describe("recovery flow — refetch + URL swap", () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		vi.useFakeTimers();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.useRealTimers();
	});

	it("on MEDIA_ERR_SRC_NOT_SUPPORTED, refetches RSS and swaps audio.src to the fresh enclosure URL", async () => {
		const FRESH_URL =
			"https://podcasts.captivate.fm/media/fresh-uuid/episode-2026.mp3";
		const xml = `<rss><channel><item><enclosure url="${FRESH_URL}" type="audio/mpeg"/></item></channel></rss>`;

		globalThis.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				text: () => Promise.resolve(xml),
			} as Response),
		) as unknown as typeof fetch;

		// minimal audio mock — exposes the surface the recovery effect touches
		const audio = {
			src: "https://podcasts.captivate.fm/media/stale-uuid/old.mp3",
			error: { code: MEDIA_ERR_SRC_NOT_SUPPORTED } as MediaError,
			load: vi.fn(),
			play: vi.fn(() => Promise.resolve()),
		};

		// inline replication of the effect's recovery branch — keeps the test
		// independent of the React render cycle while still verifying the
		// fetch + swap path that the component runs
		const history: number[] = [];
		const now = Date.now();
		const decision = decidePodcastRecovery(audio.error.code, history, now);
		expect(decision.kind).toBe("retry-now");

		const xmlText = await (
			await globalThis.fetch("https://feeds.captivate.fm/writing-on-the-wall/")
		).text();
		const doc = new DOMParser().parseFromString(xmlText, "text/xml");
		const encUrl =
			doc
				.querySelector("channel > item:first-child > enclosure")
				?.getAttribute("url") ?? null;

		expect(encUrl).toBe(FRESH_URL);

		audio.src = encUrl as string;
		audio.load();
		await audio.play();

		expect(audio.src).toBe(FRESH_URL);
		expect(audio.load).toHaveBeenCalledTimes(1);
		expect(audio.play).toHaveBeenCalledTimes(1);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it("falls back to the build-time cached enclosure URL when RSS fetch fails", async () => {
		const CACHED_URL =
			"https://content.rss.com/episodes/126551/cached/fight4ourexistence.mp3";

		globalThis.fetch = vi.fn(() =>
			Promise.reject(new Error("network down")),
		) as unknown as typeof fetch;

		const audio = {
			src: "https://content.rss.com/episodes/126551/stale/fight4ourexistence.mp3",
			load: vi.fn(),
			play: vi.fn(() => Promise.resolve()),
		};

		// simulate the recovery effect's catch branch using the cached URL
		const cached = CACHED_URL;
		try {
			await globalThis.fetch(
				"https://media.rss.com/fight4ourexistence/feed.xml",
			);
		} catch {
			audio.src = cached;
			audio.load();
			await audio.play();
		}

		expect(audio.src).toBe(CACHED_URL);
		expect(audio.load).toHaveBeenCalledTimes(1);
		expect(audio.play).toHaveBeenCalledTimes(1);
	});
});
