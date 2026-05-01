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
	readonly metaUrl: string;
	readonly colors: StationColors;
	parseMeta(data: unknown): string | null;
}

export const STREAMS: StreamDef[] = [
	{
		key: "krux",
		url: "https://kruxstream.nmsu.edu/KRUX",
		label: "krux 91.5",
		metaUrl: "https://kruxstream.nmsu.edu/status-json.xsl",
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
			const d = data as {
				results?: Array<{ artist_name?: string; song?: string }>;
			};
			const play = d?.results?.[0];
			if (!play) return null;
			const { artist_name: artist, song } = play;
			if (artist && song) return `${song} — ${artist}`;
			return song ?? artist ?? null;
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
