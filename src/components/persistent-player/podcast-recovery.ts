// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Podcast stream resilience — wave 28c.
 *
 * The two Mescalero podcast streams (writing_on_the_wall + fight_for_our_existence)
 * route through CDNs that:
 *   - rotate enclosure UUIDs on episode redeploy (captivate)
 *   - emit signed CDN URLs with Expires= params that eventually fail (Triton via content.rss.com)
 *   - cache 4xx responses on the browser side, leaving no recovery path
 *
 * This module supplies the pure decision logic for runtime recovery:
 *   - given an audio.error code + the current attempt history,
 *     decide whether to refetch a fresh enclosure URL and retry,
 *     or surrender to the existing failed UI.
 *
 * Keeping the policy out of the React component lets vitest exercise the
 * branches in isolation without DOM rendering.
 */

/** sliding window in which retries are counted toward the budget */
export const PODCAST_RETRY_WINDOW_MS = 60_000;
/** max retries inside the window before we surrender to the failed UI */
export const PODCAST_RETRY_MAX_ATTEMPTS = 3;
/** minimum spacing between retries — prevents tight error→retry→error loops */
export const PODCAST_RETRY_MIN_SPACING_MS = 5_000;

/**
 * MediaError code mapping (HTML spec):
 *  1 = MEDIA_ERR_ABORTED       (user-initiated)
 *  2 = MEDIA_ERR_NETWORK       (network died mid-fetch)
 *  3 = MEDIA_ERR_DECODE        (corrupted bytes)
 *  4 = MEDIA_ERR_SRC_NOT_SUPPORTED (src 404/403/CORS rejection / wrong type)
 *
 * We retry on NETWORK + SRC_NOT_SUPPORTED only — those are the recoverable
 * "stale URL or transient route failure" cases. ABORTED is the user pausing,
 * DECODE means the file itself is broken and a refetch won't help.
 */
export const RECOVERABLE_MEDIA_ERROR_CODES: ReadonlyArray<number> = [2, 4];

export type PodcastRecoveryDecision =
	| { kind: "retry-now" }
	| { kind: "retry-after"; delayMs: number }
	| { kind: "give-up"; reason: "budget-exhausted" | "non-recoverable" };

/**
 * Decide what to do when an audio error fires for a podcast stream.
 *
 * @param errorCode - audio.error.code, or null if the element does not expose one
 * @param history   - timestamps of previous retry attempts within the window
 *                    (caller is responsible for pruning entries older than
 *                    PODCAST_RETRY_WINDOW_MS before passing in)
 * @param now       - current epoch ms (Date.now()); injected for testability
 */
export function decidePodcastRecovery(
	errorCode: number | null,
	history: ReadonlyArray<number>,
	now: number,
): PodcastRecoveryDecision {
	if (
		errorCode !== null &&
		!RECOVERABLE_MEDIA_ERROR_CODES.includes(errorCode)
	) {
		return { kind: "give-up", reason: "non-recoverable" };
	}
	if (history.length >= PODCAST_RETRY_MAX_ATTEMPTS) {
		return { kind: "give-up", reason: "budget-exhausted" };
	}
	const lastAttempt = history.length > 0 ? history[history.length - 1] : null;
	if (lastAttempt !== null) {
		const elapsed = now - lastAttempt;
		if (elapsed < PODCAST_RETRY_MIN_SPACING_MS) {
			return {
				kind: "retry-after",
				delayMs: PODCAST_RETRY_MIN_SPACING_MS - elapsed,
			};
		}
	}
	return { kind: "retry-now" };
}

/**
 * Prune a history array in-place-style (returns a new array) by dropping
 * entries older than the sliding window. Caller passes the result back as
 * the new history.
 */
export function pruneHistory(
	history: ReadonlyArray<number>,
	now: number,
	windowMs: number = PODCAST_RETRY_WINDOW_MS,
): number[] {
	const cutoff = now - windowMs;
	return history.filter((t) => t >= cutoff);
}
