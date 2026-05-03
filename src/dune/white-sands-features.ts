// White Sands dune-type composition tunables.
//
// Pulled out of DuneMaterial so the shape parameters are reviewable + testable
// without spinning up Babylon. Values shipped as a single struct that the
// vertex shader receives as uniforms, NOT as inlined GLSL constants — that way
// the per-field intent (which dune type, which sub-region of the field) stays
// legible at the JS layer.
//
// White Sands National Park has a clear upwind→downwind morphology gradient:
//   dome (low circular mounds, fast)
//   barchan (crescents, horns pointing downwind)
//   transverse (long sinuous ridges perpendicular to wind)
//   parabolic (U-arms upwind, anchored by veg)
//
// We can't model all four discretely on a 60×40 ground plane without a real
// dune-instance system — but we CAN composite their characteristic frequency
// signatures into the noise field so the eye reads "different dune types in
// different bands of the field" instead of "same noise everywhere".
//
// Wind direction is +X by convention (matches the existing camera frame).
// Migration speed is faster than 10ft/year — at WALLPAPER scale a perceptible
// drift over the 90s timeOfDay loop is the visual contract.

/**
 * Wind direction (normalized 2D, plane-space).
 * +X means dunes migrate left-to-right across the viewport, which matches
 * the natural sun-rise direction on the page.
 */
export const WIND_DIR: readonly [number, number] = [1, 0];

/**
 * Migration speed multiplier on the existing time-based drift.
 * Bryan: "faster than 10 ft/year for web". Original drift was 0.012; we
 * push to ~3x for visible motion across the 90s loop.
 */
export const MIGRATION_SPEED_MULTIPLIER = 3.0;

/**
 * Wind-ripple parameters — small-scale 90°-to-wind ripples on the dune
 * surface. White Sands gypsum forms ripples perpendicular to wind, sorted
 * by grain size. We add these as a high-frequency fragment-shader bump that
 * tints the lit side without adding geometry.
 */
export const RIPPLE_FREQUENCY = 180.0; // cycles across the dune ground
export const RIPPLE_AMPLITUDE = 0.018; // tint contribution, lit side only

/**
 * Gypsum-white highlight wash. Bryan: "20% white wash on the surface lit
 * by sun-disc". We push lit-side ridge tops toward bright gypsum white but
 * never below the lambert > 0.7 threshold so shadow/midtone keep brand palette.
 */
export const GYPSUM_WASH_STRENGTH = 0.22;
export const GYPSUM_WASH_THRESHOLD = 0.7;

/**
 * Dune-type composition weights. Each is a 0..1 amplitude that scales the
 * contribution of that dune-type's noise signature to the total height.
 * Sum is NOT required to be 1 — these are additive contributions, capped by
 * the vertex shader's height clamp.
 *
 * White Sands upwind→downwind:
 *   - dome     (small, low, fast)
 *   - barchan  (crescents)
 *   - transverse (perpendicular ridges)
 *   - parabolic (U-arms)
 */
export interface DuneFieldComposition {
	/** Low-amplitude dome mounds — present everywhere, base layer. */
	domeAmp: number;
	/** Crescent barchans — mid-frequency anisotropic. */
	barchanAmp: number;
	/** Long transverse ridges — low frequency, perpendicular to wind. */
	transverseAmp: number;
	/** Parabolic U-arm hint at field edges. */
	parabolicAmp: number;
}

/** Default composition for the wallpaper scene. Tuned to read as "white sands". */
export const DEFAULT_FIELD_COMPOSITION: DuneFieldComposition = {
	domeAmp: 0.5,
	barchanAmp: 1.4,
	transverseAmp: 1.8,
	parabolicAmp: 0.7,
};

/**
 * Horizon-haze backdrop tunables. The HazeBackdrop quad is a camera-locked
 * billboard with a vertical gradient from horizon-color (top) to ground-color
 * (bottom), alpha-blended on top of the dune scene. Its purpose is to make
 * the FOG actually visible — scene fog alone isn't reading because the dune
 * mesh is bounded and the sky is a clear gradient.
 */
export const HAZE_QUAD_DISTANCE = 38; // meters in front of camera
export const HAZE_QUAD_SCALE_W = 90; // wider than the dune ground
export const HAZE_QUAD_SCALE_H = 28;
export const HAZE_BAND_TOP_OPACITY = 0.0;
export const HAZE_BAND_MID_OPACITY = 0.42;
export const HAZE_BAND_BOTTOM_OPACITY = 0.18;

/**
 * Validates a DuneFieldComposition — every amp must be finite and ≥ 0.
 * Negative amps would invert dune types into pits which is not physical;
 * NaN/Infinity would propagate into the vertex shader and blank the mesh.
 */
export function isValidComposition(c: DuneFieldComposition): boolean {
	return (
		Number.isFinite(c.domeAmp) &&
		c.domeAmp >= 0 &&
		Number.isFinite(c.barchanAmp) &&
		c.barchanAmp >= 0 &&
		Number.isFinite(c.transverseAmp) &&
		c.transverseAmp >= 0 &&
		Number.isFinite(c.parabolicAmp) &&
		c.parabolicAmp >= 0
	);
}

/**
 * Per-region weight for a 2D plane sample point. White Sands has a clear
 * spatial gradient: dome dunes upwind (low X), barchans + transverse in the
 * field interior, parabolic at the downwind edge (high X) where vegetation
 * anchors the arms.
 *
 * Returns weights in [0, 1] that scale the corresponding amp at that point.
 * The vertex shader applies these per-vertex so different bands of the field
 * read as different dune types without instancing.
 */
export function regionWeights(
	x: number,
	z: number,
): {
	dome: number;
	barchan: number;
	transverse: number;
	parabolic: number;
} {
	// Normalize x to [0, 1] across the 60u ground plane (centred at origin).
	const xn = (x + 30) / 60;
	const zn = (z + 20) / 40;
	// Smooth ramp so transitions don't read as banding.
	const smooth = (t: number): number => {
		const c = Math.max(0, Math.min(1, t));
		return c * c * (3 - 2 * c);
	};
	return {
		// Dome: strongest at upwind edge (low x), fades to mid-field
		dome: smooth(1 - xn) * 0.7 + 0.3,
		// Barchan: strongest in mid-field
		barchan: smooth(1 - Math.abs(xn - 0.5) * 2) * 0.8 + 0.2,
		// Transverse: strongest in mid-field but extends further downwind
		transverse: smooth(1 - Math.abs(xn - 0.55) * 1.6) * 0.8 + 0.2,
		// Parabolic: strongest at downwind edge (high x) and at field edges in z
		parabolic: smooth(xn) * 0.6 + smooth(Math.abs(zn - 0.5) * 2) * 0.4,
	};
}
