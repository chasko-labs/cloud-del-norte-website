// Brand-locked dune colour stops shared by sky and dune fragment shaders.
//
// Originated as inline GLSL constants in src/lib/background-viz/dune-scene.ts
// (4 colours per phase × 4 phases × 2 shaders). Hoisting here:
//   - removes ~80 lines of GLSL from each fragment shader (less ALU per pixel)
//   - guarantees sky horizon and dune aerial-haze stay locked: both shaders
//     receive a single pre-mixed Color3 uniform, computed once per frame in JS
//   - lets the brand palette be reviewed in TS not GLSL (#faf7f0 etc.)
//
// Brand axis (NEVER blinding white, NEVER saturated yellow, NEVER black):
//   peaks   — warm-cream #faf7f0 / cooler-cream / lavender-cream / warm-cream
//   shadow  — cream + lavender tint replacing the older warm-tan axis
//   sun     — tungsten / pale-cool / amber-pulled-toward-red / warm-tungsten
//   horizon — warm-linen / cooler-linen / lavender-cream / warm-linen
//   rim     — amber / pale-warm / violet-dramatic / soft-amber
//
// Quadrant centres on the timeOfDay 0..1 loop:
//   0.00  midday    — warm-cream peak, cream shadow with cool lavender hint
//   0.25  lateAft   — cooler-cream peak, cool-cream shadow
//   0.50  dusk      — lavender-cream peak, dusk-violet warm-taupe shadow
//   0.75  morning   — warm-cream peak, warm cream-sand shadow
//   1.00  midday    — wraps back to 0
//
// Stops are stored as [r,g,b] triples in linear-ish 0..1 (matches the GLSL
// originals — no gamma conversion was applied there either; brand HEX values
// are interpreted directly as srgb floats).

export interface DunePhaseColors {
	/** Lit-area shadow side colour. Cream + lavender axis, never warm-tan-only. */
	shadow: [number, number, number];
	/** Ridge-peak colour. Always cream-family, never blinding white. */
	peak: [number, number, number];
	/** Sun tint multiplied into lit fragments. Never saturated yellow. */
	sunTint: [number, number, number];
	/** Sky-horizon stop. Drives both the sky band AND the aerial-haze fade. */
	horizon: [number, number, number];
	/** Rim-light tint on the back-lit side. Brand violet at dusk. */
	rimTint: [number, number, number];
}

export const DUNE_PHASES: {
	midday: DunePhaseColors;
	lateAft: DunePhaseColors;
	dusk: DunePhaseColors;
	morning: DunePhaseColors;
} = {
	midday: {
		// Cool-cream shadow with subtle lavender tint (was warm-tan #b89c78);
		// pulls the dune body toward the brand palette without going dark.
		shadow: [0.733, 0.659, 0.667],
		// #faf7f0 — brand warm cream. Spec lists this as the canonical peak.
		peak: [0.98, 0.969, 0.941],
		sunTint: [1.0, 0.97, 0.88],
		horizon: [0.91, 0.875, 0.792],
		rimTint: [1.0, 0.8, 0.5],
	},
	lateAft: {
		shadow: [0.69, 0.604, 0.71],
		peak: [0.961, 0.953, 0.941],
		sunTint: [0.965, 0.965, 0.985],
		horizon: [0.89, 0.875, 0.835],
		rimTint: [0.95, 0.85, 0.75],
	},
	dusk: {
		// Dusk-violet warm-taupe — keeps the lavender brand axis dominant at dusk.
		shadow: [0.659, 0.58, 0.722],
		// #f2edf5 — lavender-cream, brand-aligned for dusk.
		peak: [0.949, 0.929, 0.961],
		// Amber pulled toward red — never bright yellow at sunset.
		sunTint: [1.0, 0.87, 0.76],
		horizon: [0.91, 0.855, 0.89],
		rimTint: [0.85, 0.65, 0.95],
	},
	morning: {
		shadow: [0.737, 0.624, 0.62],
		peak: [0.973, 0.957, 0.929],
		sunTint: [1.0, 0.945, 0.87],
		horizon: [0.925, 0.89, 0.82],
		rimTint: [0.9, 0.75, 0.6],
	},
};

/** Per-frame phase weight bundle. Sums to 1; each weight peaks at its quadrant centre. */
export interface PhaseWeights {
	midday: number;
	lateAft: number;
	dusk: number;
	morning: number;
}

/**
 * Compute the 4-quadrant phase weights used to blend palette stops.
 * Input: timeOfDay in [0..1], wrapping. Output: weights summing to 1.
 *
 * The fold uses peak-distance with width 1 (i.e. abs(td - centre) * 4); each
 * quadrant centre is 0.25 apart so the maxes overlap at the midpoints to
 * 0.5/0.5. Midday wraps across both 0.0 AND 1.0 so the loop closes seamlessly.
 *
 * Chosen for two reasons:
 *   1. cheap: 4 abs() + 4 max() + 4 divides — sub-microsecond.
 *   2. continuous: no discontinuity at 0/1 wrap; transition is C0 across all
 *      four quadrant boundaries. Higher-order continuity would mean smoothstep
 *      but the visible result is identical at this slow a cycle.
 */
export function computePhaseWeights(timeOfDay: number): PhaseWeights {
	const td = ((timeOfDay % 1) + 1) % 1; // wrap into [0, 1)
	const midday =
		Math.max(0, 1 - Math.abs(td - 0.0) * 4) +
		Math.max(0, 1 - Math.abs(td - 1.0) * 4);
	const lateAft = Math.max(0, 1 - Math.abs(td - 0.25) * 4);
	const dusk = Math.max(0, 1 - Math.abs(td - 0.5) * 4);
	const morning = Math.max(0, 1 - Math.abs(td - 0.75) * 4);
	const sum = midday + lateAft + dusk + morning;
	// Floor at 1 to avoid div-by-zero — geometrically this can't happen
	// (some quadrant peak always > 0 across the full [0,1) range) but the
	// max() flooring at 0 means a numerical edge case (eg td=0.125+epsilon)
	// could in theory squeak past zero. Cheap guard, no observable cost.
	const safe = sum > 1e-6 ? sum : 1;
	return {
		midday: midday / safe,
		lateAft: lateAft / safe,
		dusk: dusk / safe,
		morning: morning / safe,
	};
}

/**
 * Mix four [r,g,b] stops by phase weights into a destination triple.
 * Mutates and returns `out`. Allocate `out` once at module scope to avoid
 * per-frame Color3 churn — the hot path runs every render.
 */
export function mixPhaseColor(
	out: [number, number, number],
	w: PhaseWeights,
	pick: (p: DunePhaseColors) => [number, number, number],
): [number, number, number] {
	const m = pick(DUNE_PHASES.midday);
	const l = pick(DUNE_PHASES.lateAft);
	const d = pick(DUNE_PHASES.dusk);
	const r = pick(DUNE_PHASES.morning);
	out[0] =
		m[0] * w.midday + l[0] * w.lateAft + d[0] * w.dusk + r[0] * w.morning;
	out[1] =
		m[1] * w.midday + l[1] * w.lateAft + d[1] * w.dusk + r[1] * w.morning;
	out[2] =
		m[2] * w.midday + l[2] * w.lateAft + d[2] * w.dusk + r[2] * w.morning;
	return out;
}
