// Animation state — timeOfDay phase, sun wobble, camera breathe, logo pulse.
//
// One owner for all motion sources so reduced-motion gating is in one place.
// Each consumer (DuneMaterial, Skybox, SceneBootstrap-camera) reads the
// computed values from getState() each frame.
//
// Reduced motion behaviour: timeOfDay frozen at 0 (midday), sunDir frozen at
// SUN_DIR_WORLD, camera radius frozen at base, logoPulse frozen at neutral.
// Audio levels also forced to 0 by AudioAdapter, but that's its concern.
//
// 2026-05-02 spec changes:
//   - 30% amplitude reduction on sun wobble + camera breathe
//   - 24s logo-inspired pulse cycle, paired with the star-logo bulb keyframe
//     in src/components/logo-svg/index.tsx (cdn-bulb-blink, 2.4s base × 10).

import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import { computePhaseWeights, type PhaseWeights } from "./dune-colors.js";

/** World-space sun direction baseline. Wobble adds ±SUN_WOBBLE_AMP in xz. */
export const SUN_DIR_WORLD = new Vector3(0.6, 0.35, -0.7).normalize();

// 90s timeOfDay loop — long enough that the cycle reads as ambient mood, not
// animation. Strict warm-midday → late-afternoon → dusk → morning → midday.
const TIME_OF_DAY_PERIOD_S = 90;

// Sun wobble — was 0.05 amplitude on 0.05 Hz. Spec calls for 30% reduction so
// new amplitude is 0.035. Frequency unchanged so the period (20s) stays the
// same — only the visible drift shrinks.
const SUN_WOBBLE_HZ = 0.05;
const SUN_WOBBLE_AMP = 0.035;

// Camera breathe — was ±0.15 on 1/24 Hz. 30% reduction → ±0.105.
const CAMERA_BREATHE_HZ = 1 / 24;
const CAMERA_BREATHE_AMP = 0.105;
// Radius: was 45. Reduced to 40 to move camera closer to the dunes —
// reinforces the street-level feel achieved by raising beta to 1.38.
export const CAMERA_RADIUS_BASE = 40;

// Logo pulse — 24s cycle echoes the star-logo bulb keyframe (2.4s × 10
// harmonic). Used as a gentle low-frequency multiplier on the sparkle
// brightness so the dune crests "twinkle in chorus" with the logo bulbs over
// long observation windows. Range [-1, 1] preserved; consumer scales to taste.
const LOGO_PULSE_HZ = 1 / 24;

export interface AnimationState {
	/** 0..1, wraps. Drives palette mix via computePhaseWeights. */
	timeOfDay: number;
	/** Pre-computed phase weights for the current timeOfDay. */
	phaseWeights: PhaseWeights;
	/** Wobbled, normalised sun direction. */
	sunDir: Vector3;
	/** Camera radius (base + breathe). */
	cameraRadius: number;
	/** Camera alpha drift offset (cumulative). */
	cameraAlphaOffset: number;
	/** Low-frequency [-1, 1] pulse echoing logo bulb cadence. */
	logoPulse: number;
	/** Total elapsed seconds since mount (for shaders that want raw time). */
	timeSeconds: number;
}

export interface AnimationControllerOptions {
	reducedMotion: boolean;
}

export class AnimationController {
	private readonly reducedMotion: boolean;
	private timeSeconds = 0;
	private cameraAlphaOffset = 0;
	private readonly sunScratch: Vector3;
	private readonly state: AnimationState;

	constructor(options: AnimationControllerOptions) {
		this.reducedMotion = options.reducedMotion;
		this.sunScratch = SUN_DIR_WORLD.clone();
		this.state = {
			timeOfDay: 0,
			phaseWeights: computePhaseWeights(0),
			sunDir: this.sunScratch,
			cameraRadius: CAMERA_RADIUS_BASE,
			cameraAlphaOffset: 0,
			logoPulse: 0,
			timeSeconds: 0,
		};
	}

	/** Advance state by `deltaSeconds`. Reduced-motion freezes everything. */
	update(deltaSeconds: number): void {
		if (this.reducedMotion) {
			// All values stay at constructor defaults — frozen. Audio uniforms
			// are zeroed by AudioAdapter, not here, so AnimationController owns
			// only motion sources.
			return;
		}
		this.timeSeconds += deltaSeconds;
		this.cameraAlphaOffset += 0.00004;

		const td = (this.timeSeconds / TIME_OF_DAY_PERIOD_S) % 1;
		this.state.timeOfDay = td;
		this.state.phaseWeights = computePhaseWeights(td);

		const wobble = Math.sin(this.timeSeconds * SUN_WOBBLE_HZ * Math.PI * 2);
		const wobbleQuad = Math.cos(this.timeSeconds * SUN_WOBBLE_HZ * Math.PI * 2);
		this.sunScratch.set(
			SUN_DIR_WORLD.x + wobble * SUN_WOBBLE_AMP,
			SUN_DIR_WORLD.y,
			SUN_DIR_WORLD.z + wobbleQuad * SUN_WOBBLE_AMP,
		);
		this.sunScratch.normalize();

		this.state.cameraRadius =
			CAMERA_RADIUS_BASE +
			Math.sin(this.timeSeconds * CAMERA_BREATHE_HZ * Math.PI * 2) *
				CAMERA_BREATHE_AMP;

		this.state.cameraAlphaOffset = this.cameraAlphaOffset;

		this.state.logoPulse = Math.sin(
			this.timeSeconds * LOGO_PULSE_HZ * Math.PI * 2,
		);

		this.state.timeSeconds = this.timeSeconds;
	}

	getState(): AnimationState {
		return this.state;
	}

	isReducedMotion(): boolean {
		return this.reducedMotion;
	}
}
