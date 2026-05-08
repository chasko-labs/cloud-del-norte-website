// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { getIdToken, refreshTokens } from "./auth";

const API_BASE = "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com";

export interface AdminUser {
	sub: string;
	email: string;
	status: string;
	groups: string[];
	createdAt: string;
	memberType?: string;
	location?: string;
	topics?: string;
	background?: string;
}

export interface JitsiTokenResponse {
	token: string;
	domain: string;
	expiresAt: number;
}

async function apiRequest(
	path: string,
	method: string,
	body?: unknown,
): Promise<Response> {
	let idToken = getIdToken();
	if (!idToken) {
		await refreshTokens();
		idToken = getIdToken();
		if (!idToken) throw new Error("not authenticated");
	}
	const doFetch = (token: string) =>
		fetch(`${API_BASE}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	const res = await doFetch(idToken);
	if (res.status === 401) {
		await refreshTokens();
		const retryToken = getIdToken();
		if (!retryToken) throw new Error("not authenticated");
		return doFetch(retryToken);
	}
	return res;
}

export async function listUsers(
	filter: "pending" | "members" | "banned",
): Promise<AdminUser[]> {
	const res = await apiRequest(`/admin/users?filter=${filter}`, "GET");
	if (!res.ok) throw new Error(`api error: ${res.status}`);
	const data = (await res.json()) as { users: AdminUser[] };
	return data.users;
}

export async function approveUser(
	sub: string,
	group: "members" | "moderators" = "members",
): Promise<void> {
	const res = await apiRequest(
		`/admin/users/${encodeURIComponent(sub)}/approve`,
		"POST",
		{ group },
	);
	if (!res.ok) throw new Error(`approve failed: ${res.status}`);
}

export async function banUser(sub: string): Promise<void> {
	const res = await apiRequest(
		`/admin/users/${encodeURIComponent(sub)}/ban`,
		"POST",
	);
	if (!res.ok) throw new Error(`ban failed: ${res.status}`);
}

export async function unbanUser(sub: string): Promise<void> {
	return approveUser(sub, "members");
}

export async function fetchJitsiToken(): Promise<JitsiTokenResponse> {
	const res = await apiRequest("/token/jitsi", "POST", {});
	if (res.status === 403) throw new Error("banned");
	if (!res.ok) throw new Error(`token failed: ${res.status}`);
	return res.json() as Promise<JitsiTokenResponse>;
}
