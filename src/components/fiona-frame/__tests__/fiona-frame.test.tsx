// Issue #382 — FionaFrame gate-timeout + static fallback tests.
// When getDeviceTier() < 'medium', after 4s the shimmer label should be
// replaced with a static <img> labeled for screen readers, and a one-shot
// console.log diagnostic should fire on mount.

import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock device-capabilities so we control the gate decision per test.
vi.mock("../../../lib/device-capabilities", () => ({
	getDeviceTier: vi.fn(() => "high"),
	getDeviceDiagnostics: vi.fn(() => ({
		tier: "high",
		reducedMotion: false,
		softwareWebGL: false,
		lowMemory: false,
		fewCores: false,
		renderer: "NVIDIA GeForce RTX 4080",
		deviceMemory: 16,
		hardwareConcurrency: 12,
	})),
}));

// Mock useTranslation — FionaFrame requires LocaleProvider context otherwise.
vi.mock("../../../hooks/useTranslation", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		locale: "us",
		setLocale: vi.fn(),
	}),
}));

// Mock loadVisitorInfo so we don't hit the network.
vi.mock("../../../utils/visitor", () => ({
	loadVisitorInfo: vi.fn(() => Promise.resolve(null)),
}));

// Mock BabylonGate — always render children. FionaFrame's gatedFallback state
// is driven by its OWN getDeviceTier() call (already mocked above), not by
// BabylonGate's branching, so we don't need the gate to mirror tier logic in
// these tests. Keeping the children inline means the canvas DOM node is
// always present; mount() will try to dynamic-import the embed script and
// silently warn in jsdom — that's fine, the four tests only check shimmer
// label / static img / console.log behavior.
vi.mock("../../babylon-gate", () => ({
	default: ({ children }: { children: React.ReactNode }) => children,
}));

import {
	getDeviceDiagnostics,
	getDeviceTier,
} from "../../../lib/device-capabilities";
import FionaFrame from "../index";

describe("FionaFrame — gate timeout + static fallback (#382)", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.useFakeTimers();
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		logSpy.mockRestore();
		vi.clearAllMocks();
	});

	it("renders the modem-connecting shimmer label initially when gated", () => {
		vi.mocked(getDeviceTier).mockReturnValue("low");
		render(<FionaFrame />);
		expect(screen.getByText(/modem connecting/i)).toBeInTheDocument();
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
	});

	it("swaps to a static avatar img after 4 seconds when gated", () => {
		vi.mocked(getDeviceTier).mockReturnValue("low");
		render(<FionaFrame />);
		expect(screen.getByText(/modem connecting/i)).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(4000);
		});

		const img = screen.getByRole("img", {
			name: /Fiona avatar - 3D view unavailable on this device/i,
		});
		expect(img).toBeInTheDocument();
		const inner = img.querySelector("img");
		expect(inner).not.toBeNull();
		expect(inner?.getAttribute("src")).toBe("/assets/fiona-poster.webp");
		expect(screen.queryByText(/modem connecting/i)).not.toBeInTheDocument();
	});

	it("logs a one-shot diagnostic when gated", () => {
		vi.mocked(getDeviceTier).mockReturnValue("low");
		vi.mocked(getDeviceDiagnostics).mockReturnValue({
			tier: "low",
			reducedMotion: true,
			softwareWebGL: false,
			lowMemory: false,
			fewCores: false,
			renderer: "NVIDIA GeForce RTX 4080",
			deviceMemory: 16,
			hardwareConcurrency: 12,
		});
		render(<FionaFrame />);
		expect(logSpy).toHaveBeenCalledTimes(1);
		expect(logSpy).toHaveBeenCalledWith(
			"[fiona-gate] tier=low",
			expect.objectContaining({
				reducedMotion: true,
				softwareWebGL: false,
				renderer: "NVIDIA GeForce RTX 4080",
			}),
		);
	});

	it("does NOT swap to static fallback when not gated (tier=high)", () => {
		vi.mocked(getDeviceTier).mockReturnValue("high");
		render(<FionaFrame />);
		expect(screen.getByText(/modem connecting/i)).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(10000);
		});

		expect(screen.queryByRole("img")).not.toBeInTheDocument();
		expect(screen.getByText(/modem connecting/i)).toBeInTheDocument();
		expect(logSpy).not.toHaveBeenCalled();
	});
});
