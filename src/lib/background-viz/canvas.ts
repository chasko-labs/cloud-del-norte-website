import {
	getBandBass,
	getBandMid,
	getBandTreble,
	getBeatData,
	getStationKey,
	getVisualData,
} from "./audio.js";
import { detectBeat } from "./beat.js";
import { isDark, render } from "./renderer.js";
import {
	buildStaticDark,
	buildStaticLight,
	generateStarPositions,
	type StarPoint,
} from "./static.js";

const dpr = window.devicePixelRatio || 1;
const FRAME_MS = navigator.hardwareConcurrency <= 2 ? 33 : 16;

let rafId: number | null = null;
let running = false;
let lowPower = false;
let firstFrame = true;
let beatCount = 0;

let staticLightCanvas: OffscreenCanvas | null = null;
let staticDarkCanvas: OffscreenCanvas | null = null;
let starPositions: StarPoint[] = [];
let lastMode: boolean | null = null; // null = unset

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Spectral centroid — frequency-weighted mean of the magnitude spectrum.
// Low value (~0.05) = bass-heavy, high (~0.5+) = treble/transient-rich.
// Returned normalized to 0..1 over the active bin range.
function spectralCentroid(bins: Uint8Array): number {
	let weighted = 0;
	let total = 0;
	for (let i = 0; i < bins.length; i++) {
		weighted += i * bins[i];
		total += bins[i];
	}
	if (total === 0) return 0;
	return Math.min(1, weighted / (total * bins.length));
}

// Spectral flux — sum of positive bin-to-bin changes since last frame, normalized.
// Onset / transient detector. detectBeat() consumes raw flux internally; this
// produces a 0..1 signal suitable for CSS animation coupling.
const FLUX_MAX_DECAY = 0.995;
let prevFluxBins: Uint8Array | null = null;
let fluxMax = 1;
function spectralFlux(bins: Uint8Array): number {
	if (!prevFluxBins || prevFluxBins.length !== bins.length) {
		prevFluxBins = new Uint8Array(bins);
		return 0;
	}
	let flux = 0;
	for (let i = 0; i < bins.length; i++) {
		flux += Math.max(0, bins[i] - prevFluxBins[i]);
	}
	prevFluxBins.set(bins);
	// Adaptive max so quiet streams still produce a usable 0..1 signal.
	// Decay slowly so the normalisation doesn't track every momentary peak.
	fluxMax = Math.max(fluxMax * FLUX_MAX_DECAY, flux, 1);
	return Math.min(1, flux / fluxMax);
}

function rebuildStaticLayers(w: number, h: number): void {
	starPositions = generateStarPositions(w, h);
	staticLightCanvas = buildStaticLight(w, h, starPositions);
	staticDarkCanvas = buildStaticDark(w, h, starPositions);
}

export function rebuildStatic(): void {
	const w = canvas.width / dpr;
	const h = canvas.height / dpr;
	rebuildStaticLayers(w, h);
}

// canvas element
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

function createCanvas(): {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
} {
	const el = document.createElement("canvas");
	// z-index: -2 — sits BEHIND the dune canvas (z:-1) so dune always wins the
	// stacking battle. Previously this was -1 and the dune was -2; even with
	// opacity:0 set on this canvas after dune mounts, residual stacking-context
	// quirks could obscure the dune. Cream-fallback is the role here, so being
	// underneath is correct.
	el.style.cssText =
		"position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none";
	document.body.appendChild(el);
	document.documentElement.classList.add("cdn-viz-active");

	const context = el.getContext("2d");
	if (!context) throw new Error("canvas 2d context unavailable");

	return { canvas: el, ctx: context };
}

function sizeCanvas(): void {
	const w = window.innerWidth;
	const h = window.innerHeight;
	canvas.width = w * dpr;
	canvas.height = h * dpr;
	ctx.scale(dpr, dpr);
}

export function resize(): void {
	sizeCanvas();
	rebuildStatic();
}

let lastFrameTs = 0;

function frame(ts: number): void {
	if (!running) return;

	if (ts - lastFrameTs < FRAME_MS) {
		rafId = requestAnimationFrame(frame);
		return;
	}
	lastFrameTs = ts;

	const currentMode = isDark();
	if (lastMode !== null && lastMode !== currentMode) {
		rebuildStatic();
	}
	lastMode = currentMode;

	const visualBins = getVisualData();
	const beatBins = getBeatData();
	const stationKey = getStationKey();
	const beatFired = detectBeat(ts, beatBins);
	if (beatFired) beatCount++;

	const w = window.innerWidth;
	const h = window.innerHeight;

	// Filter-bank band amplitudes — cleaner separation than slicing FFT bins.
	// Bins-bleed at decade boundaries was visible as bass leaking into the mid
	// CSS prop on bass-heavy stations.
	const bass = getBandBass();
	const mid = getBandMid();
	let treble = getBandTreble();
	const centroid = spectralCentroid(visualBins);
	const flux = spectralFlux(visualBins);

	// Podcast mode: dampen treble (voice sibilance dominates otherwise),
	// let bass-driven shadows and slow ripples take over the visual.
	const isPodcastPlaying = document.body.classList.contains(
		"cdn-podcast-playing",
	);
	if (isPodcastPlaying) {
		treble *= 0.3;
	}

	const root = document.documentElement.style;
	root.setProperty("--cdn-bass", bass.toFixed(3));
	root.setProperty("--cdn-mid", mid.toFixed(3));
	root.setProperty("--cdn-treble", (treble * 0.4).toFixed(3));
	root.setProperty("--cdn-centroid", centroid.toFixed(3));
	root.setProperty("--cdn-flux", flux.toFixed(3));
	if (beatFired) {
		root.setProperty("--cdn-beat-count", String(beatCount));
		// Cycle LED bank class for liora panel — 4 banks, fire every 4th beat
		const bank = beatCount % 4;
		const body = document.body;
		body.classList.remove(
			"cdn-beat-bank-0",
			"cdn-beat-bank-1",
			"cdn-beat-bank-2",
			"cdn-beat-bank-3",
		);
		body.classList.add(`cdn-beat-bank-${bank}`);
	}

	const drawStart = performance.now();

	render(
		ctx,
		w,
		h,
		ts,
		beatFired,
		visualBins,
		stationKey,
		lowPower,
		staticLightCanvas,
		staticDarkCanvas,
		starPositions,
	);

	if (firstFrame) {
		const drawTime = performance.now() - drawStart;
		if (drawTime > 20) {
			lowPower = true;
		}
		firstFrame = false;
	}

	rafId = requestAnimationFrame(frame);
}

export function initCanvas(): {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	startLoop: () => void;
	stopLoop: () => void;
	resize: () => void;
} {
	const created = createCanvas();
	canvas = created.canvas;
	ctx = created.ctx;

	sizeCanvas();
	rebuildStatic();

	// Paint an immediate opaque frame so the canvas is never transparent.
	// On old Safari without OffscreenCanvas, a transparent canvas lets the
	// :root background bleed through before the rAF loop starts.
	const w0 = window.innerWidth;
	const h0 = window.innerHeight;
	render(
		ctx,
		w0,
		h0,
		0,
		false,
		new Uint8Array(1024),
		"",
		true,
		staticLightCanvas,
		staticDarkCanvas,
		starPositions,
	);

	if (reducedMotion) {
		// draw one static frame, no rAF
		const w = window.innerWidth;
		const h = window.innerHeight;
		render(
			ctx,
			w,
			h,
			0,
			false,
			new Uint8Array(1024),
			"",
			true,
			staticLightCanvas,
			staticDarkCanvas,
			starPositions,
		);
	}

	function startLoop(): void {
		if (reducedMotion) return;
		running = true;
		firstFrame = true;
		if (!rafId) {
			rafId = requestAnimationFrame(frame);
		}
	}

	function stopLoop(): void {
		running = false;
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	return { canvas, ctx, startLoop, stopLoop, resize };
}
