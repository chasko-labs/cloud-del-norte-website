// Wave 53 — unit tests for device-capabilities.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getDeviceDiagnostics,
	getDeviceTier,
	hasFewCores,
	hasLowMemory,
	isCapableForBabylon,
	isFionaForceOn,
	isSoftwareWebGL,
	prefersReducedMotion,
	readTierOverride,
	setTierOverride,
} from "../device-capabilities";

function mockCanvas(renderer: string | null) {
	const ext = renderer !== null ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null;
	const gl = {
		getExtension: vi.fn().mockReturnValue(ext),
		getParameter: vi.fn().mockReturnValue(renderer ?? ""),
	};
	vi.spyOn(document, "createElement").mockReturnValue({
		getContext: vi.fn().mockReturnValue(gl),
	} as unknown as HTMLCanvasElement);
}

function mockNav(overrides: {
	deviceMemory?: number | undefined;
	hardwareConcurrency?: number;
}) {
	Object.defineProperty(navigator, "deviceMemory", {
		configurable: true,
		get: () => overrides.deviceMemory,
	});
	Object.defineProperty(navigator, "hardwareConcurrency", {
		configurable: true,
		get: () => overrides.hardwareConcurrency ?? 8,
	});
}

function mockMotion(matches: boolean) {
	vi.spyOn(window, "matchMedia").mockReturnValue({
		matches,
		media: "(prefers-reduced-motion: reduce)",
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	} as unknown as MediaQueryList);
}

/** Issue #382 — set window.location.search via history.replaceState (jsdom). */
function mockUrl(search: string) {
	window.history.replaceState({}, "", search === "" ? "/" : `/${search}`);
}

beforeEach(() => {
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	// Issue #382 — reset URL + session override state between tests so the
	// override mechanism doesn't leak across cases.
	window.history.replaceState({}, "", "/");
	try {
		window.sessionStorage.clear();
	} catch {
		/* ignore */
	}
});

// ---------------------------------------------------------------------------
// isSoftwareWebGL
// ---------------------------------------------------------------------------
describe("isSoftwareWebGL", () => {
	it("returns true for SwiftShader renderer", () => {
		mockCanvas("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))");
		expect(isSoftwareWebGL()).toBe(true);
	});

	it("returns false for NVIDIA hardware renderer", () => {
		mockCanvas("NVIDIA GeForce RTX 4080/PCIe/SSE2");
		expect(isSoftwareWebGL()).toBe(false);
	});

	it("returns false when WebGL is unavailable", () => {
		vi.spyOn(document, "createElement").mockReturnValue({
			getContext: vi.fn().mockReturnValue(null),
		} as unknown as HTMLCanvasElement);
		expect(isSoftwareWebGL()).toBe(false);
	});

	it("returns false for llvmpipe renderer (matches software list)", () => {
		mockCanvas("llvmpipe (LLVM 15.0, 256 bits)");
		expect(isSoftwareWebGL()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// hasLowMemory
// ---------------------------------------------------------------------------
describe("hasLowMemory", () => {
	it("returns true when deviceMemory < 4", () => {
		mockNav({ deviceMemory: 2 });
		expect(hasLowMemory()).toBe(true);
	});

	it("returns false when deviceMemory >= 4", () => {
		mockNav({ deviceMemory: 8 });
		expect(hasLowMemory()).toBe(false);
	});

	it("returns false when deviceMemory is undefined (Firefox/Safari)", () => {
		mockNav({ deviceMemory: undefined });
		expect(hasLowMemory()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// hasFewCores
// ---------------------------------------------------------------------------
describe("hasFewCores", () => {
	it("returns true when hardwareConcurrency < 4", () => {
		mockNav({ hardwareConcurrency: 2 });
		expect(hasFewCores()).toBe(true);
	});

	it("returns false when hardwareConcurrency >= 4", () => {
		mockNav({ hardwareConcurrency: 8 });
		expect(hasFewCores()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// prefersReducedMotion
// ---------------------------------------------------------------------------
describe("prefersReducedMotion", () => {
	it("returns true when matchMedia matches", () => {
		mockMotion(true);
		expect(prefersReducedMotion()).toBe(true);
	});

	it("returns false when matchMedia does not match", () => {
		mockMotion(false);
		expect(prefersReducedMotion()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// isCapableForBabylon
// ---------------------------------------------------------------------------
describe("isCapableForBabylon", () => {
	it("returns true when prefers-reduced-motion is on (preference, not capability)", () => {
		mockMotion(true);
		mockCanvas("NVIDIA RTX 4080");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 8 });
		expect(isCapableForBabylon()).toBe(true);
	});

	it("returns false for software WebGL", () => {
		mockMotion(false);
		mockCanvas("SwiftShader");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 8 });
		expect(isCapableForBabylon()).toBe(false);
	});

	it("returns false when BOTH low memory AND few cores", () => {
		mockMotion(false);
		mockCanvas("NVIDIA RTX 4080");
		mockNav({ deviceMemory: 2, hardwareConcurrency: 2 });
		expect(isCapableForBabylon()).toBe(false);
	});

	it("returns true for low memory but many cores (MacBook Air M-series pattern)", () => {
		mockMotion(false);
		mockCanvas("Apple M3");
		mockNav({ deviceMemory: 8, hardwareConcurrency: 8 });
		expect(isCapableForBabylon()).toBe(true);
	});

	it("returns true for high-end device (Pixel 10 pattern)", () => {
		mockMotion(false);
		mockCanvas("Adreno 750");
		mockNav({ deviceMemory: 12, hardwareConcurrency: 9 });
		expect(isCapableForBabylon()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getDeviceTier
// ---------------------------------------------------------------------------
describe("getDeviceTier", () => {
	it("returns low when not capable (software WebGL)", () => {
		mockMotion(false);
		mockCanvas("SwiftShader");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 8 });
		expect(getDeviceTier()).toBe("low");
	});

	it("returns high for Pixel 10 (≥8 GB, ≥8 cores)", () => {
		mockMotion(false);
		mockCanvas("Adreno 750");
		mockNav({ deviceMemory: 12, hardwareConcurrency: 9 });
		expect(getDeviceTier()).toBe("high");
	});

	it("returns high for MacBook Air M-series (8 GB, 8 cores)", () => {
		mockMotion(false);
		mockCanvas("Apple M2");
		mockNav({ deviceMemory: 8, hardwareConcurrency: 8 });
		expect(getDeviceTier()).toBe("high");
	});

	it("returns medium for older Intel MacBook Air (4 cores, 8 GB)", () => {
		mockMotion(false);
		mockCanvas("Intel Iris Plus");
		mockNav({ deviceMemory: 8, hardwareConcurrency: 4 });
		// 8 GB (high mem) but only 4 cores (not ≥8) → medium
		expect(getDeviceTier()).toBe("medium");
	});

	it("returns high when reduced motion on but hardware is high-end (preference, not capability)", () => {
		mockMotion(true);
		mockCanvas("NVIDIA RTX 4080");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 16 });
		expect(getDeviceTier()).toBe("high");
	});
});

// ---------------------------------------------------------------------------
// getDeviceDiagnostics  (issue #382)
// ---------------------------------------------------------------------------
describe("getDeviceDiagnostics", () => {
	it("returns the full diagnostic shape with all signal keys", () => {
		mockMotion(false);
		mockCanvas("NVIDIA GeForce RTX 4080/PCIe/SSE2");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 12 });
		const d = getDeviceDiagnostics();
		expect(d).toEqual({
			tier: "high",
			reducedMotion: false,
			softwareWebGL: false,
			lowMemory: false,
			fewCores: false,
			renderer: "NVIDIA GeForce RTX 4080/PCIe/SSE2",
			webglAvailable: true,
			deviceMemory: 16,
			hardwareConcurrency: 12,
			override: null,
		});
	});

	it("reports tier=low + softwareWebGL=true on SwiftShader", () => {
		mockMotion(false);
		mockCanvas("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 8 });
		const d = getDeviceDiagnostics();
		expect(d.tier).toBe("low");
		expect(d.softwareWebGL).toBe(true);
		expect(d.reducedMotion).toBe(false);
		expect(d.renderer).toMatch(/SwiftShader/);
	});

	it("reports tier=high + reducedMotion=true on capable hardware with Reduce Motion", () => {
		mockMotion(true);
		mockCanvas("NVIDIA GeForce RTX 4080");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 12 });
		const d = getDeviceDiagnostics();
		expect(d.tier).toBe("high");
		expect(d.reducedMotion).toBe(true);
		expect(d.softwareWebGL).toBe(false);
	});

	it("reports lowMemory=false when deviceMemory is undefined (Firefox/Safari)", () => {
		mockMotion(false);
		mockCanvas("Apple M2");
		mockNav({ deviceMemory: undefined, hardwareConcurrency: 8 });
		const d = getDeviceDiagnostics();
		expect(d.lowMemory).toBe(false);
		expect(d.deviceMemory).toBeUndefined();
		expect(d.tier).toBe("high");
	});
});

// ---------------------------------------------------------------------------
// readTierOverride / ?babylon-tier URL override (issue #382)
// ---------------------------------------------------------------------------
describe("readTierOverride / ?babylon-tier URL override", () => {
	beforeEach(() => {
		window.history.replaceState({}, "", "/");
		try {
			window.sessionStorage.clear();
		} catch {
			/* ignore */
		}
	});

	it("returns null when no URL param and no sessionStorage", () => {
		expect(readTierOverride()).toBeNull();
	});

	it("returns 'high' when ?babylon-tier=high is in URL", () => {
		mockUrl("?babylon-tier=high");
		expect(readTierOverride()).toBe("high");
	});

	it("returns 'low' when ?babylon-tier=low is in URL", () => {
		mockUrl("?babylon-tier=low");
		expect(readTierOverride()).toBe("low");
	});

	it("returns 'medium' when ?babylon-tier=medium is in URL", () => {
		mockUrl("?babylon-tier=medium");
		expect(readTierOverride()).toBe("medium");
	});

	it("persists URL value to sessionStorage so subsequent calls without URL param honour it", () => {
		mockUrl("?babylon-tier=high");
		expect(readTierOverride()).toBe("high");
		mockUrl(""); // navigate away from the param
		expect(readTierOverride()).toBe("high");
	});

	it("?babylon-tier=reset clears sessionStorage and returns null", () => {
		mockUrl("?babylon-tier=low");
		expect(readTierOverride()).toBe("low");
		mockUrl("?babylon-tier=reset");
		expect(readTierOverride()).toBeNull();
		mockUrl("");
		expect(readTierOverride()).toBeNull();
		expect(
			window.sessionStorage.getItem("cdn-babylon-tier-override"),
		).toBeNull();
	});

	it("ignores unrecognised values (?babylon-tier=garbage → null)", () => {
		mockUrl("?babylon-tier=garbage");
		expect(readTierOverride()).toBeNull();
	});

	it("URL value wins over a different sessionStorage value", () => {
		window.sessionStorage.setItem("cdn-babylon-tier-override", "low");
		mockUrl("?babylon-tier=high");
		expect(readTierOverride()).toBe("high");
		// URL also wrote-through the new value to sessionStorage
		expect(window.sessionStorage.getItem("cdn-babylon-tier-override")).toBe(
			"high",
		);
	});
});

// ---------------------------------------------------------------------------
// getDeviceTier + override (integration of getDeviceTier with readTierOverride)
// ---------------------------------------------------------------------------
describe("getDeviceTier honours ?babylon-tier override", () => {
	beforeEach(() => {
		window.history.replaceState({}, "", "/");
		try {
			window.sessionStorage.clear();
		} catch {
			/* ignore */
		}
	});

	it("forces 'high' even when SwiftShader probe would gate to low", () => {
		mockMotion(false);
		mockCanvas("SwiftShader");
		mockNav({ deviceMemory: 2, hardwareConcurrency: 2 });
		mockUrl("?babylon-tier=high");
		expect(getDeviceTier()).toBe("high");
	});

	it("forces 'low' even on a Pixel-10-class device", () => {
		mockMotion(false);
		mockCanvas("Adreno 750");
		mockNav({ deviceMemory: 12, hardwareConcurrency: 9 });
		mockUrl("?babylon-tier=low");
		expect(getDeviceTier()).toBe("low");
	});

	it("getDeviceDiagnostics surfaces the override field", () => {
		mockMotion(false);
		mockCanvas("SwiftShader");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 8 });
		mockUrl("?babylon-tier=high");
		const d = getDeviceDiagnostics();
		expect(d.tier).toBe("high");
		expect(d.override).toBe("high");
		// Real probe results are still reported — only `tier` reflects the override.
		expect(d.softwareWebGL).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// setTierOverride (programmatic override for load-anyway button)
// ---------------------------------------------------------------------------
describe("setTierOverride", () => {
	beforeEach(() => {
		try {
			window.sessionStorage.clear();
		} catch {
			/* ignore */
		}
	});

	it("writes to sessionStorage so readTierOverride picks it up", () => {
		setTierOverride("medium");
		expect(readTierOverride()).toBe("medium");
	});

	it("overrides getDeviceTier on next call", () => {
		mockMotion(false);
		mockCanvas("SwiftShader");
		mockNav({ deviceMemory: 2, hardwareConcurrency: 2 });
		// Without override: low
		expect(getDeviceTier()).toBe("low");
		setTierOverride("medium");
		expect(getDeviceTier()).toBe("medium");
	});
});

// ---------------------------------------------------------------------------
// reduced-motion + capable hardware → tier at least medium (regression guard)
// ---------------------------------------------------------------------------
describe("reduced-motion user on capable hardware", () => {
	it("reports tier of at least medium (not gated out)", () => {
		mockMotion(true);
		mockCanvas("NVIDIA RTX 4080");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 16 });
		const tier = getDeviceTier();
		const rank = { high: 2, medium: 1, low: 0 };
		expect(rank[tier]).toBeGreaterThanOrEqual(rank.medium);
	});

	it("isCapableForBabylon returns true regardless of reduced-motion", () => {
		mockMotion(true);
		mockCanvas("Apple M3");
		mockNav({ deviceMemory: 8, hardwareConcurrency: 8 });
		expect(isCapableForBabylon()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// isFionaForceOn / ?fiona=force-on URL override (issue #382)
// ---------------------------------------------------------------------------
describe("isFionaForceOn / ?fiona=force-on override", () => {
	beforeEach(() => {
		window.history.replaceState({}, "", "/");
		try {
			window.sessionStorage.clear();
		} catch {
			/* ignore */
		}
	});

	it("returns false when no URL param and no sessionStorage", () => {
		expect(isFionaForceOn()).toBe(false);
	});

	it("returns true when ?fiona=force-on is in URL", () => {
		mockUrl("?fiona=force-on");
		expect(isFionaForceOn()).toBe(true);
	});

	it("persists to sessionStorage so subsequent calls without URL param honour it", () => {
		mockUrl("?fiona=force-on");
		expect(isFionaForceOn()).toBe(true);
		mockUrl("");
		expect(isFionaForceOn()).toBe(true);
	});

	it("returns false for unrelated ?fiona= values", () => {
		mockUrl("?fiona=off");
		expect(isFionaForceOn()).toBe(false);
	});

	it("returns false when ?fiona param is absent", () => {
		mockUrl("?babylon-tier=high");
		expect(isFionaForceOn()).toBe(false);
	});
});
