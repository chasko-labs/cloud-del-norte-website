import type { StarPoint } from "./static.js";

interface Ring {
	x: number;
	y: number;
	startTs: number;
	color: string;
}

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

export function renderDark(
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
		ctx.fillStyle = "#0a0c14";
		ctx.fillRect(0, 0, w, h);
	}

	const bass = normBand(visualBins, 0, 10);
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

	// ring waves on beat
	const brightStars = starPositions.filter((s) => s.bright);

	if (beatFired && brightStars.length > 0) {
		const origin = brightStars[Math.floor(Math.random() * brightStars.length)];
		rings.push({
			x: origin.x,
			y: origin.y,
			startTs: ts,
			color: "68,136,255",
		});
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
}
