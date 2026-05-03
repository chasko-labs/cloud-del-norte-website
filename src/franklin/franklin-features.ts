// Franklin Mountains feature tunables.
//
// Pure-TS so the geometry parameters and brand colours are reviewable and
// testable without spinning up Babylon. Mirrors the white-sands-features.ts
// pattern from the dune scene.
//
// Geometry source (Bryan): the Franklins are a 23-mile homocline tilted ~40°
// to the WEST, presenting as an isosceles-triangle prism from the north and
// south ends and as a continuous N–S ridge from the east or west. We don't
// model the full 23-mile slab — at viewport scale that would be a flat band.
// Instead we composite N peaks of varying height into a continuous silhouette
// that reads as the Franklins from the El Paso side (E/W viewing direction),
// with the elongated crest broken by the transverse-fault gaps that the real
// range has (Trans-Mountain Rd / Loop 375).
//
// Star treatment: the El Paso "Star on the Mountain" is a 459×278ft elongated
// diamond of light bulbs on the southern face. We render it as a small sprite
// near the southern peak that glows aws-orange in the silent / dusk state and
// pulses across the brand palette when audio is active.

/**
 * Brand palette — RGB 0..1 floats matching the project tokens.
 * deep-navy is the night-sky base (silent state behind the mountains).
 * violet + lavender drive the audio-reactive star animation.
 * aws-orange is the El Paso "Star on the Mountain" highlight.
 */
export const PALETTE = {
	deepNavy: [0.039, 0.039, 0.18] as const, // #0a0a2e
	violet: [0.565, 0.376, 0.941] as const, // #9060f0
	lavender: [0.843, 0.78, 0.933] as const, // #d7c7ee
	awsOrange: [1.0, 0.6, 0.0] as const, // #ff9900
	silhouette: [0.012, 0.012, 0.039] as const, // near-black, slight blue cast
} as const;

/**
 * Mountain silhouette parameters.
 *
 * The silhouette spans the full viewport width as a wide ground plane viewed
 * edge-on. peakCount is the number of named summits along the N–S ridge —
 * North Franklin (the tallest, modeled as ~1.0 normalised height), then a
 * sequence of secondary peaks that descend southward, broken by two
 * transverse-fault gaps for Trans-Mountain Rd and Loop 375.
 *
 * The geometry is built in silhouette-geometry.ts as a 1D height profile,
 * extruded into a thin slab in MountainSilhouette.ts.
 */
export const SILHOUETTE_WIDTH_U = 64; // wider than 16:9 viewport at base FOV
export const SILHOUETTE_HEIGHT_U = 12; // peak height in scene units
export const SILHOUETTE_DEPTH_U = 2; // extrusion depth (small — silhouette only)
export const SILHOUETTE_RESOLUTION = 256; // samples across the ridge

/**
 * Named peak sequence — Franklin Mountains north→south.
 * Each peak has a normalised position (0=north end, 1=south end), a height
 * (0..1, scaled by SILHOUETTE_HEIGHT_U), and a base width (in normalised
 * units of SILHOUETTE_WIDTH_U). Peak shapes are scalene triangles per Bryan's
 * E/W viewing-direction note; the asymmetry comes from peak.skew which biases
 * the apex toward the leeward side.
 */
export interface FranklinPeak {
	name: string;
	pos: number; // 0..1 along ridge
	height: number; // 0..1 normalised
	width: number; // 0..1 of total ridge width — base width at sea level
	skew: number; // -1..1 — apex bias (negative = north-leaning)
}

export const FRANKLIN_PEAKS: readonly FranklinPeak[] = [
	{ name: "north-franklin", pos: 0.18, height: 1.0, width: 0.22, skew: -0.15 },
	{ name: "anthonys-nose", pos: 0.32, height: 0.78, width: 0.16, skew: 0.1 },
	{ name: "mundys-peak", pos: 0.45, height: 0.85, width: 0.18, skew: -0.05 },
	{ name: "south-franklin", pos: 0.62, height: 0.72, width: 0.18, skew: 0.2 },
	{ name: "ranger-peak", pos: 0.78, height: 0.6, width: 0.14, skew: -0.1 },
	{ name: "sugarloaf", pos: 0.9, height: 0.45, width: 0.12, skew: 0.15 },
];

/**
 * Transverse-fault gaps. Each is a ridge position [start, end] (0..1) where
 * the silhouette dips to a fraction of the local profile height — Bryan: the
 * Franklins have transverse faults at high angles that opened the gaps for
 * Trans-Mountain Rd and Loop 375. We render two visible notches.
 */
export interface FranklinGap {
	name: string;
	start: number;
	end: number;
	depth: number; // 0..1 — fraction of local height that remains in the gap
}

export const FRANKLIN_GAPS: readonly FranklinGap[] = [
	{ name: "trans-mountain", start: 0.255, end: 0.295, depth: 0.32 },
	{ name: "loop-375", start: 0.7, end: 0.74, depth: 0.42 },
];

/**
 * Sedimentary-strata bands. Bryan called out the "candy stripe" limestone /
 * dolomite layers dipping westward. We render these as horizontal tonal bands
 * in the silhouette fragment shader — they're very subtle since the mountain
 * is a near-black silhouette against the night sky, but they hint at the
 * real geology when viewed close-up.
 */
export const STRATA_BAND_COUNT = 6;
export const STRATA_TINT_STRENGTH = 0.06; // very subtle on the dark silhouette

/**
 * El Paso "Star on the Mountain" — physical star is a 459×278 ft elongated
 * diamond of 459 bulbs on the southern face. We model it as a sprite at a
 * fixed position on south-franklin's southern face that glows aws-orange in
 * the silent state and pulses across the brand palette when audio plays.
 *
 * Position is the (peakIndex, faceFraction) — peakIndex picks which Franklin
 * peak hosts the star; faceFraction is 0..1 down from the peak apex toward
 * the base (0 = at apex, 1 = at base).
 */
export const EL_PASO_STAR = {
	peakIndex: 3, // south-franklin in FRANKLIN_PEAKS
	faceFraction: 0.42, // partway down the southern face
	sizeU: 1.6, // scene units, diamond bounding box width
	aspect: 459 / 278, // physical bulb diamond aspect ratio
	silentIntensity: 0.85, // brightness when no audio playing
	trippyIntensity: 1.6, // brightness during audio reactivity
} as const;

/**
 * On-mountain star field — instanced points distributed across the mountain
 * face. In silent state these are HIDDEN (the silhouette stays dark and the
 * stars live in the negative space behind it, painted by the canvas-2D layer
 * underneath). In trippy state they appear and pulse with audio bands.
 *
 * Distribution: stars are pre-generated in JS at a deterministic seed so
 * the visual is reproducible across page loads. Each star carries a band
 * affinity (bass / mid / treble) — that band's amplitude drives that star's
 * brightness during trippy mode.
 */
export const ON_MOUNTAIN_STAR_COUNT = 240;
export const STAR_BASE_SIZE_U = 0.14;
export const STAR_SIZE_VARIANCE = 0.5; // 0.5 → sizes in [0.5x, 1.5x]
export const STAR_TRIPPY_FADE_IN_S = 1.2; // seconds to ramp visibility on play
export const STAR_TRIPPY_FADE_OUT_S = 2.5; // seconds to ramp visibility on stop

/**
 * Camera framing. Camera is positioned to look at the mountain ridge from the
 * EAST (the El Paso city side, which is where the Star on the Mountain is
 * visible from). It sits low so the mountain reads as a tall silhouette
 * against the sky.
 */
export const CAMERA_ALPHA = -Math.PI / 2; // looking along +Z (toward the silhouette)
export const CAMERA_BETA = 1.45; // ~83° — low angle, close to horizon
export const CAMERA_RADIUS = 38; // base distance
export const CAMERA_FOV = 0.85; // wider than dune scene to fit silhouette span
export const CAMERA_BREATHE_AMP = 0.06; // very subtle radius oscillation
export const CAMERA_BREATHE_HZ = 1 / 48; // 48s period — half the dune cadence

/**
 * Validate a peak — used by silhouette-geometry to catch bad tuning at boot.
 */
export function isValidPeak(p: FranklinPeak): boolean {
	return (
		Number.isFinite(p.pos) &&
		p.pos >= 0 &&
		p.pos <= 1 &&
		Number.isFinite(p.height) &&
		p.height >= 0 &&
		p.height <= 1.001 &&
		Number.isFinite(p.width) &&
		p.width > 0 &&
		p.width <= 1 &&
		Number.isFinite(p.skew) &&
		p.skew >= -1 &&
		p.skew <= 1
	);
}

/**
 * Validate a gap — gaps must be ordered (start < end), within [0,1], and have
 * a depth in [0,1) so the silhouette never flatlines completely.
 */
export function isValidGap(g: FranklinGap): boolean {
	return (
		Number.isFinite(g.start) &&
		Number.isFinite(g.end) &&
		g.start >= 0 &&
		g.end <= 1 &&
		g.start < g.end &&
		Number.isFinite(g.depth) &&
		g.depth >= 0 &&
		g.depth < 1
	);
}
