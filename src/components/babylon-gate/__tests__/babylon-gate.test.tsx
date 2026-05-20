// Wave 53 — BabylonGate component tests
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BabylonGate from "../index";

// Mock getDeviceTier so we can control tier in each test
vi.mock("../../../lib/device-capabilities", () => ({
	getDeviceTier: vi.fn(() => "high"),
	isSoftwareWebGL: vi.fn(() => false),
	hasLowMemory: vi.fn(() => false),
	hasFewCores: vi.fn(() => false),
	prefersReducedMotion: vi.fn(() => false),
	isCapableForBabylon: vi.fn(() => true),
}));

import { getDeviceTier } from "../../../lib/device-capabilities";

afterEach(() => {
	vi.resetAllMocks();
});

describe("BabylonGate", () => {
	it("renders fallback when device tier is below required tier", () => {
		vi.mocked(getDeviceTier).mockReturnValue("low");
		render(
			<BabylonGate tier="medium" fallback={<div>css-fallback</div>}>
				<div>babylon-scene</div>
			</BabylonGate>,
		);
		expect(screen.getByText("css-fallback")).toBeInTheDocument();
		expect(screen.queryByText("babylon-scene")).not.toBeInTheDocument();
	});

	it("renders children when device tier meets the required tier", () => {
		vi.mocked(getDeviceTier).mockReturnValue("high");
		render(
			<BabylonGate tier="medium" fallback={<div>css-fallback</div>}>
				<div>babylon-scene</div>
			</BabylonGate>,
		);
		expect(screen.getByText("babylon-scene")).toBeInTheDocument();
		expect(screen.queryByText("css-fallback")).not.toBeInTheDocument();
	});

	it("renders children when tier matches exactly (medium device, medium tier)", () => {
		vi.mocked(getDeviceTier).mockReturnValue("medium");
		render(
			<BabylonGate tier="medium" fallback={<div>css-fallback</div>}>
				<div>babylon-scene</div>
			</BabylonGate>,
		);
		expect(screen.getByText("babylon-scene")).toBeInTheDocument();
	});

	it("renders fallback when tier is high but device is medium", () => {
		vi.mocked(getDeviceTier).mockReturnValue("medium");
		render(
			<BabylonGate tier="high" fallback={<div>lite-fallback</div>}>
				<div>heavy-scene</div>
			</BabylonGate>,
		);
		expect(screen.getByText("lite-fallback")).toBeInTheDocument();
		expect(screen.queryByText("heavy-scene")).not.toBeInTheDocument();
	});

	it("defaults tier to medium when not specified", () => {
		vi.mocked(getDeviceTier).mockReturnValue("low");
		render(
			<BabylonGate fallback={<div>default-fallback</div>}>
				<div>scene</div>
			</BabylonGate>,
		);
		expect(screen.getByText("default-fallback")).toBeInTheDocument();
	});
});
