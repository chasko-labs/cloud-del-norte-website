// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchKexpNowPlaying } from "../kexp-now-playing";

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

describe("fetchKexpNowPlaying", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("parses a trackplay row with song + artist + image_uri", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			fakeResponse(200, {
				results: [
					{
						song: "I Can't Wait",
						artist: "Nu Shooz",
						play_type: "trackplay",
						image_uri: "https://archive.example/cover-500.jpg",
						thumbnail_uri: "https://archive.example/cover-250.jpg",
					},
				],
			}),
		);

		const result = await fetchKexpNowPlaying(fetchMock);
		expect(result).toEqual({
			song: "I Can't Wait",
			artist: "Nu Shooz",
			albumArtUrl: "https://archive.example/cover-500.jpg",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.kexp.org/v2/plays/?limit=1&format=json",
		);
	});

	it("falls back to thumbnail_uri when image_uri is missing", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			fakeResponse(200, {
				results: [
					{
						song: "Track",
						artist: "Artist",
						play_type: "trackplay",
						thumbnail_uri: "https://archive.example/thumb.jpg",
					},
				],
			}),
		);

		const result = await fetchKexpNowPlaying(fetchMock);
		expect(result?.albumArtUrl).toBe("https://archive.example/thumb.jpg");
	});

	it("returns null albumArtUrl when image_uri is an empty string and no thumbnail", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			fakeResponse(200, {
				results: [
					{
						song: "Untitled Demo",
						artist: "Local Artist",
						play_type: "trackplay",
						image_uri: "",
					},
				],
			}),
		);

		const result = await fetchKexpNowPlaying(fetchMock);
		expect(result).toEqual({
			song: "Untitled Demo",
			artist: "Local Artist",
			albumArtUrl: null,
		});
	});

	it("treats missing play_type as a trackplay (back-compat)", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			fakeResponse(200, {
				results: [
					{
						song: "S",
						artist: "A",
						image_uri: "https://example/i.jpg",
					},
				],
			}),
		);

		const result = await fetchKexpNowPlaying(fetchMock);
		expect(result).not.toBeNull();
		expect(result?.song).toBe("S");
	});

	it("returns null on airbreak (non-trackplay) rows", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			fakeResponse(200, {
				results: [
					{
						play_type: "airbreak",
					},
				],
			}),
		);

		expect(await fetchKexpNowPlaying(fetchMock)).toBeNull();
	});

	it("returns null when results array is empty", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(fakeResponse(200, { results: [] }));
		expect(await fetchKexpNowPlaying(fetchMock)).toBeNull();
	});

	it("returns null when both song and artist are missing", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			fakeResponse(200, {
				results: [{ play_type: "trackplay" }],
			}),
		);
		expect(await fetchKexpNowPlaying(fetchMock)).toBeNull();
	});

	it("returns null on non-2xx response", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(503));
		expect(await fetchKexpNowPlaying(fetchMock)).toBeNull();
	});

	it("returns null on network error", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
		expect(await fetchKexpNowPlaying(fetchMock)).toBeNull();
	});

	it("returns null on malformed JSON", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(fakeResponse(200, undefined, true));
		expect(await fetchKexpNowPlaying(fetchMock)).toBeNull();
	});

	it("returns null on null body", async () => {
		const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, null));
		expect(await fetchKexpNowPlaying(fetchMock)).toBeNull();
	});
});
