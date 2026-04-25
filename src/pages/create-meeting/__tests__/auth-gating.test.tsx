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
vi.mock("../../../hooks/useTranslation", () => ({
	useTranslation: () => ({ locale: "us", t: (k: string) => k }),
}));

// Neutralize form internals — this file tests the auth gate, not the form
vi.mock("../validation/basic-validation", () => ({
	useBasicValidation: () => ({
		isFormSubmitted: false,
		setIsFormSubmitted: vi.fn(),
		addErrorField: vi.fn(),
		focusFirstErrorField: vi.fn(),
	}),
	BasicValidationContext: {
		Provider: ({ children }: AnyProps) =>
			React.createElement("div", null, children),
	},
}));
vi.mock("../components/marketing", () => ({
	default: () =>
		React.createElement("div", { "data-testid": "create-form-inner" }, "FORM"),
}));
vi.mock("../components/shape", () => ({
	default: () => React.createElement("div"),
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

describe("/create-meeting auth gating", () => {
	beforeEach(() => {
		Object.defineProperty(window, "location", {
			value: { pathname: "/create-meeting", search: "" },
			writable: true,
		});
	});

	it("authed moderator → renders form", () => {
		render(
			<AuthContext.Provider
				value={state({
					isAuthenticated: true,
					idToken: "id",
					email: "mod@example.test",
					groups: ["moderators"],
					isModerator: true,
				})}
			>
				<App />
			</AuthContext.Provider>,
		);
		expect(screen.getByTestId("create-form-inner")).toBeInTheDocument();
	});

	it("authed non-moderator → renders denied alert, not form", () => {
		const { container } = render(
			<AuthContext.Provider
				value={state({
					isAuthenticated: true,
					idToken: "id",
					email: "member@example.test",
					groups: ["members"],
				})}
			>
				<App />
			</AuthContext.Provider>,
		);
		expect(screen.queryByTestId("create-form-inner")).not.toBeInTheDocument();
		expect(container.textContent).toMatch(/moderators/i);
		expect(container.textContent).toMatch(/sign out/i);
	});

	it("unauthenticated → triggers beginLogin and renders fallback", async () => {
		const { beginLogin } = await import("../../../lib/auth");
		const { container } = render(
			<AuthContext.Provider value={state()}>
				<App />
			</AuthContext.Provider>,
		);
		await waitFor(() => expect(beginLogin).toHaveBeenCalled());
		expect(screen.queryByTestId("create-form-inner")).not.toBeInTheDocument();
		expect(container.textContent).toMatch(/redirecting to sign-in/i);
	});
});
