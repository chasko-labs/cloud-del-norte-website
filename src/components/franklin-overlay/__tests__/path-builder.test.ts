// path-builder — pure-TS SVG path geometry tests.

import { describe, expect, it } from "vitest";

import {
	buildSilhouettePath,
	buildStarPath,
	EL_PASO_STAR_ANCHOR,
	heightToSvgY,
	RIDGE_POINTS,
	VIEWBOX_HEIGHT,
	VIEWBOX_WIDTH,
} from "../path-builder";

describe("RIDGE_POINTS", () => {
	it("includes the named summits north→south", () => {
		const names = RIDGE_POINTS.map((p) => p.name);
		expect(names).toContain("north-franklin");
		expect(names).toContain("anthonys-nose");
		expect(names).toContain("mundys-peak");
		expect(names).toContain("south-franklin");
		expect(names).toContain("ranger-peak");
		expect(names).toContain("sugarloaf");
	});

	it("control points are ordered left → right by x", () => {
		for (let i = 1; i < RIDGE_POINTS.length; i++) {
			expect(RIDGE_POINTS[i].x).toBeGreaterThan(RIDGE_POINTS[i - 1].x);
		}
	});

	it("north-franklin is the tallest summit", () => {
		const north = RIDGE_POINTS.find((p) => p.name === "north-franklin");
		expect(north).toBeDefined();
		if (!north) return;
		const summits = RIDGE_POINTS.filter((p) =>
			[
				"north-franklin",
				"anthonys-nose",
				"mundys-peak",
				"south-franklin",
				"ranger-peak",
				"sugarloaf",
			].includes(p.name),
		);
		for (const s of summits) {
			if (s.name === "north-franklin") continue;
			expect(s.h).toBeLessThan(north.h);
		}
	});

	it("north-franklin sits left-of-centre (~25% from left)", () => {
		const north = RIDGE_POINTS.find((p) => p.name === "north-franklin");
		expect(north).toBeDefined();
		if (!north) return;
		const fraction = north.x / VIEWBOX_WIDTH;
		expect(fraction).toBeGreaterThan(0.18);
		expect(fraction).toBeLessThan(0.32);
	});

	it("foothill anchor sits well above the bottom-left corner (sky visible there)", () => {
		// First control point's height must be > 0 so a triangular sky wedge
		// is exposed in the bottom-left.
		expect(RIDGE_POINTS[0].h).toBeGreaterThan(40);
	});

	it("ridge tail drops to near-zero before the right edge (sky visible top-right)", () => {
		const last = RIDGE_POINTS[RIDGE_POINTS.length - 1];
		expect(last.h).toBeLessThan(50);
	});

	it("includes the trans-mountain and loop-375 V-notches as low control points", () => {
		const trans = RIDGE_POINTS.find((p) => p.name === "trans-mountain-gap");
		const loop = RIDGE_POINTS.find((p) => p.name === "loop-375-gap");
		expect(trans).toBeDefined();
		expect(loop).toBeDefined();
		if (!trans || !loop) return;
		// The notches are low compared to the peaks they sit between.
		const north = RIDGE_POINTS.find((p) => p.name === "north-franklin");
		if (!north) return;
		expect(trans.h).toBeLessThan(north.h * 0.6);
	});
});

describe("heightToSvgY", () => {
	it("inverts height-above-bottom to top-origin svg y", () => {
		expect(heightToSvgY(0, 250)).toBe(250);
		expect(heightToSvgY(250, 250)).toBe(0);
		expect(heightToSvgY(100, 250)).toBe(150);
	});
});

describe("buildSilhouettePath", () => {
	it("starts with a Move command (M)", () => {
		const path = buildSilhouettePath();
		expect(path.startsWith("M")).toBe(true);
	});

	it("ends with a Close command (Z)", () => {
		const path = buildSilhouettePath();
		expect(path.trimEnd().endsWith("Z")).toBe(true);
	});

	it("uses cubic Beziers (C) between ridge points", () => {
		const path = buildSilhouettePath();
		// At least one cubic Bezier per gap between ridge points.
		const cubicCount = (path.match(/C /g) ?? []).length;
		expect(cubicCount).toBeGreaterThanOrEqual(RIDGE_POINTS.length - 1);
	});

	it("returns a non-empty string for the production point set", () => {
		const path = buildSilhouettePath();
		expect(path.length).toBeGreaterThan(100);
	});

	it("returns a fallback flat-ground path for degenerate input", () => {
		const path = buildSilhouettePath([], VIEWBOX_WIDTH, VIEWBOX_HEIGHT);
		expect(path).toContain("M 0");
		expect(path.trimEnd().endsWith("Z")).toBe(true);
	});

	it("respects custom viewBox dimensions", () => {
		const path = buildSilhouettePath(RIDGE_POINTS, 500, 100);
		// The closing bottom-right corner should be at x=500.
		expect(path).toContain("L 500");
	});
});

describe("buildStarPath", () => {
	it("returns a 10-vertex closed pentagram path (M + 9 L + Z)", () => {
		const path = buildStarPath(100, 100, 20);
		expect(path.startsWith("M")).toBe(true);
		expect(path.trimEnd().endsWith("Z")).toBe(true);
		const lineCount = (path.match(/ L /g) ?? []).length;
		expect(lineCount).toBe(9);
	});

	it("the first vertex points up (top of the star)", () => {
		const path = buildStarPath(100, 100, 20);
		// First vertex is at angle -π/2 → x=cx+0, y=cy-radius.
		// Path starts "M 100.000 80.000 ..."
		expect(path).toMatch(/^M 100\.000 80\.000/);
	});

	it("inner-radius vertices sit closer to the centre than outer", () => {
		const cx = 0;
		const cy = 0;
		const r = 10;
		const path = buildStarPath(cx, cy, r);
		// Parse out the numeric coords — pull every "x y" pair.
		const coords = [...path.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map(
			(m) => [Number.parseFloat(m[1]), Number.parseFloat(m[2])] as const,
		);
		// 10 vertices alternating outer / inner. Outer distance == r,
		// inner distance == r * 0.382.
		for (let i = 0; i < coords.length; i++) {
			const [x, y] = coords[i];
			const dist = Math.hypot(x - cx, y - cy);
			if (i % 2 === 0) {
				expect(dist).toBeCloseTo(r, 2);
			} else {
				expect(dist).toBeCloseTo(r * 0.382, 2);
			}
		}
	});
});

describe("EL_PASO_STAR_ANCHOR", () => {
	it("sits south-east of the South Franklin apex (south face of the peak)", () => {
		const south = RIDGE_POINTS.find((p) => p.name === "south-franklin");
		expect(south).toBeDefined();
		if (!south) return;
		// Star anchor x is east of (greater than) the south-franklin apex x.
		expect(EL_PASO_STAR_ANCHOR.cx).toBeGreaterThan(south.x);
		// And it sits below the peak apex height-wise (cy is bigger = lower
		// on the screen than the apex's svg y coordinate).
		const apexY = heightToSvgY(south.h, VIEWBOX_HEIGHT);
		expect(EL_PASO_STAR_ANCHOR.cy).toBeGreaterThan(apexY);
	});

	it("has a positive radius", () => {
		expect(EL_PASO_STAR_ANCHOR.radius).toBeGreaterThan(0);
	});
});
