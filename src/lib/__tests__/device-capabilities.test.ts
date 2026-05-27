// Wave 53 — unit tests for device-capabilities.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getDeviceTier,
	hasFewCores,
	hasLowMemory,
	isCapableForBabylon,
	isSoftwareWebGL,
	prefersReducedMotion,
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

afterEach(() => {
	vi.restoreAllMocks();
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
	it("returns false when prefers-reduced-motion is on", () => {
		mockMotion(true);
		mockCanvas("NVIDIA RTX 4080");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 8 });
		expect(isCapableForBabylon()).toBe(false);
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

	it("returns low when reduced motion on", () => {
		mockMotion(true);
		mockCanvas("NVIDIA RTX 4080");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 16 });
		expect(getDeviceTier()).toBe("low");
	});
});

// ---------------------------------------------------------------------------
// getDeviceDiagnostics  (issue #382)
// ---------------------------------------------------------------------------
import { getDeviceDiagnostics } from "../device-capabilities";

describe("getDeviceDiagnostics", () => {
	it("returns the full diagnostic shape with all six signal keys", () => {
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
			deviceMemory: 16,
			hardwareConcurrency: 12,
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

	it("reports tier=low + reducedMotion=true on Reduce Motion", () => {
		mockMotion(true);
		mockCanvas("NVIDIA GeForce RTX 4080");
		mockNav({ deviceMemory: 16, hardwareConcurrency: 12 });
		const d = getDeviceDiagnostics();
		expect(d.tier).toBe("low");
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
