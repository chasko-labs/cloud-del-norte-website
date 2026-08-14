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
	prefersReducedMotion: vi.fn(() => false),
	isFionaForceOn: vi.fn(() => false),
	setTierOverride: vi.fn(),
	getDeviceDiagnostics: vi.fn(() => ({
		tier: "high",
		reducedMotion: false,
		softwareWebGL: false,
		lowMemory: false,
		fewCores: false,
		renderer: "NVIDIA GeForce RTX 4080",
		webglAvailable: true,
		deviceMemory: 16,
		hardwareConcurrency: 12,
		override: null,
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
	prefersReducedMotion,
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
			webglAvailable: true,
			deviceMemory: 16,
			hardwareConcurrency: 12,
			override: null,
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
		// When tier=high, device is NOT gated out. The component shows the
		// opt-in prompt (userConsent starts as "pending"). withFallback returns
		// the fallback string because t() mock returns the key which equals the
		// key param, triggering the fallback path.
		expect(screen.getByText(/load Amazon Sumerian scene/i)).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(10000);
		});

		// No static fallback img appears — high-tier devices never get the poster.
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
		// Opt-in prompt is still showing (user hasn't clicked yes).
		expect(screen.getByText(/load Amazon Sumerian scene/i)).toBeInTheDocument();
		expect(logSpy).not.toHaveBeenCalled();
	});

	it("swaps to static fallback IMMEDIATELY (no 4s wait) when gated AND prefers-reduced-motion is on", () => {
		vi.mocked(getDeviceTier).mockReturnValue("low");
		vi.mocked(prefersReducedMotion).mockReturnValue(true);
		render(<FionaFrame />);
		// No timer advance needed — reduce-motion path skips the 4s wait.
		const img = screen.getByRole("img", {
			name: /Fiona avatar - 3D view unavailable on this device/i,
		});
		expect(img).toBeInTheDocument();
		expect(screen.queryByText(/modem connecting/i)).not.toBeInTheDocument();
	});
});
