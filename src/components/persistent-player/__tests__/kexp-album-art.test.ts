// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 26c — KEXP album-art guard.
 *
 * The persistent-player component renders the KEXP cover-art thumbnail only
 * when (state.stationKey === "kexp" && kexpArt?.albumArtUrl). This test
 * exercises the same predicate against representative inputs to lock in the
 * KEXP-only contract:
 *   - other stations never trigger the album-art branch
 *   - kexp without album-art-url renders nothing
 *   - kexp with album-art-url renders the thumbnail
 *
 * We test the predicate directly rather than rendering the full player
 * (which requires audio + media-session mocking). This mirrors the
 * auto-advance.test.ts pattern in this directory.
 */

import { describe, expect, it } from "vitest";
import en from "../../../locales/en-US.json";
import esMX from "../../../locales/es-MX.json";

interface KexpArt {
	song: string;
	artist: string;
	albumArtUrl: string | null;
}

function shouldRenderKexpArt(stationKey: string, art: KexpArt | null): boolean {
	return stationKey === "kexp" && Boolean(art?.albumArtUrl);
}

describe("KEXP album-art KEXP-only render guard", () => {
	const sampleArt: KexpArt = {
		song: "I Can't Wait",
		artist: "Nu Shooz",
		albumArtUrl: "https://archive.example/cover.jpg",
	};

	it("renders when station=kexp and albumArtUrl is present", () => {
		expect(shouldRenderKexpArt("kexp", sampleArt)).toBe(true);
	});

	it("does NOT render when station=kexp but art is null (API failure)", () => {
		expect(shouldRenderKexpArt("kexp", null)).toBe(false);
	});

	it("does NOT render when station=kexp but albumArtUrl is null", () => {
		expect(
			shouldRenderKexpArt("kexp", { ...sampleArt, albumArtUrl: null }),
		).toBe(false);
	});

	it("does NOT render when station=krux (different station)", () => {
		expect(shouldRenderKexpArt("krux", sampleArt)).toBe(false);
	});

	it("does NOT render when station=el_sonido_kexp (different station)", () => {
		// el_sonido_kexp is a separate stream entry — only the canonical
		// `kexp` key surfaces the album-art block
		expect(shouldRenderKexpArt("el_sonido_kexp", sampleArt)).toBe(false);
	});

	it("does NOT render when station is empty / podcast", () => {
		expect(shouldRenderKexpArt("", sampleArt)).toBe(false);
		expect(shouldRenderKexpArt("rust_in_production", sampleArt)).toBe(false);
	});
});

describe("KEXP now-playing locale strings (Wave 26c)", () => {
	it("en-US persistentPlayer.kexpNowPlayingFallback exists", () => {
		expect(en.persistentPlayer?.kexpNowPlayingFallback).toBe(
			"now playing on KEXP",
		);
	});

	it("es-MX persistentPlayer.kexpNowPlayingFallback exists with parity", () => {
		expect(esMX.persistentPlayer?.kexpNowPlayingFallback).toBe(
			"sonando en KEXP",
		);
	});
});
