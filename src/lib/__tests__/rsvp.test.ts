// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import {
	addRsvp,
	buildTicketPayload,
	CDN_EVENTS,
	getEvent,
	listMyRsvps,
	type RsvpRecord,
	spotsRemaining,
} from "../rsvp";

const EVENT_ID = "happy-hour-2026-06-03";
const API_BASE = "https://tta0e43bs0.execute-api.us-west-2.amazonaws.com/prod";
const ID_TOKEN = "stub.id.token";

// Mock fetch as a vi.fn so each test can configure its own resolved/rejected
// value. Reset between tests so leakage between cases never confuses
// debugging.
const fetchMock = vi.fn();

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	fetchMock.mockReset();
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	sessionStorage.setItem("cdn.idToken", ID_TOKEN);
});

afterEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("rsvp lib — static metadata", () => {
	it("CDN_EVENTS contains the happy-hour event with expected capacity", () => {
		const event = getEvent(EVENT_ID);
		expect(event).toBeDefined();
		expect(event?.capacity).toBe(50);
		expect(event?.rsvpedBaseline).toBe(2);
		expect(event?.location).toBe("Downtown El Paso, Texas");
	});

	it("CDN_EVENTS list is non-empty", () => {
		expect(CDN_EVENTS.length).toBeGreaterThan(0);
	});

	it("getEvent returns undefined for an unknown event id", () => {
		expect(getEvent("does-not-exist")).toBeUndefined();
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
});

describe("addRsvp", () => {
	it("returns the new ticket on 201 and updates the cache", async () => {
		const record: RsvpRecord = {
			eventId: EVENT_ID,
			userSub: "u1",
			name: "Alice",
			email: "a@example.com",
			createdAt: "2026-05-18T22:00:00.000Z",
		};
		fetchMock.mockResolvedValueOnce(jsonResponse(201, record));

		const result = await addRsvp({
			eventId: EVENT_ID,
			name: "Alice",
			email: "a@example.com",
		});

		expect(result).toEqual(record);
		// Verify request shape — Bearer header + JSON body.
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`${API_BASE}/rsvp`);
		expect(init.method).toBe("POST");
		const headers = new Headers(init.headers);
		expect(headers.get("Authorization")).toBe(`Bearer ${ID_TOKEN}`);
		expect(headers.get("Content-Type")).toBe("application/json");
		expect(JSON.parse(String(init.body))).toEqual({
			eventId: EVENT_ID,
			name: "Alice",
			email: "a@example.com",
		});
		// Cache primed.
		const cached = JSON.parse(localStorage.getItem("cdn.rsvps.v1") ?? "[]");
		expect(cached).toEqual([record]);
	});

	it("treats 200 (idempotent existing ticket) as success", async () => {
		const record: RsvpRecord = {
			eventId: EVENT_ID,
			userSub: "u1",
			name: "Alice",
			email: null,
			createdAt: "2026-05-18T22:00:00.000Z",
		};
		fetchMock.mockResolvedValueOnce(jsonResponse(200, record));

		const result = await addRsvp({
			eventId: EVENT_ID,
			name: "Alice",
			email: null,
		});
		expect(result).toEqual(record);
	});

	it("throws Error('capacity_full') on 409 with that error key", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(409, { error: "capacity_full" }),
		);
		await expect(
			addRsvp({ eventId: EVENT_ID, name: null, email: null }),
		).rejects.toThrow("capacity_full");
	});

	it("throws Error('not_authenticated') when sessionStorage idToken is missing", async () => {
		sessionStorage.removeItem("cdn.idToken");
		await expect(
			addRsvp({ eventId: EVENT_ID, name: null, email: null }),
		).rejects.toThrow("not_authenticated");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("throws Error('network') when fetch rejects", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		await expect(
			addRsvp({ eventId: EVENT_ID, name: null, email: null }),
		).rejects.toThrow("network");
	});

	it("propagates unknown server error keys verbatim", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(400, { error: "bad_request" }),
		);
		await expect(
			addRsvp({ eventId: EVENT_ID, name: null, email: null }),
		).rejects.toThrow("bad_request");
	});
});

describe("listMyRsvps", () => {
	const record: RsvpRecord = {
		eventId: EVENT_ID,
		userSub: "u1",
		name: "Alice",
		email: null,
		createdAt: "2026-05-18T22:00:00.000Z",
	};

	it("returns the array on success and refreshes the cache", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(200, [record]));
		const result = await listMyRsvps();
		expect(result).toEqual([record]);
		const cached = JSON.parse(localStorage.getItem("cdn.rsvps.v1") ?? "[]");
		expect(cached).toEqual([record]);
	});

	it("falls back to the cache when fetch rejects with a network error", async () => {
		// seed cache with a stale record from a prior session
		localStorage.setItem("cdn.rsvps.v1", JSON.stringify([record]));
		fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const result = await listMyRsvps();
		expect(result).toEqual([record]);
	});

	it("throws Error('network') when fetch rejects AND cache is empty", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		await expect(listMyRsvps()).rejects.toThrow("network");
	});

	it("throws Error('unauthorized') on 401 (no cache fallback for auth errors)", async () => {
		// even with a primed cache, a 401 means the user's token is bad and
		// we want them routed to login — not silently shown stale data.
		localStorage.setItem("cdn.rsvps.v1", JSON.stringify([record]));
		fetchMock.mockResolvedValueOnce(
			jsonResponse(401, { error: "unauthorized" }),
		);
		await expect(listMyRsvps()).rejects.toThrow("unauthorized");
	});
});

describe("spotsRemaining", () => {
	let warnSpy: MockInstance<typeof console.warn>;

	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		warnSpy.mockRestore();
	});

	it("returns the remaining count on a 200 response", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(200, {
				counts: { [EVENT_ID]: { remaining: 50, capacity: 50, taken: 0 } },
			}),
		);
		await expect(spotsRemaining(EVENT_ID)).resolves.toBe(50);
		// public endpoint — no Authorization header should have been sent.
		const [url, init] = fetchMock.mock.calls[0] as [
			string,
			RequestInit | undefined,
		];
		expect(url).toBe("/data/rsvp-counts.json");
		expect(init?.headers).toBeUndefined();
	});

	it("returns NaN on a 404 (unknown event)", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(404, { error: "unknown_event" }),
		);
		const result = await spotsRemaining("does-not-exist");
		expect(Number.isNaN(result)).toBe(true);
		expect(warnSpy).toHaveBeenCalled();
	});

	it("returns NaN AND console.warns when fetch rejects", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const result = await spotsRemaining(EVENT_ID);
		expect(Number.isNaN(result)).toBe(true);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("network error"),
			expect.anything(),
		);
	});

	it("does not require auth (calls public endpoint without idToken)", async () => {
		sessionStorage.removeItem("cdn.idToken");
		fetchMock.mockResolvedValueOnce(
			jsonResponse(200, {
				counts: { [EVENT_ID]: { remaining: 45, capacity: 50, taken: 5 } },
			}),
		);
		await expect(spotsRemaining(EVENT_ID)).resolves.toBe(45);
	});
});
