#!/usr/bin/env node

// scripts/fetch-youtube-shorts.mjs
// Wave 48a — scrape YouTube channel shorts page directly.
//
// YouTube's videos.xml RSS endpoint returns 404 site-wide (broken, May 2026).
// Strategy: fetch the channel's /shorts page (with /videos as fallback), parse
// the embedded ytInitialData JSON, and walk it recursively for video blocks.
//
// publishedAt is set to script-run time as an approximation — YouTube's page
// JSON does not expose per-short upload dates. Page order is newest-first by
// default, so ordering is correct even if the timestamps are approximate.
//
// Source channel: "The Fight For Our Existence Podcast"
//   handle:  @fight4ourexistencepodcast
//   channel: UCCzkF6zRCRfZ0oxxsiPzG6w
//
// Override default channel via WAVE_24E_YOUTUBE_CHANNEL_ID env var.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public/data");
const OUT_PATH = join(OUT_DIR, "youtube-shorts.json");

const SHORTS_LIMIT = 8;
const DEFAULT_CHANNEL_HANDLE = "@fight4ourexistencepodcast";
const DEFAULT_CHANNEL_ID = "UCCzkF6zRCRfZ0oxxsiPzG6w";

const CHANNEL_ID =
	process.env.WAVE_24E_YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL_ID;

const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Recursively walk an object, collecting nodes that look like short entries. */
function collectShortNodes(obj, results = []) {
	if (!obj || typeof obj !== "object") return results;
	if (Array.isArray(obj)) {
		for (const item of obj) collectShortNodes(item, results);
		return results;
	}
	// shortsLockupViewModel shape (newer YouTube renderer)
	if (obj.videoId && (obj.headline || obj.accessibilityText)) {
		results.push({ kind: "lockup", node: obj });
		return results;
	}
	// richItemRenderer / videoRenderer shape (older renderer, also used in /videos fallback)
	if (obj.videoId && (obj.title || obj.overlayMetadata || obj.accessibility)) {
		results.push({ kind: "renderer", node: obj });
		return results;
	}
	// reelItemRenderer shape
	if (
		obj.videoId &&
		obj.thumbnail &&
		!obj.headline // avoid double-counting lockup nodes that also nest thumbnail
	) {
		results.push({ kind: "reel", node: obj });
		return results;
	}
	for (const val of Object.values(obj)) collectShortNodes(val, results);
	return results;
}

/** Extract a title string from a collected node. */
function extractTitle(kind, node) {
	if (kind === "lockup") {
		// headline is usually a string; accessibilityText is fallback
		if (typeof node.headline === "string") return node.headline;
		if (node.headline?.text) return node.headline.text;
		return node.accessibilityText ?? "";
	}
	// renderer / reel
	const t = node.title;
	if (!t) return node.accessibility?.accessibilityData?.label ?? "";
	if (typeof t === "string") return t;
	if (t.runs) return t.runs.map((r) => r.text ?? "").join("");
	if (t.simpleText) return t.simpleText;
	return "";
}

/** Extract best thumbnail URL from a collected node, fallback to ytimg. */
function extractThumbnail(kind, node, videoId) {
	const fallback = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
	let thumbs = null;
	if (kind === "lockup") {
		// thumbnail.sources[] (array)
		thumbs = node.thumbnail?.sources;
	} else {
		// thumbnail.thumbnails[]
		thumbs = node.thumbnail?.thumbnails;
	}
	if (!Array.isArray(thumbs) || thumbs.length === 0) return fallback;
	// Pick largest by width, or just last
	const best = thumbs.reduce((a, b) =>
		(b.width ?? 0) > (a.width ?? 0) ? b : a,
	);
	return best.url ?? fallback;
}

/** Parse ytInitialData from raw HTML and return shorts array. */
export function parseShorts(html, limit = SHORTS_LIMIT) {
	// Find the start of ytInitialData JSON via brace counting (regex can't
	// reliably match nested JSON without catastrophic backtracking or greedy
	// over-capture across megabytes of HTML).
	const marker = "ytInitialData = ";
	const start = html.indexOf(marker);
	if (start === -1) return [];
	const jsonStart = html.indexOf("{", start);
	if (jsonStart === -1) return [];

	let depth = 0;
	let jsonEnd = -1;
	for (let i = jsonStart; i < html.length; i++) {
		if (html[i] === "{") depth++;
		else if (html[i] === "}") {
			depth--;
			if (depth === 0) {
				jsonEnd = i;
				break;
			}
		}
	}
	if (jsonEnd === -1) return [];

	let data;
	try {
		data = JSON.parse(html.slice(jsonStart, jsonEnd + 1));
	} catch {
		return [];
	}
	const found = collectShortNodes(data);
	const now = new Date().toISOString();
	const results = [];
	for (const { kind, node } of found) {
		if (results.length >= limit) break;
		const videoId = String(node.videoId ?? "").trim();
		if (!videoId) continue;
		const title = extractTitle(kind, node).trim();
		const thumbnailUrl = extractThumbnail(kind, node, videoId);
		results.push({ videoId, title, thumbnailUrl, publishedAt: now });
	}
	return results;
}

/** Fetch a URL with a desktop User-Agent and return text. */
async function fetchHtml(url) {
	const res = await fetch(url, {
		headers: { "User-Agent": UA },
		signal: AbortSignal.timeout(20_000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
	return res.text();
}

/** Try /shorts then /videos for the given handle/id. */
async function fetchChannelShorts(channelId, limit) {
	// Always try handle-based URL first (works for any channel with a handle)
	const handle = DEFAULT_CHANNEL_HANDLE;
	const byHandle = `https://www.youtube.com/${handle}/shorts`;
	const byId = `https://www.youtube.com/channel/${channelId}/shorts`;
	const fallbackHandle = `https://www.youtube.com/${handle}/videos`;
	const fallbackId = `https://www.youtube.com/channel/${channelId}/videos`;

	// Try handle-based shorts, then id-based shorts, then videos fallbacks
	const urls = [byHandle, byId, fallbackHandle, fallbackId];
	for (const url of urls) {
		let html;
		try {
			html = await fetchHtml(url);
		} catch (err) {
			console.warn(`[fetch-youtube-shorts] ${url} failed: ${err.message}`);
			continue;
		}
		const shorts = parseShorts(html, limit);
		if (shorts.length > 0) {
			console.log(
				`[fetch-youtube-shorts] ${url}: found ${shorts.length} entries`,
			);
			return shorts;
		}
		console.warn(`[fetch-youtube-shorts] ${url}: 0 entries parsed`);
	}
	return [];
}

mkdirSync(OUT_DIR, { recursive: true });

// Guard: only run the live fetch + write when executed as entry point, not
// when imported by vitest or other test runners. import.meta.url ends with
// the same filename as process.argv[1] when run directly via `node <file>`.
const _self = fileURLToPath(import.meta.url);
const isMain =
	typeof process !== "undefined" &&
	process.argv[1] != null &&
	(process.argv[1] === _self ||
		process.argv[1].endsWith("/fetch-youtube-shorts.mjs"));

if (isMain) {
	let shorts = [];
	try {
		shorts = await fetchChannelShorts(CHANNEL_ID, SHORTS_LIMIT);
		if (shorts.length === 0) {
			console.warn(
				"[fetch-youtube-shorts] warn: all URLs returned 0 entries — YouTube HTML structure may have changed. Writing empty list.",
			);
		}
	} catch (err) {
		console.warn(
			`[fetch-youtube-shorts] warn: unexpected error — ${err.message}. Writing empty list.`,
		);
		shorts = [];
	}

	writeFileSync(OUT_PATH, JSON.stringify(shorts, null, 2));
	console.log(
		`[fetch-youtube-shorts] wrote ${OUT_PATH} (${shorts.length} items)`,
	);
}
