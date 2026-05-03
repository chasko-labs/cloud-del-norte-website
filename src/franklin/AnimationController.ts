// Animation state for the Franklin Mountains scene — time, camera breathe,
// trippy-mode opacity ramp.
//
// One owner for all motion sources so reduced-motion gating is in one place
// (mirrors src/dune/AnimationController.ts).
//
// Reduced motion behaviour: timeSeconds still increments (we use it for the
// trippy-mode fade ramps so audio start/stop transitions still soften), but
// camera breathe stays at base radius and trippy-mode is forced off (no
// dancing star animation). The audio adapter zeroes the bands separately so
// the silhouette stays still.

import {
	CAMERA_BREATHE_AMP,
	CAMERA_BREATHE_HZ,
	CAMERA_RADIUS,
	STAR_TRIPPY_FADE_IN_S,
	STAR_TRIPPY_FADE_OUT_S,
} from "./franklin-features.js";

export interface FranklinAnimationState {
	/** Elapsed seconds since mount. */
	timeSeconds: number;
	/** Camera radius (base + breathe oscillation). */
	cameraRadius: number;
	/** Trippy-mode visibility ramp [0, 1] — 0 silent, 1 fully reactive. */
	trippyOpacity: number;
}

export interface FranklinAnimationOptions {
	reducedMotion: boolean;
}

export class FranklinAnimationController {
	private readonly reducedMotion: boolean;
	private timeSeconds = 0;
	private trippyTarget = 0;
	private trippyCurrent = 0;
	private readonly state: FranklinAnimationState;

	constructor(options: FranklinAnimationOptions) {
		this.reducedMotion = options.reducedMotion;
		this.state = {
			timeSeconds: 0,
			cameraRadius: CAMERA_RADIUS,
			trippyOpacity: 0,
		};
	}

	/**
	 * Set the trippy-mode target. Caller should pass 1 when audio is playing
	 * (body.cdn-stream-playing present) and 0 when silent. The actual opacity
	 * ramps toward the target over STAR_TRIPPY_FADE_IN_S / STAR_TRIPPY_FADE_OUT_S
	 * seconds — abrupt fade-in jolts the eye, abrupt fade-out cuts off the
	 * dancing stars mid-pulse which reads as broken.
	 *
	 * Reduced motion: target is ignored (forced to 0). Dancing stars are
	 * audio-driven motion which the preference exists to suppress.
	 */
	setTrippy(active: boolean): void {
		this.trippyTarget = this.reducedMotion ? 0 : active ? 1 : 0;
	}

	update(deltaSeconds: number): void {
		this.timeSeconds += deltaSeconds;
		this.state.timeSeconds = this.timeSeconds;

		// Camera breathe — disabled in reduced-motion. Very subtle (±0.06 on a
		// 48s period) so it reads as parallax breathing, not a swoop.
		if (this.reducedMotion) {
			this.state.cameraRadius = CAMERA_RADIUS;
		} else {
			this.state.cameraRadius =
				CAMERA_RADIUS +
				Math.sin(this.timeSeconds * CAMERA_BREATHE_HZ * Math.PI * 2) *
					CAMERA_BREATHE_AMP;
		}

		// Trippy opacity ramp — different rates for fade-in vs fade-out.
		// Linear ramp toward target; we don't smooth-step this because the
		// dancing-star alpha curve already has its own envelope.
		const rate =
			this.trippyTarget > this.trippyCurrent
				? deltaSeconds / STAR_TRIPPY_FADE_IN_S
				: deltaSeconds / STAR_TRIPPY_FADE_OUT_S;
		const dir = this.trippyTarget > this.trippyCurrent ? 1 : -1;
		this.trippyCurrent = Math.max(
			0,
			Math.min(1, this.trippyCurrent + dir * rate),
		);
		// Snap to target if we crossed it (avoid floating-point drift).
		if (
			(dir > 0 && this.trippyCurrent > this.trippyTarget) ||
			(dir < 0 && this.trippyCurrent < this.trippyTarget)
		) {
			this.trippyCurrent = this.trippyTarget;
		}
		this.state.trippyOpacity = this.trippyCurrent;
	}

	getState(): FranklinAnimationState {
		return this.state;
	}

	isReducedMotion(): boolean {
		return this.reducedMotion;
	}
}
