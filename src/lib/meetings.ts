import { getIdToken, refreshTokens } from "./auth";

const API_BASE = "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/prod";

// --- Types ---

export interface Meeting {
	roomName: string;
	title: string;
	scheduledAt: string;
	createdBy: string;
}

export interface MeetingStatus {
	live: boolean;
	scheduled: Meeting[];
}

export interface InfraStatus {
	cluster: string;
	tasks_running: number;
	tasks_desired: number;
}

export class MeetingApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = "MeetingApiError";
		this.status = status;
	}
}

// --- Internal helpers ---

async function getToken(): Promise<string> {
	let idToken = getIdToken();
	if (!idToken) {
		await refreshTokens();
		idToken = getIdToken();
		if (!idToken) throw new MeetingApiError(401, "not authenticated");
	}
	return idToken;
}

async function request(
	path: string,
	options: { method: string; body?: unknown },
): Promise<Response> {
	const idToken = await getToken();

	const headers: Record<string, string> = {
		Authorization: `Bearer ${idToken}`,
		"Content-Type": "application/json",
	};

	let res = await fetch(`${API_BASE}${path}`, {
		method: options.method,
		headers,
		body: options.body != null ? JSON.stringify(options.body) : undefined,
	});

	// 401 retry: refresh tokens once and replay
	if (res.status === 401) {
		await refreshTokens();
		const refreshed = getIdToken();
		if (!refreshed)
			throw new MeetingApiError(401, "refresh failed — not authenticated");
		headers.Authorization = `Bearer ${refreshed}`;
		res = await fetch(`${API_BASE}${path}`, {
			method: options.method,
			headers,
			body: options.body != null ? JSON.stringify(options.body) : undefined,
		});
		if (res.status === 401)
			throw new MeetingApiError(401, "unauthorized after refresh");
	}

	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText);
		throw new MeetingApiError(res.status, text);
	}

	return res;
}

// --- Public API ---

export async function fetchMeetingStatus(): Promise<MeetingStatus> {
	const res = await request("/meetings/status", { method: "GET" });
	return (await res.json()) as MeetingStatus;
}

export async function scheduleMeeting(
	body: Record<string, unknown>,
): Promise<unknown> {
	const res = await request("/admin/meetings", { method: "POST", body });
	return res.json();
}

export async function launchMeeting(
	body: Record<string, unknown>,
): Promise<unknown> {
	const res = await request("/admin/meetings/launch", { method: "POST", body });
	return res.json();
}

export async function endMeeting(roomName: string): Promise<unknown> {
	const res = await request("/admin/meetings/end", {
		method: "POST",
		body: { roomName },
	});
	return res.json();
}

export async function fetchInfrastructureStatus(): Promise<InfraStatus> {
	const res = await request("/admin/infrastructure/status", { method: "GET" });
	return (await res.json()) as InfraStatus;
}
