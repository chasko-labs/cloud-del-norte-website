// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const KEY_ID_TOKEN = "cdn.idToken";
const KEY_ACCESS_TOKEN = "cdn.accessToken";
const KEY_REFRESH_TOKEN = "cdn.refreshToken";
const KEY_EXPIRES_AT = "cdn.expiresAt";

const AUTH_ORIGIN = "https://auth.clouddelnorte.org";

export interface AuthState {
	email: string;
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
			sub: (claims.sub as string) ?? "",
			groups: (claims["cognito:groups"] as string[]) ?? [],
			idToken,
		};
	} catch {
		return null;
	}
}

export function requireAuth(): AuthState {
	const state = getAuthState();
	if (!state) {
		clearTokens();
		window.location.assign(`${AUTH_ORIGIN}/login/index.html`);
		return null as never;
	}
	return state;
}

export function isMember(state: AuthState): boolean {
	return state.groups.includes("members");
}

export function isBanned(state: AuthState): boolean {
	return state.groups.includes("banned");
}

export function signOut(): void {
	clearTokens();
	window.location.assign(`${AUTH_ORIGIN}/login/index.html`);
}
