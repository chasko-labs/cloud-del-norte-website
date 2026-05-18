// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	addRsvp,
	buildTicketPayload,
	CDN_EVENTS,
	getEvent,
	getRsvp,
	listUserRsvps,
	type RsvpRecord,
	spotsRemaining,
} from "../rsvp";

const EVENT_ID = "happy-hour-2026-06-03";

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	localStorage.clear();
});

describe("rsvp lib", () => {
	it("CDN_EVENTS contains the happy-hour event with expected capacity", () => {
		const event = getEvent(EVENT_ID);
		expect(event).toBeDefined();
		expect(event?.capacity).toBe(50);
		expect(event?.rsvpedBaseline).toBe(2);
		expect(event?.location).toBe("Downtown El Paso, Texas");
	});

	it("spotsRemaining starts at capacity minus baseline", () => {
		expect(spotsRemaining(EVENT_ID)).toBe(48);
	});

	it("spotsRemaining decrements by 1 for each in-app RSVP", () => {
		addRsvp({ eventId: EVENT_ID, userSub: "u1", name: "Alice", email: null });
		expect(spotsRemaining(EVENT_ID)).toBe(47);
		addRsvp({ eventId: EVENT_ID, userSub: "u2", name: "Bob", email: null });
		expect(spotsRemaining(EVENT_ID)).toBe(46);
	});

	it("addRsvp is idempotent for the same user+event", () => {
		const first = addRsvp({
			eventId: EVENT_ID,
			userSub: "u1",
			name: "Alice",
			email: null,
		});
		const second = addRsvp({
			eventId: EVENT_ID,
			userSub: "u1",
			name: "Alice (different)",
			email: null,
		});
		expect(first).toEqual(second);
		expect(spotsRemaining(EVENT_ID)).toBe(47);
	});

	it("getRsvp returns the record for matching user+event", () => {
		addRsvp({
			eventId: EVENT_ID,
			userSub: "u1",
			name: "Alice",
			email: "a@example.com",
		});
		const found = getRsvp(EVENT_ID, "u1");
		expect(found?.name).toBe("Alice");
		expect(found?.email).toBe("a@example.com");
	});

	it("getRsvp returns undefined for missing user+event", () => {
		expect(getRsvp(EVENT_ID, "missing")).toBeUndefined();
	});

	it("listUserRsvps returns only the calling user's records", () => {
		addRsvp({ eventId: EVENT_ID, userSub: "u1", name: "A", email: null });
		addRsvp({ eventId: EVENT_ID, userSub: "u2", name: "B", email: null });
		const u1 = listUserRsvps("u1");
		expect(u1).toHaveLength(1);
		expect(u1[0].userSub).toBe("u1");
	});

	it("buildTicketPayload produces a stable cdn-ticket:v1 prefixed string", () => {
		const record: RsvpRecord = {
			eventId: EVENT_ID,
			userSub: "u1",
			name: null,
			email: null,
			createdAt: "2026-05-18T22:00:00.000Z",
		};
		expect(buildTicketPayload(record)).toBe(`cdn-ticket:v1:${EVENT_ID}:u1`);
	});

	it("spotsRemaining never goes negative when capacity is exhausted", () => {
		const event = getEvent(EVENT_ID);
		if (!event) throw new Error("event missing");
		// Fill all remaining spots with synthetic RSVPs
		for (let i = 0; i < event.capacity - event.rsvpedBaseline + 5; i++) {
			addRsvp({
				eventId: EVENT_ID,
				userSub: `u${i}`,
				name: null,
				email: null,
			});
		}
		expect(spotsRemaining(EVENT_ID)).toBe(0);
	});

	it("CDN_EVENTS list is non-empty", () => {
		expect(CDN_EVENTS.length).toBeGreaterThan(0);
	});

	it("returns empty list for unknown event id", () => {
		expect(getEvent("does-not-exist")).toBeUndefined();
		expect(spotsRemaining("does-not-exist")).toBe(0);
	});
});
