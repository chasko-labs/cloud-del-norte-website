// FranklinAnimationController — reduced-motion gating + trippy-mode ramp tests.

import { describe, expect, it } from "vitest";

import { FranklinAnimationController } from "../AnimationController.js";
import {
	CAMERA_RADIUS,
	STAR_TRIPPY_FADE_IN_S,
	STAR_TRIPPY_FADE_OUT_S,
} from "../franklin-features.js";

describe("FranklinAnimationController reduced-motion gating", () => {
	it("freezes camera radius at base", () => {
		const ac = new FranklinAnimationController({ reducedMotion: true });
		ac.update(7);
		ac.update(13);
		ac.update(60);
		expect(ac.getState().cameraRadius).toBe(CAMERA_RADIUS);
	});

	it("forces trippy opacity to 0 even when setTrippy(true)", () => {
		const ac = new FranklinAnimationController({ reducedMotion: true });
		ac.setTrippy(true);
		ac.update(STAR_TRIPPY_FADE_IN_S * 2);
		expect(ac.getState().trippyOpacity).toBe(0);
	});

	it("isReducedMotion reflects constructor", () => {
		expect(
			new FranklinAnimationController({ reducedMotion: true }).isReducedMotion(),
		).toBe(true);
		expect(
			new FranklinAnimationController({ reducedMotion: false }).isReducedMotion(),
		).toBe(false);
	});
});

describe("FranklinAnimationController active state evolution", () => {
	it("camera radius oscillates within breathe amplitude", () => {
		const ac = new FranklinAnimationController({ reducedMotion: false });
		let minR = Infinity;
		let maxR = -Infinity;
		// Step across a 50s window in 0.5s ticks.
		for (let i = 0; i < 100; i++) {
			ac.update(0.5);
			const r = ac.getState().cameraRadius;
			if (r < minR) minR = r;
			if (r > maxR) maxR = r;
		}
		// Breathe amplitude is small (0.06) — verify deviation stays inside it.
		expect(maxR - CAMERA_RADIUS).toBeLessThanOrEqual(0.07);
		expect(CAMERA_RADIUS - minR).toBeLessThanOrEqual(0.07);
	});

	it("trippy opacity ramps up over STAR_TRIPPY_FADE_IN_S after setTrippy(true)", () => {
		const ac = new FranklinAnimationController({ reducedMotion: false });
		ac.setTrippy(true);
		// Tick through the fade-in period in small steps.
		const steps = 24;
		const dt = STAR_TRIPPY_FADE_IN_S / steps;
		for (let i = 0; i < steps; i++) ac.update(dt);
		// At the end of the fade-in, opacity should be at or very near 1.
		expect(ac.getState().trippyOpacity).toBeGreaterThan(0.95);
	});

	it("trippy opacity ramps down over STAR_TRIPPY_FADE_OUT_S after setTrippy(false)", () => {
		const ac = new FranklinAnimationController({ reducedMotion: false });
		ac.setTrippy(true);
		// Reach full opacity first.
		ac.update(STAR_TRIPPY_FADE_IN_S * 1.5);
		expect(ac.getState().trippyOpacity).toBeCloseTo(1, 3);
		// Now turn it off and tick through the fade-out.
		ac.setTrippy(false);
		const steps = 24;
		const dt = STAR_TRIPPY_FADE_OUT_S / steps;
		for (let i = 0; i < steps; i++) ac.update(dt);
		expect(ac.getState().trippyOpacity).toBeLessThan(0.05);
	});

	it("trippy opacity stays in [0, 1] under all inputs", () => {
		const ac = new FranklinAnimationController({ reducedMotion: false });
		// Toggle aggressively and ensure clamp holds.
		for (let i = 0; i < 50; i++) {
			ac.setTrippy(i % 2 === 0);
			ac.update(0.3);
			const o = ac.getState().trippyOpacity;
			expect(o).toBeGreaterThanOrEqual(0);
			expect(o).toBeLessThanOrEqual(1);
		}
	});

	it("starts at trippy opacity 0 (silent state)", () => {
		const ac = new FranklinAnimationController({ reducedMotion: false });
		ac.update(0.016);
		expect(ac.getState().trippyOpacity).toBe(0);
	});

	it("timeSeconds accumulates across updates", () => {
		const ac = new FranklinAnimationController({ reducedMotion: false });
		ac.update(0.5);
		ac.update(0.5);
		ac.update(1.0);
		expect(ac.getState().timeSeconds).toBeCloseTo(2.0, 5);
	});
});
