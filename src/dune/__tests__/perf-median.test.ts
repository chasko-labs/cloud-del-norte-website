// Perf median sampler — pure-math test, no Babylon.

import { describe, expect, it } from "vitest";

import { median } from "../SceneBootstrap.js";

describe("median", () => {
	it("returns 0 for empty input", () => {
		expect(median([])).toBe(0);
	});

	it("returns the sole element for a length-1 input", () => {
		expect(median([7])).toBe(7);
	});

	it("returns the middle element for an odd-length input", () => {
		expect(median([3, 1, 2])).toBe(2);
		expect(median([10, 30, 20, 40, 50])).toBe(30);
	});

	it("returns the mean of the two middle elements for an even-length input", () => {
		expect(median([1, 2, 3, 4])).toBe(2.5);
		expect(median([10, 20, 30, 40])).toBe(25);
	});

	it("does not mutate the input array", () => {
		const samples = [3, 1, 2];
		median(samples);
		expect(samples).toEqual([3, 1, 2]);
	});

	it("handles a realistic 30-sample frame-time window", () => {
		// Synthetic frame-time samples around 6ms with a few outliers.
		const samples = [
			5.2, 6.1, 5.9, 6.4, 5.8, 6.0, 6.3, 5.5, 6.7, 5.1, 5.9, 6.2, 6.0, 5.8, 6.1,
			6.5, 5.7, 6.3, 5.9, 14.2, 6.0, 5.8, 6.2, 6.4, 5.9, 6.1, 18.7, 5.7, 6.0,
			6.3,
		];
		const m = median(samples);
		// Median should reject the 14.2 + 18.7 outliers and land near 6.05.
		expect(m).toBeGreaterThan(5.9);
		expect(m).toBeLessThan(6.2);
	});
});
