// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const KEY_ID_TOKEN = "cdn.idToken";
const KEY_ACCESS_TOKEN = "cdn.accessToken";
const KEY_REFRESH_TOKEN = "cdn.refreshToken";
const KEY_EXPIRES_AT = "cdn.expiresAt";
const KEY_LOGIN_STATE = "cdn.loginState";

const AUTH_ORIGIN = "https://auth.clouddelnorte.org";
const HOSTED_UI = "https://cloud-del-norte.auth.us-west-2.amazoncognito.com";
const CLIENT_ID = "57eikmt418ea6vti2f6h0pl74r";
const SCOPES = "openid email profile";

export interface AuthState {
	email: string;
	name?: string;
	sub: string;
	groups: string[];
	idToken: string;
}

function isExpired(): boolean {
	const raw = sessionStorage.getItem(KEY_EXPIRES_AT);
	if (!raw) return true;
	return Date.now() >= Number(raw);
}

export function getIdToken(): string | null {
	if (isExpired()) return null;
	return sessionStorage.getItem(KEY_ID_TOKEN);
}

export function getRefreshToken(): string | null {
	return sessionStorage.getItem(KEY_REFRESH_TOKEN);
}

export async function refreshTokens(): Promise<void> {
	const refresh = getRefreshToken();
	if (!refresh) throw new Error("no refresh token");
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		client_id: CLIENT_ID,
		refresh_token: refresh,
	});
	const res = await fetch(`${HOSTED_UI}/oauth2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});
	if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
	const tokens = (await res.json()) as {
		id_token: string;
		access_token: string;
		refresh_token?: string;
		expires_in: number;
	};
	if (!tokens.refresh_token) tokens.refresh_token = refresh;
	sessionStorage.setItem(KEY_ID_TOKEN, tokens.id_token);
	sessionStorage.setItem(KEY_ACCESS_TOKEN, tokens.access_token);
	sessionStorage.setItem(KEY_REFRESH_TOKEN, tokens.refresh_token);
	sessionStorage.setItem(
		KEY_EXPIRES_AT,
		String(Date.now() + tokens.expires_in * 1000),
	);
}

export function storeTokensFromFragment(
	idToken: string,
	accessToken: string,
	refreshToken: string,
): void {
	try {
		const parts = idToken.split(".");
		let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		const pad = payload.length % 4;
		if (pad) payload += "=".repeat(4 - pad);
		const claims = JSON.parse(atob(payload)) as { exp?: number };
		const expiresAt = claims.exp ? claims.exp * 1000 : Date.now() + 3600_000;
		sessionStorage.setItem(KEY_ID_TOKEN, idToken);
		sessionStorage.setItem(KEY_ACCESS_TOKEN, accessToken);
		sessionStorage.setItem(KEY_REFRESH_TOKEN, refreshToken);
		sessionStorage.setItem(KEY_EXPIRES_AT, String(expiresAt));
	} catch {
		throw new Error("failed to parse tokens");
	}
}

export function clearTokens(): void {
	[KEY_ID_TOKEN, KEY_ACCESS_TOKEN, KEY_REFRESH_TOKEN, KEY_EXPIRES_AT].forEach(
		(k) => sessionStorage.removeItem(k),
	);
}

function decodeJwt(jwt: string): Record<string, unknown> {
	const parts = jwt.split(".");
	if (parts.length < 2) throw new Error("malformed jwt");
	let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
	const pad = payload.length % 4;
	if (pad) payload += "=".repeat(4 - pad);
	return JSON.parse(atob(payload)) as Record<string, unknown>;
}

export function getAuthState(): AuthState | null {
	const idToken = getIdToken();
	if (!idToken) return null;
	try {
		const claims = decodeJwt(idToken);
		return {
			email: (claims.email as string) ?? "",
			name: (claims.name as string) || undefined,
			sub: (claims.sub as string) ?? "",
			groups: (claims["cognito:groups"] as string[]) ?? [],
			idToken,
		};
	} catch {
		return null;
	}
}

// ---- PKCE silent reauth ----

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++)
		binary += String.fromCharCode(bytes[i]);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function randomVerifier(): string {
	const bytes = new Uint8Array(48);
	crypto.getRandomValues(bytes);
	return base64UrlEncode(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
	const data = new TextEncoder().encode(verifier);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return base64UrlEncode(new Uint8Array(digest));
}

function callbackUri(): string {
	return `${window.location.origin}/auth/callback/`;
}

interface LoginState {
	pkceVerifier: string;
	returnTo: string;
}

// Silent reauth: sends prompt=none to Cognito. If a session exists, Cognito
// redirects to /auth/callback/ with a code. If not, it returns login_required
// and the callback redirects to the login form. Guard against double-redirect
// by checking for an in-flight loginState.
export async function beginSilentLogin(returnTo?: string): Promise<void> {
	if (sessionStorage.getItem(KEY_LOGIN_STATE)) return;
	const verifier = randomVerifier();
	const challenge = await pkceChallenge(verifier);
	const state: LoginState = {
		pkceVerifier: verifier,
		returnTo: returnTo ?? window.location.pathname + window.location.search,
	};
	sessionStorage.setItem(KEY_LOGIN_STATE, JSON.stringify(state));

	const params = new URLSearchParams({
		response_type: "code",
		client_id: CLIENT_ID,
		redirect_uri: callbackUri(),
		scope: SCOPES,
		code_challenge: challenge,
		code_challenge_method: "S256",
		prompt: "none",
	});
	window.location.assign(`${HOSTED_UI}/oauth2/authorize?${params.toString()}`);
}

export async function handleCallback(): Promise<{ returnTo: string }> {
	const url = new URL(window.location.href);
	const code = url.searchParams.get("code");
	const error = url.searchParams.get("error");
	if (error) throw new Error(`oidc error: ${error}`);
	if (!code) throw new Error("oidc callback missing code");

	const raw = sessionStorage.getItem(KEY_LOGIN_STATE);
	if (!raw) throw new Error("oidc callback missing login state");
	const state = JSON.parse(raw) as LoginState;
	sessionStorage.removeItem(KEY_LOGIN_STATE);

	const body = new URLSearchParams({
		grant_type: "authorization_code",
		client_id: CLIENT_ID,
		code,
		redirect_uri: callbackUri(),
		code_verifier: state.pkceVerifier,
	});
	const res = await fetch(`${HOSTED_UI}/oauth2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});
	if (!res.ok) throw new Error(`oidc token exchange failed: ${res.status}`);
	const tokens = (await res.json()) as {
		id_token: string;
		access_token: string;
		refresh_token?: string;
		expires_in: number;
	};
	const existingRefresh = sessionStorage.getItem(KEY_REFRESH_TOKEN);
	sessionStorage.setItem(KEY_ID_TOKEN, tokens.id_token);
	sessionStorage.setItem(KEY_ACCESS_TOKEN, tokens.access_token);
	if (tokens.refresh_token)
		sessionStorage.setItem(KEY_REFRESH_TOKEN, tokens.refresh_token);
	else if (existingRefresh)
		sessionStorage.setItem(KEY_REFRESH_TOKEN, existingRefresh);
	sessionStorage.setItem(
		KEY_EXPIRES_AT,
		String(Date.now() + tokens.expires_in * 1000),
	);
	return { returnTo: state.returnTo || "/" };
}

// ---- end PKCE silent reauth ----

export function requireAuth(): AuthState {
	const state = getAuthState();
	if (!state) {
		clearTokens();
		const returnTo = encodeURIComponent(
			window.location.pathname + window.location.search,
		);
		window.location.assign(
			`${AUTH_ORIGIN}/login/index.html?return_to=${returnTo}`,
		);
		return null as never;
	}
	return state;
}

export function isMember(state: AuthState): boolean {
	return state.groups.includes("members");
}

export function isModerator(state: AuthState): boolean {
	return state.groups.includes("moderators");
}

export function isBanned(state: AuthState): boolean {
	return state.groups.includes("banned");
}

export function signOut(): void {
	clearTokens();
	window.location.assign(`${AUTH_ORIGIN}/login/index.html`);
}
