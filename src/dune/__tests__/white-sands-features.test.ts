// White Sands feature tunables — pure-math validation, no Babylon dependency.

import { describe, expect, it } from "vitest";

import { DUNE_PHASES } from "../dune-colors.js";
import {
	DEFAULT_FIELD_COMPOSITION,
	GYPSUM_WASH_STRENGTH,
	GYPSUM_WASH_THRESHOLD,
	HAZE_BAND_BOTTOM_OPACITY,
	HAZE_BAND_MID_OPACITY,
	HAZE_BAND_TOP_OPACITY,
	HAZE_COLOR_WARM,
	HAZE_HORIZON_STRIP_CENTER_Y,
	HAZE_HORIZON_STRIP_HEIGHT,
	HAZE_HORIZON_STRIP_PEAK_OPACITY,
	isValidComposition,
	MIGRATION_BASS_SWAY,
	MIGRATION_PLAYING_BOOST,
	MIGRATION_SPEED_MULTIPLIER,
	RIPPLE_AMPLITUDE,
	RIPPLE_FREQUENCY,
	regionWeights,
	SPARKLE_COLOR_AMBER,
	SPARKLE_COLOR_AWS_ORANGE,
	SPARKLE_COLOR_LAVENDER,
	SPARKLE_COLOR_VIOLET,
	SPARKLE_SPEED_PLAYING,
	SPARKLE_SPEED_REDUCED,
	SPARKLE_SPEED_REDUCED_PLAYING,
	SPARKLE_SPEED_SILENT,
	WIND_DIR,
} from "../white-sands-features.js";

describe("white-sands-features constants", () => {
	it("WIND_DIR is normalized along +X", () => {
		const [x, y] = WIND_DIR;
		expect(Math.hypot(x, y)).toBeCloseTo(1, 5);
		expect(x).toBeGreaterThan(0);
	});

	it("MIGRATION_SPEED_MULTIPLIER pushes drift faster than baseline", () => {
		// Bryan: "faster than 10 ft/year for web". Original drift coef was 0.012;
		// this multiplier scales it. Anything ≥ 1 is valid; we picked 3x.
		expect(MIGRATION_SPEED_MULTIPLIER).toBeGreaterThanOrEqual(2);
		expect(MIGRATION_SPEED_MULTIPLIER).toBeLessThanOrEqual(6);
	});

	it("RIPPLE_FREQUENCY is high enough to read as ripples not waves", () => {
		// Ripples should cycle many times across the dune ground. Below ~80 they
		// read as macroscopic waves; above ~300 they alias on integrated GPUs.
		expect(RIPPLE_FREQUENCY).toBeGreaterThan(80);
		expect(RIPPLE_FREQUENCY).toBeLessThan(300);
	});

	it("RIPPLE_AMPLITUDE stays subtle (under 5%)", () => {
		// Ripples should tint the surface, never dominate it.
		expect(RIPPLE_AMPLITUDE).toBeGreaterThan(0);
		expect(RIPPLE_AMPLITUDE).toBeLessThan(0.05);
	});

	it("GYPSUM_WASH_STRENGTH is brand-respectful (~20% per spec)", () => {
		// Bryan: "20% white wash" — accept 15-30%.
		expect(GYPSUM_WASH_STRENGTH).toBeGreaterThan(0.15);
		expect(GYPSUM_WASH_STRENGTH).toBeLessThan(0.3);
	});

	it("GYPSUM_WASH_THRESHOLD only fires on highly-lit fragments", () => {
		// Threshold is on lambert; below 0.5 the wash would bleed into midtone.
		expect(GYPSUM_WASH_THRESHOLD).toBeGreaterThanOrEqual(0.6);
		expect(GYPSUM_WASH_THRESHOLD).toBeLessThan(1);
	});

	it("HAZE_BAND opacity ramps from top→bottom in expected direction", () => {
		// Top: transparent, mid: densest, bottom: partial. This shape sells
		// horizon haze that builds toward the dune line and softens near ground.
		expect(HAZE_BAND_TOP_OPACITY).toBeLessThan(HAZE_BAND_MID_OPACITY);
		expect(HAZE_BAND_BOTTOM_OPACITY).toBeLessThan(HAZE_BAND_MID_OPACITY);
		expect(HAZE_BAND_TOP_OPACITY).toBeGreaterThanOrEqual(0);
		expect(HAZE_BAND_MID_OPACITY).toBeLessThanOrEqual(1);
	});
});

// v0.0.0085 → v0.0.0092 — fog-visibility regressions. Five prior fog passes
// (v0.0.0067 fogDensity, v0.0.0073 cream-on-cream, v0.0.0085 NDC quad, two
// silent today-attempts) all collapsed to invisible. Bryan: "still don't see
// the fog" five times. v0.0.0092 escalation: alpha bands pushed past 0.75,
// strip peak past 0.9, dune-fragment haze mix moved AFTER the lavender
// ao-crease so the haze isn't grey-shifted in the final composite. These
// tests guard the invariants that make the fog actually READ as fog.
describe("v0.0.0092 fog visibility invariants", () => {
	it("HAZE_BAND_MID_OPACITY is high enough to register visually (≥0.75)", () => {
		// v0.0.0085 set 0.55 → playwright-confirmed invisible at viewport y≈0.5
		// (sample rgb 184,170,160 — gray-mauve, not peach-cream). v0.0.0092
		// pushes to 0.92 so the warm haze fully dominates the dune body in the
		// horizon band. Floor at 0.75 to lock in the gain.
		expect(HAZE_BAND_MID_OPACITY).toBeGreaterThanOrEqual(0.75);
	});

	it("HAZE_BAND_BOTTOM_OPACITY also visually readable (≥0.6)", () => {
		// The bottom of the viewport is where the dune base sits — haze must be
		// dense enough at the ground to read as a dust pool, not a faint wash.
		// v0.0.0092 raises 0.35 → 0.78 to match Bryan's "deniably obvious" bar.
		expect(HAZE_BAND_BOTTOM_OPACITY).toBeGreaterThanOrEqual(0.6);
	});

	it("HAZE_COLOR_WARM is meaningfully DIFFERENT from every phase horizon stop", () => {
		// THE v0.0.0073 BUG: haze color = mixed `horizon` palette stop, which
		// for every phase is in the cream-cream-cream-lavender-cream family —
		// the SAME color as the dune body. Cream-on-cream at any alpha = invis.
		// v0.0.0085 fix: HAZE_COLOR_WARM is a peach-cream pushed warmer +
		// slightly more saturated. This test fails if some future palette tweak
		// brings the horizon stops too close to the haze (re-introducing the
		// invisible-fog bug).
		const minPerceptualDelta = 0.05; // ~13/255 in any channel
		for (const [name, phase] of Object.entries(DUNE_PHASES)) {
			const dr = HAZE_COLOR_WARM[0] - phase.horizon[0];
			const dg = HAZE_COLOR_WARM[1] - phase.horizon[1];
			const db = HAZE_COLOR_WARM[2] - phase.horizon[2];
			const delta = Math.hypot(dr, dg, db);
			expect(
				delta,
				`HAZE_COLOR_WARM too close to ${name}.horizon — fog will be invisible`,
			).toBeGreaterThanOrEqual(minPerceptualDelta);
		}
	});

	it("HAZE_COLOR_WARM is warmer than it is cool (R + G > 1.6 * B)", () => {
		// Warm desert haze invariant. If this flips toward blue/grey it stops
		// reading as "El Paso morning" and starts reading as "wet city smog".
		const [r, g, b] = HAZE_COLOR_WARM;
		expect(r + g).toBeGreaterThan(b * 1.6);
	});

	it("HAZE_COLOR_WARM is also distinct from the cream peak palette", () => {
		// Peak (ridge top) color is a near-white cream. The haze must differ
		// from it for the same reason it must differ from horizon — fog must
		// be visible against ridge tops, not invisible.
		const minDelta = 0.05;
		for (const [name, phase] of Object.entries(DUNE_PHASES)) {
			const dr = HAZE_COLOR_WARM[0] - phase.peak[0];
			const dg = HAZE_COLOR_WARM[1] - phase.peak[1];
			const db = HAZE_COLOR_WARM[2] - phase.peak[2];
			const delta = Math.hypot(dr, dg, db);
			expect(
				delta,
				`HAZE_COLOR_WARM too close to ${name}.peak — fog invisible on ridges`,
			).toBeGreaterThanOrEqual(minDelta);
		}
	});

	it("HAZE_HORIZON_STRIP center sits in the lower half of the viewport", () => {
		// The dune horizon line at the standard ArcRotate frame sits roughly at
		// y=0.55 in screen UV (lower half). Strip must straddle that line, not
		// float in the sky.
		expect(HAZE_HORIZON_STRIP_CENTER_Y).toBeGreaterThan(0.4);
		expect(HAZE_HORIZON_STRIP_CENTER_Y).toBeLessThan(0.7);
	});

	it("HAZE_HORIZON_STRIP_HEIGHT is narrow (under 25% viewport)", () => {
		// A thick strip would read as a banded sky; a narrow strip reads as
		// the horizon-line haze. Between 5% and 25% viewport is the sweet spot.
		expect(HAZE_HORIZON_STRIP_HEIGHT).toBeGreaterThan(0.05);
		expect(HAZE_HORIZON_STRIP_HEIGHT).toBeLessThan(0.25);
	});

	it("HAZE_HORIZON_STRIP_PEAK_OPACITY exceeds the vertical mid band", () => {
		// The strip is the densest part of the haze — that's the point. If the
		// strip alpha drops below the mid band it disappears into the gradient.
		// v0.0.0092: bumped 0.5 → 0.95 so the strip behaves as a near-opaque
		// bridging band over the horizon line.
		expect(HAZE_HORIZON_STRIP_PEAK_OPACITY).toBeGreaterThanOrEqual(
			HAZE_BAND_MID_OPACITY * 0.85,
		);
		expect(HAZE_HORIZON_STRIP_PEAK_OPACITY).toBeLessThanOrEqual(1);
	});

	it("HAZE_HORIZON_STRIP_PEAK_OPACITY is near-opaque (≥0.9)", () => {
		// v0.0.0092 invariant: the horizon-line bridging strip MUST read as
		// near-solid haze. Below 0.9 the dune horizon line still pokes through
		// and the eye reads "tinted dunes" instead of "fog blanket".
		expect(HAZE_HORIZON_STRIP_PEAK_OPACITY).toBeGreaterThanOrEqual(0.9);
	});
});

describe("v0.0.0082 sparkle speed tunables", () => {
	it("silent sparkle speed is roughly quartered (Bryan: slow waaayyy down)", () => {
		// Spec: ~0.25 of baseline 1.0. Accept 0.15-0.35 for mild future tweaks.
		expect(SPARKLE_SPEED_SILENT).toBeGreaterThanOrEqual(0.15);
		expect(SPARKLE_SPEED_SILENT).toBeLessThanOrEqual(0.35);
	});

	it("playing sparkle speed restores or boosts past baseline (go nuts)", () => {
		// Bryan: "go nuts" when music plays. Boost ≥ 1.0, cap ≤ 2.5 so it
		// stays inside epileptic-safe strobe rates at typical pulse env.
		expect(SPARKLE_SPEED_PLAYING).toBeGreaterThanOrEqual(1.0);
		expect(SPARKLE_SPEED_PLAYING).toBeLessThanOrEqual(2.5);
	});

	it("playing sparkle speed exceeds silent by ≥4x (audio-reactivity contract)", () => {
		// Quartered silent → 4x ratio is the visual contract. Accept ≥ 4
		// (currently 1.5/0.25 = 6x).
		expect(SPARKLE_SPEED_PLAYING / SPARKLE_SPEED_SILENT).toBeGreaterThanOrEqual(
			4,
		);
	});

	it("reduced-motion silent sparkle speed is 0 (drops sparkle entirely)", () => {
		// prefers-reduced-motion silent path: no sparkle motion. The shader's
		// floor(time*0) = 0 freezes the sparkle pattern.
		expect(SPARKLE_SPEED_REDUCED).toBe(0);
	});

	it("reduced-motion playing sparkle speed is dampened but non-zero", () => {
		// Subtle pulse allowed when streamPlaying even under reduced-motion;
		// must stay below the silent-non-reduced rate so we never strobe.
		expect(SPARKLE_SPEED_REDUCED_PLAYING).toBeGreaterThan(0);
		expect(SPARKLE_SPEED_REDUCED_PLAYING).toBeLessThan(
			SPARKLE_SPEED_SILENT * 2,
		);
	});
});

describe("v0.0.0082 migration audio-reactivity tunables", () => {
	it("MIGRATION_PLAYING_BOOST is ~3x (dunes roll more aggressively)", () => {
		// Bryan: dunes should roll "more aggressively" in sync with the
		// bassline. Spec value 3x; accept 2-5x.
		expect(MIGRATION_PLAYING_BOOST).toBeGreaterThanOrEqual(2);
		expect(MIGRATION_PLAYING_BOOST).toBeLessThanOrEqual(5);
	});

	it("MIGRATION_BASS_SWAY is small but non-zero (per-hit lurch)", () => {
		// Additive drift contribution per unit bass. Above ~0.1 the dunes
		// would jolt visibly between frames; 0 would silence the bass coupling.
		expect(MIGRATION_BASS_SWAY).toBeGreaterThan(0);
		expect(MIGRATION_BASS_SWAY).toBeLessThan(0.1);
	});

	it("effective playing migration outpaces silent baseline by ~3x or more", () => {
		// silent: MIGRATION_SPEED_MULTIPLIER  | playing: MIGRATION_SPEED_MULTIPLIER * MIGRATION_PLAYING_BOOST
		const silent = MIGRATION_SPEED_MULTIPLIER;
		const playing = MIGRATION_SPEED_MULTIPLIER * MIGRATION_PLAYING_BOOST;
		expect(playing / silent).toBeGreaterThanOrEqual(3);
	});
});

describe("v0.0.0082 sparkle palette (brand colors)", () => {
	const palette = [
		["amber", SPARKLE_COLOR_AMBER],
		["aws-orange", SPARKLE_COLOR_AWS_ORANGE],
		["violet", SPARKLE_COLOR_VIOLET],
		["lavender", SPARKLE_COLOR_LAVENDER],
	] as const;

	for (const [name, rgb] of palette) {
		it(`${name} is a valid 0..1 RGB triple`, () => {
			expect(rgb).toHaveLength(3);
			for (const channel of rgb) {
				expect(channel).toBeGreaterThanOrEqual(0);
				expect(channel).toBeLessThanOrEqual(1);
				expect(Number.isFinite(channel)).toBe(true);
			}
		});
	}

	it("amber and aws-orange are warm (R > B)", () => {
		expect(SPARKLE_COLOR_AMBER[0]).toBeGreaterThan(SPARKLE_COLOR_AMBER[2]);
		expect(SPARKLE_COLOR_AWS_ORANGE[0]).toBeGreaterThan(
			SPARKLE_COLOR_AWS_ORANGE[2],
		);
	});

	it("violet and lavender are cool (B > R)", () => {
		expect(SPARKLE_COLOR_VIOLET[2]).toBeGreaterThan(SPARKLE_COLOR_VIOLET[0]);
		expect(SPARKLE_COLOR_LAVENDER[2]).toBeGreaterThan(
			SPARKLE_COLOR_LAVENDER[0],
		);
	});

	it("aws-orange matches AWS brand #ff9900 within rounding", () => {
		// 1.0, 0.6, 0.0 — verifies palette entry stays in sync with AWS brand.
		expect(SPARKLE_COLOR_AWS_ORANGE[0]).toBeCloseTo(1.0, 2);
		expect(SPARKLE_COLOR_AWS_ORANGE[1]).toBeCloseTo(0.6, 2);
		expect(SPARKLE_COLOR_AWS_ORANGE[2]).toBeCloseTo(0.0, 2);
	});
});

describe("DEFAULT_FIELD_COMPOSITION", () => {
	it("is valid (all amps finite + non-negative)", () => {
		expect(isValidComposition(DEFAULT_FIELD_COMPOSITION)).toBe(true);
	});

	it("has transverse > barchan > parabolic > dome (visual-emphasis order)", () => {
		// Transverse ridges dominate the silhouette; barchan crescents the
		// mid-detail; parabolic at edges; dome smallest. Per White Sands research.
		const c = DEFAULT_FIELD_COMPOSITION;
		expect(c.transverseAmp).toBeGreaterThan(c.barchanAmp);
		expect(c.barchanAmp).toBeGreaterThan(c.parabolicAmp);
		expect(c.parabolicAmp).toBeGreaterThan(c.domeAmp);
	});

	it("rejects negative + NaN amplitudes", () => {
		expect(
			isValidComposition({
				domeAmp: -0.1,
				barchanAmp: 1,
				transverseAmp: 1,
				parabolicAmp: 1,
			}),
		).toBe(false);
		expect(
			isValidComposition({
				domeAmp: Number.NaN,
				barchanAmp: 1,
				transverseAmp: 1,
				parabolicAmp: 1,
			}),
		).toBe(false);
		expect(
			isValidComposition({
				domeAmp: Number.POSITIVE_INFINITY,
				barchanAmp: 1,
				transverseAmp: 1,
				parabolicAmp: 1,
			}),
		).toBe(false);
	});
});

describe("regionWeights", () => {
	it("returns finite weights at all sampled points across the field", () => {
		// Sample a 7×5 grid spanning the 60×40 ground plane.
		for (let i = 0; i < 7; i++) {
			for (let j = 0; j < 5; j++) {
				const x = -30 + (60 * i) / 6;
				const z = -20 + (40 * j) / 4;
				const w = regionWeights(x, z);
				expect(Number.isFinite(w.dome)).toBe(true);
				expect(Number.isFinite(w.barchan)).toBe(true);
				expect(Number.isFinite(w.transverse)).toBe(true);
				expect(Number.isFinite(w.parabolic)).toBe(true);
			}
		}
	});

	it("dome dominates upwind edge (low x)", () => {
		const upwind = regionWeights(-28, 0);
		const downwind = regionWeights(28, 0);
		expect(upwind.dome).toBeGreaterThan(downwind.dome);
	});

	it("parabolic dominates downwind edge (high x)", () => {
		const upwind = regionWeights(-28, 0);
		const downwind = regionWeights(28, 0);
		expect(downwind.parabolic).toBeGreaterThan(upwind.parabolic);
	});

	it("barchan + transverse peak in mid-field", () => {
		const mid = regionWeights(0, 0);
		const upwind = regionWeights(-28, 0);
		const downwind = regionWeights(28, 0);
		expect(mid.barchan).toBeGreaterThan(upwind.barchan);
		expect(mid.barchan).toBeGreaterThan(downwind.barchan);
		expect(mid.transverse).toBeGreaterThan(upwind.transverse);
	});

	it("all weights stay in [0, 1]", () => {
		for (let i = 0; i < 11; i++) {
			const x = -30 + 6 * i;
			const w = regionWeights(x, 0);
			for (const v of [w.dome, w.barchan, w.transverse, w.parabolic]) {
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(1);
			}
		}
	});
});
