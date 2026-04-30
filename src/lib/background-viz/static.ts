export interface StarPoint {
	x: number;
	y: number;
	size: number;
	opacity: number;
	bright: boolean;
	constellation: boolean; // always false — field kept for interface compat
}

// ── Logo watermark ───────────────────────────────────────────────────────────
let logoBitmap: ImageBitmap | null = null;

export async function preloadLogo(): Promise<void> {
	try {
		const resp = await fetch("/brand/logo.svg");
		if (!resp.ok) return;
		const blob = await resp.blob();
		logoBitmap = await createImageBitmap(blob);
	} catch {
		// watermark simply won't render — non-critical
	}
}

function drawLogoWatermark(
	ctx: OffscreenCanvasRenderingContext2D,
	w: number,
	h: number,
	mode: "light" | "dark",
): void {
	if (!logoBitmap) return;

	const scale = Math.min(
		(w * 0.52) / logoBitmap.width,
		(h * 0.38) / logoBitmap.height,
	);
	const lw = logoBitmap.width * scale;
	const lh = logoBitmap.height * scale;
	const lx = (w - lw) / 2;
	const ly = h * 0.22 - lh / 2;

	ctx.save();

	if (mode === "light") {
		// tint white logo paths to warm amber using source-in composite
		const tmp = new OffscreenCanvas(Math.ceil(lw), Math.ceil(lh));
		const tc = tmp.getContext("2d")!;
		tc.drawImage(logoBitmap, 0, 0, lw, lh);
		tc.globalCompositeOperation = "source-in";
		tc.fillStyle = "rgba(139,90,43,1)";
		tc.fillRect(0, 0, lw, lh);
		ctx.globalAlpha = 0.1;
		ctx.drawImage(tmp, lx, ly);
	} else {
		ctx.globalAlpha = 0.07;
		ctx.drawImage(logoBitmap, lx, ly, lw, lh);
	}

	ctx.restore();
}

export function generateStarPositions(w: number, h: number): StarPoint[] {
	const stars: StarPoint[] = [];

	// background star field — dark mode only; no constellation
	for (let i = 0; i < 260; i++) {
		stars.push({
			x: Math.random() * w,
			y: Math.random() * h,
			size: 0.4 + Math.random() * 1.2,
			opacity: 0.18 + Math.random() * 0.45,
			bright: false,
			constellation: false,
		});
	}

	// sort descending by opacity, mark top 20 as bright
	stars.sort((a, b) => b.opacity - a.opacity);
	for (let i = 0; i < 20; i++) {
		stars[i].bright = true;
	}

	return stars;
}

export function buildStaticLight(
	w: number,
	h: number,
	_starPositions: StarPoint[],
): OffscreenCanvas {
	const canvas = new OffscreenCanvas(w, h);
	const ctx = canvas.getContext("2d")!;

	// base cream fill
	ctx.fillStyle = "#ede5d4";
	ctx.fillRect(0, 0, w, h);

	// diagonal paper grain via repeating thin lines
	ctx.save();
	ctx.strokeStyle = "rgba(139,90,43,0.018)";
	ctx.lineWidth = 2;
	const diagSpacing = 5;
	const angle = (8 * Math.PI) / 180;
	const diagLen = Math.sqrt(w * w + h * h);
	ctx.translate(w / 2, h / 2);
	ctx.rotate(angle);
	const halfLen = diagLen / 2;
	const numLines = Math.ceil(diagLen / diagSpacing) * 2;
	for (let i = -numLines; i <= numLines; i++) {
		const offset = i * diagSpacing;
		ctx.beginPath();
		ctx.moveTo(-halfLen, offset);
		ctx.lineTo(halfLen, offset);
		ctx.stroke();
	}
	ctx.restore();

	// logo watermark — amber-tinted, very faint
	drawLogoWatermark(ctx, w, h, "light");

	return canvas;
}

export function buildStaticDark(
	w: number,
	h: number,
	starPositions: StarPoint[],
): OffscreenCanvas {
	const canvas = new OffscreenCanvas(w, h);
	const ctx = canvas.getContext("2d")!;

	// base dark fill
	ctx.fillStyle = "#0a0c14";
	ctx.fillRect(0, 0, w, h);

	// star field
	for (const star of starPositions) {
		ctx.beginPath();
		ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(255,255,255,${Math.min(1, star.opacity).toFixed(3)})`;
		ctx.fill();
	}

	// logo watermark — white, very faint
	drawLogoWatermark(ctx, w, h, "dark");

	// galactic smear — off-axis ellipse using scale trick
	ctx.save();
	const cx = w * 0.45;
	const cy = h * 0.4;
	const rx = w * 0.55;
	const ry = h * 0.12;
	ctx.translate(cx, cy);
	ctx.rotate(-0.3);
	ctx.scale(1, ry / rx);
	const smearGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
	smearGrad.addColorStop(0, "rgba(220,180,80,0.04)");
	smearGrad.addColorStop(1, "rgba(220,180,80,0)");
	ctx.fillStyle = smearGrad;
	ctx.beginPath();
	ctx.arc(0, 0, rx, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	// airglow band near bottom 15%
	const airglowGrad = ctx.createLinearGradient(0, h * 0.8, 0, h * 0.95);
	airglowGrad.addColorStop(0, "rgba(100,180,100,0)");
	airglowGrad.addColorStop(0.5, "rgba(100,180,100,0.025)");
	airglowGrad.addColorStop(1, "rgba(100,180,100,0)");
	ctx.fillStyle = airglowGrad;
	ctx.fillRect(0, h * 0.8, w, h * 0.15);

	// el paso glow at bottom 5%
	const elpasoGrad = ctx.createLinearGradient(0, h * 0.95, 0, h);
	elpasoGrad.addColorStop(0, "rgba(255,140,40,0)");
	elpasoGrad.addColorStop(1, "rgba(255,140,40,0.03)");
	ctx.fillStyle = elpasoGrad;
	ctx.fillRect(0, h * 0.95, w, h * 0.05);

	return canvas;
}
