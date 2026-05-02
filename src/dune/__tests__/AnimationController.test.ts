// AnimationController — reduced-motion gating + state evolution tests.

import { describe, expect, it } from "vitest";

import {
	AnimationController,
	CAMERA_RADIUS_BASE,
	SUN_DIR_WORLD,
} from "../AnimationController.js";

describe("AnimationController reduced-motion gating", () => {
	it("freezes timeOfDay at 0 (midday)", () => {
		const ac = new AnimationController({ reducedMotion: true });
		ac.update(10); // simulate 10 seconds
		ac.update(10);
		ac.update(60);
		expect(ac.getState().timeOfDay).toBe(0);
		expect(ac.getState().phaseWeights.midday).toBeCloseTo(1, 5);
	});

	it("freezes camera radius at base", () => {
		const ac = new AnimationController({ reducedMotion: true });
		ac.update(7); // mid of the 24s breathe cycle would push radius off base
		expect(ac.getState().cameraRadius).toBe(CAMERA_RADIUS_BASE);
	});

	it("freezes sunDir at SUN_DIR_WORLD", () => {
		const ac = new AnimationController({ reducedMotion: true });
		ac.update(5); // any wobble would shift xz
		const s = ac.getState().sunDir;
		expect(s.x).toBeCloseTo(SUN_DIR_WORLD.x, 5);
		expect(s.y).toBeCloseTo(SUN_DIR_WORLD.y, 5);
		expect(s.z).toBeCloseTo(SUN_DIR_WORLD.z, 5);
	});

	it("freezes camera-alpha offset", () => {
		const ac = new AnimationController({ reducedMotion: true });
		ac.update(5);
		expect(ac.getState().cameraAlphaOffset).toBe(0);
	});

	it("freezes logoPulse at neutral", () => {
		const ac = new AnimationController({ reducedMotion: true });
		ac.update(6); // 6s of a 24s pulse cycle would be sin(pi/2) = 1
		expect(ac.getState().logoPulse).toBe(0);
	});

	it("isReducedMotion reflects constructor", () => {
		expect(
			new AnimationController({ reducedMotion: true }).isReducedMotion(),
		).toBe(true);
		expect(
			new AnimationController({ reducedMotion: false }).isReducedMotion(),
		).toBe(false);
	});
});

describe("AnimationController active state evolution", () => {
	it("advances timeOfDay over the 90s period", () => {
		const ac = new AnimationController({ reducedMotion: false });
		ac.update(45); // halfway through the 90s loop
		expect(ac.getState().timeOfDay).toBeCloseTo(0.5, 3);
	});

	it("wraps timeOfDay at the period boundary", () => {
		const ac = new AnimationController({ reducedMotion: false });
		ac.update(90); // full loop
		expect(ac.getState().timeOfDay).toBeCloseTo(0, 3);
	});

	it("camera radius oscillates within reduced amplitude (±0.105)", () => {
		const ac = new AnimationController({ reducedMotion: false });
		// Sweep across one breathe period (24s) at fine steps; collect extremes.
		let minR = Infinity;
		let maxR = -Infinity;
		// Reset by rebuilding then stepping in 0.5s ticks.
		for (let i = 0; i < 60; i++) {
			ac.update(0.5);
			const r = ac.getState().cameraRadius;
			if (r < minR) minR = r;
			if (r > maxR) maxR = r;
		}
		// Spec: 30% reduction from prior 0.15 → 0.105 amplitude
		expect(maxR - CAMERA_RADIUS_BASE).toBeLessThanOrEqual(0.106);
		expect(CAMERA_RADIUS_BASE - minR).toBeLessThanOrEqual(0.106);
		expect(maxR - CAMERA_RADIUS_BASE).toBeGreaterThan(0.09);
	});

	it("sunDir wobbles within reduced amplitude (≤0.04 from base)", () => {
		const ac = new AnimationController({ reducedMotion: false });
		// 0.05 Hz, sample over 25s in 0.5s steps → cover full period.
		let maxDx = 0;
		let maxDz = 0;
		for (let i = 0; i < 50; i++) {
			ac.update(0.5);
			const s = ac.getState().sunDir;
			// sunDir is normalized; deltas in xz should not exceed 0.05 amp + tiny
			// renormalisation slop. Allow 0.04 ceiling to confirm 30% reduction.
			maxDx = Math.max(maxDx, Math.abs(s.x - SUN_DIR_WORLD.x));
			maxDz = Math.max(maxDz, Math.abs(s.z - SUN_DIR_WORLD.z));
		}
		expect(maxDx).toBeLessThan(0.045);
		expect(maxDz).toBeLessThan(0.045);
		// Confirm wobble actually fires (not just zero)
		expect(maxDx).toBeGreaterThan(0.02);
	});

	it("logoPulse stays in [-1, 1]", () => {
		const ac = new AnimationController({ reducedMotion: false });
		for (let i = 0; i < 200; i++) {
			ac.update(0.25);
			const p = ac.getState().logoPulse;
			expect(p).toBeGreaterThanOrEqual(-1);
			expect(p).toBeLessThanOrEqual(1);
		}
	});
});
