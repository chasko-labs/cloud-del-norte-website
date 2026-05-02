// Audio band sampler with reduced-motion forcing + cached --cdn-flux read.
//
// Wraps getBandBass / getBandMid from src/lib/background-viz/audio.ts plus a
// CSSStyleDeclaration handle for --cdn-flux (the only of bass/mid/flux that
// the audio module doesn't expose as a JS export — flux state lives in
// canvas.ts because spectralFlux needs prior-frame bins).
//
// Reduced motion: every getter returns 0. Audio reactivity counts as motion
// (it surprises users into looking at the screen) and is exactly what the
// preference exists to suppress.

import { getBandBass, getBandMid } from "../lib/background-viz/audio.js";

export interface AudioLevels {
	bass: number;
	mid: number;
	flux: number;
}

export interface AudioAdapterOptions {
	reducedMotion: boolean;
}

export class AudioAdapter {
	private readonly reducedMotion: boolean;
	private readonly rootStyle: CSSStyleDeclaration | null;
	private readonly levels: AudioLevels = { bass: 0, mid: 0, flux: 0 };

	constructor(options: AudioAdapterOptions) {
		this.reducedMotion = options.reducedMotion;
		// Cache the CSSStyleDeclaration once — getComputedStyle is cheap on a
		// cached ref, expensive on the cold path. Skip in reduced-motion since
		// we'll always return 0 anyway.
		this.rootStyle =
			typeof document !== "undefined" && !options.reducedMotion
				? getComputedStyle(document.documentElement)
				: null;
	}

	/** Sample the current bass / mid / flux levels. Mutates the cached struct. */
	sample(): AudioLevels {
		if (this.reducedMotion) {
			this.levels.bass = 0;
			this.levels.mid = 0;
			this.levels.flux = 0;
			return this.levels;
		}
		this.levels.bass = getBandBass();
		this.levels.mid = getBandMid();
		this.levels.flux = this.rootStyle
			? parseFloat(this.rootStyle.getPropertyValue("--cdn-flux")) || 0
			: 0;
		return this.levels;
	}
}
