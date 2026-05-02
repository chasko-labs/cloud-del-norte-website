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

	// title prefers the live track string; falls back to station label so the
	// notification always says something station-specific (never "AWS UG Cloud
	// Del No..."). artist always carries the station label so the "now playing"
	// readout reads as "<song> — <station>" on Android's split-line layout.
	ms.metadata = new MediaMetadata({
		title: input.nowPlaying ?? input.stationLabel,
		artist: input.stationLabel,
		album: "AWS UG Cloud Del Norte",
		artwork: [
			// 180×180 PNG covers Android lockscreen + notification shade. SVG entry
			// is for Chrome desktop's global media hub which can render vector at
			// any DPR; Android ignores SVG and picks the PNG
			{
				src: "/apple-touch-icon.png",
				sizes: "180x180",
				type: "image/png",
			},
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
