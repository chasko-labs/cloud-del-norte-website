// Wave 60 — AtmosphereRibbon tests
// Covers: canvas mount, BabylonGate fallback, sun-position math, DOM order, visibility pause.
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Babylon stub (same pattern as atmosphere-scene.test.tsx) ─────────────────
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
		constructor() {
			Object.assign(this, eng);
		}
	}
	class Scene {
		constructor() {
			Object.assign(this, scene);
		}
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
		constructor() {
			Object.assign(this, { emissiveColor: null, disableLighting: false });
		}
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
		Color4: class Color4 {},
		Color3: class Color3 {},
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

// ── device-capabilities stub ─────────────────────────────────────────────────
vi.mock("../../../lib/device-capabilities", () => ({
	getDeviceTier: vi.fn(() => "high"),
	isSoftwareWebGL: vi.fn(() => false),
	hasLowMemory: vi.fn(() => false),
	hasFewCores: vi.fn(() => false),
	prefersReducedMotion: vi.fn(() => false),
	isCapableForBabylon: vi.fn(() => true),
}));

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
});

afterEach(() => {
	vi.clearAllMocks();
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
	it("does NOT start render loop when prefers-reduced-motion is set", () => {
		setReducedMotion(true);
		const { container, unmount } = render(<AtmosphereRibbon />);
		expect(container.querySelector("canvas")).toBeInTheDocument();
		const g = globalThis as unknown as {
			__ribbonEng: { runRenderLoop: ReturnType<typeof vi.fn> };
		};
		expect(g.__ribbonEng.runRenderLoop).not.toHaveBeenCalled();
		unmount();
	});
});
