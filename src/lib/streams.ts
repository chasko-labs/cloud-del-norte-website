// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Per-station brand color palette.
 * - primary: institution's main brand color (used for borders, accent text, glow)
 * - secondary: complementary brand color (used for hover sweeps, secondary accents)
 * - accent: tertiary / neutral anchor (used for high-contrast text overlays)
 *
 * Per-mode overrides keep the station's identity readable on both the cream
 * (#ede5d4) light bg and the navy (#0a0a2e) dark bg. If a mode override is
 * absent the base value is used in both modes.
 */
export interface StationColors {
	readonly primary: string;
	readonly secondary: string;
	readonly accent: string;
	/** light-mode contrast tweak — used when primary fails 4.5:1 on cream */
	readonly primaryLight?: string;
	/** dark-mode contrast tweak — used when primary fails 4.5:1 on navy */
	readonly primaryDark?: string;
}

export interface StreamDef {
	readonly key: string;
	readonly url: string;
	readonly label: string;
	/** now-playing endpoint — omit when station has no public metadata feed */
	readonly metaUrl?: string;
	/**
	 * how to consume metaUrl. defaults to "json" (fetch + poll on POLL_MS).
	 * "sse" opens an EventSource and listens for push events — used for
	 * Zeno.fm mounts which expose text/event-stream at
	 * api.zeno.fm/mounts/metadata/subscribe/<mount>
	 */
	readonly metaFormat?: "json" | "sse";
	readonly colors: StationColors;
	/**
	 * canonical donation URL — surfaces a "donate | to | <key>" mini button
	 * inline with the player when present. omit for stations without a public
	 * donation channel (e.g. fully institution-funded mexican student radio)
	 */
	readonly donateUrl?: string;
	/**
	 * approximate broadcast-region latitude (decimal degrees, +N / -S). paired
	 * with longitude so the feed player can render a clickable geo line beneath
	 * the station name as part of the donate target. omit alongside donateUrl
	 * when the station has no donation channel
	 */
	readonly latitude?: number;
	/** approximate broadcast-region longitude (decimal degrees, +E / -W) */
	readonly longitude?: number;
	/** parses metaUrl response into "song — artist" string. omit alongside metaUrl */
	parseMeta?(data: unknown): string | null;
}

export const STREAMS: StreamDef[] = [
	{
		key: "krux",
		url: "https://kruxstream.nmsu.edu/KRUX",
		label: "krux 91.5",
		metaUrl: "https://kruxstream.nmsu.edu/status-json.xsl",
		donateUrl: "https://nmsufoundation.org/givenow/KRUX.html",
		// NMSU Las Cruces, NM — Milton Hall studios on the main campus
		latitude: 32.281,
		longitude: -106.748,
		// nmsu brand book — https://brand.nmsu.edu/colors/
		// primary: aggie crimson; secondary: mesilla valley sunset (orange);
		// accent: warm cream (replaces banned #fff)
		colors: {
			primary: "#8C0B42",
			secondary: "#F2824F",
			accent: "#faf7f0",
			// crimson too dark on navy bg — brighten to magenta-rose for dark mode
			primaryDark: "#d63868",
		},
		parseMeta(data) {
			const d = data as {
				icestats?: { source?: { title?: string } | Array<{ title?: string }> };
			};
			const src = d?.icestats?.source;
			const s = Array.isArray(src) ? src[0] : src;
			return s?.title ?? null;
		},
	},
	{
		key: "kexp",
		url: "https://kexp.streamguys1.com/kexp160.aac",
		label: "kexp 90.3",
		metaUrl: "https://api.kexp.org/v2/plays/?limit=1&format=json",
		donateUrl: "https://www.kexp.org/donate/",
		// KEXP Gathering Space — Seattle Center, WA
		latitude: 47.61,
		longitude: -122.342,
		// kexp brand book — https://cargocollective.com/jonisdelicious/KEXP-Brand-Book
		// primary: buttercup yellow; secondary: mona lisa coral; accent: thunder near-black
		colors: {
			primary: "#F5B21F",
			secondary: "#FF9E8B",
			accent: "#231F20",
			// buttercup too pale on cream — deepen to amber for light-mode AA contrast
			primaryLight: "#a06e0c",
		},
		parseMeta(data) {
			// KEXP v2 plays returns `artist` (not `artist_name`) plus `play_type`.
			// Filter to trackplay so airbreak / nontrackplay rows do not surface a
			// stale title from a prior song
			const d = data as {
				results?: Array<{ artist?: string; song?: string; play_type?: string }>;
			};
			const play = d?.results?.[0];
			if (!play) return null;
			if (play.play_type && play.play_type !== "trackplay") return null;
			const { artist, song } = play;
			if (artist && song) return `${song} — ${artist}`;
			return song ?? artist ?? null;
		},
	},
	{
		key: "ksfr",
		// StreamTheWorld AAC+ endpoint surfaced from ksfr.org homepage HTML scan
		// (curl + grep). 302 redirects to 18243.live.streamtheworld.com:443/KSFRFM_ICE.aac.
		// Validated: HTTP/1.1 302 → HTTP/1.0 200, Content-Type: audio/aacp,
		// Access-Control-Allow-Origin: * (CORS open).
		url: "https://playerservices.streamtheworld.com/api/livestream-redirect/KSFRFM_ICE.aac",
		label: "ksfr 101.1",
		// NPR Composer widget id 5182a3cce1c805df63015f16 captured via headless
		// playwright network sniff of ksfr.org (v0.0.0071). Lazy-hydrated player
		// widget didn't expose this in static HTML. Same shape as KUNM's prior
		// composer feed — onNow.song.{trackName, artistName} when track-logging
		// is active, falls back to onNow.program.name on talk shows.
		metaUrl:
			"https://api.composer.nprstations.org/v1/widget/5182a3cce1c805df63015f16/now?format=json&style=v2&show_song=true",
		metaFormat: "json",
		donateUrl: "https://www.ksfr.org/donate",
		// SFCC studios — Santa Fe, NM
		latitude: 35.687,
		longitude: -105.938,
		// SFCC official brand: turquoise PMS 326 + maroon PMS 484. Replaces the
		// v0.0.0065 UNM-cherry placeholder once bryan supplied the SFCC guide.
		colors: {
			primary: "#00B2A9", // SFCC turquoise (PMS 326)
			secondary: "#9A3324", // SFCC maroon (PMS 484)
			accent: "#faf7f0", // warm cream anchor (avoids #fff)
			// turquoise borderline on cream (~3.4:1) — deepen for light-mode AA
			primaryLight: "#006e69",
			// turquoise on navy ~6.8:1 — passes AAA, no dark override needed
		},
		parseMeta(data) {
			// nprstations widget shape: onNow.song.{trackName, artistName} when
			// the track-logger is active. Programs without inline track metadata
			// (talk shows like "Somos Son") fall back to onNow.program.name
			const d = data as {
				onNow?: {
					program?: { name?: string };
					song?: { trackName?: string; artistName?: string };
				} | null;
			};
			const song = d?.onNow?.song;
			if (song) {
				const { trackName: track, artistName: artist } = song;
				if (track && artist) return `${track} — ${artist}`;
				if (track || artist) return track ?? artist ?? null;
			}
			const program = d?.onNow?.program?.name?.trim();
			return program || null;
		},
	},
	{
		key: "kutx",
		// FOLLOWUP: hls.js for HLS streams — canonical source is
		// https://streams.kut.org/4428/playlist.m3u8 but the bare <audio> element
		// only plays HLS natively on Safari. mp3 fallback works in all browsers.
		url: "https://streams.kut.org/4428_192.mp3?aw_0_1st.playerid=kutx-free",
		label: "kutx 98.9",
		donateUrl: "https://www.kutx.org/donate",
		// KUT/KUTX studios — UT Austin campus, TX
		latitude: 30.275,
		longitude: -97.741,
		// NPR Composer widget id 50ef24ebe1c8a1369593d032 sniffed from kutx.org
		// homepage; CORS open (Access-Control-Allow-Origin: *)
		metaUrl:
			"https://api.composer.nprstations.org/v1/widget/50ef24ebe1c8a1369593d032/now?format=json",
		// ut austin brand — burnt orange / dark blue-gray
		colors: {
			primary: "#bf5700", // burnt orange — ut iconic
			secondary: "#333f48", // dark blue-gray
			accent: "#f8971f", // lighter orange
			// burnt orange too dark on navy bg — brighten for dark-mode AA contrast
			primaryDark: "#d97c2e",
			// burnt orange on cream: ~5.1:1 — passes AA, no light override
		},
		parseMeta(data) {
			// nprstations widget shape: onNow.song.{trackName, artistName}.
			// onNow is null between programs; song is null on talk shows
			const d = data as {
				onNow?: {
					song?: { trackName?: string; artistName?: string };
				} | null;
			};
			const song = d?.onNow?.song;
			if (!song) return null;
			const { trackName: track, artistName: artist } = song;
			if (track && artist) return `${track} — ${artist}`;
			return track ?? artist ?? null;
		},
	},
	{
		key: "uam_radio",
		// FOLLOWUP: verify CORS works in browser; alt URL: https://radios.yanapak.org/UAMRadio if primary fails
		// non-standard port 1124 — icecast mp3; <audio crossOrigin="anonymous"> may need
		// per-station opt-out if origin lacks Access-Control-Allow-Origin header
		url: "https://stream5.mexiserver.com:1124/",
		label: "uam radio 94.1",
		// metaUrl omitted — uam radio site has no public json now-playing endpoint
		// uam institutional brand — agent guess: red/black/white with yellow accent
		// (azcapotzalco unidad color). FOLLOWUP: refine once official uam brand
		// guidelines confirmed — five unidades each carry distinct accent colors
		colors: {
			primary: "#a72f2f", // uam university red — institutional
			secondary: "#000000", // uam black
			accent: "#e8c547", // warm yellow — azcapotzalco accent
			// red too dark on navy bg — brighten for dark-mode AA contrast
			primaryDark: "#d44f4f",
			// red on cream borderline — deepen for light-mode AA contrast
			primaryLight: "#7a1f1f",
		},
	},
	{
		key: "ibero_909",
		// FOLLOWUP: verify CORS works in browser; alt URL: https://noasrv.caster.fm:10182/live
		// caster.fm icecast mp3 endpoint extracted from live player network sniff;
		// HEAD validated: 200, audio/mpeg, Access-Control-Allow-Origin: *
		url: "https://shaincast.caster.fm:20866/listen.mp3",
		label: "ibero 90.9",
		// caster.fm icecast standard status endpoint; CORS open. source.title is
		// often absent (DJ feed without inline metadata); parseMeta returns null
		// gracefully and the player just shows the station label
		metaUrl: "https://shaincast.caster.fm:20866/status-json.xsl",
		// universidad iberoamericana institutional brand — agent guess: navy + red,
		// gold accent for warmth. FOLLOWUP: refine once official ibero brand book
		// confirmed (homepage css fetch did not surface inline color values)
		colors: {
			primary: "#1a3a72", // ibero navy blue — institutional
			secondary: "#c8102e", // ibero red accent
			accent: "#f4d35e", // warm gold — palette warmth
			// navy too dark on navy bg — brighten for dark-mode AA contrast
			primaryDark: "#3d5fa3",
			// navy borderline on cream — deepen for light-mode AA contrast
			primaryLight: "#0a2752",
		},
		parseMeta(data) {
			// icecast status-json.xsl: source can be a single object or array
			// when the server hosts multiple mounts. mirror krux parser
			const d = data as {
				icestats?: { source?: { title?: string } | Array<{ title?: string }> };
			};
			const src = d?.icestats?.source;
			const s = Array.isArray(src) ? src[0] : src;
			return s?.title ?? null;
		},
	},
	{
		key: "concepto_radial",
		// FOLLOWUP: AAC+ stream — verify <audio> handles aacp natively (it does in
		// Chrome/Safari/FF; may need fallback for older browsers)
		url: "https://sp2.servidorrprivado.com:8196/stream",
		label: "concepto radial",
		// metaUrl omitted — no public json now-playing endpoint
		// tec de monterrey institutional brand — deep blue + lime green accent
		// (CEDETEC building, mexico city campus; student-programmed)
		colors: {
			primary: "#003876", // tec blue — institutional
			secondary: "#94C11F", // tec lime — energy accent
			accent: "#000000", // tec dark anchor
			// tec blue on cream ~10:1 — passes AAA, no light override
			// tec blue on navy ~1.4:1 — fails badly, brighten heavily for dark
			primaryDark: "#5b8edb", // brightened sky blue, ~5.5:1 vs navy
		},
	},
	{
		key: "radio_udg_lagos",
		// Zeno.fm CDN — base URL auto-redirects with JWT token per connection
		url: "https://stream.zeno.fm/8hage4z92hhvv",
		label: "radio udg lagos 104.7", // "lagos" disambiguates from main Guadalajara station
		// Zeno.fm exposes track metadata as Server-Sent Events (text/event-stream),
		// not JSON polling. CORS open. Each event payload: {mount, streamTitle}.
		// streamTitle may be " - " (placeholder) when a live show without inline
		// metadata is on air — parseMeta returns null in that case so the player
		// falls back to the station label
		metaUrl: "https://api.zeno.fm/mounts/metadata/subscribe/8hage4z92hhvv",
		metaFormat: "sse",
		// UDG institutional palette: Pantone 7406 (gold) + black anchor
		// Differentiation from KEXP (also yellow): UDG gold is more saturated/orange-leaning,
		// and the secondary swap to deep terra-cotta keeps it apart visually
		colors: {
			primary: "#FFCC00", // UDG gold (institutional)
			secondary: "#8B4513", // saddle brown — Lagos de Moreno regional flavor (colonial earth)
			accent: "#1a1a1a", // UDG near-black anchor (avoiding pure #000 per palette rule)
			// Gold on cream #ede5d4: ~1.4:1 — fails text contrast badly. Need light override.
			primaryLight: "#8b6f00", // deepened amber gold for cream, ~5.0:1
			// Gold on navy #0a0a2e: ~14:1 — passes AAA easily, no dark override needed.
		},
		parseMeta(data) {
			// Zeno.fm SSE event payload: {mount, streamTitle}.
			// streamTitle commonly arrives as " - " when no inline track metadata is
			// available (live DJ feed); trim and treat empty / dash-only as null
			const r = data as { mount?: string; streamTitle?: string };
			const t = r.streamTitle?.trim();
			if (!t || t === "-") return null;
			return t;
		},
	},
	// TODO: Mexican student radio (Ciudad Juárez) — pending research verification
	// {
	// 	key: "radio_upnech",
	// 	url: "...",
	// 	label: "radio upnech",
	// 	metaUrl: "...",
	// 	colors: {
	// 		primary: "#cc4422",   // orange-red placeholder
	// 		secondary: "#faf7f0", // warm cream
	// 		accent: "#231F20",
	// 	},
	// 	parseMeta() { return null; },
	// },
	// {
	// 	key: "lobos_radio",
	// 	url: "...",
	// 	label: "lobos radio",
	// 	metaUrl: "...",
	// 	colors: {
	// 		primary: "#cc4422",
	// 		secondary: "#faf7f0",
	// 		accent: "#231F20",
	// 	},
	// 	parseMeta() { return null; },
	// },
];

/**
 * Convert a hex color (#rrggbb) to a comma-separated rgb tuple ("r, g, b")
 * suitable for use inside CSS rgba(...) expressions.
 *
 * Used by the feed page to expose --station-primary-rgb / --station-secondary-rgb
 * custom properties so styles.css can build rgba() glows from the active
 * station's brand palette without duplicating each color in two formats.
 */
export function hexToRgbTuple(hex: string): string {
	const h = hex.replace("#", "");
	const r = Number.parseInt(h.slice(0, 2), 16);
	const g = Number.parseInt(h.slice(2, 4), 16);
	const b = Number.parseInt(h.slice(4, 6), 16);
	return `${r}, ${g}, ${b}`;
}

/**
 * Format a (lat, lon) decimal pair into a human-readable cardinal string.
 * Example: formatGeo(35.687, -105.938) -> "35.69°N, 105.94°W"
 *
 * Two decimal places gives ~1.1 km of precision at the equator — enough to
 * point at a campus or studio without surfacing exact rooftop coordinates.
 * Sign convention: positive lat = north, positive lon = east. Magnitudes
 * are rendered absolute alongside an N/S or E/W cardinal letter.
 */
export function formatGeo(lat: number, lon: number): string {
	const latCard = lat >= 0 ? "N" : "S";
	const lonCard = lon >= 0 ? "E" : "W";
	return `${Math.abs(lat).toFixed(2)}°${latCard}, ${Math.abs(lon).toFixed(2)}°${lonCard}`;
}
