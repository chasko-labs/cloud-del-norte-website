import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectRenderCapability } from "../render-capability";

// Helper to mock document.createElement('canvas') with a configurable renderer string.
function mockCanvas(rendererString: string | null) {
	const mockGetExtension = vi
		.fn()
		.mockReturnValue(
			rendererString !== null ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null,
		);
	const mockGetParameter = vi.fn().mockReturnValue(rendererString ?? "");
	const mockGl = {
		getExtension: mockGetExtension,
		getParameter: mockGetParameter,
	};
	const mockGetContext = vi.fn().mockReturnValue(mockGl);
	const mockCanvasEl = {
		getContext: mockGetContext,
		remove: vi.fn(),
	} as unknown as HTMLCanvasElement;
	return vi.spyOn(document, "createElement").mockReturnValue(mockCanvasEl);
}

function mockMatchMedia(matches: boolean) {
	vi.spyOn(window, "matchMedia").mockReturnValue({
		matches,
		media: "(prefers-reduced-motion: reduce)",
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	} as MediaQueryList);
}

describe("detectRenderCapability", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns hardwareWebgl=true for NVIDIA renderer", () => {
		mockMatchMedia(false);
		mockCanvas("NVIDIA GeForce RTX 3080/PCIe/SSE2");
		const result = detectRenderCapability();
		expect(result.hardwareWebgl).toBe(true);
		expect(result.rendererString).toContain("NVIDIA");
	});

	it("returns hardwareWebgl=false for SwiftShader renderer", () => {
		mockMatchMedia(false);
		mockCanvas("Google SwiftShader");
		const result = detectRenderCapability();
		expect(result.hardwareWebgl).toBe(false);
	});

	it("returns hardwareWebgl=false for llvmpipe renderer", () => {
		mockMatchMedia(false);
		mockCanvas("llvmpipe (LLVM 15.0.7, 256 bits)");
		const result = detectRenderCapability();
		expect(result.hardwareWebgl).toBe(false);
	});

	it("returns hardwareWebgl=false for Microsoft Basic Render Driver", () => {
		mockMatchMedia(false);
		mockCanvas("Microsoft Basic Render Driver");
		const result = detectRenderCapability();
		expect(result.hardwareWebgl).toBe(false);
	});

	it("returns reducedMotion=true when matchMedia matches", () => {
		mockMatchMedia(true);
		mockCanvas("NVIDIA GeForce RTX 3080/PCIe/SSE2");
		const result = detectRenderCapability();
		expect(result.reducedMotion).toBe(true);
	});

	it("shouldRenderRichScene = hardwareWebgl && !reducedMotion — hardware+no-motion → true", () => {
		mockMatchMedia(false);
		mockCanvas("NVIDIA GeForce RTX 3080/PCIe/SSE2");
		const result = detectRenderCapability();
		expect(result.hardwareWebgl).toBe(true);
		expect(result.reducedMotion).toBe(false);
		expect(result.shouldRenderRichScene).toBe(true);
	});

	describe("when reduced-motion is on", () => {
		beforeEach(() => {
			mockMatchMedia(true);
		});

		it("shouldRenderRichScene = false even with hardware GPU", () => {
			mockCanvas("NVIDIA GeForce RTX 3080/PCIe/SSE2");
			const result = detectRenderCapability();
			expect(result.hardwareWebgl).toBe(true);
			expect(result.reducedMotion).toBe(true);
			expect(result.shouldRenderRichScene).toBe(false);
		});
	});

	describe("when WEBGL_debug_renderer_info is unavailable", () => {
		beforeEach(() => {
			mockMatchMedia(false);
			const mockGl = {
				getExtension: vi.fn().mockReturnValue(null),
				getParameter: vi.fn().mockReturnValue(""),
			};
			const mockCanvasEl = {
				getContext: vi.fn().mockReturnValue(mockGl),
				remove: vi.fn(),
			} as unknown as HTMLCanvasElement;
			vi.spyOn(document, "createElement").mockReturnValue(mockCanvasEl);
		});

		it("returns hardwareWebgl=false with empty rendererString", () => {
			const result = detectRenderCapability();
			expect(result.hardwareWebgl).toBe(false);
			expect(result.rendererString).toBe("");
		});
	});

	describe("when WebGL is unavailable", () => {
		beforeEach(() => {
			mockMatchMedia(false);
			const mockCanvasEl = {
				getContext: vi.fn().mockReturnValue(null),
				remove: vi.fn(),
			} as unknown as HTMLCanvasElement;
			vi.spyOn(document, "createElement").mockReturnValue(mockCanvasEl);
		});

		it("returns rendererString=no-webgl and hardwareWebgl=false", () => {
			const result = detectRenderCapability();
			expect(result.hardwareWebgl).toBe(false);
			expect(result.rendererString).toBe("no-webgl");
		});
	});
});
