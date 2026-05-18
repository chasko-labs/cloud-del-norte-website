// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * KEXP now-playing fetcher — surfaces the current song / artist / album-art
 * URL from api.kexp.org/v2/plays so the persistent player can render a small
 * cover-art thumbnail when the listener is tuned to the KEXP stream.
 *
 * Background:
 *   - api.kexp.org is already in our CSP connect-src, so the fetch lands in
 *     the browser without proxying.
 *   - /v2/plays/?limit=1 returns an array of "play" rows. Each row has a
 *     `play_type` enum — "trackplay" carries song metadata; "airbreak" /
 *     "nontrackplay" rows are DJ talk segments and have no song / image.
 *   - `image_uri` is a 500px cover-art-archive thumbnail when MusicBrainz has
 *     a release match for the track. It can be an empty string when the
 *     track is unmatched (DJs spinning unreleased / very obscure cuts) — we
 *     normalize that to null so callers can short-circuit the <img> render.
 *
 * Contract:
 *   - Returns { song, artist, albumArtUrl } on a fresh trackplay row
 *   - Returns null on:
 *       - network error
 *       - non-2xx response
 *       - malformed / empty JSON
 *       - non-trackplay rows (airbreak, nontrackplay) — caller treats this
 *         the same as "no current track" and drops the album art UI
 *
 *   albumArtUrl is null when image_uri is missing or empty so the UI can
 *   distinguish "no image yet" from "no track playing".
 *
 * The fetch function is parameterized to keep tests deterministic — pass a
 * mock through the optional second argument.
 */

const KEXP_PLAYS_ENDPOINT =
	"https://api.kexp.org/v2/plays/?limit=1&format=json";

export interface KexpNowPlaying {
	readonly song: string;
	readonly artist: string;
	readonly albumArtUrl: string | null;
}

interface KexpPlayRow {
	readonly artist?: string;
	readonly song?: string;
	readonly play_type?: string;
	readonly image_uri?: string;
	readonly thumbnail_uri?: string;
}

interface KexpPlaysResponse {
	readonly results?: ReadonlyArray<KexpPlayRow>;
}

export async function fetchKexpNowPlaying(
	fetchImpl: typeof fetch = fetch,
): Promise<KexpNowPlaying | null> {
	try {
		const res = await fetchImpl(KEXP_PLAYS_ENDPOINT);
		if (!res.ok) return null;
		const data = (await res.json()) as KexpPlaysResponse | null;
		const play = data?.results?.[0];
		if (!play) return null;
		// non-trackplay rows (airbreak, nontrackplay) have no song / image —
		// caller drops the now-playing block entirely
		if (play.play_type && play.play_type !== "trackplay") return null;
		const song = typeof play.song === "string" ? play.song : "";
		const artist = typeof play.artist === "string" ? play.artist : "";
		if (!song && !artist) return null;
		// image_uri is a non-empty string when MusicBrainz had a release match;
		// fall back to thumbnail_uri (250px) for parity, then null when neither
		// is populated so the UI can hide the <img> cleanly
		const rawArt =
			(typeof play.image_uri === "string" && play.image_uri.length > 0
				? play.image_uri
				: null) ??
			(typeof play.thumbnail_uri === "string" && play.thumbnail_uri.length > 0
				? play.thumbnail_uri
				: null);
		return {
			song,
			artist,
			albumArtUrl: rawArt,
		};
	} catch {
		// network error / malformed JSON — silent; caller drops the UI
		return null;
	}
}
