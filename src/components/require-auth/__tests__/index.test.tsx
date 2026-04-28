import { render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthState } from "../../../contexts/auth-context";

vi.mock("../../../lib/auth", () => ({
	beginLogin: vi.fn(),
	signOut: vi.fn(),
	// Passed through but not used in these tests:
	getIdToken: vi.fn(() => null),
	decodeToken: vi.fn(),
	refreshTokens: vi.fn(),
}));

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver =
	ResizeObserverMock as unknown as typeof ResizeObserver;

import { AuthContext } from "../../../contexts/auth-context";
import { RequireAuth } from "../index";

function wrap(value: AuthState, children: React.ReactNode) {
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function authedState(overrides: Partial<AuthState> = {}): AuthState {
	return {
		isAuthenticated: true,
		idToken: "id",
		email: "a@b.co",
		name: "A",
		groups: ["members"],
		isModerator: false,
		signOut: vi.fn(),
		...overrides,
	};
}

function unauthedState(): AuthState {
	return {
		isAuthenticated: false,
		idToken: null,
		email: null,
		name: null,
		groups: [],
		isModerator: false,
		signOut: vi.fn(),
	};
}

describe("RequireAuth", () => {
	beforeEach(async () => {
		vi.resetModules();
		Object.defineProperty(window, "location", {
			value: { pathname: "/meetings", search: "?x=1" },
			writable: true,
		});
		const { beginLogin } = await import("../../../lib/auth");
		(beginLogin as ReturnType<typeof vi.fn>).mockReset();
	});

	it("renders children when authenticated and no requireGroup", () => {
		render(
			wrap(
				authedState(),
				<RequireAuth>
					<div>inside</div>
				</RequireAuth>,
			),
		);
		expect(screen.getByText("inside")).toBeInTheDocument();
	});

	it("unauthenticated → calls beginLogin with pathname+search and renders spinner fallback", async () => {
		const { beginLogin } = await import("../../../lib/auth");
		const { container } = render(
			wrap(
				unauthedState(),
				<RequireAuth>
					<div>protected</div>
				</RequireAuth>,
			),
		);
		await waitFor(() => {
			expect(beginLogin).toHaveBeenCalledWith("/meetings?x=1");
		});
		expect(screen.queryByText("protected")).not.toBeInTheDocument();
		expect(container.textContent).toMatch(/redirecting to sign-in/i);
	});

	it("unauthenticated with custom fallback renders fallback", async () => {
		const { beginLogin } = await import("../../../lib/auth");
		render(
			wrap(
				unauthedState(),
				<RequireAuth fallback={<div>custom-fb</div>}>
					<div>protected</div>
				</RequireAuth>,
			),
		);
		await waitFor(() => {
			expect(beginLogin).toHaveBeenCalled();
		});
		expect(screen.getByText("custom-fb")).toBeInTheDocument();
	});

	it("authed but missing requireGroup → denied alert with sign-out button", () => {
		const { container } = render(
			wrap(
				authedState({ groups: ["members"] }),
				<RequireAuth requireGroup="moderators">
					<div>secret</div>
				</RequireAuth>,
			),
		);
		expect(screen.queryByText("secret")).not.toBeInTheDocument();
		expect(container.textContent).toMatch(/moderators/i);
		expect(container.textContent).toMatch(/sign out/i);
	});

	it("authed with requireGroup match → renders children", () => {
		render(
			wrap(
				authedState({ groups: ["moderators", "members"], isModerator: true }),
				<RequireAuth requireGroup="moderators">
					<div>admin-only</div>
				</RequireAuth>,
			),
		);
		expect(screen.getByText("admin-only")).toBeInTheDocument();
	});
});
