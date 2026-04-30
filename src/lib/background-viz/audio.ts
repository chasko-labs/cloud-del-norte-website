let audioCtx: AudioContext | null = null;
let analyserBeat: AnalyserNode | null = null;
let analyserVisual: AnalyserNode | null = null;
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

function ensureAnalysers(ctx: AudioContext): void {
	if (analyserBeat && analyserVisual) return;

	analyserBeat = ctx.createAnalyser();
	analyserBeat.fftSize = 2048;
	analyserBeat.smoothingTimeConstant = 0.5;

	analyserVisual = ctx.createAnalyser();
	analyserVisual.fftSize = 2048;
	analyserVisual.smoothingTimeConstant = 0.85;

	analyserBeat.connect(analyserVisual);
	analyserVisual.connect(ctx.destination);
}

export function createAudioBridge(_ctx: CanvasRenderingContext2D): {
	initAudio: (el: HTMLAudioElement, stationKey: string) => void;
	destroyAudio: () => void;
	resumeCtx: () => void;
} {
	function initAudio(el: HTMLAudioElement, stationKey: string): void {
		const ctx = getAudioCtx();
		ensureAnalysers(ctx);

		if (!sourceRegistry.has(el)) {
			const source = ctx.createMediaElementSource(el);
			sourceRegistry.set(el, source);
			source.connect(analyserBeat!);
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
		analyserBeat = null;
		analyserVisual = null;
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

export function getStationKey(): string {
	return currentStationKey;
}

export function resumeCtx(): void {
	if (audioCtx && audioCtx.state === "suspended") {
		audioCtx.resume();
	}
}
