// Phase weight + palette mixing — pure-math tests, no Babylon dependency.

import { describe, expect, it } from "vitest";

import {
	computePhaseWeights,
	DUNE_PHASES,
	mixPhaseColor,
} from "../dune-colors.js";

describe("computePhaseWeights", () => {
	it("returns weights summing to 1 across the [0, 1) range", () => {
		// Sample at 41 evenly-spaced points; sum at every sample must be ~1.
		for (let i = 0; i <= 40; i++) {
			const td = i / 40;
			const w = computePhaseWeights(td);
			const sum = w.midday + w.lateAft + w.dusk + w.morning;
			expect(sum).toBeCloseTo(1, 5);
		}
	});

	it("peaks at quadrant centres", () => {
		const m = computePhaseWeights(0.0);
		expect(m.midday).toBeCloseTo(1, 5);
		expect(m.lateAft).toBeCloseTo(0, 5);
		expect(m.dusk).toBeCloseTo(0, 5);
		expect(m.morning).toBeCloseTo(0, 5);

		const l = computePhaseWeights(0.25);
		expect(l.lateAft).toBeCloseTo(1, 5);

		const d = computePhaseWeights(0.5);
		expect(d.dusk).toBeCloseTo(1, 5);

		const r = computePhaseWeights(0.75);
		expect(r.morning).toBeCloseTo(1, 5);
	});

	it("midpoint between two quadrants splits weight evenly", () => {
		// Halfway between midday (0.0) and lateAft (0.25) is 0.125 → 0.5/0.5.
		const w = computePhaseWeights(0.125);
		expect(w.midday).toBeCloseTo(0.5, 4);
		expect(w.lateAft).toBeCloseTo(0.5, 4);
		expect(w.dusk).toBeCloseTo(0, 5);
		expect(w.morning).toBeCloseTo(0, 5);
	});

	it("wraps continuously across td=0/1 boundary", () => {
		// td just under 1 should be near identical to td just over 0 (mod 1).
		const before = computePhaseWeights(0.999);
		const after = computePhaseWeights(0.001);
		expect(before.midday).toBeCloseTo(after.midday, 2);
		expect(before.lateAft).toBeCloseTo(after.lateAft, 2);
		expect(before.dusk).toBeCloseTo(after.dusk, 2);
		expect(before.morning).toBeCloseTo(after.morning, 2);
	});

	it("handles negative timeOfDay via modulo wrap", () => {
		const a = computePhaseWeights(0.25);
		const b = computePhaseWeights(-0.75); // -0.75 + 1 = 0.25
		expect(a.lateAft).toBeCloseTo(b.lateAft, 5);
	});
});

describe("mixPhaseColor", () => {
	it("returns the midday stop when phase is pure midday", () => {
		const out: [number, number, number] = [0, 0, 0];
		mixPhaseColor(
			out,
			{ midday: 1, lateAft: 0, dusk: 0, morning: 0 },
			(p) => p.peak,
		);
		expect(out[0]).toBeCloseTo(DUNE_PHASES.midday.peak[0], 5);
		expect(out[1]).toBeCloseTo(DUNE_PHASES.midday.peak[1], 5);
		expect(out[2]).toBeCloseTo(DUNE_PHASES.midday.peak[2], 5);
	});

	it("interpolates linearly between two phases", () => {
		const out: [number, number, number] = [0, 0, 0];
		mixPhaseColor(
			out,
			{ midday: 0.5, lateAft: 0.5, dusk: 0, morning: 0 },
			(p) => p.shadow,
		);
		const expected0 =
			DUNE_PHASES.midday.shadow[0] * 0.5 + DUNE_PHASES.lateAft.shadow[0] * 0.5;
		expect(out[0]).toBeCloseTo(expected0, 5);
	});

	it("brand peak axis stays in the cream family at every phase centre", () => {
		// Each peak channel should be > 0.9 (cream brightness floor) and the
		// max channel - min channel < 0.1 (cream is near-neutral).
		for (const phase of [
			DUNE_PHASES.midday,
			DUNE_PHASES.lateAft,
			DUNE_PHASES.dusk,
			DUNE_PHASES.morning,
		]) {
			expect(Math.min(...phase.peak)).toBeGreaterThan(0.9);
			expect(Math.max(...phase.peak) - Math.min(...phase.peak)).toBeLessThan(
				0.1,
			);
		}
	});
});
