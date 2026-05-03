// Audio band sampler for the Franklin scene.
//
// Reads bass / mid / treble amplitudes via the same getBand* exports the dune
// scene uses. Also exposes a `streamPlaying` flag derived from
// document.body.classList — the persistent player toggles `cdn-stream-playing`
// when an audio element starts/stops, and that flag gates the trippy-mode
// dancing-star animation.
//
// Reduced motion: every band returns 0 and streamPlaying returns false. Audio
// reactivity is motion the preference suppresses.

import {
	getBandBass,
	getBandMid,
	getBandTreble,
} from "../lib/background-viz/audio.js";

export interface FranklinAudioLevels {
	bass: number;
	mid: number;
	treble: number;
	/** True when body.cdn-stream-playing is set (audio element is producing sound). */
	streamPlaying: boolean;
}

export interface FranklinAudioOptions {
	reducedMotion: boolean;
}

const STREAM_PLAYING_CLASS = "cdn-stream-playing";

export class FranklinAudioAdapter {
	private readonly reducedMotion: boolean;
	private readonly levels: FranklinAudioLevels = {
		bass: 0,
		mid: 0,
		treble: 0,
		streamPlaying: false,
	};

	constructor(options: FranklinAudioOptions) {
		this.reducedMotion = options.reducedMotion;
	}

	sample(): FranklinAudioLevels {
		if (this.reducedMotion) {
			this.levels.bass = 0;
			this.levels.mid = 0;
			this.levels.treble = 0;
			this.levels.streamPlaying = false;
			return this.levels;
		}
		this.levels.bass = getBandBass();
		this.levels.mid = getBandMid();
		this.levels.treble = getBandTreble();
		this.levels.streamPlaying =
			typeof document !== "undefined" &&
			document.body.classList.contains(STREAM_PLAYING_CLASS);
		return this.levels;
	}
}
