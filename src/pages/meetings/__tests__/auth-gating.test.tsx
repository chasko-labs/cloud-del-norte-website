import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthState } from "../../../contexts/auth-context";
import { AuthContext } from "../../../contexts/auth-context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver =
	ResizeObserverMock as unknown as typeof ResizeObserver;

vi.mock("../../../lib/auth", () => ({
	beginLogin: vi.fn(),
	signOut: vi.fn(),
	getIdToken: vi.fn(() => null),
	decodeToken: vi.fn(),
	refreshTokens: vi.fn(),
}));

// Shell passes children through (skip AuthProvider wrap — we provide our own below).
vi.mock("../../../layouts/shell", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));
vi.mock("../../../components/navigation", () => ({
	default: () => React.createElement("nav"),
}));
vi.mock("../../../components/breadcrumbs", () => ({
	default: () => React.createElement("nav", { "aria-label": "breadcrumbs" }),
}));
vi.mock("../../create-meeting/components/help-panel-home", () => ({
	HelpPanelHome: () => React.createElement("div"),
}));
vi.mock("../../../hooks/useTranslation", () => ({
	useTranslation: () => ({ locale: "us", t: (k: string) => k }),
}));
vi.mock("../components/meetings-table", () => ({
	default: () =>
		React.createElement("div", { "data-testid": "meetings-table" }, "TABLE"),
}));

import App from "../app";

function state(overrides: Partial<AuthState> = {}): AuthState {
	return {
		isAuthenticated: false,
		idToken: null,
		email: null,
		name: null,
		groups: [],
		isModerator: false,
		signOut: vi.fn(),
		...overrides,
	};
}

describe("/meetings auth gating", () => {
	beforeEach(() => {
		Object.defineProperty(window, "location", {
			value: { pathname: "/meetings", search: "" },
			writable: true,
		});
	});

	it("authed member → renders meetings table", () => {
		render(
			<AuthContext.Provider
				value={state({ isAuthenticated: true, idToken: "id", email: "a@b.co" })}
			>
				<App />
			</AuthContext.Provider>,
		);
		expect(screen.getByTestId("meetings-table")).toBeInTheDocument();
	});

	it("unauthenticated → renders fallback, not table; triggers beginLogin", async () => {
		const { beginLogin } = await import("../../../lib/auth");
		const { container } = render(
			<AuthContext.Provider value={state()}>
				<App />
			</AuthContext.Provider>,
		);
		await waitFor(() => expect(beginLogin).toHaveBeenCalled());
		expect(screen.queryByTestId("meetings-table")).not.toBeInTheDocument();
		expect(container.textContent).toMatch(/redirecting to sign-in/i);
	});
});
