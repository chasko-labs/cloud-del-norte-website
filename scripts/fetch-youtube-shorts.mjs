#!/usr/bin/env node

// scripts/fetch-youtube-shorts.mjs
// Wave 24e / 28b — fetch YouTube uploads from a confirmed Mescalero-related
// channel and write public/data/youtube-shorts.json before the Vite build.
//
// Source channel (wave 28b, 2026-05-19):
//   "The Fight For Our Existence Podcast" — @fight4ourexistencepodcast
//   Topics: Oak Flat, Indigenous culture, MMIP movement.
//   Canonical channel id: UCCzkF6zRCRfZ0oxxsiPzG6w
//
// Strategy:
//   1. Fetch the channel's RSS upload feed
//      (https://www.youtube.com/feeds/videos.xml?channel_id=...)
//      — no API key required, returns ~15 most recent uploads in
//      newest-first order.
//   2. Cap to the first SHORTS_LIMIT items.
//   3. Without the YouTube Data API, duration filtering (< 60s for true
//      Shorts) is not possible at build time. The carousel renders
//      whatever the channel published most recently; if the channel is
//      mostly long-form, those will appear too. Future enhancement may
//      layer Data-API-based duration filtering.
//
// On any error, writes an empty array and console.warn — does not fail
// the build (matches the contract of fetch-feeds.mjs). The carousel
// component shows a localized empty state when the array is empty.
//
// The default channel id can be overridden by the WAVE_24E_YOUTUBE_CHANNEL_ID
// environment variable for future channel changes without code edits.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public/data");
const OUT_PATH = join(OUT_DIR, "youtube-shorts.json");

const SHORTS_LIMIT = 8;
const DEFAULT_CHANNEL_ID = "UCCzkF6zRCRfZ0oxxsiPzG6w";
const CHANNEL_ID =
	process.env.WAVE_24E_YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL_ID;

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
try {
	shorts = await fetchChannelShorts(CHANNEL_ID, SHORTS_LIMIT);
	console.log(
		`[fetch-youtube-shorts] channel ${CHANNEL_ID}: ${shorts.length} shorts`,
	);
} catch (err) {
	console.warn(
		`[fetch-youtube-shorts] warn: channel ${CHANNEL_ID} fetch failed — ${err.message}. Writing empty list.`,
	);
	shorts = [];
}

writeFileSync(OUT_PATH, JSON.stringify(shorts, null, 2));
console.log(
	`[fetch-youtube-shorts] wrote ${OUT_PATH} (${shorts.length} items)`,
);
