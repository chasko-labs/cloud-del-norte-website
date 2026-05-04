// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Per-page-load shuffled view of STREAMS.
 *
 * The canonical order in `streams.ts` is alphabetical / language-grouped
 * (English first, then Spanish) — useful as a source of truth but produces
 * a monotonous "always start with KEXP/KRUX" experience for listeners.
 *
 * This module shuffles the canonical array ONCE at import time (= once per
 * page load) and exports the shuffled array as `STREAMS`. Module-level
 * constants run exactly once per JS module instance, so both consumers
 * (KruxPlayer in feed/app.tsx + PersistentPlayer) see the same per-session
 * order — their carousel + station-key lookups stay in sync.
 *
 * Reload the page to reshuffle. Per-station lookup uses `key` not array
 * index, so sessionStorage continuity is preserved across the shuffle.
 */

import { STREAMS as CANONICAL_STREAMS, type StreamDef } from "./streams";

function shuffleOnce(arr: readonly StreamDef[]): StreamDef[] {
	const copy = arr.filter((s) => !s.hidden);
	// Fisher-Yates in-place, O(n)
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export const STREAMS: readonly StreamDef[] = shuffleOnce(CANONICAL_STREAMS);
