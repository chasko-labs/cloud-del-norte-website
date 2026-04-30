const HISTORY_SIZE = 60;
const TRIGGER_RATIO = 1.5;
const GATE_MS = 200;

const fluxHistory: number[] = [];
let lastBeat = 0;
let prevBins: Uint8Array | null = null;

export function detectBeat(ts: number, currBins: Uint8Array): boolean {
	if (!prevBins || prevBins.length !== currBins.length) {
		prevBins = new Uint8Array(currBins);
		return false;
	}

	let flux = 0;
	for (let i = 0; i < currBins.length; i++) {
		flux += Math.max(0, currBins[i] - prevBins[i]);
	}
	prevBins.set(currBins);

	fluxHistory.push(flux);
	if (fluxHistory.length > HISTORY_SIZE) fluxHistory.shift();

	const avg = fluxHistory.reduce((a, b) => a + b, 0) / fluxHistory.length;

	if (flux > avg * TRIGGER_RATIO && ts - lastBeat > GATE_MS) {
		lastBeat = ts;
		return true;
	}
	return false;
}

export function resetBeat() {
	fluxHistory.length = 0;
	prevBins = null;
	lastBeat = 0;
}
