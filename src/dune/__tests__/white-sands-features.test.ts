// White Sands feature tunables — pure-math validation, no Babylon dependency.

import { describe, expect, it } from "vitest";

import {
	DEFAULT_FIELD_COMPOSITION,
	GYPSUM_WASH_STRENGTH,
	GYPSUM_WASH_THRESHOLD,
	HAZE_BAND_BOTTOM_OPACITY,
	HAZE_BAND_MID_OPACITY,
	HAZE_BAND_TOP_OPACITY,
	isValidComposition,
	MIGRATION_SPEED_MULTIPLIER,
	RIPPLE_AMPLITUDE,
	RIPPLE_FREQUENCY,
	regionWeights,
	WIND_DIR,
} from "../white-sands-features.js";

describe("white-sands-features constants", () => {
	it("WIND_DIR is normalized along +X", () => {
		const [x, y] = WIND_DIR;
		expect(Math.hypot(x, y)).toBeCloseTo(1, 5);
		expect(x).toBeGreaterThan(0);
	});

	it("MIGRATION_SPEED_MULTIPLIER pushes drift faster than baseline", () => {
		// Bryan: "faster than 10 ft/year for web". Original drift coef was 0.012;
		// this multiplier scales it. Anything ≥ 1 is valid; we picked 3x.
		expect(MIGRATION_SPEED_MULTIPLIER).toBeGreaterThanOrEqual(2);
		expect(MIGRATION_SPEED_MULTIPLIER).toBeLessThanOrEqual(6);
	});

	it("RIPPLE_FREQUENCY is high enough to read as ripples not waves", () => {
		// Ripples should cycle many times across the dune ground. Below ~80 they
		// read as macroscopic waves; above ~300 they alias on integrated GPUs.
		expect(RIPPLE_FREQUENCY).toBeGreaterThan(80);
		expect(RIPPLE_FREQUENCY).toBeLessThan(300);
	});

	it("RIPPLE_AMPLITUDE stays subtle (under 5%)", () => {
		// Ripples should tint the surface, never dominate it.
		expect(RIPPLE_AMPLITUDE).toBeGreaterThan(0);
		expect(RIPPLE_AMPLITUDE).toBeLessThan(0.05);
	});

	it("GYPSUM_WASH_STRENGTH is brand-respectful (~20% per spec)", () => {
		// Bryan: "20% white wash" — accept 15-30%.
		expect(GYPSUM_WASH_STRENGTH).toBeGreaterThan(0.15);
		expect(GYPSUM_WASH_STRENGTH).toBeLessThan(0.3);
	});

	it("GYPSUM_WASH_THRESHOLD only fires on highly-lit fragments", () => {
		// Threshold is on lambert; below 0.5 the wash would bleed into midtone.
		expect(GYPSUM_WASH_THRESHOLD).toBeGreaterThanOrEqual(0.6);
		expect(GYPSUM_WASH_THRESHOLD).toBeLessThan(1);
	});

	it("HAZE_BAND opacity ramps from top→bottom in expected direction", () => {
		// Top: transparent, mid: densest, bottom: partial. This shape sells
		// horizon haze that builds toward the dune line and softens near ground.
		expect(HAZE_BAND_TOP_OPACITY).toBeLessThan(HAZE_BAND_MID_OPACITY);
		expect(HAZE_BAND_BOTTOM_OPACITY).toBeLessThan(HAZE_BAND_MID_OPACITY);
		expect(HAZE_BAND_TOP_OPACITY).toBeGreaterThanOrEqual(0);
		expect(HAZE_BAND_MID_OPACITY).toBeLessThanOrEqual(1);
	});
});

describe("DEFAULT_FIELD_COMPOSITION", () => {
	it("is valid (all amps finite + non-negative)", () => {
		expect(isValidComposition(DEFAULT_FIELD_COMPOSITION)).toBe(true);
	});

	it("has transverse > barchan > parabolic > dome (visual-emphasis order)", () => {
		// Transverse ridges dominate the silhouette; barchan crescents the
		// mid-detail; parabolic at edges; dome smallest. Per White Sands research.
		const c = DEFAULT_FIELD_COMPOSITION;
		expect(c.transverseAmp).toBeGreaterThan(c.barchanAmp);
		expect(c.barchanAmp).toBeGreaterThan(c.parabolicAmp);
		expect(c.parabolicAmp).toBeGreaterThan(c.domeAmp);
	});

	it("rejects negative + NaN amplitudes", () => {
		expect(
			isValidComposition({
				domeAmp: -0.1,
				barchanAmp: 1,
				transverseAmp: 1,
				parabolicAmp: 1,
			}),
		).toBe(false);
		expect(
			isValidComposition({
				domeAmp: Number.NaN,
				barchanAmp: 1,
				transverseAmp: 1,
				parabolicAmp: 1,
			}),
		).toBe(false);
		expect(
			isValidComposition({
				domeAmp: Number.POSITIVE_INFINITY,
				barchanAmp: 1,
				transverseAmp: 1,
				parabolicAmp: 1,
			}),
		).toBe(false);
	});
});

describe("regionWeights", () => {
	it("returns finite weights at all sampled points across the field", () => {
		// Sample a 7×5 grid spanning the 60×40 ground plane.
		for (let i = 0; i < 7; i++) {
			for (let j = 0; j < 5; j++) {
				const x = -30 + (60 * i) / 6;
				const z = -20 + (40 * j) / 4;
				const w = regionWeights(x, z);
				expect(Number.isFinite(w.dome)).toBe(true);
				expect(Number.isFinite(w.barchan)).toBe(true);
				expect(Number.isFinite(w.transverse)).toBe(true);
				expect(Number.isFinite(w.parabolic)).toBe(true);
			}
		}
	});

	it("dome dominates upwind edge (low x)", () => {
		const upwind = regionWeights(-28, 0);
		const downwind = regionWeights(28, 0);
		expect(upwind.dome).toBeGreaterThan(downwind.dome);
	});

	it("parabolic dominates downwind edge (high x)", () => {
		const upwind = regionWeights(-28, 0);
		const downwind = regionWeights(28, 0);
		expect(downwind.parabolic).toBeGreaterThan(upwind.parabolic);
	});

	it("barchan + transverse peak in mid-field", () => {
		const mid = regionWeights(0, 0);
		const upwind = regionWeights(-28, 0);
		const downwind = regionWeights(28, 0);
		expect(mid.barchan).toBeGreaterThan(upwind.barchan);
		expect(mid.barchan).toBeGreaterThan(downwind.barchan);
		expect(mid.transverse).toBeGreaterThan(upwind.transverse);
	});

	it("all weights stay in [0, 1]", () => {
		for (let i = 0; i < 11; i++) {
			const x = -30 + 6 * i;
			const w = regionWeights(x, 0);
			for (const v of [w.dome, w.barchan, w.transverse, w.parabolic]) {
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(1);
			}
		}
	});
});
