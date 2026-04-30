import { getBeatData, getStationKey, getVisualData } from "./audio.js";
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

let staticLightCanvas: OffscreenCanvas | null = null;
let staticDarkCanvas: OffscreenCanvas | null = null;
let starPositions: StarPoint[] = [];
let lastMode: boolean | null = null; // null = unset

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function normBand(bins: Uint8Array, lo: number, hi: number): number {
	const end = Math.min(hi, bins.length);
	const start = Math.min(lo, end);
	if (start >= end) return 0;
	let sum = 0;
	for (let i = start; i < end; i++) sum += bins[i];
	return Math.min(1, sum / ((end - start) * 255));
}

function rebuildStaticLayers(w: number, h: number): void {
	starPositions = generateStarPositions(w, h);
	staticLightCanvas = buildStaticLight(w, h);
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
	el.style.cssText =
		"position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none";
	document.body.appendChild(el);

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

	const w = window.innerWidth;
	const h = window.innerHeight;

	const bass = normBand(visualBins, 0, 10);
	const mid = normBand(visualBins, 10, 100);

	document.documentElement.style.setProperty("--cdn-bass", bass.toFixed(3));
	document.documentElement.style.setProperty("--cdn-mid", mid.toFixed(3));

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
