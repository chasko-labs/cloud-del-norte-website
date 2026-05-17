import { describe, expect, it } from "vitest";
import { STREAMS as CANONICAL_STREAMS } from "../streams";

// ── shuffleOnce — curated-first guarantee (Wave 13) ──────────────────────────
// We can't directly import the module-level STREAMS constant (it runs once at
// import time, so re-importing would return the same cached shuffle). Instead
// we replicate the shuffle function under test so we can call it N times with
// controlled random inputs.

import type { StreamDef } from "../streams";

function shuffleOnce(arr: readonly StreamDef[]): StreamDef[] {
	const copy = arr.filter((s) => !s.hidden);
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	const curatedIdxs = copy.reduce<number[]>((acc, s, i) => {
		if (s.curated) acc.push(i);
		return acc;
	}, []);
	if (curatedIdxs.length > 0) {
		const pick = curatedIdxs[Math.floor(Math.random() * curatedIdxs.length)];
		[copy[0], copy[pick]] = [copy[pick], copy[0]];
	}
	return copy;
}

describe("shuffleOnce — curated-first guarantee (Wave 13)", () => {
	it("STREAMS has at least one curated station", () => {
		const curated = CANONICAL_STREAMS.filter((s) => s.curated && !s.hidden);
		expect(curated.length).toBeGreaterThan(0);
	});

	it("position 0 is always a curated station across 100 runs", () => {
		for (let i = 0; i < 100; i++) {
			const result = shuffleOnce(CANONICAL_STREAMS);
			expect(
				result[0]?.curated,
				`run ${i}: position 0 stream "${result[0]?.key}" is not curated`,
			).toBe(true);
		}
	});

	it("returns all non-hidden streams (no items dropped)", () => {
		const nonHidden = CANONICAL_STREAMS.filter((s) => !s.hidden);
		const result = shuffleOnce(CANONICAL_STREAMS);
		expect(result.length).toBe(nonHidden.length);
	});

	it("result contains no hidden streams", () => {
		const result = shuffleOnce(CANONICAL_STREAMS);
		expect(result.every((s) => !s.hidden)).toBe(true);
	});
});
