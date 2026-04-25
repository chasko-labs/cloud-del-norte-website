import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../../../lib/admin", () => ({
	listPendingUsers: vi.fn(),
	approveUser: vi.fn(),
}));

vi.mock("../../../layouts/shell", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", { "data-testid": "shell" }, children),
}));
vi.mock("../../../components/navigation", () => ({
	default: () => React.createElement("nav", { "data-testid": "navigation" }),
}));
vi.mock("../../../components/breadcrumbs", () => ({
	default: () => React.createElement("nav", { "aria-label": "breadcrumbs" }),
}));
vi.mock("../../../hooks/useTranslation", () => ({
	useTranslation: () => ({ locale: "us", t: (k: string) => k }),
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

describe("/admin auth gating + table", () => {
	beforeEach(() => {
		Object.defineProperty(window, "location", {
			value: { pathname: "/admin", search: "" },
			writable: true,
		});
	});

	it("moderator → renders table with mocked pending users", async () => {
		const { listPendingUsers } = await import("../../../lib/admin");
		(listPendingUsers as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				sub: "sub-1",
				email: "alice@example.com",
				status: "CONFIRMED",
				groups: [],
				createdAt: "2026-01-01T00:00:00Z",
			},
			{
				sub: "sub-2",
				email: "bob@example.com",
				status: "CONFIRMED",
				groups: [],
				createdAt: "2026-02-01T00:00:00Z",
			},
		]);

		render(
			<AuthContext.Provider
				value={state({
					isAuthenticated: true,
					idToken: "id",
					email: "mod@example.com",
					groups: ["moderators"],
					isModerator: true,
				})}
			>
				<App />
			</AuthContext.Provider>,
		);

		await waitFor(() =>
			expect(screen.getByText("alice@example.com")).toBeInTheDocument(),
		);
		expect(screen.getByText("bob@example.com")).toBeInTheDocument();
	});

	it("moderator → clicking approve calls approveUser", async () => {
		const { listPendingUsers, approveUser } = await import(
			"../../../lib/admin"
		);
		(listPendingUsers as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				sub: "sub-1",
				email: "alice@example.com",
				status: "CONFIRMED",
				groups: [],
				createdAt: "2026-01-01T00:00:00Z",
			},
		]);
		(approveUser as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			user: {
				sub: "sub-1",
				email: "alice@example.com",
				status: "CONFIRMED",
				groups: ["members"],
				createdAt: "2026-01-01T00:00:00Z",
			},
		});

		render(
			<AuthContext.Provider
				value={state({
					isAuthenticated: true,
					idToken: "id",
					email: "mod@example.com",
					groups: ["moderators"],
					isModerator: true,
				})}
			>
				<App />
			</AuthContext.Provider>,
		);

		await waitFor(() => screen.getByText("alice@example.com"));
		const approveBtn = screen.getByRole("button", {
			name: /admin.approveButton/i,
		});
		fireEvent.click(approveBtn);
		await waitFor(() =>
			expect(approveUser).toHaveBeenCalledWith("sub-1", "members"),
		);
	});

	it("non-moderator → RequireAuth shows access denied, not table", async () => {
		render(
			<AuthContext.Provider
				value={state({
					isAuthenticated: true,
					idToken: "id",
					email: "member@example.com",
					groups: ["members"],
					isModerator: false,
				})}
			>
				<App />
			</AuthContext.Provider>,
		);
		// RequireAuth with requireGroup="moderators" renders the access denied alert
		await waitFor(() =>
			expect(
				screen.getByText(/moderator access required/i),
			).toBeInTheDocument(),
		);
		expect(screen.queryByRole("table")).not.toBeInTheDocument();
	});

	it("unauthenticated → triggers beginLogin, renders spinner not table", async () => {
		const { beginLogin } = await import("../../../lib/auth");
		render(
			<AuthContext.Provider value={state()}>
				<App />
			</AuthContext.Provider>,
		);
		await waitFor(() => expect(beginLogin).toHaveBeenCalled());
		expect(screen.queryByRole("table")).not.toBeInTheDocument();
	});

	it("load error → shows error alert", async () => {
		const { listPendingUsers } = await import("../../../lib/admin");
		(listPendingUsers as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("network failure"),
		);

		render(
			<AuthContext.Provider
				value={state({
					isAuthenticated: true,
					idToken: "id",
					email: "mod@example.com",
					groups: ["moderators"],
					isModerator: true,
				})}
			>
				<App />
			</AuthContext.Provider>,
		);

		await waitFor(() =>
			expect(screen.getByText("network failure")).toBeInTheDocument(),
		);
	});
});
