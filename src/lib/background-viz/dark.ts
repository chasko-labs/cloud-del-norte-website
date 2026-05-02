import type { StarPoint } from "./static.js";

interface Ring {
	x: number;
	y: number;
	startTs: number;
	color: string;
}

/**
 * Per-band peak detection state. Each band fires its own burst at a consistent
 * star position so the visual correlation between audio range and on-screen
 * pulse stays legible — bryan v0.0.0066: "the randomness makes hard to see
 * the correlation". bass = warm orange, mid = brand violet, treble = lavender.
 */
type Band = "bass" | "mid" | "treble";
const BAND_COLOR: Record<Band, string> = {
	bass: "255,153,0", // aws-orange
	mid: "144,96,240", // cdn-violet
	treble: "215,199,238", // cdn-lavender
};
/** debounce per band — prevents burst spam during sustained loud passages */
const BAND_DEBOUNCE_MS = 380;
/** transient threshold — curr must exceed prevSmoothed by this delta */
const BAND_TRANSIENT_DELTA = 0.18;
/** floor — band must reach at least this amplitude to trigger any burst */
const BAND_FLOOR = 0.28;

interface BandState {
	prev: number;
	lastBurstTs: number;
}
const bandState: Record<Band, BandState> = {
	bass: { prev: 0, lastBurstTs: -Infinity },
	mid: { prev: 0, lastBurstTs: -Infinity },
	treble: { prev: 0, lastBurstTs: -Infinity },
};

let nebulaAlpha = 0.32;
const rings: Ring[] = [];

function normBand(bins: Uint8Array, lo: number, hi: number): number {
	const end = Math.min(hi, bins.length);
	const start = Math.min(lo, end);
	if (start >= end) return 0;
	let sum = 0;
	for (let i = start; i < end; i++) sum += bins[i];
	return Math.min(1, sum / ((end - start) * 255));
}

/**
 * Pick a deterministic anchor star per band — order-stable index lookup so
 * the same star always lights up for the same band across the session. Falls
 * back to a viewport-fraction position when the bright-star list is empty.
 */
function bandAnchor(
	band: Band,
	brightStars: StarPoint[],
	w: number,
	h: number,
): { x: number; y: number } {
	if (brightStars.length > 0) {
		const idx =
			band === "bass"
				? 0
				: band === "mid"
					? 1 % brightStars.length
					: 2 % brightStars.length;
		const s = brightStars[Math.min(idx, brightStars.length - 1)];
		return { x: s.x, y: s.y };
	}
	if (band === "bass") return { x: w * 0.22, y: h * 0.78 };
	if (band === "mid") return { x: w * 0.5, y: h * 0.5 };
	return { x: w * 0.78, y: h * 0.22 };
}

export function renderDark(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	ts: number,
	_beatFired: boolean,
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
		ctx.fillStyle = "#0a0c14";
		ctx.fillRect(0, 0, w, h);
	}

	const bass = normBand(visualBins, 0, 10);
	const mid = normBand(visualBins, 60, 120);
	const treble = normBand(visualBins, 150, 200);

	const isKexp = stationKey === "kexp";

	// nebula pulse
	const targetNebulaAlpha = 0.32 + bass * 0.12;
	nebulaAlpha += (targetNebulaAlpha - nebulaAlpha) * 0.04;

	const nr = isKexp ? 30 : 48;
	const ng = 0;
	const nb = isKexp ? 80 : 106;

	const nx = w * 0.8;
	const ny = h * 0.85;
	const nebulaGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, w * 0.45);
	nebulaGrad.addColorStop(
		0,
		`rgba(${nr},${ng},${nb},${nebulaAlpha.toFixed(3)})`,
	);
	nebulaGrad.addColorStop(1, `rgba(${nr},${ng},${nb},0)`);
	ctx.fillStyle = nebulaGrad;
	ctx.fillRect(0, 0, w, h);

	// Per-band burst rings. Each band has its own anchor star + color so the
	// audio→visual correlation reads clearly. Random per-burst placement was
	// the v0.0.0065 behavior; bryan flagged it as too noisy to follow.
	const brightStars = starPositions.filter((s) => s.bright);
	const bands: Array<{ band: Band; amp: number }> = [
		{ band: "bass", amp: bass },
		{ band: "mid", amp: mid },
		{ band: "treble", amp: treble },
	];
	for (const { band, amp } of bands) {
		const st = bandState[band];
		const transient = amp - st.prev > BAND_TRANSIENT_DELTA;
		const cooled = ts - st.lastBurstTs > BAND_DEBOUNCE_MS;
		if (amp > BAND_FLOOR && transient && cooled) {
			const anchor = bandAnchor(band, brightStars, w, h);
			rings.push({
				x: anchor.x,
				y: anchor.y,
				startTs: ts,
				color: BAND_COLOR[band],
			});
			st.lastBurstTs = ts;
		}
		st.prev = st.prev * 0.6 + amp * 0.4;
	}

	// draw and cull rings
	const maxDim = Math.min(w, h);
	for (let i = rings.length - 1; i >= 0; i--) {
		const ring = rings[i];
		const elapsed = ts - ring.startTs;
		if (elapsed > 1500) {
			rings.splice(i, 1);
			continue;
		}
		const progress = elapsed / 1500;
		const alpha = (1 - progress) * (1 - progress) * 0.6;
		const radius = progress * maxDim * 0.6;
		const lineWidth = 2 * (1 - progress);

		ctx.save();
		ctx.beginPath();
		ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
		ctx.strokeStyle = `rgba(${ring.color},${alpha.toFixed(3)})`;
		ctx.lineWidth = lineWidth;
		ctx.stroke();
		ctx.restore();
	}

	// star scintillation
	if (!lowPower && starPositions.length > 0) {
		const nonBright = starPositions.filter((s) => !s.bright);
		ctx.save();
		for (let i = 0; i < 3; i++) {
			const star = nonBright[Math.floor(Math.random() * nonBright.length)];
			if (!star) continue;
			const boostOpacity = Math.min(1, star.opacity + 0.35 * treble);
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(255,255,255,${boostOpacity.toFixed(3)})`;
			ctx.fill();
		}
		ctx.restore();
	}
}

export function resetDarkState(): void {
	nebulaAlpha = 0.32;
	rings.length = 0;
	for (const band of ["bass", "mid", "treble"] as Band[]) {
		bandState[band].prev = 0;
		bandState[band].lastBurstTs = -Infinity;
	}
}
