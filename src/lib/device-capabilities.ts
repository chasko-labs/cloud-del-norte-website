// Wave 53 — centralized device capability detection for Babylon gating.
// All Babylon scenes are accessories, not bones. CSS + skeletons load first;
// Babylon enhances capable devices after first paint.

export type DeviceTier = "high" | "medium" | "low";

const SOFTWARE_RENDERER_RE =
	/SwiftShader|llvmpipe|Software|Microsoft Basic Render/i;

/**
 * One-shot WebGL probe. Returns the UNMASKED_RENDERER_WEBGL string (or "") and
 * disposes the probe context immediately so Chrome reclaims the slot rather
 * than waiting for GC.
 */
function probeRenderer(): string {
	try {
		const probe = document.createElement("canvas");
		const gl = (probe.getContext("webgl2") ||
			probe.getContext("webgl")) as WebGLRenderingContext | null;
		if (!gl) return "";
		const ext = gl.getExtension("WEBGL_debug_renderer_info");
		const renderer = ext
			? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
			: "";
		gl.getExtension("WEBGL_lose_context")?.loseContext?.();
		return renderer;
	} catch {
		return "";
	}
}

/** Detect software-rendered WebGL (SwiftShader / llvmpipe / Mesa / MSBRD). */
export function isSoftwareWebGL(): boolean {
	return SOFTWARE_RENDERER_RE.test(probeRenderer());
}

/**
 * True when deviceMemory < 4 GB.
 * Undefined on Firefox/Safari — default false (no over-restriction).
 */
export function hasLowMemory(): boolean {
	const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
	return mem !== undefined ? mem < 4 : false;
}

/** True when hardwareConcurrency < 4. */
export function hasFewCores(): boolean {
	return navigator.hardwareConcurrency < 4;
}

/** True when the user has requested reduced motion. */
export function prefersReducedMotion(): boolean {
	return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Gate: true when device can run Babylon scenes.
 *
 * Fails when:
 * - software WebGL (would chug regardless of tier)
 * - BOTH low memory AND few cores (double-constrained)
 * - prefers-reduced-motion (always fail-closed)
 *
 * MacBook Air M-series: 8 GB RAM (not low) + 8 cores → capable.
 * Pixel 10: ample RAM + many cores → capable.
 */
export function isCapableForBabylon(): boolean {
	if (prefersReducedMotion()) return false;
	if (isSoftwareWebGL()) return false;
	if (hasLowMemory() && hasFewCores()) return false;
	return true;
}

/**
 * Fine-grained tier for scenes with multiple quality levels.
 *
 * high   — capable + ≥8 GB RAM + ≥8 cores  (Pixel 10, MacBook Air M-series)
 * medium — capable but constrained           (older Intel MacBook Air, mid-range Android)
 * low    — not capable                       (Pixel 4, VMs, software WebGL)
 */
export function getDeviceTier(): DeviceTier {
	if (!isCapableForBabylon()) return "low";
	const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
	const cores = navigator.hardwareConcurrency;
	const highMem = mem === undefined ? true : mem >= 8;
	const highCores = cores >= 8;
	if (highMem && highCores) return "high";
	return "medium";
}

/** Diagnostic snapshot: every signal that contributes to the tier decision. */
export interface DeviceDiagnostics {
	tier: DeviceTier;
	reducedMotion: boolean;
	softwareWebGL: boolean;
	lowMemory: boolean;
	fewCores: boolean;
	/** UNMASKED_RENDERER_WEBGL string — empty when WebGL unavailable / extension blocked. */
	renderer: string;
	/** navigator.deviceMemory in GB; undefined on Firefox/Safari. */
	deviceMemory: number | undefined;
	/** navigator.hardwareConcurrency. */
	hardwareConcurrency: number;
}

/**
 * Single-probe diagnostic snapshot for logging. Captures every signal that
 * feeds the tier decision so a downstream caller can log "why did this device
 * land in low tier?" without re-running each helper (each WebGL probe creates
 * and disposes a context — fine for one shot, wasteful in a loop).
 */
export function getDeviceDiagnostics(): DeviceDiagnostics {
	const renderer = probeRenderer();
	const softwareWebGL = SOFTWARE_RENDERER_RE.test(renderer);
	const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
		.deviceMemory;
	const hardwareConcurrency = navigator.hardwareConcurrency;
	const lowMemory = deviceMemory !== undefined ? deviceMemory < 4 : false;
	const fewCores = hardwareConcurrency < 4;

	let tier: DeviceTier;
	if (reducedMotion || softwareWebGL || (lowMemory && fewCores)) {
		tier = "low";
	} else {
		const highMem = deviceMemory === undefined ? true : deviceMemory >= 8;
		const highCores = hardwareConcurrency >= 8;
		tier = highMem && highCores ? "high" : "medium";
	}

	return {
		tier,
		reducedMotion,
		softwareWebGL,
		lowMemory,
		fewCores,
		renderer,
		deviceMemory,
		hardwareConcurrency,
	};
}
