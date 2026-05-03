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
// v0.0.0113 — bryan: peaks felt too short. Heights raised across the named
// summits (north-franklin 230→245, anthonys-nose 175→195, mundys-peak
// 195→215, south-franklin 165→190, ranger-peak 130→145, sugarloaf
// 100→115). Saddles bumped modestly to keep V-notches readable. X-positions
// preserved exactly — the el paso star's horizontal slot is locked to the
// south-franklin slope and any x-shift would break its grazing alignment.
//
// Foothill-anchor h dropped 70→40 so the visually-right viewport edge (post-
// mirror this is what reads as the right side) descends gradually into the
// footer band rather than popping up to a small bump and cutting off.
export const RIDGE_POINTS: readonly RidgePoint[] = [
	// Foothill anchor — above the bottom-left corner (visually the bottom-
	// RIGHT after the mirror flip). v0.0.0113: lowered to 40 so the post-
	// mirror right viewport edge slopes gently into the footer rather than
	// terminating at a visible bump.
	{ name: "foothill-anchor", x: 30, h: 40 },
	// Ascending toward North Franklin — small bump (Anthonys foothill north)
	{ name: "north-saddle", x: 130, h: 115 },
	// North Franklin — tallest, ~25% from left (left-of-centre per brief)
	{ name: "north-franklin", x: 240, h: 245 },
	// Trans-Mountain Rd transverse-fault gap (V-notch between N. Franklin
	// and Anthonys Nose)
	{ name: "trans-mountain-gap", x: 310, h: 100 },
	// Anthonys Nose — secondary peak south of N. Franklin
	{ name: "anthonys-nose", x: 380, h: 195 },
	// Saddle between Anthonys and Mundys
	{ name: "anthonys-mundys-saddle", x: 440, h: 130 },
	// Mundys Peak — second-tallest in the ridge
	{ name: "mundys-peak", x: 500, h: 215 },
	// Saddle into South Franklin
	{ name: "mundys-south-saddle", x: 565, h: 115 },
	// South Franklin — hosts the El Paso Star on its south face
	{ name: "south-franklin", x: 630, h: 190 },
	// Loop 375 transverse-fault gap (V-notch)
	{ name: "loop-375-gap", x: 700, h: 80 },
	// Ranger Peak — smaller, southward
	{ name: "ranger-peak", x: 765, h: 145 },
	// Saddle into Sugarloaf
	{ name: "ranger-sugarloaf-saddle", x: 815, h: 85 },
	// Sugarloaf — final named summit, smaller still
	{ name: "sugarloaf", x: 860, h: 115 },
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
 * v0.0.0104 — Bryan: "the bulbs on your star look cartoonish ... its just a
 * lightbulb it shouldnt be much different than the stars behind the
 * mountain". Radius dropped from 18 → 9 so the landmark sits closer in scale
 * to the canvas-2D background twinkles. The star is a single tiny bulb on a
 * dark mountainside, not a brand showcase.
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
// v0.0.0114 — bryan: prior nudge missed the target — left arm was floating in
// open sky / overshooting the mountain. Move RIGHT and UP so the LEFT-pointing
// outer arm (vertex 8, ≈187° from x-axis) grazes the south-franklin → loop-375
// slope. cx 335→350 (right 15), cy 128→100 (up 28 ≈ 46px on a 1920 viewport).
// Bezier solution: at cy=100 the left-arm tip y ≈ 98.9; on the south-franklin
// slope bezier, y=98.9 lands at authored x≈658 → visual x≈342; tip x = cx-8.93
// → cx=350.9 → rounded to 350.
export const EL_PASO_STAR_ANCHOR = {
	cx: 350, // pre-mirrored; un-flipped star renders visually at x≈350
	cy: VIEWBOX_HEIGHT - 150, // 100 — raised so the LEFT arm tip grazes the slope
	radius: 9, // v0.0.0104: humble landmark — half the v0.0.0102 size
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
	// v0.0.0113 — gentle slope from the off-screen bottom into the foothill
	// anchor. Use a cubic Bezier (rather than two straight Ls) so the post-
	// mirror right viewport edge reads as a continuous descending ridge that
	// merges into the footer band, not a kinked V-notch at the corner.
	const firstY = heightToSvgY(points[0].h, viewBoxHeight);
	const baselineY = viewBoxHeight + 4;
	parts.push(
		`C 0 ${baselineY}, ${points[0].x * 0.5} ${firstY + 8}, ${points[0].x} ${firstY}`,
	);

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
// El Paso Star — humble lightbulb landmark (v0.0.0104)
// ---------------------------------------------------------------------------
//
// v0.0.0102 was a multi-bulb logo composite (cdn-violet body + aws-orange core
// + 5 lavender peer bulbs + 1 white hero bulb). v0.0.0103 swapped to
// purples-only but kept the same shape. Both read as a flashy brand mark.
//
// v0.0.0104 — Bryan: "the bulbs on your star look cartoonish - your going to
// need vector layers so that not all of them are on at the same time & the
// center shouldn't be solid white. remember its dark its night time its
// mountain this is just a lightbulb it shouldnt be much different than the
// stars behind the mountain".
//
// New direction (Option C — composite with staggered bulb cycle):
//   - Drop the orange/white core entirely — center is the slim violet body
//     showing through, NO solid fill at the center.
//   - Drop the hero-tip asymmetry — a humble lightbulb has no brand accent.
//     All 5 outer arms are equal radius. The slim body still reads as a
//     star-shape but quietly, not as the CDN logo.
//   - Halve the radius (18 → 9) so the landmark sits closer in scale to the
//     background canvas-2D twinkles in dark.ts.
//   - 5 small lavender bulbs at each arm tip, animated via CSS keyframes
//     with phase offsets of 1/5 cycle each so they cycle ON sequentially —
//     bulb 0 peaks at t=0, bulb 1 at t=1/5, bulb 2 at t=2/5, etc. At any
//     moment ~1 bulb is bright while the others are dim. This mirrors the
//     real El Paso Star bulbs blinking in rotation.
//   - Body opacity 0.55 baseline (set in styles.css) so the whole composite
//     sits in the visual hierarchy WITH the background stars, not above.
//   - Halo glow softened (alpha 0.3 from 0.85) — moonlit, not headlight.
//
// Geometry exports:
//   STAR_BULB_COUNT — number of bulbs (5, one per outer arm)
//   STAR_INNER_RATIO — slim-star inner notch ratio (0.32, unchanged)
//   STAR_BULB_RADIUS_RATIO — bulb circle radius vs outer radius (0.18 — bumped
//     from 0.12 because absolute pixel size matters more than ratio at the new
//     smaller landmark scale; the pinpoints would otherwise be sub-pixel)
//   STAR_ROTATION_DEG — body rotation (20°, unchanged — keeps the same
//     orientation for any external consumer that locks to it)
//
// Total DOM cost: 1 body path + 5 circles = 6 SVG nodes (was 7 in v0.0.0103).

export const STAR_INNER_RATIO = 0.32;
// v0.0.0113 — bryan: rotate ~9° clockwise from the v0.0.0112 -20° baseline so
// the upper arm leans LESS to the left (now -11°). SVG y-down convention:
// negative degree = counterclockwise, so adding +9° to -20° = -11° is a 9°
// clockwise rotation from the prior orientation.
export const STAR_ROTATION_DEG = -11;
const STAR_ROTATION_RAD = (STAR_ROTATION_DEG * Math.PI) / 180;
/** Bulb-tip radius — fraction of outer radius. Halved to 9% (was 18%) so the
 *  outer arm pinpoints are 50% smaller in rest state. Center bulb is decoupled
 *  and held at its prior absolute size via STAR_CENTER_BULB_RADIUS_RATIO. */
export const STAR_BULB_RADIUS_RATIO = 0.09;
/** Number of outer-arm bulbs. Five points = a star shape; one bulb per
 *  arm tip cycles ON in rotation via CSS keyframe phase offsets. */
export const STAR_BULB_COUNT = 5;
/** Center bulb radius — fixed at 1/3 of the PRE-halved outer bulb ratio
 *  (0.18 / 3 = 0.06) so the center stays unchanged while the outer bulbs
 *  shrink. Decoupled from STAR_BULB_RADIUS_RATIO so further outer-bulb
 *  tweaks do not accidentally resize the center. */
export const STAR_CENTER_BULB_RADIUS_RATIO = 0.06;

/** Compute the (x,y) of a star vertex i ∈ [0..9] given centre + outerRadius.
 *  Even indices = outer arms; odd = inner notches. v0.0.0104 dropped the
 *  hero-tip elongation — all outer arms are equal length now. */
function starVertex(
	cx: number,
	cy: number,
	outerRadius: number,
	i: number,
): { x: number; y: number } {
	const baseAngle = -Math.PI / 2 + (i * Math.PI) / 5;
	const angle = baseAngle + STAR_ROTATION_RAD;
	const innerRadius = outerRadius * STAR_INNER_RATIO;
	const r = i % 2 === 0 ? outerRadius : innerRadius;
	return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

/**
 * Build the violet body path — slim 5-arm star, equal arm lengths.
 * 10 vertices (5 outer arms + 5 inner notches), rotated +20° clockwise so
 * the upper arm leans upper-right (preserves orientation continuity with
 * v0.0.0103 callers). No hero-tip asymmetry — humble lightbulb, not logo.
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

/** Bulb tip descriptor — one per outer arm. `cycleIndex` ∈ [0..4] is the
 *  position in the staggered keyframe cycle so styles.css can address each
 *  bulb's phase via a CSS custom property or per-index class. */
export interface StarBulbTip {
	cx: number;
	cy: number;
	r: number;
	cycleIndex: number;
}

/**
 * Build the 5 outer-arm bulbs + 1 center bulb (v0.0.0113). The 5 outer bulbs
 * sit at vertices 0/2/4/6/8 with equal radius. The center bulb sits at
 * (cx, cy) at 1/3 the outer bulb radius and gets cycleIndex=5 — the same
 * staggered-keyframe class system as the others, so it pulses with them but
 * never in sync with any individual arm.
 */
export function buildStarBulbTips(
	cx: number,
	cy: number,
	outerRadius: number,
): readonly StarBulbTip[] {
	const r = outerRadius * STAR_BULB_RADIUS_RATIO;
	const tips: StarBulbTip[] = [];
	const outerVertices = [0, 2, 4, 6, 8];
	for (let k = 0; k < outerVertices.length; k++) {
		const i = outerVertices[k];
		const { x, y } = starVertex(cx, cy, outerRadius, i);
		tips.push({ cx: x, cy: y, r, cycleIndex: k });
	}
	// Center bulb — 1/3 the outer bulb radius, slot 5 in the staggered cycle.
	tips.push({
		cx,
		cy,
		r: outerRadius * STAR_CENTER_BULB_RADIUS_RATIO,
		cycleIndex: STAR_BULB_COUNT,
	});
	return tips;
}

/**
 * Backward-compatible alias — `buildStarPath` resolves to the body path.
 * Pre-v0.0.0102 callers continue to receive a 10-vertex closed star path.
 */
export function buildStarPath(
	cx: number,
	cy: number,
	outerRadius: number,
): string {
	return buildStarBodyPath(cx, cy, outerRadius);
}
