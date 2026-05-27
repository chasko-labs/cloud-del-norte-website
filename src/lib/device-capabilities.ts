// Wave 53 — centralized device capability detection for Babylon gating.
// All Babylon scenes are accessories, not bones. CSS + skeletons load first;
// Babylon enhances capable devices after first paint.

export type DeviceTier = "high" | "medium" | "low";

/** Detect software-rendered WebGL (SwiftShader / llvmpipe / Mesa / MSBRD). */
export function isSoftwareWebGL(): boolean {
	try {
		const probe = document.createElement("canvas");
		const gl = (probe.getContext("webgl2") ||
			probe.getContext("webgl")) as WebGLRenderingContext | null;
		if (!gl) return false;
		const ext = gl.getExtension("WEBGL_debug_renderer_info");
		const renderer = ext
			? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
			: "";
		// Explicitly release the probe's WebGL context so Chrome reclaims it
		// immediately rather than waiting for GC. The probe is called early
		// in page load and can otherwise occupy a context slot for seconds.
		gl.getExtension("WEBGL_lose_context")?.loseContext?.();
		return /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(
			renderer,
		);
	} catch {
		return false;
	}
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
