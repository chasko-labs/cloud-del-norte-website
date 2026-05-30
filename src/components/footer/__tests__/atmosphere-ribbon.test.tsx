// Wave 60 — AtmosphereRibbon tests
// Wave 66 — extended: IntersectionObserver gate, budget integration, dispose-on-unmount.
// Wave 70b — extended: fade-in (is-loaded class) tests.
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Babylon stub ─────────────────────────────────────────────────────────────
vi.mock("@babylonjs/core", () => {
	const runRenderLoop = vi.fn();
	const stopRenderLoop = vi.fn();
	const dispose = vi.fn();
	const resize = vi.fn();
	const beginAnimation = vi.fn();

	const eng = { runRenderLoop, stopRenderLoop, dispose, resize };
	const scene = {
		clearColor: null,
		render: vi.fn(),
		beginAnimation,
		ambientColor: null,
	};

	class Engine {
		runRenderLoop = eng.runRenderLoop;
		stopRenderLoop = eng.stopRenderLoop;
		dispose = eng.dispose;
		resize = eng.resize;
	}
	class Scene {
		clearColor = scene.clearColor;
		render = scene.render;
		beginAnimation = scene.beginAnimation;
		ambientColor = scene.ambientColor;
	}
	class ArcRotateCamera {
		inputs = { clear: vi.fn() };
		animations: unknown[] = [];
		mode = 0;
		orthoLeft = 0;
		orthoRight = 0;
		orthoBottom = 0;
		orthoTop = 0;
	}
	class StandardMaterial {
		emissiveColor = null;
		disableLighting = false;
	}
	class Animation {
		constructor(public name: string) {}
		setKeys = vi.fn();
		static ANIMATIONTYPE_FLOAT = 0;
		static ANIMATIONTYPE_VECTOR3 = 1;
		static ANIMATIONLOOPMODE_CYCLE = 0;
		static ANIMATIONLOOPMODE_CONSTANT = 1;
	}

	const mockMesh = (name: string) => ({
		name,
		material: null,
		position: new (class Vector3 {
			x = 0;
			y = 0;
			z = 0;
			constructor(x = 0, y = 0, z = 0) {
				this.x = x;
				this.y = y;
				this.z = z;
			}
		})(),
		rotation: { x: 0 },
		animations: [] as unknown[],
		scaling: {},
	});

	(globalThis as unknown as { __ribbonEng: typeof eng }).__ribbonEng = eng;

	return {
		Engine,
		Scene,
		ArcRotateCamera,
		StandardMaterial,
		Animation,
		Color4: class Color4 {
			r = 0;
			g = 0;
			b = 0;
			a = 0;
		},
		Color3: class Color3 {
			r = 0;
			g = 0;
			b = 0;
		},
		Vector3: class Vector3 {
			static Zero() {
				return {};
			}
			constructor(
				public x = 0,
				public y = 0,
				public z = 0,
			) {}
		},
		MeshBuilder: {
			CreateDisc: vi.fn((name: string) => mockMesh(name)),
		},
	};
});

// ── babylon-shared-engine stub ─────────────────────────────────────────────────
const mockSharedEngine = {
	resize: vi.fn(),
	dispose: vi.fn(),
	runRenderLoop: vi.fn(),
	stopRenderLoop: vi.fn(),
	registerView: vi.fn(),
	unRegisterView: vi.fn(),
};
const mockGetOrCreate = vi.fn(() => mockSharedEngine);
const mockRegister = vi.fn();
const mockUnregister = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();

vi.mock("../../../lib/babylon-shared-engine", () => ({
	get getOrCreateSharedEngine() {
		return mockGetOrCreate;
	},
	get registerSceneView() {
		return mockRegister;
	},
	get unregisterSceneView() {
		return mockUnregister;
	},
	get pauseSceneView() {
		return mockPause;
	},
	get resumeSceneView() {
		return mockResume;
	},
}));

// ── device-capabilities stub ─────────────────────────────────────────────────
vi.mock("../../../lib/device-capabilities", () => ({
	getDeviceTier: vi.fn(() => "high"),
	isSoftwareWebGL: vi.fn(() => false),
	hasLowMemory: vi.fn(() => false),
	hasFewCores: vi.fn(() => false),
	prefersReducedMotion: vi.fn(() => false),
	isCapableForBabylon: vi.fn(() => true),
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

import { getDeviceTier } from "../../../lib/device-capabilities";
import { sunHourToX } from "../../../lib/time-of-day";
import AtmosphereRibbon from "../atmosphere-ribbon";

function setReducedMotion(reduced: boolean) {
	vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
		matches: query.includes("prefers-reduced-motion") ? reduced : false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}));
}

beforeEach(() => {
	setReducedMotion(false);
	vi.mocked(getDeviceTier).mockReturnValue("high");
	mockGetOrCreate.mockClear();
	mockRegister.mockClear();
	mockUnregister.mockClear();
	lastIODisconnect = null;
	lastIOObserve = null;
	vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

// ── sunHourToX math ───────────────────────────────────────────────────────────
describe("sunHourToX — deterministic math", () => {
	it("hour 0 → right edge (1)", () => expect(sunHourToX(0)).toBe(1));
	it("hour 6 → right edge (1)", () => expect(sunHourToX(6)).toBe(1));
	it("hour 12 → centre (0.5)", () => expect(sunHourToX(12)).toBeCloseTo(0.5));
	it("hour 18 → left edge (0)", () => expect(sunHourToX(18)).toBe(0));
	it("hour 23 → left edge (0)", () => expect(sunHourToX(23)).toBe(0));
	it("hour 9 → between centre and right", () => {
		const x = sunHourToX(9);
		expect(x).toBeGreaterThan(0.5);
		expect(x).toBeLessThan(1);
	});
});

// ── canvas mount ──────────────────────────────────────────────────────────────
describe("AtmosphereRibbon — Babylon path", () => {
	it("renders the ribbon container", () => {
		render(<AtmosphereRibbon />);
		expect(screen.getByTestId("atmosphere-ribbon")).toBeInTheDocument();
	});

	it("mounts a canvas when device is capable", () => {
		const { container } = render(<AtmosphereRibbon />);
		expect(container.querySelector("canvas")).toBeInTheDocument();
	});

	it("canvas is aria-hidden (decorative)", () => {
		const { container } = render(<AtmosphereRibbon />);
		expect(container.querySelector("canvas")?.getAttribute("aria-hidden")).toBe(
			"true",
		);
	});

	it("unmounts without throwing", () => {
		const { unmount } = render(<AtmosphereRibbon />);
		expect(() => unmount()).not.toThrow();
	});

	it("sets up IntersectionObserver on the canvas", () => {
		render(<AtmosphereRibbon />);
		expect(lastIOObserve).toHaveBeenCalled();
	});

	it("disconnects IntersectionObserver on unmount", () => {
		const { unmount } = render(<AtmosphereRibbon />);
		unmount();
		expect(lastIODisconnect).toHaveBeenCalled();
	});

	it("unregisterSceneView is called on unmount", () => {
		const { unmount } = render(<AtmosphereRibbon />);
		unmount();
		expect(mockUnregister).toHaveBeenCalled();
	});
});

// ── Wave 70b — fade-in ────────────────────────────────────────────────────────
describe("AtmosphereRibbon — fade-in (wave 70b)", () => {
	it("ribbon starts without is-loaded class", () => {
		render(<AtmosphereRibbon />);
		const ribbon = screen.getByTestId("atmosphere-ribbon");
		expect(ribbon.classList.contains("is-loaded")).toBe(false);
	});

	it("fallback path adds is-loaded class on mount", () => {
		vi.mocked(getDeviceTier).mockReturnValue("low");
		render(<AtmosphereRibbon />);
		const ribbon = screen.getByTestId("atmosphere-ribbon");
		expect(ribbon.classList.contains("is-loaded")).toBe(true);
	});
});

// ── BabylonGate fallback ──────────────────────────────────────────────────────
describe("AtmosphereRibbon — CSS fallback on incapable device", () => {
	it("shows fallback div and no canvas when tier is low", () => {
		vi.mocked(getDeviceTier).mockReturnValue("low");
		const { container } = render(<AtmosphereRibbon />);
		expect(
			container.querySelector(".cdn-footer-atmosphere-fallback"),
		).toBeInTheDocument();
		expect(container.querySelector("canvas")).not.toBeInTheDocument();
	});
});

// ── visibility-hidden render-loop pause ───────────────────────────────────────
describe("AtmosphereRibbon — visibility pause", () => {
	it("does NOT call registerSceneView before IntersectionObserver fires", () => {
		// Wave 66: engine is created lazily; IO never fires in jsdom
		render(<AtmosphereRibbon />);
		expect(mockRegister).not.toHaveBeenCalled();
	});
});
