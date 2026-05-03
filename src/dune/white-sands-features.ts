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
 *
 * v0.0.0082 audit: silent drift was not actually stopping when music played
 * — but the bass-pulse vertical scaling (±18% height) outpaced the slow
 * 0.036/s drift visually, so the eye locked onto throbbing-in-place. Fix:
 * when body.cdn-stream-playing is set, multiply by MIGRATION_PLAYING_BOOST
 * AND add bass-coupled sway via MIGRATION_BASS_SWAY so dunes roll harder in
 * sync with the bassline.
 */
export const MIGRATION_SPEED_MULTIPLIER = 3.0;

/**
 * Multiplier applied on top of MIGRATION_SPEED_MULTIPLIER when music is
 * playing. 3.0 → effective ~9x baseline drift. Bryan: dunes should roll
 * "more aggressively" in sync with the bassline.
 */
export const MIGRATION_PLAYING_BOOST = 3.0;

/**
 * Bass-coupled additive drift contribution. drift += bass * this when
 * streamPlaying. 0.04 means full-bass = +0.04/s extra drift, on top of the
 * boosted base. Eye reads as dunes lurching with each bass hit.
 */
export const MIGRATION_BASS_SWAY = 0.04;

/**
 * Wind-ripple parameters — small-scale 90°-to-wind ripples on the dune
 * surface. White Sands gypsum forms ripples perpendicular to wind, sorted
 * by grain size. We add these as a high-frequency fragment-shader bump that
 * tints the lit side without adding geometry.
 */
export const RIPPLE_FREQUENCY = 180.0; // cycles across the dune ground
export const RIPPLE_AMPLITUDE = 0.018; // tint contribution, lit side only

/**
 * Sparkle / ripple temporal scaling.
 *
 * v0.0.0082 — Bryan: "particularly the lights need to slow waaayyy down,
 * they are distracting" when silent. Quartered when no music plays; restored
 * (and slightly boosted) when streamPlaying.
 *
 * The sparkle glint phase advances at 2Hz baseline (floor(time * 2.0) in
 * the fragment shader). SPARKLE_SPEED_SILENT scales that down to 0.5Hz so
 * glints recompose every 2s instead of every 0.5s — reads as quiet
 * twinkle, not strobing.
 *
 * SPARKLE_SPEED_PLAYING boosts past 1.0 — when music is playing the field
 * "goes nuts", glints repositioning faster than baseline.
 *
 * Reduced-motion silent: SPARKLE_SPEED_REDUCED is 0 — sparkle is dropped
 * entirely (uniform forces step() threshold to 1.0 in the shader path).
 * Reduced-motion playing: damped to SPARKLE_SPEED_REDUCED_PLAYING so a
 * subtle pulse still registers without the strobe risk.
 */
export const SPARKLE_SPEED_SILENT = 0.25;
export const SPARKLE_SPEED_PLAYING = 1.5;
export const SPARKLE_SPEED_REDUCED = 0.0;
export const SPARKLE_SPEED_REDUCED_PLAYING = 0.4;

/**
 * Sparkle color palette — brand axis. When streamPlaying, the sparkle tint
 * cycles through these four colors driven by mid + treble band amplitudes.
 * Ordering: amber → aws-orange → violet → lavender. RGB triples in linear
 * 0..1 space (matches shader vec3 uniforms).
 *
 * Sources:
 *   amber       #ffbf66 (warm ridge highlight, brand cream-amber axis)
 *   aws-orange  #ff9900 (AWS brand)
 *   violet      #9060f0 (dusk violet, brand)
 *   lavender    #d7c7ee (brand lavender, used in fallback gradient)
 */
export const SPARKLE_COLOR_AMBER: readonly [number, number, number] = [
	1.0, 0.749, 0.4,
];
export const SPARKLE_COLOR_AWS_ORANGE: readonly [number, number, number] = [
	1.0, 0.6, 0.0,
];
export const SPARKLE_COLOR_VIOLET: readonly [number, number, number] = [
	0.565, 0.376, 0.941,
];
export const SPARKLE_COLOR_LAVENDER: readonly [number, number, number] = [
	0.843, 0.78, 0.933,
];

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
 * Horizon-haze backdrop tunables. The HazeBackdrop is a screen-space NDC quad
 * (vertex shader bypasses view/projection — guaranteed always-on-screen) with
 * a vertical alpha gradient. Color is a deliberately WARMER cream-peach than
 * the dune body / sky horizon stop so the haze actually READS as haze rather
 * than blending invisibly into the cream dune body.
 *
 * v0.0.0085 — escalated. Prior attempts (camera-parented quad, scene fog
 * density, dune fragment fogMix) all collapsed because horizonTint ≈ dune body
 * color (both cream). Fix: use HAZE_COLOR_WARM, raise mid-band alpha to 0.55,
 * push the alpha into the lower 60% of the viewport (where the dunes actually
 * are) so the eye sees a distinct warm haze layer at the horizon.
 *
 * HAZE_QUAD_* values retained for back-compat / tests; the screen-space rewrite
 * no longer reads them at runtime but the constants must keep shape.
 */
export const HAZE_QUAD_DISTANCE = 38; // meters in front of camera (legacy)
export const HAZE_QUAD_SCALE_W = 90; // wider than the dune ground (legacy)
export const HAZE_QUAD_SCALE_H = 28; // legacy
// v0.0.0092 — escalated again. v0.0.0085 alphas (0.55 / 0.35) STILL invisible
// in dev playwright capture: pixel-sample at viewport y=0.5 returned
// rgb(184,170,160) — warm haze quad alpha-blending against gray-mauve dune
// body did not register as peach-cream. The lavender ao-crease multiplier in
// the dune fragment shader was eating the haze contribution AFTER the mix.
// Bumped: top 0.0→0.10, mid 0.55→0.92, bottom 0.35→0.78. Combined with the
// horizon-strip pass at 0.95 + the dune-fragment haze mix moved AFTER aoTint,
// the lower 60% of the viewport is now an undeniable warm peach-cream wash.
export const HAZE_BAND_TOP_OPACITY = 0.1;
export const HAZE_BAND_MID_OPACITY = 0.92;
export const HAZE_BAND_BOTTOM_OPACITY = 0.78;

/**
 * Warm desert-morning haze color. Distinct from `horizon` palette stop —
 * pushed warmer + slightly more saturated so the haze sits ABOVE the cream
 * dune body color rather than dissolving into it. Bryan: "foggy desert
 * morning vibe" / El Paso haze.
 *
 * v0.0.0092 — pushed deeper toward saturated warm cream / almost-orange so
 * the haze cannot be confused with the cream dune body even at high alpha
 * blending. (~#ffd199 — peach with an orange undertone.)
 *
 * RGB linear 0..1.
 */
export const HAZE_COLOR_WARM: readonly [number, number, number] = [
	1.0, 0.82, 0.6,
];

/**
 * Horizon strip — second haze pass, narrow horizontal band at the dune-meets-
 * sky line. Painted ABOVE the main vertical gradient at higher alpha so the
 * horizon line itself reads as the densest haze (where atmospheric path-length
 * is longest in real-world physics). Center y in [0,1] viewport coords; height
 * is the band thickness in viewport coords.
 *
 * v0.0.0092 — peak opacity 0.5 → 0.95 so the strip behaves as a near-opaque
 * bridging band between the dune horizon line and the sky cream. Bryan's
 * "deniably obvious" requirement.
 */
export const HAZE_HORIZON_STRIP_CENTER_Y = 0.55;
export const HAZE_HORIZON_STRIP_HEIGHT = 0.18;
export const HAZE_HORIZON_STRIP_PEAK_OPACITY = 0.95;

/**
 * Wisp modulation — v0.0.0093 (Bryan: "fog is wasted in this sea of cream,
 * reimagine it"). The screen-space haze quad now multiplies its alpha by an
 * fbm noise field so the haze breaks up into floating wisps + clearings
 * rather than reading as a flat horizontal blanket. Clearings expose the
 * dune body underneath; dense bands keep their warm-peach character.
 *
 * HAZE_WISP_SCALE — fbm UV multiplier. Higher = smaller, busier wisps.
 *   Around 4-8 reads as ground-fog wisps; <2 reads as one giant blob; >12
 *   reads as static noise / dirty screen.
 * HAZE_WISP_CONTRAST — how aggressively the wisps carve through the haze.
 *   At 0 the haze stays flat (v0.0.0092 behaviour). At 0.5 the clearings
 *   drop the haze alpha to 50% of the gradient value. Above 0.7 the dunes
 *   start poking through the haze even at the densest band. 0.45 is the
 *   sweet spot — undeniably broken-up but the haze still reads as continuous.
 */
export const HAZE_WISP_SCALE = 6.0;
export const HAZE_WISP_CONTRAST = 0.45;

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
