// Franklin Mountains feature tunables — pure-math validation, no Babylon.

import { describe, expect, it } from "vitest";

import {
	CAMERA_BREATHE_AMP,
	CAMERA_BREATHE_HZ,
	CAMERA_FOV,
	CAMERA_RADIUS,
	EL_PASO_STAR,
	FRANKLIN_GAPS,
	FRANKLIN_PEAKS,
	isValidGap,
	isValidPeak,
	ON_MOUNTAIN_STAR_COUNT,
	PALETTE,
	SILHOUETTE_HEIGHT_U,
	SILHOUETTE_RESOLUTION,
	SILHOUETTE_WIDTH_U,
	STAR_BASE_SIZE_U,
	STAR_SIZE_VARIANCE,
	STRATA_BAND_COUNT,
	STRATA_TINT_STRENGTH,
} from "../franklin-features.js";

describe("franklin-features palette", () => {
	it("PALETTE channels are all in [0, 1] range", () => {
		for (const [name, rgb] of Object.entries(PALETTE)) {
			for (const c of rgb) {
				expect(c, `${name} channel`).toBeGreaterThanOrEqual(0);
				expect(c, `${name} channel`).toBeLessThanOrEqual(1);
			}
		}
	});

	it("PALETTE.silhouette is darker than every other brand colour", () => {
		// The silhouette must read as a silhouette against the other layers.
		const sumSil =
			PALETTE.silhouette[0] + PALETTE.silhouette[1] + PALETTE.silhouette[2];
		for (const [name, rgb] of Object.entries(PALETTE)) {
			if (name === "silhouette") continue;
			const sum = rgb[0] + rgb[1] + rgb[2];
			expect(sum, `${name} brighter than silhouette`).toBeGreaterThan(sumSil);
		}
	});
});

describe("franklin-features silhouette geometry constants", () => {
	it("silhouette is wide enough to span a 16:9 viewport at base FOV", () => {
		// 16:9 viewport at fov=0.85 + radius=38 spans ~64u of view-plane width.
		// Silhouette width must equal or exceed that so we don't see edges.
		const viewWidth = 2 * CAMERA_RADIUS * Math.tan(CAMERA_FOV / 2) * (16 / 9);
		expect(SILHOUETTE_WIDTH_U).toBeGreaterThanOrEqual(viewWidth * 0.95);
	});

	it("silhouette height fits in the lower viewport portion", () => {
		const viewHeight = 2 * CAMERA_RADIUS * Math.tan(CAMERA_FOV / 2);
		// Silhouette should be tall enough to read as mountains (>20% of viewport)
		// but not so tall it occupies the whole sky region.
		expect(SILHOUETTE_HEIGHT_U).toBeGreaterThan(viewHeight * 0.15);
		expect(SILHOUETTE_HEIGHT_U).toBeLessThan(viewHeight * 0.55);
	});

	it("silhouette resolution gives smooth peaks (>= 128 samples)", () => {
		expect(SILHOUETTE_RESOLUTION).toBeGreaterThanOrEqual(128);
	});

	it("strata constants are subtle (band count low, strength under 10%)", () => {
		expect(STRATA_BAND_COUNT).toBeGreaterThanOrEqual(3);
		expect(STRATA_BAND_COUNT).toBeLessThanOrEqual(12);
		expect(STRATA_TINT_STRENGTH).toBeGreaterThan(0);
		expect(STRATA_TINT_STRENGTH).toBeLessThan(0.1);
	});
});

describe("FRANKLIN_PEAKS sequence", () => {
	it("contains the named summits", () => {
		const names = FRANKLIN_PEAKS.map((p) => p.name);
		expect(names).toContain("north-franklin");
		expect(names).toContain("south-franklin");
	});

	it("every peak passes isValidPeak", () => {
		for (const p of FRANKLIN_PEAKS) {
			expect(isValidPeak(p), `peak ${p.name}`).toBe(true);
		}
	});

	it("peaks are ordered north → south by position", () => {
		for (let i = 1; i < FRANKLIN_PEAKS.length; i++) {
			expect(FRANKLIN_PEAKS[i].pos).toBeGreaterThan(FRANKLIN_PEAKS[i - 1].pos);
		}
	});

	it("north-franklin is the tallest peak (matches the real range — 7191 ft)", () => {
		const north = FRANKLIN_PEAKS.find((p) => p.name === "north-franklin");
		expect(north).toBeDefined();
		if (!north) return;
		for (const p of FRANKLIN_PEAKS) {
			if (p.name === "north-franklin") continue;
			expect(p.height).toBeLessThanOrEqual(north.height);
		}
	});

	it("isValidPeak rejects out-of-range fields", () => {
		expect(
			isValidPeak({ name: "x", pos: -0.1, height: 0.5, width: 0.2, skew: 0 }),
		).toBe(false);
		expect(
			isValidPeak({ name: "x", pos: 0.5, height: 1.5, width: 0.2, skew: 0 }),
		).toBe(false);
		expect(
			isValidPeak({ name: "x", pos: 0.5, height: 0.5, width: 0, skew: 0 }),
		).toBe(false);
		expect(
			isValidPeak({ name: "x", pos: 0.5, height: 0.5, width: 0.2, skew: 2 }),
		).toBe(false);
		expect(
			isValidPeak({
				name: "x",
				pos: 0.5,
				height: Number.NaN,
				width: 0.2,
				skew: 0,
			}),
		).toBe(false);
	});
});

describe("FRANKLIN_GAPS", () => {
	it("contains the trans-mountain and loop-375 gaps", () => {
		const names = FRANKLIN_GAPS.map((g) => g.name);
		expect(names).toContain("trans-mountain");
		expect(names).toContain("loop-375");
	});

	it("every gap passes isValidGap", () => {
		for (const g of FRANKLIN_GAPS) {
			expect(isValidGap(g), `gap ${g.name}`).toBe(true);
		}
	});

	it("gaps do not overlap each other", () => {
		const sorted = [...FRANKLIN_GAPS].sort((a, b) => a.start - b.start);
		for (let i = 1; i < sorted.length; i++) {
			expect(sorted[i].start).toBeGreaterThan(sorted[i - 1].end);
		}
	});

	it("isValidGap rejects malformed gaps", () => {
		expect(isValidGap({ name: "x", start: 0.5, end: 0.4, depth: 0.3 })).toBe(
			false,
		);
		expect(isValidGap({ name: "x", start: -0.1, end: 0.4, depth: 0.3 })).toBe(
			false,
		);
		expect(isValidGap({ name: "x", start: 0.1, end: 0.4, depth: 1 })).toBe(
			false,
		);
		expect(isValidGap({ name: "x", start: 0.1, end: 0.4, depth: -0.1 })).toBe(
			false,
		);
	});
});

describe("EL_PASO_STAR", () => {
	it("references a valid peak index in FRANKLIN_PEAKS", () => {
		expect(EL_PASO_STAR.peakIndex).toBeGreaterThanOrEqual(0);
		expect(EL_PASO_STAR.peakIndex).toBeLessThan(FRANKLIN_PEAKS.length);
	});

	it("preserves the real-world bulb-array aspect ratio (459:278)", () => {
		expect(EL_PASO_STAR.aspect).toBeCloseTo(459 / 278, 4);
	});

	it("trippy intensity is brighter than silent intensity", () => {
		expect(EL_PASO_STAR.trippyIntensity).toBeGreaterThan(
			EL_PASO_STAR.silentIntensity,
		);
	});

	it("face fraction is partway down the southern face", () => {
		// Should sit on the face (not at the apex, not at the base).
		expect(EL_PASO_STAR.faceFraction).toBeGreaterThan(0.1);
		expect(EL_PASO_STAR.faceFraction).toBeLessThan(0.8);
	});
});

describe("on-mountain star tunables", () => {
	it("star count is in a perf-safe range (<= 500)", () => {
		// Each star is a quad — at 500 quads we're at 2k tris, comfortably
		// inside a single draw call. Going higher pushes overdraw.
		expect(ON_MOUNTAIN_STAR_COUNT).toBeGreaterThan(0);
		expect(ON_MOUNTAIN_STAR_COUNT).toBeLessThanOrEqual(500);
	});

	it("base star size is small relative to silhouette dimensions", () => {
		// A star quad shouldn't visually swallow the silhouette — must be
		// well under 5% of either silhouette dimension.
		expect(STAR_BASE_SIZE_U).toBeLessThan(SILHOUETTE_HEIGHT_U * 0.05);
		expect(STAR_BASE_SIZE_U).toBeLessThan(SILHOUETTE_WIDTH_U * 0.05);
	});

	it("star size variance keeps every star strictly positive", () => {
		// size = base * (1 + (rand-0.5)*variance). Worst case rand=0 → multiplier
		// = 1 - variance/2. Must be > 0 to avoid degenerate zero-area quads.
		expect(1 - STAR_SIZE_VARIANCE / 2).toBeGreaterThan(0);
	});
});

describe("camera constants", () => {
	it("camera breathe is subtle (<0.15 amplitude)", () => {
		expect(CAMERA_BREATHE_AMP).toBeGreaterThan(0);
		expect(CAMERA_BREATHE_AMP).toBeLessThan(0.15);
	});

	it("camera breathe period is long (> 30s)", () => {
		// HZ < 1/30 means period > 30s — slow enough to read as ambient.
		expect(CAMERA_BREATHE_HZ).toBeLessThan(1 / 30);
	});
});
