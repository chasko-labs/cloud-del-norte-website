import { render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Build a JWT with the given payload. Signature is unused — the module never verifies.
function buildJwt(payload: Record<string, unknown>): string {
	const b64 = (s: string) =>
		btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	const header = b64(JSON.stringify({ alg: "none", typ: "JWT" }));
	const body = b64(JSON.stringify(payload));
	return `${header}.${body}.sig`;
}

function seedSession(
	payload: Record<string, unknown>,
	{ expired = false } = {},
) {
	const exp = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
	const iat = Math.floor(Date.now() / 1000) - 60;
	const jwt = buildJwt({ exp, iat, ...payload });
	sessionStorage.setItem("cdn.idToken", jwt);
	sessionStorage.setItem("cdn.accessToken", "ac");
	sessionStorage.setItem(
		"cdn.expiresAt",
		String(expired ? Date.now() - 1000 : Date.now() + 3_600_000),
	);
	return jwt;
}

describe("AuthProvider + useAuth", () => {
	beforeEach(() => {
		sessionStorage.clear();
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("exposes unauthenticated state when no token present", async () => {
		const { AuthProvider } = await import("../auth-context");
		const { useAuth } = await import("../../hooks/useAuth");
		const { result } = renderHook(() => useAuth(), {
			wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
		});
		expect(result.current.isAuthenticated).toBe(false);
		expect(result.current.idToken).toBeNull();
		expect(result.current.email).toBeNull();
		expect(result.current.groups).toEqual([]);
		expect(result.current.isModerator).toBe(false);
	});

	it("decodes claims and exposes email, name, groups", async () => {
		seedSession({
			email: "ada@example.test",
			name: "Ada Lovelace",
			"cognito:groups": ["members"],
		});
		const { AuthProvider } = await import("../auth-context");
		const { useAuth } = await import("../../hooks/useAuth");
		const { result } = renderHook(() => useAuth(), {
			wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
		});
		expect(result.current.isAuthenticated).toBe(true);
		expect(result.current.email).toBe("ada@example.test");
		expect(result.current.name).toBe("Ada Lovelace");
		expect(result.current.groups).toEqual(["members"]);
		expect(result.current.isModerator).toBe(false);
	});

	it("sets isModerator when moderators group claim present", async () => {
		seedSession({
			email: "mod@example.test",
			"cognito:groups": ["moderators", "members"],
		});
		const { AuthProvider } = await import("../auth-context");
		const { useAuth } = await import("../../hooks/useAuth");
		const { result } = renderHook(() => useAuth(), {
			wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
		});
		expect(result.current.isModerator).toBe(true);
	});

	it("falls back to cognito:username when name claim missing", async () => {
		seedSession({
			email: "x@example.test",
			"cognito:username": "xuser",
		});
		const { AuthProvider } = await import("../auth-context");
		const { useAuth } = await import("../../hooks/useAuth");
		const { result } = renderHook(() => useAuth(), {
			wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
		});
		expect(result.current.name).toBe("xuser");
	});

	it("treats expired token as unauthenticated", async () => {
		seedSession({ email: "stale@example.test" }, { expired: true });
		const { AuthProvider } = await import("../auth-context");
		const { useAuth } = await import("../../hooks/useAuth");
		const { result } = renderHook(() => useAuth(), {
			wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
		});
		expect(result.current.isAuthenticated).toBe(false);
	});

	it("renders children", async () => {
		const { AuthProvider } = await import("../auth-context");
		render(
			<AuthProvider>
				<div>child-content</div>
			</AuthProvider>,
		);
		expect(screen.getByText("child-content")).toBeInTheDocument();
	});

	it("useAuth throws outside provider", async () => {
		const { useAuth } = await import("../../hooks/useAuth");
		const caught = vi.fn();
		function Consumer() {
			try {
				useAuth();
			} catch (e) {
				caught((e as Error).message);
			}
			return null;
		}
		render(<Consumer />);
		expect(caught).toHaveBeenCalledWith(
			expect.stringContaining("AuthProvider"),
		);
	});
});
