import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearAllOembedCache,
	clearOembedCache,
	probeOembed,
} from "../youtube-oembed-cache";

const CHANNEL = "https://www.youtube.com/@andmoredev/live";
const OTHER = "https://www.youtube.com/@someoneelse/live";

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

describe("youtube-oembed-cache", () => {
	beforeEach(() => {
		clearAllOembedCache();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		clearAllOembedCache();
	});

	it("404 caches the offline result and skips a second fetch", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(404));

		const a = await probeOembed(CHANNEL, fetchMock);
		const b = await probeOembed(CHANNEL, fetchMock);

		expect(a).toEqual({ live: false, videoId: null });
		expect(b).toEqual({ live: false, videoId: null });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("200 with embed html caches the live videoId", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			fakeResponse(200, {
				html: '<iframe src="https://www.youtube.com/embed/abc123XYZ_-"></iframe>',
			}),
		);

		const a = await probeOembed(CHANNEL, fetchMock);
		const b = await probeOembed(CHANNEL, fetchMock);

		expect(a).toEqual({ live: true, videoId: "abc123XYZ_-" });
		expect(b).toEqual(a);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("transient failure (500) returns null and does NOT cache", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(fakeResponse(500))
			.mockResolvedValueOnce(fakeResponse(404));

		const a = await probeOembed(CHANNEL, fetchMock);
		const b = await probeOembed(CHANNEL, fetchMock);

		expect(a).toBeNull();
		expect(b).toEqual({ live: false, videoId: null });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("network throw returns null and does NOT cache", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(fakeResponse(404));

		const a = await probeOembed(CHANNEL, fetchMock);
		const b = await probeOembed(CHANNEL, fetchMock);

		expect(a).toBeNull();
		expect(b).toEqual({ live: false, videoId: null });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("200 with no html caches as offline", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, {}));
		const result = await probeOembed(CHANNEL, fetchMock);
		expect(result).toEqual({ live: false, videoId: null });
	});

	it("malformed json returns null and does NOT cache", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(fakeResponse(200, undefined, true))
			.mockResolvedValueOnce(fakeResponse(404));
		const a = await probeOembed(CHANNEL, fetchMock);
		const b = await probeOembed(CHANNEL, fetchMock);
		expect(a).toBeNull();
		expect(b).toEqual({ live: false, videoId: null });
	});

	it("encodes the channel url into the oembed query", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(404));
		await probeOembed(CHANNEL, fetchMock);
		const calledUrl = String(fetchMock.mock.calls[0][0]);
		expect(calledUrl).toContain("https://www.youtube.com/oembed?url=");
		expect(calledUrl).toContain(encodeURIComponent(CHANNEL));
		expect(calledUrl).toContain("&format=json");
	});

	it("caches per-channel — clearing one does not evict the other", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(404));
		await probeOembed(CHANNEL, fetchMock);
		await probeOembed(OTHER, fetchMock);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		clearOembedCache(CHANNEL);
		await probeOembed(CHANNEL, fetchMock);
		await probeOembed(OTHER, fetchMock);

		// CHANNEL re-fetched, OTHER still cached
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});
