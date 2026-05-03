// silhouette-geometry — pure-math test of the ridge profile builder.

import { describe, expect, it } from "vitest";

import {
	FRANKLIN_GAPS,
	FRANKLIN_PEAKS,
	SILHOUETTE_RESOLUTION,
} from "../franklin-features.js";
import {
	buildSilhouetteProfile,
	gapMultiplier,
	peakContribution,
	sampleProfile,
} from "../silhouette-geometry.js";

describe("peakContribution", () => {
	it("returns peak.height at the apex (no skew)", () => {
		const p = {
			name: "test",
			pos: 0.5,
			height: 0.8,
			width: 0.2,
			skew: 0,
		};
		expect(peakContribution(0.5, p)).toBeCloseTo(0.8, 5);
	});

	it("returns 0 outside the peak's base width", () => {
		const p = {
			name: "test",
			pos: 0.5,
			height: 0.8,
			width: 0.2,
			skew: 0,
		};
		expect(peakContribution(0.2, p)).toBe(0);
		expect(peakContribution(0.8, p)).toBe(0);
	});

	it("falls off toward the base edges (quadratic)", () => {
		const p = {
			name: "test",
			pos: 0.5,
			height: 1.0,
			width: 0.4,
			skew: 0,
		};
		// Halfway out from apex on each side should be ~0.75 (1 - 0.5²).
		expect(peakContribution(0.4, p)).toBeCloseTo(0.75, 2);
		expect(peakContribution(0.6, p)).toBeCloseTo(0.75, 2);
	});

	it("skew biases the apex (negative = north-leaning)", () => {
		const p = {
			name: "test",
			pos: 0.5,
			height: 1.0,
			width: 0.4,
			skew: -0.5,
		};
		// Apex shifts toward lower x (north) with negative skew.
		const heightAtNominal = peakContribution(0.5, p);
		// Sample slightly north — should be higher than the centre.
		const heightSlightlyNorth = peakContribution(0.48, p);
		expect(heightSlightlyNorth).toBeGreaterThan(heightAtNominal);
	});
});

describe("gapMultiplier", () => {
	it("returns 1 when x is outside every gap", () => {
		expect(gapMultiplier(0.05, FRANKLIN_GAPS)).toBe(1);
		expect(gapMultiplier(0.5, FRANKLIN_GAPS)).toBe(1);
	});

	it("returns the gap depth at the gap midpoint", () => {
		const gap = FRANKLIN_GAPS[0];
		const mid = (gap.start + gap.end) / 2;
		// gapMultiplier at midpoint = depth + (1-depth)*(1 - 1) = depth.
		expect(gapMultiplier(mid, [gap])).toBeCloseTo(gap.depth, 4);
	});

	it("returns 1 at the gap edges (smooth U-shape, not square notch)", () => {
		const gap = FRANKLIN_GAPS[0];
		expect(gapMultiplier(gap.start, [gap])).toBeCloseTo(1, 4);
		expect(gapMultiplier(gap.end, [gap])).toBeCloseTo(1, 4);
	});

	it("smoothly ramps from 1 → depth → 1 inside the gap", () => {
		const gap = { name: "x", start: 0.4, end: 0.6, depth: 0.3 };
		const samples: number[] = [];
		for (let i = 0; i <= 10; i++) {
			const x = gap.start + ((gap.end - gap.start) * i) / 10;
			samples.push(gapMultiplier(x, [gap]));
		}
		// Should be a U: high at edges, low in middle.
		expect(samples[0]).toBeCloseTo(1, 4);
		expect(samples[5]).toBeLessThan(0.5);
		expect(samples[10]).toBeCloseTo(1, 4);
	});
});

describe("buildSilhouetteProfile", () => {
	it("returns the requested resolution", () => {
		const p = buildSilhouetteProfile();
		expect(p.resolution).toBe(SILHOUETTE_RESOLUTION);
		expect(p.xs.length).toBe(SILHOUETTE_RESOLUTION);
		expect(p.ys.length).toBe(SILHOUETTE_RESOLUTION);
	});

	it("xs are monotonically increasing across [0, 1]", () => {
		const p = buildSilhouetteProfile();
		expect(p.xs[0]).toBeCloseTo(0, 5);
		expect(p.xs[p.resolution - 1]).toBeCloseTo(1, 5);
		for (let i = 1; i < p.resolution; i++) {
			expect(p.xs[i]).toBeGreaterThan(p.xs[i - 1]);
		}
	});

	it("ys stay in [0, 1.001] (allow tiny float headroom from skewed apex)", () => {
		const p = buildSilhouetteProfile();
		for (let i = 0; i < p.resolution; i++) {
			expect(p.ys[i]).toBeGreaterThanOrEqual(0);
			expect(p.ys[i]).toBeLessThanOrEqual(1.001);
		}
	});

	it("never falls below the base ridge (~0.18) outside gaps", () => {
		const p = buildSilhouetteProfile();
		for (let i = 0; i < p.resolution; i++) {
			const x = p.xs[i];
			let inGap = false;
			for (const g of FRANKLIN_GAPS) {
				if (x >= g.start && x <= g.end) {
					inGap = true;
					break;
				}
			}
			if (!inGap) {
				expect(p.ys[i]).toBeGreaterThanOrEqual(0.17);
			}
		}
	});

	it("dips at every gap midpoint relative to its neighbours", () => {
		const p = buildSilhouetteProfile();
		for (const gap of FRANKLIN_GAPS) {
			const midX = (gap.start + gap.end) / 2;
			const midH = sampleProfile(p, midX);
			const justBeforeH = sampleProfile(p, gap.start - 0.01);
			const justAfterH = sampleProfile(p, gap.end + 0.01);
			// Mid of gap should be at most depth × neighbour height.
			expect(midH).toBeLessThan(justBeforeH);
			expect(midH).toBeLessThan(justAfterH);
		}
	});

	it("peak at north-franklin position is the tallest sample", () => {
		const p = buildSilhouetteProfile();
		const northPeak = FRANKLIN_PEAKS.find((q) => q.name === "north-franklin");
		expect(northPeak).toBeDefined();
		if (!northPeak) return;
		const northH = sampleProfile(p, northPeak.pos);
		// north-franklin should be at or near the global max (allow tiny slop
		// because the discrete sample grid may not land exactly on the apex).
		let maxH = 0;
		for (let i = 0; i < p.resolution; i++) {
			if (p.ys[i] > maxH) maxH = p.ys[i];
		}
		expect(northH).toBeGreaterThan(maxH * 0.95);
	});

	it("respects a custom resolution argument", () => {
		const p = buildSilhouetteProfile(FRANKLIN_PEAKS, FRANKLIN_GAPS, 64);
		expect(p.resolution).toBe(64);
		expect(p.xs.length).toBe(64);
	});
});

describe("sampleProfile", () => {
	it("returns y at exact sample positions", () => {
		const p = buildSilhouetteProfile();
		const midIdx = p.resolution >> 1;
		const xAtMid = p.xs[midIdx];
		expect(sampleProfile(p, xAtMid)).toBeCloseTo(p.ys[midIdx], 4);
	});

	it("clamps x outside [0, 1]", () => {
		const p = buildSilhouetteProfile();
		expect(sampleProfile(p, -1)).toBe(p.ys[0]);
		expect(sampleProfile(p, 2)).toBe(p.ys[p.resolution - 1]);
	});

	it("interpolates linearly between samples", () => {
		const p = buildSilhouetteProfile();
		// Halfway between sample 10 and 11 should be the average.
		const x10 = p.xs[10];
		const x11 = p.xs[11];
		const xMid = (x10 + x11) / 2;
		const expected = (p.ys[10] + p.ys[11]) / 2;
		expect(sampleProfile(p, xMid)).toBeCloseTo(expected, 4);
	});
});
