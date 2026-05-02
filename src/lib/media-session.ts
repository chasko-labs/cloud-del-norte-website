// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * MediaSession API integration — surfaces station + now-playing metadata
 * into the OS-level media notification (Android lock screen / notification
 * shade, macOS Now Playing widget, ChromeOS / desktop Chrome global media
 * controls). Without this, Chrome on Android falls back to the page <title>
 * + origin host, which renders as "AWS UG Cloud Del No..." + "clouddelnorte.org".
 *
 * Support matrix (validated 2026-05):
 * - Chrome / Edge desktop + Android: full support, including action handlers
 * - Safari iOS 15+ / iPadOS / macOS: metadata + play/pause; nexttrack/previoustrack
 *   wired to lockscreen "skip" buttons
 * - Firefox desktop / Android: metadata supported, action handlers partial
 *   (play/pause yes; nexttrack/previoustrack ignored on some versions)
 *
 * ICY metadata note: native browser <audio> elements do NOT expose ICY/Shoutcast
 * inline metadata to JavaScript — there is no standardized API to read the
 * StreamTitle frame. Surfacing live track info from stations without a
 * separate JSON endpoint would require a server-side proxy that strips ICY
 * frames and re-streams + serves a parallel /now.json. Out of scope here:
 * for stations without metaUrl we fall back to the station label, which is
 * still a meaningful upgrade over "AWS UG Cloud Del No...".
 */

/**
 * Marketing-style fallback subtitle surfaced in the lockscreen / Now Playing
 * widget when the station has no live track metadata (no metaUrl OR endpoint
 * errored / returned empty). Lives in the artist field because the Web
 * MediaSession spec doesn't expose displaySubtitle. Same string is also
 * rendered in the in-page pill via the eyebrow row so the web UI matches the
 * OS notification copy.
 */
export const STREAMING_FALLBACK_SUBTITLE = "streaming on clouddelnorte.org";

interface MediaSessionInput {
	stationLabel: string;
	/** "song — artist" or null when no live track info available */
	nowPlaying: string | null;
	/** when present, "next track" / "previous track" actions skip stations */
	onSkipNext?: () => void;
	onSkipPrev?: () => void;
	/** play / pause handlers — bound to the active <audio> element */
	onPlay: () => void;
	onPause: () => void;
}

/**
 * Apply MediaSession metadata + action handlers. Safe to call on every render
 * (idempotent — the API normalizes repeated metadata writes). When the
 * runtime has no MediaSession support (older Firefox, in-app webviews) this
 * silently no-ops; existing playback continues unaffected.
 */
export function setMediaSession(input: MediaSessionInput): void {
	if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
		return;
	}

	const ms = navigator.mediaSession;

	// title + artist resolution:
	// - track present  → title = "<song>", artist = "<station label>"
	//   (Android renders these on two lines; reads as "<song> / <station>")
	// - track absent   → title = "<station label>", artist = STREAMING_FALLBACK_SUBTITLE
	//   so the notification surfaces brand context ("streaming on clouddelnorte.org")
	//   instead of "<station> / <station>" duplication when no nowPlaying string
	//   is available (uam_radio, concepto_radial, or any station whose metadata
	//   endpoint errored / returned empty)
	const hasTrack = !!input.nowPlaying;
	ms.metadata = new MediaMetadata({
		title: hasTrack ? (input.nowPlaying as string) : input.stationLabel,
		artist: hasTrack ? input.stationLabel : STREAMING_FALLBACK_SUBTITLE,
		album: "AWS UG Cloud Del Norte",
		artwork: [
			// 512×512 first — Android picks the largest sufficient size for full-screen
			// lockscreen art and notification shade thumb in one pass; iOS 16+ uses
			// it as the source for tap-to-expand artwork in the Now Playing tile
			{
				src: "/apple-touch-icon-512.png",
				sizes: "512x512",
				type: "image/png",
			},
			// 180×180 fallback — covers Android notification shade thumb on devices
			// that prefer the smaller raster + iOS 15 home/lock screen artwork
			{
				src: "/apple-touch-icon.png",
				sizes: "180x180",
				type: "image/png",
			},
			// SVG for Chrome desktop's global media hub (renders vector at any DPR);
			// Android / iOS ignore SVG and pick a PNG above
			{
				src: "/favicon.svg",
				sizes: "any",
				type: "image/svg+xml",
			},
		],
	});

	// each action handler must be set explicitly; passing null clears one. We
	// always wire play/pause; skip handlers only when the caller supplied them
	// (the persistent player carries skip; ad-hoc <audio> elements may not)
	try {
		ms.setActionHandler("play", () => input.onPlay());
		ms.setActionHandler("pause", () => input.onPause());
		ms.setActionHandler(
			"nexttrack",
			input.onSkipNext ? () => input.onSkipNext?.() : null,
		);
		ms.setActionHandler(
			"previoustrack",
			input.onSkipPrev ? () => input.onSkipPrev?.() : null,
		);
	} catch {
		// older browsers throw on unsupported action types — ignore, the
		// supported subset is already wired
	}
}

/**
 * Clear MediaSession state — called on stop / unmount so the OS notification
 * disappears alongside the in-page player. Without this, Android keeps
 * showing the last known metadata until the page is closed.
 */
export function clearMediaSession(): void {
	if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
		return;
	}
	const ms = navigator.mediaSession;
	ms.metadata = null;
	for (const action of [
		"play",
		"pause",
		"nexttrack",
		"previoustrack",
	] as const) {
		try {
			ms.setActionHandler(action, null);
		} catch {
			// unsupported action — already absent, nothing to clear
		}
	}
}
