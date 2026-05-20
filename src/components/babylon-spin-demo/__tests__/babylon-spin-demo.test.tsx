// Wave 53 — babylon-spin-demo tests
// Wave 66 — extended: IntersectionObserver gate, budget integration, dispose-on-unmount.
// @babylonjs/core is stubbed — we only verify mount/unmount contract.
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BabylonSpinDemo from "../index";

// Stub dynamic import of @babylonjs/core so it never actually loads
vi.mock("@babylonjs/core", () => ({
	Engine: vi.fn().mockImplementation(() => ({
		runRenderLoop: vi.fn(),
		stopRenderLoop: vi.fn(),
		dispose: vi.fn(),
	})),
	Scene: vi.fn().mockImplementation(() => ({
		clearColor: null,
		render: vi.fn(),
	})),
	Color4: vi.fn(),
	Color3: { White: vi.fn(() => ({})) },
	Vector3: { Zero: vi.fn(() => ({})) },
	ArcRotateCamera: vi.fn(),
	HemisphericLight: vi.fn(),
	MeshBuilder: {
		CreatePlane: vi
			.fn()
			.mockReturnValue({ material: null, rotation: { y: 0 } }),
	},
	StandardMaterial: vi.fn().mockImplementation(() => ({
		diffuseTexture: null,
		emissiveColor: null,
	})),
	Texture: vi.fn(),
	Animation: {
		CreateAndStartAnimation: vi.fn(),
		ANIMATIONLOOPMODE_CONSTANT: 0,
	},
}));

// ── babylon-budget stub ───────────────────────────────────────────────────────
const mockRequestActivation = vi.fn(() => true);
const mockReleaseActivation = vi.fn();

vi.mock("../../../lib/babylon-budget", () => ({
	get requestActivation() {
		return mockRequestActivation;
	},
	get releaseActivation() {
		return mockReleaseActivation;
	},
	activeScenes: new Set(),
	MAX_ACTIVE_SCENES: 2,
}));

// ── IntersectionObserver stub ─────────────────────────────────────────────────
type IOCallback = (entries: { isIntersecting: boolean }[]) => void;
let lastIODisconnect: ReturnType<typeof vi.fn> | null = null;
let lastIOObserve: ReturnType<typeof vi.fn> | null = null;

class IntersectionObserverMock {
	observe: ReturnType<typeof vi.fn>;
	disconnect: ReturnType<typeof vi.fn>;
	constructor(_cb: IOCallback) {
		this.observe = vi.fn();
		this.disconnect = vi.fn();
		lastIOObserve = this.observe;
		lastIODisconnect = this.disconnect;
	}
}

beforeEach(() => {
	mockRequestActivation.mockClear();
	mockRequestActivation.mockReturnValue(true);
	mockReleaseActivation.mockClear();
	lastIODisconnect = null;
	lastIOObserve = null;
	vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe("BabylonSpinDemo", () => {
	it("renders a div containing a canvas element", () => {
		const { container } = render(
			<BabylonSpinDemo thumbnailUrl="https://i.ytimg.com/vi/abc/hqdefault.jpg" />,
		);
		expect(container.querySelector("canvas")).toBeInTheDocument();
	});

	it("canvas has aria-label for accessibility", () => {
		render(
			<BabylonSpinDemo thumbnailUrl="https://i.ytimg.com/vi/abc/hqdefault.jpg" />,
		);
		const canvas = screen.getByLabelText("Spinning video preview");
		expect(canvas).toBeInTheDocument();
	});

	it("unmounts without throwing", () => {
		const { unmount } = render(
			<BabylonSpinDemo thumbnailUrl="https://i.ytimg.com/vi/abc/hqdefault.jpg" />,
		);
		expect(() => unmount()).not.toThrow();
	});

	it("sets up IntersectionObserver on the canvas", () => {
		render(
			<BabylonSpinDemo thumbnailUrl="https://i.ytimg.com/vi/abc/hqdefault.jpg" />,
		);
		expect(lastIOObserve).toHaveBeenCalled();
	});

	it("disconnects IntersectionObserver on unmount", () => {
		const { unmount } = render(
			<BabylonSpinDemo thumbnailUrl="https://i.ytimg.com/vi/abc/hqdefault.jpg" />,
		);
		unmount();
		expect(lastIODisconnect).toHaveBeenCalled();
	});

	it("releaseActivation is called on unmount", () => {
		const { unmount } = render(
			<BabylonSpinDemo thumbnailUrl="https://i.ytimg.com/vi/abc/hqdefault.jpg" />,
		);
		unmount();
		expect(mockReleaseActivation).toHaveBeenCalledWith("babylon-spin-demo");
	});
});
