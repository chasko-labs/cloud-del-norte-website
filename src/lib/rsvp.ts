// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * RSVP client-side data layer.
 *
 * Wave 35a deployed the cdn-rsvp Lambda + API Gateway HTTP V2 + DDB stack at
 * `https://tta0e43bs0.execute-api.us-west-2.amazonaws.com/prod`. Wave 35b
 * (this file) flips the client from localStorage-only to fetch() against
 * that backend.
 *
 * The DDB record shape mirrors RsvpRecord (user_sub, event_id, name, email,
 * created_at, ticket_payload), so we keep the existing TypeScript types
 * unchanged and the QR ticket payload identical
 * (`cdn-ticket:v1:{eventId}:{userSub}` — see buildTicketPayload).
 *
 * localStorage is retained as a read-only cache so:
 *   - listMyRsvps() can fall back to the cached list when the network
 *     hiccups or the user is briefly offline (UI shows tickets, possibly
 *     stale, instead of a hard error).
 *   - Phase 1 users with localStorage tickets keep seeing them through the
 *     cutover until they next visit the RSVP page (which will write a fresh
 *     server record + refresh the cache).
 *
 * Writes only ever go to the backend; the cache is updated as a side-effect
 * of successful reads/writes, never as the source of truth.
 */

const API_BASE = "https://tta0e43bs0.execute-api.us-west-2.amazonaws.com/prod";
const STORAGE_KEY = "cdn.rsvps.v1";
const ID_TOKEN_KEY = "cdn.idToken";

export interface CdnEvent {
	id: string;
	title: string;
	scheduledDate: string; // ISO date string YYYY-MM-DD
	location: string;
	capacity: number;
	rsvpedBaseline: number; // spots already taken outside the in-app flow
	meetupRsvpUrl: string;
}

export interface RsvpRecord {
	eventId: string;
	userSub: string;
	name: string | null;
	email: string | null;
	createdAt: string; // ISO timestamp
}

/** Canonical event registry. Add upcoming in-person events here. */
export const CDN_EVENTS: CdnEvent[] = [
	{
		id: "happy-hour-2026-06-03",
		title: "Cloud del Norte UG — Community Happy Hour & Networking Night",
		scheduledDate: "2026-06-03",
		location: "Downtown El Paso, Texas",
		capacity: 50,
		rsvpedBaseline: 2,
		meetupRsvpUrl:
			"https://www.meetup.com/awsugclouddelnorte/events/314839263/rsvp/",
	},
];

export function getEvent(id: string): CdnEvent | undefined {
	return CDN_EVENTS.find((e) => e.id === id);
}

// ---------------------------------------------------------------------------
// localStorage read-cache helpers
// ---------------------------------------------------------------------------

function isBrowser(): boolean {
	return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readCache(): RsvpRecord[] {
	if (!isBrowser()) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed as RsvpRecord[];
	} catch {
		return [];
	}
}

function writeCache(records: RsvpRecord[]): void {
	if (!isBrowser()) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
	} catch {
		// localStorage may be disabled (private mode, quota exceeded). Cache
		// failure is non-fatal — the network path is the source of truth.
	}
}

/** Merge a single fresh record into the cache, replacing any existing entry
 *  for the same {eventId, userSub}. */
function upsertCache(record: RsvpRecord): void {
	const records = readCache();
	const idx = records.findIndex(
		(r) => r.eventId === record.eventId && r.userSub === record.userSub,
	);
	if (idx >= 0) records[idx] = record;
	else records.push(record);
	writeCache(records);
}

// ---------------------------------------------------------------------------
// fetch helpers
// ---------------------------------------------------------------------------

function getIdToken(): string {
	if (!isBrowser()) throw new Error("not_authenticated");
	const token = sessionStorage.getItem(ID_TOKEN_KEY);
	if (!token) throw new Error("not_authenticated");
	return token;
}

interface ErrorBody {
	error?: string;
}

/** Parse `{error: '...'}` from a non-OK response, falling back to a generic
 *  string when the body is missing/unparseable. */
async function parseErrorKey(res: Response): Promise<string> {
	try {
		const body = (await res.json()) as ErrorBody;
		if (typeof body.error === "string" && body.error.length > 0)
			return body.error;
	} catch {
		// fall through to status-based default
	}
	if (res.status === 401) return "unauthorized";
	if (res.status === 403) return "forbidden";
	if (res.status === 404) return "not_found";
	if (res.status === 409) return "capacity_full";
	return "generic";
}

async function authedFetch(
	path: string,
	init?: RequestInit,
): Promise<Response> {
	const token = getIdToken();
	const headers = new Headers(init?.headers);
	headers.set("Authorization", `Bearer ${token}`);
	if (init?.body && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}
	let res: Response;
	try {
		res = await fetch(`${API_BASE}${path}`, { ...init, headers });
	} catch {
		throw new Error("network");
	}
	return res;
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/**
 * Add (or refresh) the calling user's RSVP for the given event. The user's
 * `sub` is derived server-side from the JWT — the caller no longer passes
 * it. The legacy `userSub` field on `input` is accepted but ignored for
 * backward compatibility with Phase 1 callsites.
 *
 * The backend is idempotent: 201 for a new ticket, 200 for an existing one.
 * Both resolve to a successful RsvpRecord here.
 *
 * Throws:
 *   - Error('not_authenticated') — sessionStorage idToken missing
 *   - Error('capacity_full')     — 409 from server
 *   - Error('network')           — fetch threw (offline, DNS, etc.)
 *   - Error(<server error key>)  — any other 4xx/5xx
 */
export async function addRsvp(input: {
	eventId: string;
	userSub?: string;
	name: string | null;
	email: string | null;
}): Promise<RsvpRecord> {
	const body: Record<string, unknown> = { eventId: input.eventId };
	if (input.name) body.name = input.name;
	if (input.email) body.email = input.email;

	const res = await authedFetch("/rsvp", {
		method: "POST",
		body: JSON.stringify(body),
	});

	if (!(res.status === 200 || res.status === 201)) {
		const key = await parseErrorKey(res);
		throw new Error(key);
	}

	const record = (await res.json()) as RsvpRecord;
	upsertCache(record);
	return record;
}

/**
 * List every RSVP belonging to the currently authenticated user. On network
 * failure, falls back to the localStorage read-cache (records may be stale
 * from a prior session) so the meetings page still renders something useful
 * during transient API outages.
 *
 * Throws:
 *   - Error('not_authenticated') — no idToken AND no cache available
 *   - Error('network')           — fetch threw AND no cache available
 *   - Error(<server error key>)  — any 4xx/5xx other than transient network
 */
export async function listMyRsvps(): Promise<RsvpRecord[]> {
	let res: Response;
	try {
		res = await authedFetch("/rsvp", { method: "GET" });
	} catch (err) {
		// `not_authenticated` from getIdToken() is also caught here; it would
		// be re-thrown without consulting the cache because we can't filter the
		// cache to "this user" without a sub.
		if (err instanceof Error && err.message === "network") {
			const cached = readCache();
			if (cached.length > 0) return cached;
		}
		throw err;
	}

	if (!res.ok) {
		const key = await parseErrorKey(res);
		throw new Error(key);
	}

	const list = (await res.json()) as RsvpRecord[];
	// refresh the cache with the authoritative server view
	if (Array.isArray(list)) writeCache(list);
	return list;
}

/**
 * Lookup the calling user's RSVP for a single event. Implemented by listing
 * all of the user's RSVPs and filtering — the backend doesn't expose a
 * single-record GET and the list is bounded by the user's event count
 * (small).
 *
 * Returns undefined if no RSVP exists. Re-throws auth and network errors so
 * the caller can route to login or render an outage state.
 */
export async function getRsvpForCurrentUser(
	eventId: string,
): Promise<RsvpRecord | undefined> {
	const list = await listMyRsvps();
	return list.find((r) => r.eventId === eventId);
}

/**
 * Public spots-remaining counter. Does NOT require auth — backed by the
 * public `GET /rsvp/{eventId}/spots` route. On any failure (network, 404,
 * 5xx) returns Number.NaN so the UI's `remaining > 0` checks fail-safe to
 * the "sold out / unknown" state. A console.warn marks the failure for
 * devtools visibility.
 */
export async function spotsRemaining(eventId: string): Promise<number> {
	// Read from the static snapshot at /data/rsvp-counts.json instead of
	// hitting the cdn-rsvp Lambda on every page load. The snapshot is
	// refreshed every 5 minutes by EventBridge and on every successful POST
	// /rsvp — stale data window is bounded by the cache-control max-age=60
	// header on the JSON object plus the 5-minute snapshot cadence.
	let res: Response;
	try {
		res = await fetch("/data/rsvp-counts.json", { cache: "default" });
	} catch (err) {
		console.warn("[rsvp] spotsRemaining network error", err);
		return Number.NaN;
	}

	if (!res.ok) {
		console.warn(`[rsvp] spotsRemaining snapshot returned ${res.status}`);
		return Number.NaN;
	}

	try {
		const body = (await res.json()) as {
			counts?: Record<string, { remaining?: number }>;
		};
		const entry = body.counts?.[eventId];
		if (entry && typeof entry.remaining === "number") return entry.remaining;
		console.warn("[rsvp] spotsRemaining snapshot missing event", eventId);
		return Number.NaN;
	} catch (err) {
		console.warn("[rsvp] spotsRemaining body parse error", err);
		return Number.NaN;
	}
}

/**
 * Build the deterministic ticket payload string used as the QR code value.
 * Format: `cdn-ticket:v1:{eventId}:{userSub}` — short, scannable, no PII.
 * Wire-compatible with Phase 1 tickets and the wave 35a backend's
 * `ticket_payload` field. Pure function — no I/O.
 */
export function buildTicketPayload(record: RsvpRecord): string {
	return `cdn-ticket:v1:${record.eventId}:${record.userSub}`;
}

// ---------------------------------------------------------------------------
// backward-compat shims
//
// Phase 1 callsites pass userSub explicitly; the new API derives sub from
// the JWT server-side. These shims accept the old signature and forward to
// the new one so consumers can migrate at their own pace.
// ---------------------------------------------------------------------------

/** @deprecated Use {@link getRsvpForCurrentUser}. The userSub argument is
 *  ignored — the server derives it from the JWT. */
export function getRsvp(
	eventId: string,
	_userSub?: string,
): Promise<RsvpRecord | undefined> {
	return getRsvpForCurrentUser(eventId);
}

/** @deprecated Use {@link listMyRsvps}. The userSub argument is ignored —
 *  the server derives it from the JWT. */
export function listUserRsvps(_userSub?: string): Promise<RsvpRecord[]> {
	return listMyRsvps();
}
