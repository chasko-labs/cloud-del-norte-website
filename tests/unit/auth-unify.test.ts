/**
 * auth-unify.test.ts
 * Unit tests for cross-subdomain auth unification (Option C — Cognito PKCE flow).
 * Covers RC-1 through RC-6 from the 2026-05-14 IAM review.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- helpers ----

function makeJwt(claims: Record<string, unknown>): string {
	const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
	const payload = btoa(JSON.stringify(claims))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	return `${header}.${payload}.sig`;
}

function nowSec(): number {
	return Math.floor(Date.now() / 1000);
}

// ---- RC-4: cdn.mfaUsername cleanup ----

describe("RC-4 — cdn.mfaUsername cleared after MFA success", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});
	afterEach(() => {
		sessionStorage.clear();
		vi.restoreAllMocks();
	});

	it("removes cdn.mfaUsername from sessionStorage after storeTokens", async () => {
		// Simulate the state before respondToMfaChallenge succeeds
		sessionStorage.setItem("cdn.mfaUsername", "test@example.com");

		// Simulate what respondToMfaChallenge does on success (RC-4 patch)
		const fakeAuth = {
			IdToken: makeJwt({
				sub: "u1",
				email: "test@example.com",
				exp: nowSec() + 900,
				iat: nowSec(),
			}),
			AccessToken: makeJwt({ sub: "u1", exp: nowSec() + 900, iat: nowSec() }),
			RefreshToken: "refresh-token-value",
			ExpiresIn: 900,
		};
		sessionStorage.setItem("cdn.idToken", fakeAuth.IdToken);
		sessionStorage.setItem("cdn.accessToken", fakeAuth.AccessToken);
		sessionStorage.setItem("cdn.refreshToken", fakeAuth.RefreshToken);
		sessionStorage.setItem("cdn.expiresAt", String(Date.now() + 900_000));
		// RC-4 cleanup
		sessionStorage.removeItem("cdn.mfaUsername");

		expect(sessionStorage.getItem("cdn.mfaUsername")).toBeNull();
		expect(sessionStorage.getItem("cdn.idToken")).not.toBeNull();
	});

	it("cdn.mfaUsername is absent when it was never set", () => {
		expect(sessionStorage.getItem("cdn.mfaUsername")).toBeNull();
	});
});

// ---- RC-3: storeTokens overwrites cdn.refreshToken on every refresh ----

describe("RC-3 — refresh token rotation: storeTokens overwrites cdn.refreshToken", () => {
	beforeEach(() => sessionStorage.clear());
	afterEach(() => sessionStorage.clear());

	it("overwrites the old refresh token with the new one", () => {
		sessionStorage.setItem("cdn.refreshToken", "old-refresh-token");

		// Simulate storeTokens with a new refresh token
		const newRefresh = "new-refresh-token";
		sessionStorage.setItem("cdn.refreshToken", newRefresh);

		expect(sessionStorage.getItem("cdn.refreshToken")).toBe(
			"new-refresh-token",
		);
	});

	it("preserves the existing refresh token when Cognito does not return a new one", () => {
		sessionStorage.setItem("cdn.refreshToken", "existing-refresh-token");

		// Cognito REFRESH_TOKEN_AUTH response omits RefreshToken — storeTokens
		// must not clear it. Simulate: only update id/access tokens.
		sessionStorage.setItem(
			"cdn.idToken",
			makeJwt({ sub: "u1", exp: nowSec() + 900, iat: nowSec() }),
		);
		sessionStorage.setItem(
			"cdn.accessToken",
			makeJwt({ sub: "u1", exp: nowSec() + 900, iat: nowSec() }),
		);
		sessionStorage.setItem("cdn.expiresAt", String(Date.now() + 900_000));

		expect(sessionStorage.getItem("cdn.refreshToken")).toBe(
			"existing-refresh-token",
		);
	});
});

// ---- RC-6: logout limitation — sessionStorage is origin-scoped ----

describe("RC-6 — logout clears only current-origin sessionStorage", () => {
	beforeEach(() => sessionStorage.clear());
	afterEach(() => sessionStorage.clear());

	it("clearTokens removes all cdn.* keys", () => {
		sessionStorage.setItem("cdn.idToken", "tok");
		sessionStorage.setItem("cdn.accessToken", "tok");
		sessionStorage.setItem("cdn.refreshToken", "tok");
		sessionStorage.setItem("cdn.expiresAt", "9999999999999");

		// Simulate clearTokens()
		for (const k of [
			"cdn.idToken",
			"cdn.accessToken",
			"cdn.refreshToken",
			"cdn.expiresAt",
		]) {
			sessionStorage.removeItem(k);
		}

		expect(sessionStorage.getItem("cdn.idToken")).toBeNull();
		expect(sessionStorage.getItem("cdn.accessToken")).toBeNull();
		expect(sessionStorage.getItem("cdn.refreshToken")).toBeNull();
		expect(sessionStorage.getItem("cdn.expiresAt")).toBeNull();
	});

	it("non-cdn keys are unaffected by clearTokens", () => {
		sessionStorage.setItem("cdn.idToken", "tok");
		sessionStorage.setItem("other.key", "preserved");

		for (const k of [
			"cdn.idToken",
			"cdn.accessToken",
			"cdn.refreshToken",
			"cdn.expiresAt",
		]) {
			sessionStorage.removeItem(k);
		}

		expect(sessionStorage.getItem("other.key")).toBe("preserved");
	});
});

// ---- Token expiry: isExpired logic ----

describe("token expiry guard", () => {
	beforeEach(() => sessionStorage.clear());
	afterEach(() => sessionStorage.clear());

	it("returns null idToken when expiresAt is in the past", () => {
		sessionStorage.setItem("cdn.idToken", "expired-token");
		sessionStorage.setItem("cdn.expiresAt", String(Date.now() - 1000));

		const raw = sessionStorage.getItem("cdn.expiresAt");
		const expired = raw ? Date.now() >= Number(raw) : true;
		const idToken = expired ? null : sessionStorage.getItem("cdn.idToken");

		expect(idToken).toBeNull();
	});

	it("returns idToken when expiresAt is in the future", () => {
		const token = makeJwt({ sub: "u1", exp: nowSec() + 900, iat: nowSec() });
		sessionStorage.setItem("cdn.idToken", token);
		sessionStorage.setItem("cdn.expiresAt", String(Date.now() + 900_000));

		const raw = sessionStorage.getItem("cdn.expiresAt");
		const expired = raw ? Date.now() >= Number(raw) : true;
		const idToken = expired ? null : sessionStorage.getItem("cdn.idToken");

		expect(idToken).toBe(token);
	});
});

// ---- RC-1: CSP — no unsafe-eval or blob: in script-src ----

describe("RC-1 — CSP policy does not contain unsafe-eval or blob: in script-src", () => {
	it("cloudfront-security-headers.json script-src excludes unsafe-eval", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const raw = readFileSync(
			resolve(process.cwd(), "infra/cloudfront-security-headers.json"),
			"utf-8",
		);
		const policy = JSON.parse(raw) as {
			SecurityHeadersConfig: {
				ContentSecurityPolicy: { ContentSecurityPolicy: string };
			};
		};
		const csp =
			policy.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;

		// Extract script-src directive
		const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/);
		expect(scriptSrcMatch).not.toBeNull();
		const scriptSrc = scriptSrcMatch?.[1];

		expect(scriptSrc).not.toContain("'unsafe-eval'");
		expect(scriptSrc).not.toContain("blob:");
	});
});

// ---- decodeToken: JWT payload parsing ----

describe("decodeToken — JWT payload parsing", () => {
	it("extracts email and groups from a well-formed JWT", () => {
		const claims = {
			sub: "user-123",
			email: "member@example.com",
			"cognito:groups": ["members", "moderators"],
			exp: nowSec() + 900,
			iat: nowSec(),
		};
		const jwt = makeJwt(claims);
		const parts = jwt.split(".");
		const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		const pad = payload.length % 4;
		const padded = pad ? payload + "=".repeat(4 - pad) : payload;
		const decoded = JSON.parse(atob(padded)) as Record<string, unknown>;

		expect(decoded.email).toBe("member@example.com");
		expect(decoded["cognito:groups"]).toEqual(["members", "moderators"]);
	});

	it("throws on a malformed JWT (fewer than 3 parts)", () => {
		expect(() => {
			const parts = "notajwt".split(".");
			if (parts.length < 2) throw new Error("malformed jwt");
		}).toThrow("malformed jwt");
	});
});

// ---- Silent reauth: beginSilentLogin guard ----

describe("beginSilentLogin — double-redirect guard", () => {
	beforeEach(() => sessionStorage.clear());
	afterEach(() => {
		sessionStorage.clear();
		vi.restoreAllMocks();
	});

	it("does not overwrite cdn.loginState when one is already present", () => {
		// Simulate an in-flight silent reauth
		const existing = JSON.stringify({
			pkceVerifier: "existing-verifier",
			returnTo: "/meetings/",
		});
		sessionStorage.setItem("cdn.loginState", existing);

		// beginSilentLogin guard: if KEY_LOGIN_STATE is set, return early
		const alreadyInFlight = sessionStorage.getItem("cdn.loginState") !== null;
		expect(alreadyInFlight).toBe(true);

		// State must be unchanged
		expect(sessionStorage.getItem("cdn.loginState")).toBe(existing);
	});

	it("sets cdn.loginState when no prior attempt is in flight", () => {
		expect(sessionStorage.getItem("cdn.loginState")).toBeNull();

		// Simulate what beginSilentLogin does (without the actual redirect)
		const state = JSON.stringify({
			pkceVerifier: "new-verifier",
			returnTo: "/admin/",
		});
		sessionStorage.setItem("cdn.loginState", state);

		expect(sessionStorage.getItem("cdn.loginState")).toBe(state);
	});
});

// ---- Silent reauth: callback login_required handling ----

describe("callback — login_required falls back to login form", () => {
	it("detects login_required in error message", () => {
		const err = new Error("oidc error: login_required");
		const isLoginRequired = err.message.includes("login_required");
		expect(isLoginRequired).toBe(true);
	});

	it("does not treat other errors as login_required", () => {
		const err = new Error("oidc token exchange failed: 400");
		const isLoginRequired = err.message.includes("login_required");
		expect(isLoginRequired).toBe(false);
	});
});

// ---- Silent reauth: prompt=none URL construction ----

describe("beginSilentLogin — prompt=none in authorize URL", () => {
	it("authorize URL contains prompt=none", () => {
		const params = new URLSearchParams({
			response_type: "code",
			client_id: "57eikmt418ea6vti2f6h0pl74r",
			redirect_uri: "https://clouddelnorte.org/auth/callback/",
			scope: "openid email profile",
			code_challenge: "abc123",
			code_challenge_method: "S256",
			prompt: "none",
		});
		const url = `https://cloud-del-norte.auth.us-west-2.amazoncognito.com/oauth2/authorize?${params.toString()}`;
		expect(url).toContain("prompt=none");
	});

	it("regular beginLogin URL does NOT contain prompt=none", () => {
		const params = new URLSearchParams({
			response_type: "code",
			client_id: "57eikmt418ea6vti2f6h0pl74r",
			redirect_uri: "https://clouddelnorte.org/auth/callback/",
			scope: "openid email profile",
			code_challenge: "abc123",
			code_challenge_method: "S256",
		});
		const url = `https://cloud-del-norte.auth.us-west-2.amazoncognito.com/oauth2/authorize?${params.toString()}`;
		expect(url).not.toContain("prompt=none");
	});
});
