import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearAllTwitchLiveCache,
	clearTwitchLiveCache,
	probeTwitchLive,
} from "../twitch-channel-cache";

const CHANNEL = "aws";
const OTHER = "awsonair";

function fakeResponse(
	status: number,
	body?: unknown,
	throwOnJson = false,
): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => {
			if (throwOnJson) throw new Error("bad json");
			return body;
		},
	} as unknown as Response;
}

function liveBody(): unknown {
	return [
		{
			data: {
				user: { stream: { id: "12345", createdAt: "2026-05-02T00:00:00Z" } },
			},
		},
	];
}

function offlineBody(): unknown {
	return [{ data: { user: { stream: null } } }];
}

describe("twitch-channel-cache", () => {
	beforeEach(() => {
		clearAllTwitchLiveCache();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		clearAllTwitchLiveCache();
	});

	it("offline response caches { live: false } and skips a second fetch", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, offlineBody()));

		const a = await probeTwitchLive(CHANNEL, fetchMock);
		const b = await probeTwitchLive(CHANNEL, fetchMock);

		expect(a).toEqual({ live: false });
		expect(b).toEqual({ live: false });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("live response caches { live: true } and skips a second fetch", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, liveBody()));

		const a = await probeTwitchLive(CHANNEL, fetchMock);
		const b = await probeTwitchLive(CHANNEL, fetchMock);

		expect(a).toEqual({ live: true });
		expect(b).toEqual({ live: true });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("non-existent user (data.user === null) caches as offline", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(fakeResponse(200, [{ data: { user: null } }]));

		const result = await probeTwitchLive(CHANNEL, fetchMock);
		expect(result).toEqual({ live: false });
	});

	it("transient failure (500) returns null and does NOT cache", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(fakeResponse(500))
			.mockResolvedValueOnce(fakeResponse(200, offlineBody()));

		const a = await probeTwitchLive(CHANNEL, fetchMock);
		const b = await probeTwitchLive(CHANNEL, fetchMock);

		expect(a).toBeNull();
		expect(b).toEqual({ live: false });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("network throw returns null and does NOT cache", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(fakeResponse(200, offlineBody()));

		const a = await probeTwitchLive(CHANNEL, fetchMock);
		const b = await probeTwitchLive(CHANNEL, fetchMock);

		expect(a).toBeNull();
		expect(b).toEqual({ live: false });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("malformed json returns null and does NOT cache", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(fakeResponse(200, undefined, true))
			.mockResolvedValueOnce(fakeResponse(200, offlineBody()));
		const a = await probeTwitchLive(CHANNEL, fetchMock);
		const b = await probeTwitchLive(CHANNEL, fetchMock);
		expect(a).toBeNull();
		expect(b).toEqual({ live: false });
	});

	it("missing data.user (undefined) returns null and does NOT cache", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(fakeResponse(200, [{ data: {} }]))
			.mockResolvedValueOnce(fakeResponse(200, offlineBody()));
		const a = await probeTwitchLive(CHANNEL, fetchMock);
		const b = await probeTwitchLive(CHANNEL, fetchMock);
		expect(a).toBeNull();
		expect(b).toEqual({ live: false });
	});

	it("non-array payload returns null and does NOT cache", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(fakeResponse(200, { not: "an array" }))
			.mockResolvedValueOnce(fakeResponse(200, offlineBody()));
		const a = await probeTwitchLive(CHANNEL, fetchMock);
		const b = await probeTwitchLive(CHANNEL, fetchMock);
		expect(a).toBeNull();
		expect(b).toEqual({ live: false });
	});

	it("posts the UseLive operation with channelLogin lowercased", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, offlineBody()));
		await probeTwitchLive("AwsOnAir", fetchMock);
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toBe("https://gql.twitch.tv/gql");
		expect(init?.method).toBe("POST");
		const headers = init?.headers as Record<string, string>;
		expect(headers["Client-Id"]).toBe("kimne78kx3ncx6brgo4mv6wki5h1ko");
		const body = JSON.parse(init?.body as string);
		expect(body[0].operationName).toBe("UseLive");
		expect(body[0].variables.channelLogin).toBe("awsonair");
	});

	it("caches per-channel — clearing one does not evict the other", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, offlineBody()));
		await probeTwitchLive(CHANNEL, fetchMock);
		await probeTwitchLive(OTHER, fetchMock);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		clearTwitchLiveCache(CHANNEL);
		await probeTwitchLive(CHANNEL, fetchMock);
		await probeTwitchLive(OTHER, fetchMock);

		// CHANNEL re-fetched, OTHER still cached
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("cache key is case-insensitive on channelId", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, offlineBody()));
		await probeTwitchLive("AWS", fetchMock);
		await probeTwitchLive("aws", fetchMock);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
