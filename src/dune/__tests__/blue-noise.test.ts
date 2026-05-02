// Blue-noise generator — pure-math test, no Babylon.

import { describe, expect, it } from "vitest";

import { BLUE_NOISE_SIZE, generateBlueNoise } from "../blue-noise.js";

describe("generateBlueNoise", () => {
	it("returns a 64×64 byte array", () => {
		const data = generateBlueNoise();
		expect(data.length).toBe(BLUE_NOISE_SIZE * BLUE_NOISE_SIZE);
		expect(data).toBeInstanceOf(Uint8Array);
	});

	it("is deterministic across calls (fixed seed)", () => {
		const a = generateBlueNoise();
		const b = generateBlueNoise();
		expect(Array.from(a)).toEqual(Array.from(b));
	});

	it("uses the full 0..255 range broadly", () => {
		const data = generateBlueNoise();
		// Histogram across 16 bins. Every bin should have at least 1% of samples
		// — otherwise the polish loop has biased the distribution off-uniform.
		const bins = new Array(16).fill(0);
		for (const b of data) bins[Math.min(15, (b / 16) | 0)]++;
		const minBinExpected = data.length * 0.01;
		for (const count of bins) {
			expect(count).toBeGreaterThan(minBinExpected);
		}
	});

	it("has higher local variance than pure white noise on average", () => {
		// Compare mean 3×3 neighborhood diff for blue-noise vs random.
		const blue = generateBlueNoise();
		const white = new Uint8Array(blue.length);
		// Stable seed for the white reference.
		let s = 1234567;
		for (let i = 0; i < white.length; i++) {
			s = (s * 1664525 + 1013904223) | 0;
			white[i] = (s >>> 0) % 256;
		}
		expect(meanNeighborDiff(blue)).toBeGreaterThan(meanNeighborDiff(white));
	});
});

function meanNeighborDiff(data: Uint8Array): number {
	let sum = 0;
	let n = 0;
	for (let y = 0; y < BLUE_NOISE_SIZE; y++) {
		for (let x = 0; x < BLUE_NOISE_SIZE - 1; x++) {
			const a = data[y * BLUE_NOISE_SIZE + x];
			const b = data[y * BLUE_NOISE_SIZE + x + 1];
			sum += Math.abs(a - b);
			n++;
		}
	}
	return sum / n;
}
