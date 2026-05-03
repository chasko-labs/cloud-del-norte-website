// path-builder — pure-TS SVG path geometry tests.

import { describe, expect, it } from "vitest";

import {
	buildSilhouettePath,
	buildStarBodyPath,
	buildStarBulbTips,
	buildStarPath,
	EL_PASO_STAR_ANCHOR,
	heightToSvgY,
	RIDGE_POINTS,
	STAR_BULB_COUNT,
	STAR_BULB_RADIUS_RATIO,
	STAR_INNER_RATIO,
	STAR_ROTATION_DEG,
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

describe("buildStarBodyPath", () => {
	it("returns a 10-vertex closed star path (M + 9 L + Z)", () => {
		const path = buildStarBodyPath(100, 100, 20);
		expect(path.startsWith("M")).toBe(true);
		expect(path.trimEnd().endsWith("Z")).toBe(true);
		const lineCount = (path.match(/ L /g) ?? []).length;
		expect(lineCount).toBe(9);
	});

	it("inner vertices use a sharper ratio (0.32) than a golden-ratio pentagram (0.382)", () => {
		const cx = 0;
		const cy = 0;
		const r = 10;
		const path = buildStarBodyPath(cx, cy, r);
		const coords = [...path.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map(
			(m) => [Number.parseFloat(m[1]), Number.parseFloat(m[2])] as const,
		);
		// Indices 1, 3, 5, 7, 9 are inner vertices; all sit at r * STAR_INNER_RATIO.
		for (const i of [1, 3, 5, 7, 9]) {
			const [x, y] = coords[i];
			const dist = Math.hypot(x - cx, y - cy);
			expect(dist).toBeCloseTo(r * STAR_INNER_RATIO, 2);
		}
	});

	it("v0.0.0104 — all 5 outer arms are equal length (no hero-tip asymmetry)", () => {
		// Humble lightbulb has no brand-accent arm. Outer vertices 0/2/4/6/8
		// must all sit at exactly r from the centre.
		const cx = 0;
		const cy = 0;
		const r = 10;
		const path = buildStarBodyPath(cx, cy, r);
		const coords = [...path.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map(
			(m) => [Number.parseFloat(m[1]), Number.parseFloat(m[2])] as const,
		);
		for (const i of [0, 2, 4, 6, 8]) {
			const [x, y] = coords[i];
			expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(r, 2);
		}
	});

	it("body is rotated -20° (counterclockwise) so the upper arm leans upper-left", () => {
		const cx = 0;
		const cy = 0;
		const r = 10;
		const path = buildStarBodyPath(cx, cy, r);
		const coords = [...path.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map(
			(m) => [Number.parseFloat(m[1]), Number.parseFloat(m[2])] as const,
		);
		const [hx, hy] = coords[0];
		const expectedAngle = -Math.PI / 2 + (STAR_ROTATION_DEG * Math.PI) / 180;
		expect(Math.atan2(hy - cy, hx - cx)).toBeCloseTo(expectedAngle, 3);
		// Upper-LEFT quadrant: negative x, negative y. Bryan v0.0.0112 ccw flip.
		expect(hx).toBeLessThan(0);
		expect(hy).toBeLessThan(0);
	});
});

describe("buildStarBulbTips", () => {
	it("returns exactly STAR_BULB_COUNT (5) bulb-tip descriptors", () => {
		const tips = buildStarBulbTips(0, 0, 20);
		expect(tips.length).toBe(STAR_BULB_COUNT);
		expect(STAR_BULB_COUNT).toBe(5);
	});

	it("v0.0.0104 — all bulbs are equal radius (no hero accent)", () => {
		const r = 20;
		const tips = buildStarBulbTips(0, 0, r);
		const expected = r * STAR_BULB_RADIUS_RATIO;
		for (const t of tips) {
			expect(t.r).toBeCloseTo(expected, 4);
		}
	});

	it("each bulb has a unique cycleIndex 0..4 for staggered keyframe phasing", () => {
		const tips = buildStarBulbTips(0, 0, 20);
		const indices = tips.map((t) => t.cycleIndex).sort();
		expect(indices).toEqual([0, 1, 2, 3, 4]);
	});

	it("all bulbs sit on the body's outer arm tips (distance from centre = outerRadius)", () => {
		const r = 20;
		const tips = buildStarBulbTips(0, 0, r);
		for (const t of tips) {
			expect(Math.hypot(t.cx, t.cy)).toBeCloseTo(r, 2);
		}
	});
});

describe("buildStarPath (legacy alias)", () => {
	it("resolves to the violet body path (backward-compat for pre-v0.0.0102 callers)", () => {
		const legacy = buildStarPath(50, 60, 15);
		const body = buildStarBodyPath(50, 60, 15);
		expect(legacy).toBe(body);
	});
});

describe("EL_PASO_STAR_ANCHOR", () => {
	it("sits south-east of the South Franklin apex (in pre-flip authoring coords)", () => {
		const south = RIDGE_POINTS.find((p) => p.name === "south-franklin");
		expect(south).toBeDefined();
		if (!south) return;
		// v0.0.0087: the silhouette `<g>` is mirrored via SVG transform, so
		// the star anchor is authored at the pre-mirrored x = VIEWBOX_WIDTH -
		// originalCx. The star's apparent (post-flip) position is what should
		// sit south-east of the South Franklin apex; un-flip the cx for the
		// comparison.
		const apparentCx = VIEWBOX_WIDTH - EL_PASO_STAR_ANCHOR.cx;
		expect(apparentCx).toBeGreaterThan(south.x);
		// And it sits below the peak apex height-wise (cy is bigger = lower
		// on the screen than the apex's svg y coordinate).
		const apexY = heightToSvgY(south.h, VIEWBOX_HEIGHT);
		expect(EL_PASO_STAR_ANCHOR.cy).toBeGreaterThan(apexY);
	});

	it("cx is the pre-mirrored coordinate (lands on the visually-left South Franklin)", () => {
		// After the silhouette flip, South Franklin (authored x=630) renders
		// visually around x=370. The star's authored cx should be on the
		// left half of the viewBox (< VIEWBOX_WIDTH / 2) so it lands on the
		// south face of that flipped peak rather than the right side.
		expect(EL_PASO_STAR_ANCHOR.cx).toBeLessThan(VIEWBOX_WIDTH / 2);
	});

	it("has a positive radius", () => {
		expect(EL_PASO_STAR_ANCHOR.radius).toBeGreaterThan(0);
	});

	it("v0.0.0104 — radius is small enough to read as a humble landmark, not a brand showcase", () => {
		// Pre-v0.0.0104 the radius was 18. The new humble-bulb design is
		// half that. Future tweaks above 12 would re-introduce the "logo
		// billboard" feel Bryan called out.
		expect(EL_PASO_STAR_ANCHOR.radius).toBeLessThanOrEqual(12);
	});
});
