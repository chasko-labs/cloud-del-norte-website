// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Admin RSVP API client — moderator-scoped read of event registrations.
 *
 * ## Required backend endpoint (NOT YET DEPLOYED)
 *
 * The cdn-rsvp API at https://tta0e43bs0.execute-api.us-west-2.amazonaws.com/prod
 * needs a new route:
 *
 *   GET /admin/rsvps/{eventId}
 *
 * Auth: Bearer token (Cognito idToken). The Lambda must verify the caller
 * belongs to the "moderators" group via the `cognito:groups` claim before
 * returning data.
 *
 * Response shape (200):
 *   { "records": AdminRsvpRecord[] }
 *
 * AdminRsvpRecord:
 *   - event_id: string
 *   - user_sub: string
 *   - name: string | null
 *   - email: string | null
 *   - group: string | null        (cognito group at registration time)
 *   - created_at: string          (ISO timestamp)
 *   - migrated: boolean           (true if record came from migration)
 *   - is_test: boolean            (true if record is a test record)
 *
 * Error responses:
 *   - 401: missing or expired token
 *   - 403: caller is not in moderators group
 *   - 404: event not found
 */

import { showSessionExpired } from "../../../components/session-expired-modal";
import { getIdToken, refreshTokens } from "../_shared/auth";

const API_BASE = "https://tta0e43bs0.execute-api.us-west-2.amazonaws.com/prod";

export interface AdminRsvpRecord {
	event_id: string;
	user_sub: string;
	name: string | null;
	email: string | null;
	group: string | null;
	created_at: string;
	migrated: boolean;
	is_test: boolean;
}

interface ListRsvpsResponse {
	records: AdminRsvpRecord[];
}

async function rsvpAdminRequest(path: string): Promise<Response> {
	let idToken = getIdToken();
	if (!idToken) {
		try {
			await refreshTokens();
		} catch {
			showSessionExpired();
			throw new Error("session expired");
		}
		idToken = getIdToken();
		if (!idToken) {
			showSessionExpired();
			throw new Error("session expired");
		}
	}
	const doFetch = (token: string) =>
		fetch(`${API_BASE}${path}`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});
	const res = await doFetch(idToken);
	if (res.status === 401) {
		try {
			await refreshTokens();
		} catch {
			showSessionExpired();
			throw new Error("session expired");
		}
		const retryToken = getIdToken();
		if (!retryToken) {
			showSessionExpired();
			throw new Error("session expired");
		}
		const retryRes = await doFetch(retryToken);
		if (retryRes.status === 401) {
			showSessionExpired();
			throw new Error("session expired");
		}
		return retryRes;
	}
	return res;
}

/**
 * List all RSVP records for an event. Requires moderator auth.
 * Returns an empty array on 404 (event not found).
 */
export async function listEventRsvps(
	eventId: string,
): Promise<AdminRsvpRecord[]> {
	const res = await rsvpAdminRequest(
		`/admin/rsvps/${encodeURIComponent(eventId)}`,
	);
	if (res.status === 404) return [];
	if (res.status === 403) throw new Error("moderator access required");
	if (!res.ok) throw new Error(`api error: ${res.status}`);
	const data = (await res.json()) as ListRsvpsResponse;
	return data.records;
}
