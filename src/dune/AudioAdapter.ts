// Audio band sampler with reduced-motion forcing + cached --cdn-flux read.
//
// Wraps getBandBass / getBandMid / getBandTreble from
// src/lib/background-viz/audio.ts plus a CSSStyleDeclaration handle for
// --cdn-flux (the only of bass/mid/flux that the audio module doesn't expose
// as a JS export — flux state lives in canvas.ts because spectralFlux needs
// prior-frame bins).
//
// v0.0.0082 additions:
//   - treble band sampled (drives sparkle color cycling alongside mid)
//   - streamPlaying derived from document.body.classList — gates the
//     "go nuts" mode (boosted sparkle speed, brand-palette color cycling,
//     bass-coupled migration sway). Mirrors the franklin scaffolding pattern.
//
// Reduced motion: every getter returns 0 / false. Audio reactivity counts as
// motion (it surprises users into looking at the screen) and is exactly what
// the preference exists to suppress.

import {
	getBandBass,
	getBandMid,
	getBandTreble,
} from "../lib/background-viz/audio.js";

export interface AudioLevels {
	bass: number;
	mid: number;
	treble: number;
	flux: number;
	/** True when body.cdn-stream-playing is set (audio element producing sound). */
	streamPlaying: boolean;
}

export interface AudioAdapterOptions {
	reducedMotion: boolean;
}

const STREAM_PLAYING_CLASS = "cdn-stream-playing";

export class AudioAdapter {
	private readonly reducedMotion: boolean;
	private readonly rootStyle: CSSStyleDeclaration | null;
	private readonly levels: AudioLevels = {
		bass: 0,
		mid: 0,
		treble: 0,
		flux: 0,
		streamPlaying: false,
	};

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

	/** Sample the current bass / mid / treble / flux levels + streamPlaying flag. */
	sample(): AudioLevels {
		if (this.reducedMotion) {
			this.levels.bass = 0;
			this.levels.mid = 0;
			this.levels.treble = 0;
			this.levels.flux = 0;
			// streamPlaying still tracked under reduced motion so consumers can
			// pick a damped-but-pulsing path instead of fully-frozen — see
			// DuneMaterial sparkleSpeed selection.
			this.levels.streamPlaying =
				typeof document !== "undefined" &&
				document.body.classList.contains(STREAM_PLAYING_CLASS);
			return this.levels;
		}
		this.levels.bass = getBandBass();
		this.levels.mid = getBandMid();
		this.levels.treble = getBandTreble();
		this.levels.flux = this.rootStyle
			? parseFloat(this.rootStyle.getPropertyValue("--cdn-flux")) || 0
			: 0;
		this.levels.streamPlaying =
			typeof document !== "undefined" &&
			document.body.classList.contains(STREAM_PLAYING_CLASS);
		return this.levels;
	}
}
