import type { StarPoint } from "./static.js";

// dust mote state
interface DustMote {
	x: number;
	y: number;
	baseX: number;
	opacity: number;
}

const MOTE_COUNT = 40;
let motes: DustMote[] = [];
let motesInitialized = false;

// bloom lerp state
let bloomRadius = 0;
let bloomAlpha = 0.12;
let bloomWarm = 0; // 0 = cool base, 1 = beat-warm

let lastBeatTs = -Infinity;

function initMotes(w: number, h: number): void {
	motes = [];
	for (let i = 0; i < MOTE_COUNT; i++) {
		const x = Math.random() * w;
		motes.push({
			x,
			y: Math.random() * h,
			baseX: x,
			opacity: 0.12,
		});
	}
	motesInitialized = true;
}

function normBand(bins: Uint8Array, lo: number, hi: number): number {
	const end = Math.min(hi, bins.length);
	const start = Math.min(lo, end);
	if (start >= end) return 0;
	let sum = 0;
	for (let i = start; i < end; i++) sum += bins[i];
	return Math.min(1, sum / ((end - start) * 255));
}

export function renderLight(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	ts: number,
	beatFired: boolean,
	visualBins: Uint8Array,
	stationKey: string,
	lowPower: boolean,
	staticCanvas: OffscreenCanvas | null,
	starPositions: StarPoint[],
): void {
	// draw static base layer
	if (staticCanvas) {
		ctx.drawImage(staticCanvas, 0, 0);
	} else {
		ctx.fillStyle = "#ede5d4";
		ctx.fillRect(0, 0, w, h);
	}

	// no constellation stars — light mode concept uses logo watermark in static layer

	const bass = normBand(visualBins, 0, 10);
	const mid = normBand(visualBins, 10, 100);
	const treble = normBand(visualBins, 150, 200);

	// bloom radius lerp
	const targetRadius = w * (0.55 + bass * 0.22);
	bloomRadius += (targetRadius - bloomRadius) * 0.06;
	if (bloomRadius === 0) bloomRadius = w * 0.55;

	// bloom warm lerp
	if (beatFired) {
		bloomWarm = 1;
		lastBeatTs = ts;
	}
	const elapsedBeat = ts - lastBeatTs;
	const warmTarget = elapsedBeat < 800 ? 1 - elapsedBeat / 800 : 0;
	bloomWarm += (warmTarget - bloomWarm) * 0.06;

	// bloom alpha lerp toward base 0.12
	const targetAlpha = 0.12 + bass * 0.06;
	bloomAlpha += (targetAlpha - bloomAlpha) * 0.06;

	// amber spotlight bloom — top-left origin
	const bx = w * 0.25;
	const by = h * 0.15;
	const bloomGrad = ctx.createRadialGradient(bx, by, 0, bx, by, bloomRadius);

	// interpolate between amber base and beat-warm terracotta
	const r = Math.round(201 + bloomWarm * (196 - 201));
	const g = Math.round(162 + bloomWarm * (98 - 162));
	const b = Math.round(63 + bloomWarm * (45 - 63));
	const alpha = (bloomAlpha + bloomWarm * (0.18 - 0.12)).toFixed(3);

	bloomGrad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
	bloomGrad.addColorStop(1, "rgba(201,162,63,0)");
	ctx.fillStyle = bloomGrad;
	ctx.fillRect(0, 0, w, h);

	// counter-spotlight bottom-right
	const isKexp = stationKey === "kexp";
	const cr = isKexp ? 80 : 144;
	const cg = isKexp ? 120 : 96;
	const cb = isKexp ? 180 : 240;
	const counterAlpha = (0.08 + mid * 0.03).toFixed(3);
	const counterGrad = ctx.createRadialGradient(
		w * 0.9,
		h * 0.9,
		0,
		w * 0.9,
		h * 0.9,
		w * 0.5,
	);
	counterGrad.addColorStop(0, `rgba(${cr},${cg},${cb},${counterAlpha})`);
	counterGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
	ctx.fillStyle = counterGrad;
	ctx.fillRect(0, 0, w, h);

	// dust motes
	if (!lowPower) {
		if (!motesInitialized) initMotes(w, h);

		ctx.save();
		for (let i = 0; i < motes.length; i++) {
			const mote = motes[i];

			// drift upward
			mote.y -= 0.3 + mid * 0.4;
			mote.x = mote.baseX + Math.sin(ts / 3000 + i) * 1.5;

			// wrap at top
			if (mote.y < -4) {
				mote.y = h + 4;
			}

			// opacity — spike on treble transient
			const targetOpacity = 0.12 + treble * 0.28;
			mote.opacity += (targetOpacity - mote.opacity) * 0.1;

			const radius = 1 + treble * 0.5;
			ctx.beginPath();
			ctx.arc(mote.x, mote.y, radius, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(201,162,63,${mote.opacity.toFixed(3)})`;
			ctx.fill();
		}
		ctx.restore();
	}
}

export function resetLightState(): void {
	motesInitialized = false;
	bloomRadius = 0;
	bloomAlpha = 0.12;
	bloomWarm = 0;
	lastBeatTs = -Infinity;
}
