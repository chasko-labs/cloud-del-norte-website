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

/**
 * Origin of the broadcast — surfaced as "streaming from <city>, <region>, <country>"
 * inside the feed player. Mexican stations carry proper Spanish forms (México with
 * the accent, Ciudad de México rather than Mexico City) so the line reads
 * naturally regardless of UI locale. Region maps to state for US stations and
 * to estado for MX stations
 */
export interface StreamLocation {
	readonly city: string;
	readonly region: string;
	readonly country: string;
}

/**
 * Richer extraction shape — surfaces fields beyond the "song — artist" string
 * the UI currently consumes. Populated by parseMetaRich on stations whose
 * metaUrl exposes more than a flat title:
 *  - artworkUrl: cover-art / album-art image (KEXP image_uri, NPR Composer
 *    when widget_config.album_art is true and song.itunes/release art surfaces)
 *  - programName: currently-airing show (NPR Composer onNow.program.name) —
 *    fallback display when no song metadata is logged (talk shows, between
 *    tracks)
 *  - programLink: linkable program page (NPR Composer onNow.program.program_link)
 *  - listeners: live listener count (icecast source.listeners) — surfaceable
 *    as a "N listening" mini-line
 *  - djComment: free-form DJ note (KEXP plays.comment) — RIP / show context
 * Title remains the canonical "song — artist" string for back-compat with the
 * existing UI consumer; everything else is additive
 */
export interface RichMeta {
	readonly title: string | null;
	readonly artworkUrl?: string;
	readonly programName?: string;
	readonly programLink?: string;
	readonly listeners?: number;
	readonly djComment?: string;
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
	 * weekly program schedule URL — public-facing page (not API). Surfaces
	 * a "schedule" mini link inline with the station label. Most stations
	 * publish one; UAM has none, Concepto has none. Set to undefined for
	 * stations without a discoverable schedule page
	 */
	readonly scheduleUrl?: string;
	/**
	 * city / region / country of the broadcast origin. populated for every
	 * station (donate-enabled or not) so the feed player can render a
	 * "streaming from …" line. Mexican entries use proper Spanish naming —
	 * México (with accent), Ciudad de México — so the line reads naturally
	 * even when the user is on the en-US locale
	 */
	readonly location: StreamLocation;
	/** parses metaUrl response into "song — artist" string. omit alongside metaUrl */
	parseMeta?(data: unknown): string | null;
	/**
	 * extended extraction — returns artwork, program, listener fields when the
	 * upstream response carries them. Optional: stations whose metaUrl only
	 * exposes a flat title (KRUX icecast) can omit this. UI consumers should
	 * fall back to parseMeta when parseMetaRich is absent. Do NOT remove
	 * parseMeta — the persistent-player + feed page still consume that signature
	 */
	parseMetaRich?(data: unknown): RichMeta | null;
}

export const STREAMS: StreamDef[] = [
	{
		key: "krux",
		url: "https://kruxstream.nmsu.edu/KRUX",
		label: "krux 91.5",
		metaUrl: "https://kruxstream.nmsu.edu/status-json.xsl",
		donateUrl: "https://nmsufoundation.org/givenow/KRUX.html",
		// KRUX program grid — student-run, schedule on the official site
		scheduleUrl: "https://krux.nmsu.edu/schedule/",
		// NMSU Las Cruces, NM — Milton Hall studios on the main campus
		location: { city: "Las Cruces", region: "New Mexico", country: "USA" },
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
		parseMetaRich(data) {
			// icecast status-json.xsl carries source.listeners (current count) +
			// source.listener_peak. Surfaces title for back-compat alongside the
			// listener count so a single rich call can replace parseMeta + a side
			// listener fetch. listener_peak is intentionally not surfaced — only
			// the live count is interesting in the player UI
			const d = data as {
				icestats?: {
					source?:
						| { title?: string; listeners?: number }
						| Array<{ title?: string; listeners?: number }>;
				};
			};
			const src = d?.icestats?.source;
			const s = Array.isArray(src) ? src[0] : src;
			if (!s) return null;
			const out: RichMeta = { title: s.title ?? null };
			if (typeof s.listeners === "number")
				return { ...out, listeners: s.listeners };
			return out;
		},
	},
	{
		key: "kexp",
		url: "https://kexp.streamguys1.com/kexp160.aac",
		label: "kexp 90.3",
		metaUrl: "https://api.kexp.org/v2/plays/?limit=1&format=json",
		donateUrl: "https://www.kexp.org/donate/",
		// public weekly grid — KEXP schedule page
		scheduleUrl: "https://www.kexp.org/schedule/",
		// KEXP Gathering Space — Seattle Center, WA
		location: { city: "Seattle", region: "Washington", country: "USA" },
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
		parseMetaRich(data) {
			// KEXP plays row carries image_uri (cover-art-archive 500px) and an
			// optional comment field DJs use for show notes / RIP messages.
			// image_uri is empty when there is no MusicBrainz match — treat blank
			// string as absent. play_type !== "trackplay" still surfaces so the UI
			// can render the airbreak / nontrackplay state without a stale title
			const d = data as {
				results?: Array<{
					artist?: string;
					song?: string;
					play_type?: string;
					image_uri?: string;
					comment?: string;
				}>;
			};
			const play = d?.results?.[0];
			if (!play) return null;
			const isTrack = !play.play_type || play.play_type === "trackplay";
			const title = isTrack
				? play.artist && play.song
					? `${play.song} — ${play.artist}`
					: (play.song ?? play.artist ?? null)
				: null;
			const out: RichMeta = { title };
			if (play.image_uri && play.image_uri.length > 0)
				return play.comment
					? { ...out, artworkUrl: play.image_uri, djComment: play.comment }
					: { ...out, artworkUrl: play.image_uri };
			if (play.comment) return { ...out, djComment: play.comment };
			return out;
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
		// KSFR public weekly schedule page
		scheduleUrl: "https://www.ksfr.org/schedule",
		// SFCC studios — Santa Fe, NM
		location: { city: "Santa Fe", region: "New Mexico", country: "USA" },
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
		parseMetaRich(data) {
			// nprstations widget — surfaces program.name + program_link separately
			// so the UI can render "now: <Program> →" link beside the song line on
			// talk shows or between tracks. song trackName/artistName remain the
			// title source. KSFR widgets do not enable album_art (widget_config
			// confirms false), so artworkUrl stays absent here
			const d = data as {
				onNow?: {
					program?: { name?: string; program_link?: string };
					song?: { trackName?: string; artistName?: string };
				} | null;
			};
			const on = d?.onNow ?? null;
			if (!on) return null;
			const song = on.song;
			let title: string | null = null;
			if (song) {
				const { trackName: track, artistName: artist } = song;
				if (track && artist) title = `${track} — ${artist}`;
				else title = track ?? artist ?? null;
			}
			const programName = on.program?.name?.trim() || undefined;
			const programLink = on.program?.program_link?.trim() || undefined;
			if (!title && !programName) return null;
			const out: RichMeta = { title: title ?? programName ?? null };
			if (programName && title) {
				return programLink
					? { ...out, programName, programLink }
					: { ...out, programName };
			}
			if (programLink && programName) return { ...out, programLink };
			return out;
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
		// KUTX schedule lives at /schedule on kutx.org
		scheduleUrl: "https://www.kutx.org/schedule/",
		// KUT/KUTX studios — UT Austin campus, TX
		location: { city: "Austin", region: "Texas", country: "USA" },
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
		parseMetaRich(data) {
			// KUTX widget enables album_art in widget_config (confirmed live), but
			// the album-art image URL itself is NOT in /now — it lives behind the
			// `playlist` field that returns "REMOVED" on the public widget. So
			// artworkUrl stays absent. We DO surface programName + programLink so
			// the player can render "now: The Breaks with Confucius and Fresh"
			// even when song is null
			const d = data as {
				onNow?: {
					program?: { name?: string; program_link?: string };
					song?: { trackName?: string; artistName?: string };
				} | null;
			};
			const on = d?.onNow ?? null;
			if (!on) return null;
			const song = on.song;
			let title: string | null = null;
			if (song) {
				const { trackName: track, artistName: artist } = song;
				if (track && artist) title = `${track} — ${artist}`;
				else title = track ?? artist ?? null;
			}
			const programName = on.program?.name?.trim() || undefined;
			const programLink = on.program?.program_link?.trim() || undefined;
			if (!title && !programName) return null;
			const out: RichMeta = { title: title ?? programName ?? null };
			if (programName && title) {
				return programLink
					? { ...out, programName, programLink }
					: { ...out, programName };
			}
			if (programLink && programName) return { ...out, programLink };
			return out;
		},
	},
	{
		key: "uam_radio",
		// FOLLOWUP: verify CORS works in browser; alt URL: https://radios.yanapak.org/UAMRadio if primary fails
		// non-standard port 1124 — icecast mp3; <audio crossOrigin="anonymous"> may need
		// per-station opt-out if origin lacks Access-Control-Allow-Origin header
		url: "https://stream5.mexiserver.com:1124/",
		label: "uam radio 94.1",
		// metaUrl omitted — Shoutcast v2 stats endpoint exists at
		// https://stream5.mexiserver.com:1124/stats?json=1 and returns
		// {songtitle, currentlisteners, peaklisteners, bitrate, servertitle}
		// but the server emits NO Access-Control-Allow-Origin header so a
		// browser fetch blocks on CORS. FOLLOWUP: route through a small Lambda /
		// CloudFront function proxy (response headers: ACAO:*) before wiring as
		// metaUrl. The audio /stream itself does send ACAO:* so playback works
		// FOLLOWUP-2: songtitle observed as "RT1=" placeholder — confirm whether
		// UAM sends real track titles during music programs (vs. talk slots)
		// before investing in the proxy
		scheduleUrl: "https://uamradio.uam.mx/programacion/",
		// UAM Azcapotzalco unidad — Universidad Autónoma Metropolitana, CDMX
		location: {
			city: "Ciudad de México",
			region: "Ciudad de México",
			country: "México",
		},
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
		// Ibero 90.9 weekly grid — official station site
		scheduleUrl: "https://ibero909.fm/programacion/",
		// Universidad Iberoamericana — Santa Fe campus, CDMX
		location: {
			city: "Ciudad de México",
			region: "Ciudad de México",
			country: "México",
		},
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
		parseMetaRich(data) {
			// caster.fm icecast — surfaces source.listeners alongside title.
			// Currently observed ~7 listeners during off-hours; useful for
			// "N listening" affordance once the player UI consumes it
			const d = data as {
				icestats?: {
					source?:
						| { title?: string; listeners?: number }
						| Array<{ title?: string; listeners?: number }>;
				};
			};
			const src = d?.icestats?.source;
			const s = Array.isArray(src) ? src[0] : src;
			if (!s) return null;
			const out: RichMeta = { title: s.title ?? null };
			if (typeof s.listeners === "number")
				return { ...out, listeners: s.listeners };
			return out;
		},
	},
	{
		key: "concepto_radial",
		// FOLLOWUP: AAC+ stream — verify <audio> handles aacp natively (it does in
		// Chrome/Safari/FF; may need fallback for older browsers)
		url: "https://sp2.servidorrprivado.com:8196/stream",
		label: "concepto radial",
		// metaUrl omitted — Shoutcast v2 stats endpoint at
		// https://sp2.servidorrprivado.com:8196/stats?json=1 returns
		// {songtitle, currentlisteners, peaklisteners, bitrate, servertitle}
		// but emits NO Access-Control-Allow-Origin header. The CentovaCast
		// widget at /cp/widgets/player/single/?p=8196 also exposes nowplay.php
		// and art.php (cover art!) but again no CORS. FOLLOWUP: route through
		// a Lambda / CloudFront function proxy. As of probe 2026-05-02 the
		// songtitle was empty even mid-broadcast, so the upstream may not be
		// pushing inline track titles for this Shoutcast mount — verify at a
		// musical timeslot before investing in proxy work
		scheduleUrl: "https://conceptoradial.com/es/programacion",
		// Tec de Monterrey CEDETEC — Centro de Diseño y Tecnología on the
		// Ciudad de México (Tlalpan) campus, NOT the Monterrey home campus.
		// Student-programmed station, hence the CDMX location
		location: {
			city: "Ciudad de México",
			region: "Ciudad de México",
			country: "México",
		},
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
		// Centro Universitario de los Lagos (UDG sede Lagos) — Lagos de Moreno, Jalisco
		location: {
			city: "Lagos de Moreno",
			region: "Jalisco",
			country: "México",
		},
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
 * Format a StreamLocation into a comma-separated "City, Region, Country" string.
 * Example: formatLocation({ city: "Las Cruces", region: "New Mexico", country: "USA" })
 *   -> "Las Cruces, New Mexico, USA"
 * Example: formatLocation({ city: "Ciudad de México", region: "Ciudad de México", country: "México" })
 *   -> "Ciudad de México, Ciudad de México, México"
 *
 * For CDMX entries the city + region intentionally repeat — Ciudad de México is
 * both the city and the entidad federativa, mirroring how locals refer to it.
 * Spanish accents are preserved verbatim from the source object so the output
 * reads naturally regardless of the user's UI locale.
 */
export function formatLocation(loc: StreamLocation): string {
	return `${loc.city}, ${loc.region}, ${loc.country}`;
}
