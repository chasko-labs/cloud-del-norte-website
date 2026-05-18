// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * RSVP client-side storage layer.
 *
 * Phase 1: localStorage-only. Each RSVP record is keyed by the user's Cognito
 * `sub` and the event id. The QR ticket payload is derived deterministically
 * from {sub, eventId, name, email} so the same authenticated user always
 * regenerates the same ticket from the same browser.
 *
 * Phase 2 (deferred to a separate dispatch): replace the localStorage layer
 * with an API Gateway HTTP V2 + Lambda + DynamoDB backend so capacity is
 * enforced server-side and tickets survive across browsers/devices.
 */

const STORAGE_KEY = "cdn.rsvps.v1";

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
		title: "Cloud Del Norte UG — Community Happy Hour & Networking Night",
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

function isBrowser(): boolean {
	return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): RsvpRecord[] {
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

function writeAll(records: RsvpRecord[]): void {
	if (!isBrowser()) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
	} catch {
		// localStorage may be disabled (private mode, quota exceeded). The user
		// will see the ticket on the confirmation page but it won't persist;
		// next dispatch's backend will solve the durability problem.
	}
}

/**
 * Lookup a single user's RSVP for a given event.
 * Returns undefined if no RSVP exists.
 */
export function getRsvp(
	eventId: string,
	userSub: string,
): RsvpRecord | undefined {
	return readAll().find((r) => r.eventId === eventId && r.userSub === userSub);
}

/**
 * Add (or refresh) an RSVP record for the given user + event.
 * Idempotent — a second call with the same {eventId,userSub} returns the
 * existing record without duplicating it.
 */
export function addRsvp(input: {
	eventId: string;
	userSub: string;
	name: string | null;
	email: string | null;
}): RsvpRecord {
	const existing = getRsvp(input.eventId, input.userSub);
	if (existing) return existing;
	const record: RsvpRecord = {
		eventId: input.eventId,
		userSub: input.userSub,
		name: input.name,
		email: input.email,
		createdAt: new Date().toISOString(),
	};
	const records = readAll();
	records.push(record);
	writeAll(records);
	return record;
}

/** Return all RSVPs belonging to a single authenticated user. */
export function listUserRsvps(userSub: string): RsvpRecord[] {
	return readAll().filter((r) => r.userSub === userSub);
}

/**
 * Spots remaining for an event. Counts the baseline (off-platform RSVPs) plus
 * the local count of in-app RSVPs. Phase 2 will swap this for a server query.
 */
export function spotsRemaining(eventId: string): number {
	const event = getEvent(eventId);
	if (!event) return 0;
	const localCount = readAll().filter((r) => r.eventId === eventId).length;
	const taken = event.rsvpedBaseline + localCount;
	return Math.max(0, event.capacity - taken);
}

/**
 * Build the deterministic ticket payload string used as the QR code value.
 * Format: `cdn-ticket:v1:{eventId}:{userSub}` — short, scannable, no PII.
 * The check-in flow at the door scans this string and looks up the record
 * server-side (when the backend lands in Phase 2). For now it serves as a
 * stable identifier the user can show.
 */
export function buildTicketPayload(record: RsvpRecord): string {
	return `cdn-ticket:v1:${record.eventId}:${record.userSub}`;
}
