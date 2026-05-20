// Wave 53 — babylon-spin-demo tests
// @babylonjs/core is stubbed — we only verify mount/unmount contract.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
});
