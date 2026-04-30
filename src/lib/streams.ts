// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export interface StreamDef {
	readonly key: string;
	readonly url: string;
	readonly label: string;
	readonly metaUrl: string;
	parseMeta(data: unknown): string | null;
}

export const STREAMS: StreamDef[] = [
	{
		key: "krux",
		url: "https://kruxstream.nmsu.edu/KRUX",
		label: "krux 91.5",
		metaUrl: "https://kruxstream.nmsu.edu/status-json.xsl",
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
];
