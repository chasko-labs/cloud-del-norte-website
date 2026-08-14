import { getIdToken, refreshTokens } from "./auth";

const API_BASE =
	import.meta.env.VITE_SCHEDULED_MEETINGS_API_URL ||
	"https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com";

export interface ScheduledMeeting {
	meeting_id: string;
	scheduled_start: string;
	title: string;
	description: string;
	duration_minutes: number;
	room_hash: string;
	created_by_sub: string;
	status: "scheduled" | "live" | "ended" | "cancelled";
	speaker_bio_url: string;
	meetup_rsvp_url: string;
	created_at: string;
	updated_at: string;
}

export interface CreateScheduledMeetingRequest {
	title: string;
	description?: string;
	scheduled_start: string;
	duration_minutes?: number;
	speaker_bio_url?: string;
	meetup_rsvp_url?: string;
}

export interface UpdateScheduledMeetingRequest {
	title?: string;
	description?: string;
	scheduled_start?: string;
	duration_minutes?: number;
	status?: string;
	speaker_bio_url?: string;
	meetup_rsvp_url?: string;
}

async function adminRequest(
	path: string,
	method: string,
	body?: unknown,
): Promise<Response> {
	const idToken = getIdToken();
	if (!idToken) throw new Error("not authenticated");
	return fetch(`${API_BASE}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${idToken}`,
			"Content-Type": "application/json",
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
}

async function withRetry<T>(
	fn: () => Promise<Response>,
	parse: (r: Response) => Promise<T>,
): Promise<T> {
	let res = await fn();
	if (res.status === 401) {
		await refreshTokens();
		res = await fn();
		if (res.status === 401) throw new Error("unauthorized after refresh");
	}
	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText);
		throw new Error(`scheduled-meetings api error: ${res.status} — ${text}`);
	}
	return parse(res);
}

export async function listScheduledMeetings(
	view: "upcoming" | "past" = "upcoming",
): Promise<ScheduledMeeting[]> {
	const result = await withRetry(
		() => adminRequest(`/admin/scheduled-meetings?view=${view}`, "GET"),
		(r) => r.json() as Promise<{ meetings: ScheduledMeeting[] }>,
	);
	return result.meetings;
}

export async function getScheduledMeeting(
	meetingId: string,
): Promise<ScheduledMeeting> {
	const result = await withRetry(
		() =>
			adminRequest(
				`/admin/scheduled-meetings/${encodeURIComponent(meetingId)}`,
				"GET",
			),
		(r) => r.json() as Promise<{ meeting: ScheduledMeeting }>,
	);
	return result.meeting;
}

export async function createScheduledMeeting(
	body: CreateScheduledMeetingRequest,
): Promise<ScheduledMeeting> {
	const result = await withRetry(
		() => adminRequest("/admin/scheduled-meetings", "POST", body),
		(r) => r.json() as Promise<{ meeting: ScheduledMeeting }>,
	);
	return result.meeting;
}

export async function updateScheduledMeeting(
	meetingId: string,
	body: UpdateScheduledMeetingRequest,
): Promise<ScheduledMeeting> {
	const result = await withRetry(
		() =>
			adminRequest(
				`/admin/scheduled-meetings/${encodeURIComponent(meetingId)}`,
				"PUT",
				body,
			),
		(r) => r.json() as Promise<{ meeting: ScheduledMeeting }>,
	);
	return result.meeting;
}

export async function deleteScheduledMeeting(meetingId: string): Promise<void> {
	await withRetry(
		() =>
			adminRequest(
				`/admin/scheduled-meetings/${encodeURIComponent(meetingId)}`,
				"DELETE",
			),
		() => Promise.resolve(),
	);
}
