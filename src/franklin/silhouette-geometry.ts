// Pure-TS profile builder — turns the FRANKLIN_PEAKS + FRANKLIN_GAPS sequence
// into a 1D height profile that MountainSilhouette extrudes into a thin slab.
//
// Each peak contributes a scalene-triangle height field centered on its
// normalised position; the apex is biased by `skew` so adjacent peaks alternate
// north-leaning / south-leaning summits (matches how real ridge profiles read
// from the side — successive peaks rarely look like mirror copies). Gaps
// multiply the local sample by `depth` so the ridge dips for transverse-fault
// notches.
//
// Output is two parallel arrays: `xs` (normalised 0..1 along the ridge) and
// `ys` (normalised 0..1 height). The caller scales these by SILHOUETTE_WIDTH_U
// and SILHOUETTE_HEIGHT_U when extruding into world space.
//
// Splitting this out (as opposed to building the profile in MountainSilhouette
// directly) lets us unit-test the geometry shape — peak ordering, gap depths,
// monotonic sample x — without booting Babylon.

import {
	FRANKLIN_GAPS,
	FRANKLIN_PEAKS,
	type FranklinGap,
	type FranklinPeak,
	SILHOUETTE_RESOLUTION,
} from "./franklin-features.js";

export interface SilhouetteProfile {
	/** Normalised x-positions along the ridge, monotonically increasing 0..1. */
	xs: Float32Array;
	/** Normalised heights at each xs sample, in [0, 1]. */
	ys: Float32Array;
	/** Width in samples (mirror of SILHOUETTE_RESOLUTION). */
	resolution: number;
}

/**
 * Smooth scalene-triangle contribution at sample position `x` from a peak
 * centered at `peak.pos` with the given width and skew. Returns a height in
 * [0, peak.height]. Skew biases the apex toward one side: skew < 0 makes the
 * north (low x) flank steeper; skew > 0 makes the south (high x) flank steeper.
 *
 * Using a quadratic falloff (1 - t^2) instead of linear (1 - t) gives the
 * profile a smoother, more "rolling-hill" shape near the apex which reads as
 * eroded sedimentary rock instead of a sharp tent. The flanks still meet zero
 * at the peak's base width edge.
 */
export function peakContribution(x: number, peak: FranklinPeak): number {
	const halfWidth = peak.width / 2;
	const apex = peak.pos + peak.skew * halfWidth * 0.5;
	const dx = x - apex;
	// Different denominators on each side of the apex give the scalene shape.
	const denom =
		dx < 0
			? halfWidth + peak.skew * halfWidth * 0.4
			: halfWidth - peak.skew * halfWidth * 0.4;
	if (denom <= 0) return 0;
	const t = Math.abs(dx / denom);
	if (t >= 1) return 0;
	// Quadratic falloff — smoother than linear at the apex.
	return peak.height * (1 - t * t);
}

/**
 * Apply gap depressions to a height sample. If `x` falls inside any gap, the
 * sample is multiplied by that gap's depth. Multiple overlapping gaps stack
 * (multiplicatively) but the gaps in FRANKLIN_GAPS are non-overlapping by
 * construction.
 */
export function gapMultiplier(x: number, gaps: readonly FranklinGap[]): number {
	let mult = 1;
	for (const gap of gaps) {
		if (x >= gap.start && x <= gap.end) {
			// Smooth U-shape inside the gap — full depression at the midpoint,
			// soft ramps at the edges so the silhouette doesn't read as a square
			// notch (square notches look like 8-bit pixel art, not erosion).
			const t = (x - gap.start) / (gap.end - gap.start);
			const u = 1 - 4 * (t - 0.5) * (t - 0.5); // 0 at edges, 1 at midpoint
			const localDepth = gap.depth + (1 - gap.depth) * (1 - u);
			mult *= localDepth;
		}
	}
	return mult;
}

/**
 * Build the 1D ridge profile by sampling SILHOUETTE_RESOLUTION points across
 * the [0, 1] range. At each sample we accumulate the max contribution from
 * every peak (max, not sum — a real ridge silhouette is the upper envelope of
 * its peaks, not their additive height) then apply gap multipliers.
 *
 * Peaks are passed as a parameter so tests can inject simplified peak sets.
 * Defaults to the production FRANKLIN_PEAKS / FRANKLIN_GAPS.
 */
export function buildSilhouetteProfile(
	peaks: readonly FranklinPeak[] = FRANKLIN_PEAKS,
	gaps: readonly FranklinGap[] = FRANKLIN_GAPS,
	resolution: number = SILHOUETTE_RESOLUTION,
): SilhouetteProfile {
	const xs = new Float32Array(resolution);
	const ys = new Float32Array(resolution);
	for (let i = 0; i < resolution; i++) {
		const x = i / (resolution - 1);
		xs[i] = x;
		let h = 0;
		for (const peak of peaks) {
			const c = peakContribution(x, peak);
			if (c > h) h = c;
		}
		// Add a low base ridge so the silhouette never falls to absolute zero
		// between peaks — real Franklin ridge crest stays elevated even between
		// named summits. 0.18 normalised = ~1300ft "saddle" elevation.
		const base = 0.18;
		h = Math.max(h, base);
		// Apply gaps last — they cut the saddle-line too.
		h *= gapMultiplier(x, gaps);
		ys[i] = h;
	}
	return { xs, ys, resolution };
}

/**
 * Sample the profile at a normalised x in [0, 1]. Linear interpolation between
 * the two neighbouring samples. Useful for callers that need to place sprites
 * (e.g. the El Paso star) at an exact peak position without rebuilding the
 * profile.
 */
export function sampleProfile(profile: SilhouetteProfile, x: number): number {
	const r = profile.resolution;
	if (r === 0) return 0;
	const fx = Math.max(0, Math.min(1, x)) * (r - 1);
	const i0 = Math.floor(fx);
	const i1 = Math.min(r - 1, i0 + 1);
	const t = fx - i0;
	return profile.ys[i0] * (1 - t) + profile.ys[i1] * t;
}
