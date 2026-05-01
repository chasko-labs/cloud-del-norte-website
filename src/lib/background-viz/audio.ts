// Web Audio API graph
//
//   <audio>
//      └─ MediaElementAudioSourceNode
//             └─ DynamicsCompressorNode  (loudness normalization across the 8 stations,
//             │                          which arrive at wildly different mastering levels —
//             │                          KEXP slams the bass band, KUNM ducks low)
//             ├─ AnalyserNode  analyserBeat        (full-spectrum, low smoothing — onset detector)
//             ├─ AnalyserNode  analyserVisual      (full-spectrum, high smoothing — visualizers)
//             ├─ AnalyserNode  analyserWaveform    (time-domain, future oscilloscope)
//             ├─ BiquadFilter lowpass   250Hz Q=1   ─→ AnalyserNode bandBass
//             ├─ BiquadFilter bandpass 1500Hz Q=0.7 ─→ AnalyserNode bandMid
//             ├─ BiquadFilter highpass 4000Hz Q=1   ─→ AnalyserNode bandTreble
//             └─ ctx.destination                   (audible output)
//
// The filter-bank gives cleaner band isolation than slicing raw FFT bins (FFT bin
// boundaries bleed across decades). Each filter has its own analyser so callers
// can pull tight band amplitudes for `--cdn-bass` / `--cdn-mid` / `--cdn-treble`
// CSS custom properties.

let audioCtx: AudioContext | null = null;
let compressor: DynamicsCompressorNode | null = null;
let analyserBeat: AnalyserNode | null = null;
let analyserVisual: AnalyserNode | null = null;
let analyserWaveform: AnalyserNode | null = null;
let bandBassAnalyser: AnalyserNode | null = null;
let bandMidAnalyser: AnalyserNode | null = null;
let bandTrebleAnalyser: AnalyserNode | null = null;
let currentStationKey = "";

const sourceRegistry = new WeakMap<
	HTMLAudioElement,
	MediaElementAudioSourceNode
>();

function getAudioCtx(): AudioContext {
	if (!audioCtx) {
		audioCtx = new AudioContext();
	}
	return audioCtx;
}

function ensureGraph(ctx: AudioContext): void {
	if (compressor) return;

	// Loudness normalization. Threshold high enough that quiet talk passages
	// pass through unmolested; ratio + attack chosen to tame the loud bass
	// transients without audibly pumping the mids.
	compressor = ctx.createDynamicsCompressor();
	compressor.threshold.value = -24;
	compressor.knee.value = 30;
	compressor.ratio.value = 4;
	compressor.attack.value = 0.003;
	compressor.release.value = 0.25;

	analyserBeat = ctx.createAnalyser();
	analyserBeat.fftSize = 2048;
	analyserBeat.smoothingTimeConstant = 0.5;

	analyserVisual = ctx.createAnalyser();
	analyserVisual.fftSize = 2048;
	analyserVisual.smoothingTimeConstant = 0.85;

	analyserWaveform = ctx.createAnalyser();
	analyserWaveform.fftSize = 2048;
	analyserWaveform.smoothingTimeConstant = 0.0;

	// Per-band filter → analyser chains. Smaller fftSize is fine — filters
	// already isolate the band, we just need amplitude.
	const bassFilter = ctx.createBiquadFilter();
	bassFilter.type = "lowpass";
	bassFilter.frequency.value = 250;
	bassFilter.Q.value = 1;
	bandBassAnalyser = ctx.createAnalyser();
	bandBassAnalyser.fftSize = 256;
	bandBassAnalyser.smoothingTimeConstant = 0.7;

	const midFilter = ctx.createBiquadFilter();
	midFilter.type = "bandpass";
	midFilter.frequency.value = 1500;
	midFilter.Q.value = 0.7;
	bandMidAnalyser = ctx.createAnalyser();
	bandMidAnalyser.fftSize = 256;
	bandMidAnalyser.smoothingTimeConstant = 0.7;

	const trebleFilter = ctx.createBiquadFilter();
	trebleFilter.type = "highpass";
	trebleFilter.frequency.value = 4000;
	trebleFilter.Q.value = 1;
	bandTrebleAnalyser = ctx.createAnalyser();
	bandTrebleAnalyser.fftSize = 256;
	bandTrebleAnalyser.smoothingTimeConstant = 0.7;

	// Wire compressor → all sinks. Filters tap from the compressor in parallel
	// (no cumulative chain) so each band sees the post-compression signal but
	// not the previous band's filter colouring.
	compressor.connect(analyserBeat);
	compressor.connect(analyserVisual);
	compressor.connect(analyserWaveform);
	compressor.connect(bassFilter);
	bassFilter.connect(bandBassAnalyser);
	compressor.connect(midFilter);
	midFilter.connect(bandMidAnalyser);
	compressor.connect(trebleFilter);
	trebleFilter.connect(bandTrebleAnalyser);

	// Audible output — only one connection to destination. The analyser/filter
	// taps are sinks that don't feed back to speakers.
	compressor.connect(ctx.destination);
}

export function createAudioBridge(_ctx: CanvasRenderingContext2D): {
	initAudio: (el: HTMLAudioElement, stationKey: string) => void;
	destroyAudio: () => void;
	resumeCtx: () => void;
} {
	function initAudio(el: HTMLAudioElement, stationKey: string): void {
		const ctx = getAudioCtx();
		ensureGraph(ctx);

		if (!sourceRegistry.has(el)) {
			const source = ctx.createMediaElementSource(el);
			sourceRegistry.set(el, source);
			source.connect(compressor!);
		}

		currentStationKey = stationKey;

		if (ctx.state === "suspended") {
			ctx.resume();
		}
	}

	function destroyAudio(): void {
		if (audioCtx) {
			audioCtx.close();
			audioCtx = null;
		}
		compressor = null;
		analyserBeat = null;
		analyserVisual = null;
		analyserWaveform = null;
		bandBassAnalyser = null;
		bandMidAnalyser = null;
		bandTrebleAnalyser = null;
		currentStationKey = "";
	}

	function resumeCtx(): void {
		if (audioCtx && audioCtx.state === "suspended") {
			audioCtx.resume();
		}
	}

	return { initAudio, destroyAudio, resumeCtx };
}

export function getVisualData(): Uint8Array {
	if (!analyserVisual) {
		return new Uint8Array(1024);
	}
	const bins = new Uint8Array(analyserVisual.frequencyBinCount);
	analyserVisual.getByteFrequencyData(bins);
	return bins;
}

export function getBeatData(): Uint8Array {
	if (!analyserBeat) {
		return new Uint8Array(1024);
	}
	const bins = new Uint8Array(analyserBeat.frequencyBinCount);
	analyserBeat.getByteFrequencyData(bins);
	return bins;
}

export function getWaveformData(): Uint8Array {
	if (!analyserWaveform) {
		return new Uint8Array(1024);
	}
	const bins = new Uint8Array(analyserWaveform.frequencyBinCount);
	analyserWaveform.getByteTimeDomainData(bins);
	return bins;
}

// Average normalized amplitude (0..1) of a filter-bank analyser. Returns 0 when
// the graph isn't built yet (silent / pre-play).
function bandLevel(node: AnalyserNode | null): number {
	if (!node) return 0;
	const bins = new Uint8Array(node.frequencyBinCount);
	node.getByteFrequencyData(bins);
	let sum = 0;
	for (let i = 0; i < bins.length; i++) sum += bins[i];
	return Math.min(1, sum / (bins.length * 255));
}

export function getBandBass(): number {
	return bandLevel(bandBassAnalyser);
}

export function getBandMid(): number {
	return bandLevel(bandMidAnalyser);
}

export function getBandTreble(): number {
	return bandLevel(bandTrebleAnalyser);
}

export function getStationKey(): string {
	return currentStationKey;
}

export function resumeCtx(): void {
	if (audioCtx && audioCtx.state === "suspended") {
		audioCtx.resume();
	}
}
