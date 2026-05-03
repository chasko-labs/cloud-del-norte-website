// franklin-overlay/path-builder — pure-TS SVG path geometry for the static
// Franklin Mountains silhouette. Replaces the retired BabylonJS franklin scene
// with a single static <path> overlay drawn over the canvas-2D dark layer.
//
// Coordinate system: SVG viewBox is 1000 × 250 (4:1 ridge band). x grows L→R,
// y grows top→bottom. y=0 is the sky, y=250 is below the viewport bottom.
// preserveAspectRatio="xMidYMax slice" so the path covers the full viewport
// width and the rightmost / leftmost edges may crop on narrow viewports.
//
// Geometry approach: a fixed sequence of named control points (apexes,
// saddles, gap notch bottoms) authored by hand from the peak data in the
// retired franklin-features.ts. Each segment between control points is a
// smoothed Bezier (cubic) so the silhouette reads as eroded sedimentary rock
// rather than a tent. Bryan's design constraints:
//   - foothills slope OFF the bottom-left (start above the bottom-left corner
//     so a triangular sky gap is visible there)
//   - North Franklin (the tallest peak) is left-of-centre at ~25% across
//   - peaks descend southward (Anthonys Nose, Mundys, South Franklin, Ranger,
//     Sugarloaf) with V-notch transverse-fault gaps between them
//   - after Sugarloaf the ridge falls to near-zero before the right edge so
//     stars in the top-right corner remain visible
//   - El Paso Star sits on the south face of South Franklin (point #5)

export const VIEWBOX_WIDTH = 1000;
export const VIEWBOX_HEIGHT = 250;

/** Named control points along the ridge — y values are heights ABOVE the
 *  viewport bottom (we invert when emitting SVG y coords). x is in viewBox px. */
export interface RidgePoint {
	name: string;
	x: number;
	/** Height above bottom — 0 means at the bottom edge, 250 means top of viewBox. */
	h: number;
}

/**
 * Ridge control points, north→south. First point sits ABOVE the bottom-left
 * corner so the foothills slope off-screen to the left (sky visible in the
 * bottom-left corner per Bryan's brief). Heights are tuned so North Franklin
 * is the tallest and the ridge descends, with notch points (low h) between
 * named summits to create the V-shaped transverse-fault gaps.
 */
export const RIDGE_POINTS: readonly RidgePoint[] = [
	// Foothill anchor — above the bottom-left corner, ridge slopes DOWN to
	// the left edge from here so a triangular sky wedge is exposed.
	{ name: "foothill-anchor", x: 30, h: 70 },
	// Ascending toward North Franklin — small bump (Anthonys foothill north)
	{ name: "north-saddle", x: 130, h: 110 },
	// North Franklin — tallest, ~25% from left (left-of-centre per brief)
	{ name: "north-franklin", x: 240, h: 230 },
	// Trans-Mountain Rd transverse-fault gap (V-notch between N. Franklin
	// and Anthonys Nose)
	{ name: "trans-mountain-gap", x: 310, h: 95 },
	// Anthonys Nose — secondary peak south of N. Franklin
	{ name: "anthonys-nose", x: 380, h: 175 },
	// Saddle between Anthonys and Mundys
	{ name: "anthonys-mundys-saddle", x: 440, h: 120 },
	// Mundys Peak — second-tallest in the ridge
	{ name: "mundys-peak", x: 500, h: 195 },
	// Saddle into South Franklin
	{ name: "mundys-south-saddle", x: 565, h: 105 },
	// South Franklin — hosts the El Paso Star on its south face
	{ name: "south-franklin", x: 630, h: 165 },
	// Loop 375 transverse-fault gap (V-notch)
	{ name: "loop-375-gap", x: 700, h: 75 },
	// Ranger Peak — smaller, southward
	{ name: "ranger-peak", x: 765, h: 130 },
	// Saddle into Sugarloaf
	{ name: "ranger-sugarloaf-saddle", x: 815, h: 80 },
	// Sugarloaf — final named summit, smaller still
	{ name: "sugarloaf", x: 860, h: 100 },
	// Drop-off after Sugarloaf — ridge falls to near-zero before the right
	// edge so the top-right corner of the viewport stays open for stars.
	{ name: "sugarloaf-tail", x: 940, h: 35 },
	{ name: "right-tail", x: 1000, h: 18 },
];

/**
 * El Paso Star anchor — on the south face of South Franklin, partway down
 * (faceFraction ≈ 0.45 in the retired franklin-features.ts EL_PASO_STAR
 * coords). We place it slightly south-east of the South Franklin apex so it
 * reads as being on the southern flank, not at the summit.
 */
export const EL_PASO_STAR_ANCHOR = {
	cx: 660,
	cy: VIEWBOX_HEIGHT - 95, // partway down the south face
	radius: 11,
} as const;

/** Convert a height-above-bottom to an SVG y-coordinate (top-origin). */
export function heightToSvgY(h: number, viewBoxHeight: number): number {
	return viewBoxHeight - h;
}

/**
 * Build the silhouette SVG path. Uses cubic Béziers between adjacent ridge
 * points with control handles biased horizontally to give a smooth eroded
 * profile — sharper near the peaks (small handle length) and wider in the
 * saddles (longer handle length) so summits read as discrete summits and
 * saddles read as soft U-shapes.
 *
 * Path topology: starts at the bottom-left corner (off-screen left for
 * preserveAspectRatio=slice), rises to the foothill anchor, traces the ridge,
 * descends to the bottom-right, and closes along the bottom. The fill renders
 * as the ground silhouette.
 */
export function buildSilhouettePath(
	points: readonly RidgePoint[] = RIDGE_POINTS,
	viewBoxWidth: number = VIEWBOX_WIDTH,
	viewBoxHeight: number = VIEWBOX_HEIGHT,
): string {
	if (points.length < 2) {
		// Degenerate — return a flat ground rectangle so the SVG never breaks.
		return `M 0 ${viewBoxHeight} L ${viewBoxWidth} ${viewBoxHeight} Z`;
	}

	const parts: string[] = [];
	// Start below the bottom-left corner — guarantees the fill closes cleanly
	// even on viewports wider than the viewBox aspect ratio.
	parts.push(`M 0 ${viewBoxHeight + 20}`);
	// Rise to the first ridge point. Going through the bottom-left corner
	// keeps the foothill triangle sky-gap intact (left side slopes UP from
	// off-screen, NOT from a flat ground).
	parts.push(`L 0 ${heightToSvgY(points[0].h * 0.45, viewBoxHeight)}`);
	parts.push(`L ${points[0].x} ${heightToSvgY(points[0].h, viewBoxHeight)}`);

	// Ridge segments — cubic Bezier between each pair, control handle length
	// = 35% of segment x-span, biased so handles sit at the same height as
	// their endpoint (gives a soft S-curve through saddles, sharp through
	// peaks — adjacent peak-saddle-peak transitions become the V-notches).
	for (let i = 1; i < points.length; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const dx = curr.x - prev.x;
		const handleLen = dx * 0.35;
		const c1x = prev.x + handleLen;
		const c1y = heightToSvgY(prev.h, viewBoxHeight);
		const c2x = curr.x - handleLen;
		const c2y = heightToSvgY(curr.h, viewBoxHeight);
		const ex = curr.x;
		const ey = heightToSvgY(curr.h, viewBoxHeight);
		parts.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`);
	}

	// Close the shape via bottom-right and bottom-left.
	parts.push(`L ${viewBoxWidth} ${viewBoxHeight + 20}`);
	parts.push("Z");
	return parts.join(" ");
}

/**
 * Build a 5-pointed star SVG path centred at (cx, cy) with the given outer
 * radius. The inner radius is fixed at 0.382 × outer (golden-ratio standard
 * pentagram inner radius) which gives a classic 5-pointed star.
 *
 * Used for the El Paso "Star on the Mountain" landmark — a single immovable
 * pentagram on the south face of South Franklin.
 */
export function buildStarPath(
	cx: number,
	cy: number,
	outerRadius: number,
): string {
	const innerRadius = outerRadius * 0.382;
	const points: string[] = [];
	// 10 vertices alternating outer/inner. Start at the top (-π/2) so the
	// star points up.
	for (let i = 0; i < 10; i++) {
		const angle = -Math.PI / 2 + (i * Math.PI) / 5;
		const r = i % 2 === 0 ? outerRadius : innerRadius;
		const x = cx + Math.cos(angle) * r;
		const y = cy + Math.sin(angle) * r;
		points.push(`${x.toFixed(3)} ${y.toFixed(3)}`);
	}
	return `M ${points[0]} L ${points.slice(1).join(" L ")} Z`;
}
