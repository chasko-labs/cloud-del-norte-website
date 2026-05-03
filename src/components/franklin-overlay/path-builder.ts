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
 *
 * NOTE on cx after the v0.0.0087 horizontal flip: the silhouette `<g>` is
 * mirrored via SVG `transform="scale(-1,1) translate(-1000,0)"`, so South
 * Franklin's apex (authored at x=630) renders visually at x=370. The star
 * sits OUTSIDE the flipped group and is authored at the already-mirrored
 * coordinate cx=340 = 1000-660 so its un-flipped logo-star geometry lands
 * on the south face of the (now visually-left) South Franklin. This keeps
 * the asymmetric logo-star points facing their original orientation rather
 * than mirroring with the silhouette.
 */
export const EL_PASO_STAR_ANCHOR = {
	cx: 340, // = 1000 - 660; pre-mirrored so the un-flipped star lands on S.F.'s south face
	cy: VIEWBOX_HEIGHT - 95, // partway down the south face
	radius: 18, // larger than the retired pentagram (11) — logo-star reads better at scale
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

// ---------------------------------------------------------------------------
// El Paso Star — composite logo-star geometry
// ---------------------------------------------------------------------------
//
// v0.0.0102 — Bryan: "currently a yellow 'straight' star, needs to be replaced
// with our theme colored logo". The previous single-path aws-orange polygon
// read as a generic yellow pentagram, not the CDN brand mark.
//
// The full brand mark (src/components/logo-svg/index.tsx, 354 paths in a
// 1024² viewBox) is a violet-dominant 5-arm starburst with white highlights,
// deep-violet shadow side, and lavender bulb tips at each arm end — one of
// which (the "hero" tip at logo coords (574,351)) is the brand's distinctive
// off-balance focal accent. Reproducing all 354 paths inline at a 30-unit
// landmark scale would add disproportionate DOM weight and the audio-reactive
// bulb animations would be too noisy as a small static landmark.
//
// Composite reduction (Option B): four geometry builders feed a small
// multi-path render in index.tsx so the franklin star reads as the CDN logo
// at distance:
//
//   1. buildStarBodyPath — the violet body. 10-vertex slim starburst, sharper
//      inner ratio (0.32) than a golden-ratio pentagram, one hero tip elongated
//      1.18×, whole burst rotated +20° clockwise so the hero tip leans
//      upper-right (matches brand mark orientation).
//   2. buildStarCorePath — a smaller concentric 10-vertex star at 0.55× the
//      outer radius. Filled aws-orange to give the warm-orange centre that
//      reads through the violet body — matches the white-hot core in the
//      brand mark where multiple arm paths overlap at the centre.
//   3. buildStarBulbTips — 5 small lavender circles at each outer arm tip.
//      The hero bulb (index 0) is rendered slightly larger and aws-orange to
//      echo the brand's cdn-bulb-tip-hero focal point.
//   4. buildStarPath (legacy) — kept as an alias of buildStarBodyPath so any
//      external import of buildStarPath continues to resolve to the body
//      geometry. The default fill cascades to violet via index.tsx.
//
// Total DOM cost: 1 body path + 1 core path + 5 circles = 7 SVG nodes
// (vs the prior 1 path, vs the canonical 354). All decorative,
// no animations — the franklin star is a static landmark, not a hero mark.

/** Geometry constants shared across the composite star builders so the body,
 *  core, and bulb tips stay in sync if someone tweaks the silhouette. */
export const STAR_INNER_RATIO = 0.32;
export const STAR_HERO_TIP_INDEX = 0;
export const STAR_HERO_TIP_SCALE = 1.18;
export const STAR_ROTATION_DEG = 20;
const STAR_ROTATION_RAD = (STAR_ROTATION_DEG * Math.PI) / 180;
/** Inner orange-core star scale — fraction of outer radius. 0.55 keeps the
 *  core visible behind the slim violet arms without bleeding past the inner
 *  vertex notches (which sit at 0.32 × outerRadius). */
export const STAR_CORE_SCALE = 0.55;
/** Bulb-tip radius — fraction of outer radius. ~12% reads as a discrete
 *  pinpoint at the 30-unit landmark scale. */
export const STAR_BULB_RADIUS_RATIO = 0.12;
/** Hero bulb is rendered 1.5× larger than peer bulbs — matches the brand
 *  mark's wider hero halo (cdn-bulb-tip-hero filter chain in logo-svg). */
export const STAR_HERO_BULB_SCALE = 1.5;

/** Compute the (x,y) of a star vertex i ∈ [0..9] given centre + outerRadius.
 *  Even indices = outer arms (with hero scale on index 0); odd = inner notch. */
function starVertex(
	cx: number,
	cy: number,
	outerRadius: number,
	i: number,
): { x: number; y: number } {
	const baseAngle = -Math.PI / 2 + (i * Math.PI) / 5;
	const angle = baseAngle + STAR_ROTATION_RAD;
	const innerRadius = outerRadius * STAR_INNER_RATIO;
	const baseR = i % 2 === 0 ? outerRadius : innerRadius;
	const r = i === STAR_HERO_TIP_INDEX ? baseR * STAR_HERO_TIP_SCALE : baseR;
	return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

/**
 * Build the violet logo-star BODY — the recognizable 5-arm slim starburst.
 * 10 vertices (5 outer arms + 5 inner notches), hero tip at index 0
 * elongated 1.18×, whole burst rotated +20° clockwise from straight up.
 */
export function buildStarBodyPath(
	cx: number,
	cy: number,
	outerRadius: number,
): string {
	const points: string[] = [];
	for (let i = 0; i < 10; i++) {
		const { x, y } = starVertex(cx, cy, outerRadius, i);
		points.push(`${x.toFixed(3)} ${y.toFixed(3)}`);
	}
	return `M ${points[0]} L ${points.slice(1).join(" L ")} Z`;
}

/**
 * Build the orange-core inner star — same 10-vertex geometry as the body but
 * scaled to STAR_CORE_SCALE × outerRadius so it sits inside the violet body
 * as a warm-orange centre. Hero asymmetry is preserved at the smaller scale
 * so the core leans the same direction as the body.
 */
export function buildStarCorePath(
	cx: number,
	cy: number,
	outerRadius: number,
): string {
	return buildStarBodyPath(cx, cy, outerRadius * STAR_CORE_SCALE);
}

/** Bulb tip descriptor — one per outer arm. `hero` flags the focal bulb. */
export interface StarBulbTip {
	cx: number;
	cy: number;
	r: number;
	hero: boolean;
}

/**
 * Build the 5 bulb-tip positions at each outer arm vertex (indices 0/2/4/6/8).
 * The hero bulb (index 0, post-rotation upper-right) gets a larger radius to
 * echo the cdn-bulb-tip-hero focal accent in the brand mark.
 */
export function buildStarBulbTips(
	cx: number,
	cy: number,
	outerRadius: number,
): readonly StarBulbTip[] {
	const baseR = outerRadius * STAR_BULB_RADIUS_RATIO;
	const tips: StarBulbTip[] = [];
	for (const i of [0, 2, 4, 6, 8]) {
		const { x, y } = starVertex(cx, cy, outerRadius, i);
		const isHero = i === STAR_HERO_TIP_INDEX;
		tips.push({
			cx: x,
			cy: y,
			r: isHero ? baseR * STAR_HERO_BULB_SCALE : baseR,
			hero: isHero,
		});
	}
	return tips;
}

/**
 * Backward-compatible alias — `buildStarPath` now resolves to the violet
 * body path. Pre-v0.0.0102 callers that imported buildStarPath continue to
 * receive a 10-vertex closed star path; the new composite is opt-in via the
 * `buildStarBodyPath` / `buildStarCorePath` / `buildStarBulbTips` trio.
 */
export function buildStarPath(
	cx: number,
	cy: number,
	outerRadius: number,
): string {
	return buildStarBodyPath(cx, cy, outerRadius);
}
