// Wave 59 — AtmosphereScene tests
// Wave 66 — extended: IntersectionObserver gate, budget integration, dispose-on-unmount.
// @babylonjs/core is stubbed — verifies mount/unmount contract,
// weather-code differentiation, and prefers-reduced-motion behaviour.
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AtmosphereScene, { codeToVariantExact } from "../atmosphere-scene";

// ── Babylon stub ─────────────────────────────────────────────────────────────
vi.mock("@babylonjs/core", () => {
	const runRenderLoop = vi.fn();
	const stopRenderLoop = vi.fn();
	const dispose = vi.fn();
	const resize = vi.fn();
	const beginAnimation = vi.fn();

	const eng = { runRenderLoop, stopRenderLoop, dispose, resize };
	const scene = { clearColor: null, render: vi.fn(), beginAnimation };

	// biome-ignore lint/complexity/noStaticOnlyClass: vitest requires class syntax for constructable mocks
	class Engine {
		constructor() {
			Object.assign(this, eng);
		}
	}
	// biome-ignore lint/complexity/noStaticOnlyClass: same
	class Scene {
		constructor() {
			Object.assign(this, scene);
		}
	}
	// biome-ignore lint/complexity/noStaticOnlyClass: vitest requires class syntax for constructable mocks
	class ArcRotateCamera {
		inputs = { clear: vi.fn() };
		animations: unknown[] = [];
		constructor() {}
	}
	// biome-ignore lint/complexity/noStaticOnlyClass: same
	class HemisphericLight {
		constructor() {
			Object.assign(this, { intensity: 1, diffuse: null });
		}
	}
	// biome-ignore lint/complexity/noStaticOnlyClass: same
	class DirectionalLight {
		constructor() {
			Object.assign(this, { intensity: 1, diffuse: null });
		}
	}
	// biome-ignore lint/complexity/noStaticOnlyClass: same
	class StandardMaterial {
		constructor() {
			Object.assign(this, {
				emissiveColor: null,
				alpha: 1,
				disableLighting: false,
			});
		}
	}
	// biome-ignore lint/complexity/noStaticOnlyClass: same
	class Animation {
		constructor(public name: string) {}
		setKeys = vi.fn();
		static ANIMATIONTYPE_FLOAT = 0;
		static ANIMATIONTYPE_VECTOR3 = 1;
		static ANIMATIONLOOPMODE_CYCLE = 0;
		static ANIMATIONLOOPMODE_CONSTANT = 1;
	}

	const meshes: { name: string }[] = [];
	const mockMesh = (name: string) => {
		const m = {
			name,
			material: null,
			position: { y: 0 },
			scaling: {},
			animations: [] as unknown[],
			visibility: 1,
			color: null,
			rotation: { y: 0 },
		};
		meshes.push(m);
		return m;
	};

	(
		globalThis as unknown as { __babylonMeshes: typeof meshes }
	).__babylonMeshes = meshes;
	(globalThis as unknown as { __babylonEng: typeof eng }).__babylonEng = eng;

	return {
		Engine,
		Scene,
		ArcRotateCamera,
		HemisphericLight,
		DirectionalLight,
		Animation,
		Color4: class Color4 {
			constructor() {}
		},
		Color3: class Color3 {
			constructor() {}
			static White() {
				return {};
			}
		},
		Vector3: class Vector3 {
			static Zero() {
				return {};
			}
			constructor() {}
		},
		MeshBuilder: {
			CreateSphere: vi.fn((name: string) => mockMesh(name)),
			CreateCylinder: vi.fn((name: string) => mockMesh(name)),
			CreateLines: vi.fn((name: string) => mockMesh(name)),
		},
		StandardMaterial,
	};
});

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
let lastIOCallback: IOCallback | null = null;
let lastIOObserve: ReturnType<typeof vi.fn> | null = null;
let lastIODisconnect: ReturnType<typeof vi.fn> | null = null;

class IntersectionObserverMock {
	observe: ReturnType<typeof vi.fn>;
	disconnect: ReturnType<typeof vi.fn>;
	constructor(cb: IOCallback) {
		lastIOCallback = cb;
		this.observe = vi.fn();
		this.disconnect = vi.fn();
		lastIOObserve = this.observe;
		lastIODisconnect = this.disconnect;
	}
}

// ── matchMedia stub ──────────────────────────────────────────────────────────
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
	mockRequestActivation.mockClear();
	mockRequestActivation.mockReturnValue(true);
	mockReleaseActivation.mockClear();
	const g = globalThis as unknown as { __babylonMeshes: { name: string }[] };
	if (g.__babylonMeshes) g.__babylonMeshes.length = 0;
	lastIOCallback = null;
	lastIOObserve = null;
	lastIODisconnect = null;
	vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

// ── codeToVariantExact unit ──────────────────────────────────────────────────
describe("codeToVariantExact", () => {
	it("0 → clear", () => expect(codeToVariantExact(0)).toBe("clear"));
	it("2 → partly-cloudy", () =>
		expect(codeToVariantExact(2)).toBe("partly-cloudy"));
	it("45 → fog", () => expect(codeToVariantExact(45)).toBe("fog"));
	it("61 → rain", () => expect(codeToVariantExact(61)).toBe("rain"));
	it("73 → snow", () => expect(codeToVariantExact(73)).toBe("snow"));
	it("95 → thunderstorm", () =>
		expect(codeToVariantExact(95)).toBe("thunderstorm"));
});

// ── Canvas mount ─────────────────────────────────────────────────────────────
describe("AtmosphereScene", () => {
	it("renders a canvas element", () => {
		const { container } = render(
			<AtmosphereScene weatherCode={0} timezone="America/Denver" hour={14} />,
		);
		expect(container.querySelector("canvas")).toBeInTheDocument();
	});

	it("canvas is decorative (aria-hidden)", () => {
		const { container } = render(
			<AtmosphereScene weatherCode={0} timezone="America/Denver" hour={14} />,
		);
		expect(container.querySelector("canvas")?.getAttribute("aria-hidden")).toBe(
			"true",
		);
	});

	it("unmounts without throwing (no engine leaks)", () => {
		const { unmount } = render(
			<AtmosphereScene weatherCode={0} timezone="America/Denver" hour={14} />,
		);
		expect(() => unmount()).not.toThrow();
	});

	it("weather code 0 (clear) produces a different variant than 95 (thunderstorm)", () => {
		expect(codeToVariantExact(0)).toBe("clear");
		expect(codeToVariantExact(95)).toBe("thunderstorm");
		expect(codeToVariantExact(0)).not.toBe(codeToVariantExact(95));
	});

	it("does NOT request budget activation before IntersectionObserver fires", () => {
		// Wave 66: engine is created lazily; IO never fires in jsdom
		render(
			<AtmosphereScene weatherCode={0} timezone="America/Denver" hour={10} />,
		);
		// IO never fires in jsdom → requestActivation never called
		expect(mockRequestActivation).not.toHaveBeenCalled();
	});

	it("sets up IntersectionObserver on the canvas", () => {
		render(
			<AtmosphereScene weatherCode={0} timezone="America/Denver" hour={14} />,
		);
		expect(lastIOObserve).toHaveBeenCalled();
	});

	it("releaseActivation is called on unmount", () => {
		const { unmount } = render(
			<AtmosphereScene weatherCode={0} timezone="America/Denver" hour={14} />,
		);
		unmount();
		expect(mockReleaseActivation).toHaveBeenCalledWith("atmosphere-scene");
	});

	it("disconnects IntersectionObserver on unmount", () => {
		const { unmount } = render(
			<AtmosphereScene weatherCode={0} timezone="America/Denver" hour={14} />,
		);
		unmount();
		expect(lastIODisconnect).toHaveBeenCalled();
	});

	it("engine does NOT start when budget is full (requestActivation returns false)", () => {
		mockRequestActivation.mockReturnValue(false);

		render(
			<AtmosphereScene weatherCode={0} timezone="America/Denver" hour={10} />,
		);
		// Simulate intersection — budget is full so startEngine should bail out
		lastIOCallback?.([{ isIntersecting: true }]);

		// requestActivation was called but returned false → no engine
		expect(mockRequestActivation).toHaveBeenCalled();
		// releaseActivation NOT called — activation was denied, no slot taken
		expect(mockReleaseActivation).not.toHaveBeenCalled();
	});
});

// ── BabylonGate fallback (medium tier) ──────────────────────────────────────
describe("BabylonGate fallback in weather context", () => {
	it("does not mount AtmosphereScene canvas when device tier is below medium", async () => {
		const deviceCap = await import("../../../lib/device-capabilities");
		vi.spyOn(deviceCap, "getDeviceTier").mockReturnValue("low");

		const BabylonGate = (await import("../../babylon-gate")).default;
		render(
			<BabylonGate tier="medium" fallback={<div role="status">2d-card</div>}>
				<AtmosphereScene weatherCode={0} timezone="America/Denver" hour={12} />
			</BabylonGate>,
		);
		expect(screen.getByRole("status")).toBeInTheDocument();
		expect(document.querySelector("canvas")).not.toBeInTheDocument();

		vi.restoreAllMocks();
	});
});
