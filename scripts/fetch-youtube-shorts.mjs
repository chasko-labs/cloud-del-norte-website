#!/usr/bin/env node

// scripts/fetch-youtube-shorts.mjs
// Wave 24e — fetch YouTube Shorts from a Mescalero-related channel.
// Writes public/data/youtube-shorts.json before the Vite build.
//
// Strategy:
//   1. If WAVE_24E_YOUTUBE_CHANNEL_ID env var is set, fetch the channel's RSS
//      upload feed (https://www.youtube.com/feeds/videos.xml?channel_id=...)
//      — no API key required, returns ~15 most recent uploads.
//   2. Filter / cap to the first N items (N = SHORTS_LIMIT).
//   3. Without the YouTube Data API, we cannot reliably filter by duration
//      (< 60s). The shape of the JSON is identical regardless — operator
//      curates the source channel so all uploads are shorts, OR a future
//      enhancement layers API-based duration filtering.
//
// On any error, writes an empty array and console.warn — does not fail the
// build (matches the contract of fetch-feeds.mjs).
//
// TODO(operator): set WAVE_24E_YOUTUBE_CHANNEL_ID to a verified Mescalero-
// related channel. Candidates investigated 2026-05-18:
//   - "Mescalero Apache Tribe" — no canonical YouTube channel located.
//   - "Inn of the Mountain Gods" — no canonical YouTube channel located.
//   - "Writing on the Wall" podcast (Blue Shendo / Cris Frizzell) — audio-only
//     per Captivate.fm; no YouTube channel discovered.
//   - "Peter Santenello" — has Mescalero Apache video (YOUTUBE_ID:
//     watch?v=p3JmCEFW7vc per petersantenello.com), but channel is
//     general-travel, not Mescalero-specific.
// Until WAVE_24E_YOUTUBE_CHANNEL_ID is set, this script writes a small
// placeholder list (see PLACEHOLDER_SHORTS) so the carousel renders with
// representative content. The empty-state path is exercised when
// PLACEHOLDER_SHORTS is `[]`.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public/data");
const OUT_PATH = join(OUT_DIR, "youtube-shorts.json");

const SHORTS_LIMIT = 8;
const CHANNEL_ID = process.env.WAVE_24E_YOUTUBE_CHANNEL_ID || "";

// Placeholder shorts. Each entry: { videoId, title, thumbnailUrl, publishedAt }.
// These are real, public, Mescalero-themed YouTube videos curated as a
// stand-in until WAVE_24E_YOUTUBE_CHANNEL_ID is configured. They are NOT
// actual YouTube Shorts (no <60s constraint enforced here) — when an
// operator-confirmed channel is wired in, this list is replaced wholesale.
// TODO(operator): swap or empty this list once the source channel is set.
const PLACEHOLDER_SHORTS = [
	{
		videoId: "p3JmCEFW7vc",
		title: "Mescalero Apache Tribe — Native Cowboys (Peter Santenello)",
		thumbnailUrl: "https://i.ytimg.com/vi/p3JmCEFW7vc/hqdefault.jpg",
		publishedAt: "2022-07-19",
	},
];

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
});

/** Extract a scalar text value from a parsed XML node. */
function getText(val) {
	if (!val) return "";
	if (typeof val === "object") return String(val["#text"] ?? "");
	return String(val);
}

/** Normalize a date string to ISO yyyy-mm-dd, or empty on failure. */
function normalizeDate(raw) {
	if (!raw) return "";
	try {
		return new Date(raw).toISOString().split("T")[0];
	} catch {
		return "";
	}
}

/** Fetch a YouTube channel's RSS upload feed.
 *  Returns an array of { videoId, title, thumbnailUrl, publishedAt }. */
async function fetchChannelShorts(channelId, limit) {
	const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
	const res = await fetch(url, {
		headers: { "User-Agent": "AWSUGCloudDelNorte-fetch-youtube-shorts" },
		signal: AbortSignal.timeout(15_000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
	const xml = await res.text();
	const parsed = parser.parse(xml);
	const feed = parsed?.feed ?? {};
	const rawEntries = feed.entry ?? [];
	const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];

	return entries.slice(0, limit).map((entry) => {
		const videoId = String(
			entry["yt:videoId"] ?? entry.yt_videoId ?? "",
		).trim();
		const title = getText(entry.title).trim();
		const publishedAt = normalizeDate(entry.published ?? entry.updated ?? "");
		return {
			videoId,
			title,
			thumbnailUrl: videoId
				? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
				: "",
			publishedAt,
		};
	});
}

mkdirSync(OUT_DIR, { recursive: true });

let shorts = [];
if (CHANNEL_ID) {
	try {
		shorts = await fetchChannelShorts(CHANNEL_ID, SHORTS_LIMIT);
		console.log(
			`[fetch-youtube-shorts] channel ${CHANNEL_ID}: ${shorts.length} shorts`,
		);
	} catch (err) {
		console.warn(
			`[fetch-youtube-shorts] warn: channel ${CHANNEL_ID} fetch failed — ${err.message}. Writing placeholder list.`,
		);
		shorts = PLACEHOLDER_SHORTS.slice(0, SHORTS_LIMIT);
	}
} else {
	console.log(
		"[fetch-youtube-shorts] WAVE_24E_YOUTUBE_CHANNEL_ID not set — using placeholder list. See TODO(operator) at top of script.",
	);
	shorts = PLACEHOLDER_SHORTS.slice(0, SHORTS_LIMIT);
}

writeFileSync(OUT_PATH, JSON.stringify(shorts, null, 2));
console.log(
	`[fetch-youtube-shorts] wrote ${OUT_PATH} (${shorts.length} items)`,
);
