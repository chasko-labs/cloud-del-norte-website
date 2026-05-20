// Wave 66 — Navigation/FionaFrame panel-gating tests.
// FionaFrame must NOT mount when the navigation panel is closed (default).
// It MUST mount after cdn-nav-open event fires.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Stub FionaFrame so it just renders a sentinel div ────────────────────────
// Path is relative to this test file: navigation/__tests__/ → ../../fiona-frame
vi.mock("../../fiona-frame", () => ({
	default: () => <div data-testid="fiona-frame-sentinel" />,
}));

// ── Stub Cloudscape SideNavigation (no DOM complexity) ───────────────────────
vi.mock("@cloudscape-design/components/side-navigation", () => ({
	default: () => <nav data-testid="side-navigation" />,
}));

// ── Stub auth + i18n hooks ────────────────────────────────────────────────────
vi.mock("../../../hooks/useAuth", () => ({
	useAuth: () => ({ isModerator: false }),
}));

vi.mock("../../../hooks/useTranslation", () => ({
	useTranslation: () => ({
		t: (k: string) => k,
		locale: "us" as const,
	}),
}));

import {
	CDN_NAV_CLOSE_EVENT,
	CDN_NAV_OPEN_EVENT,
} from "../../../hooks/usePanelOpen";
import Navigation from "../index";

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("Navigation — FionaFrame panel gating (wave 66)", () => {
	it("does NOT render FionaFrame when panel is closed (default state)", () => {
		render(<Navigation />);
		expect(
			screen.queryByTestId("fiona-frame-sentinel"),
		).not.toBeInTheDocument();
	});

	it("renders FionaFrame after cdn-nav-open event", () => {
		render(<Navigation />);
		expect(
			screen.queryByTestId("fiona-frame-sentinel"),
		).not.toBeInTheDocument();

		act(() => {
			document.dispatchEvent(new CustomEvent(CDN_NAV_OPEN_EVENT));
		});

		expect(screen.queryByTestId("fiona-frame-sentinel")).toBeInTheDocument();
	});

	it("hides FionaFrame after cdn-nav-close event", () => {
		render(<Navigation />);

		act(() => {
			document.dispatchEvent(new CustomEvent(CDN_NAV_OPEN_EVENT));
		});
		expect(screen.queryByTestId("fiona-frame-sentinel")).toBeInTheDocument();

		act(() => {
			document.dispatchEvent(new CustomEvent(CDN_NAV_CLOSE_EVENT));
		});
		expect(
			screen.queryByTestId("fiona-frame-sentinel"),
		).not.toBeInTheDocument();
	});

	it("side navigation is always present regardless of panel state", () => {
		render(<Navigation />);
		expect(screen.getByTestId("side-navigation")).toBeInTheDocument();
	});
});
