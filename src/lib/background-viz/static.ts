export interface StarPoint {
	x: number;
	y: number;
	size: number;
	opacity: number;
	bright: boolean;
	constellation: boolean; // true = part of the ⭐ outline cluster
}

/** Compute the 10 vertices of a 5-pointed star centred at (cx,cy). */
function starVerts(
	cx: number,
	cy: number,
	R: number,
	r: number,
): [number, number][] {
	const pts: [number, number][] = [];
	for (let i = 0; i < 10; i++) {
		const angle = (i * Math.PI) / 5 - Math.PI / 2; // top-point up
		const radius = i % 2 === 0 ? R : r;
		pts.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
	}
	return pts;
}

export function generateStarPositions(w: number, h: number): StarPoint[] {
	const stars: StarPoint[] = [];

	// ── ⭐ constellation outline ──────────────────────────────────────────────
	// Centre upper-right quadrant so it's visible but doesn't compete with cards.
	const cx = w * 0.62;
	const cy = h * 0.28;
	const R = Math.min(w, h) * 0.26; // outer radius
	const r = R * 0.42; // inner radius (slightly fatter than pure ≈0.382)
	const verts = starVerts(cx, cy, R, r);

	const outlineCount = 90;
	const jitter = R * 0.04;
	for (let i = 0; i < outlineCount; i++) {
		const seg = Math.floor(Math.random() * 10);
		const t = Math.random();
		const [x1, y1] = verts[seg];
		const [x2, y2] = verts[(seg + 1) % 10];
		stars.push({
			x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 2 * jitter,
			y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 2 * jitter,
			size: 0.9 + Math.random() * 1.3,
			opacity: 0.55 + Math.random() * 0.45,
			bright: false,
			constellation: true,
		});
	}

	// ── background star field ────────────────────────────────────────────────
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
	starPositions: StarPoint[],
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

	// ⭐ constellation as faint warm-amber dots on the cream static layer
	ctx.save();
	for (const star of starPositions) {
		if (!star.constellation) continue;
		const alpha = star.opacity * 0.22; // subdued on static layer
		ctx.beginPath();
		ctx.arc(star.x, star.y, star.size * 0.85, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(139,90,43,${alpha.toFixed(3)})`;
		ctx.fill();
	}
	ctx.restore();

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

	// star field — constellation stars rendered slightly brighter
	for (const star of starPositions) {
		const opacityBoost = star.constellation ? 1.18 : 1;
		ctx.beginPath();
		ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(255,255,255,${Math.min(1, star.opacity * opacityBoost).toFixed(3)})`;
		ctx.fill();
	}

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
