// Wave 53 — centralized device capability detection for Babylon gating.
// All Babylon scenes are accessories, not bones. CSS + skeletons load first;
// Babylon enhances capable devices after first paint.
//
// Issue #382 — ?babylon-tier=high|medium|low|reset URL override (session-scoped).
// Lets reporters and QA force a specific tier without changing OS/browser flags.
// Visit ?babylon-tier=high to bypass the gate; ?babylon-tier=reset to clear.

export type DeviceTier = "high" | "medium" | "low";

const SOFTWARE_RENDERER_RE =
	/SwiftShader|llvmpipe|Software|Microsoft Basic Render/i;

const TIER_OVERRIDE_STORAGE_KEY = "cdn-babylon-tier-override";
const TIER_OVERRIDE_URL_PARAM = "babylon-tier";

function isDeviceTier(value: string): value is DeviceTier {
	return value === "high" || value === "medium" || value === "low";
}

/**
 * Read a session-scoped tier override.
 *
 * Resolution order:
 *  1. `?babylon-tier=high|medium|low` in the current URL  — writes to
 *     sessionStorage so subsequent navigations within the tab keep the
 *     override without needing the param again.
 *  2. `?babylon-tier=reset` in the current URL  — clears any stored
 *     override and returns null (real probes run).
 *  3. Existing sessionStorage value from a prior URL visit in this tab.
 *  4. Otherwise null — caller falls back to capability probes.
 *
 * Storage failures (Safari private mode, sandboxed contexts) are swallowed:
 * the override still works for the current call, just not persisted.
 */
export function readTierOverride(): DeviceTier | null {
	if (typeof window === "undefined") return null;

	let urlValue: string | null = null;
	try {
		urlValue = new URLSearchParams(window.location.search).get(
			TIER_OVERRIDE_URL_PARAM,
		);
	} catch {
		/* malformed URL — ignore */
	}

	if (urlValue === "reset") {
		try {
			window.sessionStorage.removeItem(TIER_OVERRIDE_STORAGE_KEY);
		} catch {
			/* storage unavailable — still return null */
		}
		return null;
	}

	if (urlValue !== null && isDeviceTier(urlValue)) {
		try {
			window.sessionStorage.setItem(TIER_OVERRIDE_STORAGE_KEY, urlValue);
		} catch {
			/* storage unavailable — override still applies for this call */
		}
		return urlValue;
	}

	try {
		const stored = window.sessionStorage.getItem(TIER_OVERRIDE_STORAGE_KEY);
		if (stored !== null && isDeviceTier(stored)) return stored;
	} catch {
		/* storage unavailable — fall through */
	}

	return null;
}

/**
 * One-shot WebGL probe. Returns whether a WebGL context could be obtained and
 * the UNMASKED_RENDERER_WEBGL string (empty when the extension is blocked).
 * Disposes the probe context immediately so Chrome reclaims the slot rather
 * than waiting for GC.
 *
 * The `available` flag distinguishes "no WebGL at all" (e.g. Tor browser,
 * disabled in flags) from "WebGL works but the renderer string is masked".
 * Callers that previously inferred a missing context from an empty renderer
 * string can now check `available` directly.
 */
function probeWebGL(): { available: boolean; renderer: string } {
	try {
		const probe = document.createElement("canvas");
		const gl = (probe.getContext("webgl2") ||
			probe.getContext("webgl")) as WebGLRenderingContext | null;
		if (!gl) return { available: false, renderer: "" };
		const ext = gl.getExtension("WEBGL_debug_renderer_info");
		const renderer = ext
			? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
			: "";
		gl.getExtension("WEBGL_lose_context")?.loseContext?.();
		return { available: true, renderer };
	} catch {
		return { available: false, renderer: "" };
	}
}

/** Detect software-rendered WebGL (SwiftShader / llvmpipe / Mesa / MSBRD). */
export function isSoftwareWebGL(): boolean {
	return SOFTWARE_RENDERER_RE.test(probeWebGL().renderer);
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
 *
 * Honours `?babylon-tier=...` URL override when present (issue #382).
 */
export function getDeviceTier(): DeviceTier {
	const override = readTierOverride();
	if (override !== null) return override;
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
	/** UNMASKED_RENDERER_WEBGL string — empty when extension blocked OR WebGL unavailable. */
	renderer: string;
	/** True when a WebGL (or WebGL2) context could be obtained. False on Tor / disabled-WebGL. */
	webglAvailable: boolean;
	/** navigator.deviceMemory in GB; undefined on Firefox/Safari. */
	deviceMemory: number | undefined;
	/** navigator.hardwareConcurrency. */
	hardwareConcurrency: number;
	/** When non-null, ?babylon-tier=... or sessionStorage forced the tier (issue #382). */
	override: DeviceTier | null;
}

/**
 * Single-probe diagnostic snapshot for logging. Captures every signal that
 * feeds the tier decision so a downstream caller can log "why did this device
 * land in low tier?" without re-running each helper. Includes the URL/session
 * override state so logs make it obvious when a forced tier is in effect.
 */
export function getDeviceDiagnostics(): DeviceDiagnostics {
	const override = readTierOverride();
	const { available: webglAvailable, renderer } = probeWebGL();
	const softwareWebGL = SOFTWARE_RENDERER_RE.test(renderer);
	const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
		.deviceMemory;
	const hardwareConcurrency = navigator.hardwareConcurrency;
	const lowMemory = deviceMemory !== undefined ? deviceMemory < 4 : false;
	const fewCores = hardwareConcurrency < 4;

	let tier: DeviceTier;
	if (override !== null) {
		tier = override;
	} else if (reducedMotion || softwareWebGL || (lowMemory && fewCores)) {
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
		webglAvailable,
		deviceMemory,
		hardwareConcurrency,
		override,
	};
}
