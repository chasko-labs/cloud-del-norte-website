#!/usr/bin/env node

// scripts/fetch-feeds.mjs
// Fetches RSS feeds and writes public/data/feeds.json before the Vite build.
// Also fetches latest podcast episode metadata → public/data/podcast-episodes.json
// (server-side: no CORS restrictions, so CORS-blocked feeds work here).
// Uses built-in fetch (Node 22+). Parses XML with fast-xml-parser.
// On any fetch error: writes empty arrays/nulls + console.warn — does not fail the build.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public/data");
const OUT_PATH = join(OUT_DIR, "feeds.json");
const PODCAST_OUT_PATH = join(OUT_DIR, "podcast-episodes.json");

const FEEDS = [
	{ key: "andmore", url: "https://www.andmore.dev/index.xml", limit: 5 },
	{
		key: "awsml",
		url: "https://aws.amazon.com/blogs/machine-learning/feed/",
		limit: 5,
	},
	{
		key: "readysetcloud",
		url: "https://www.readysetcloud.io/index.xml",
		limit: 10,
	},
];

// Podcast entries whose browser fetch is CORS-blocked but accessible server-side.
// All five are fetched; CORS-open feeds (rustacean_station, syntax_fm, talk_python)
// benefit from having a pre-built fallback for cold-start latency.
const PODCAST_FEEDS = [
	{
		key: "rustacean_station",
		url: "https://rustacean-station.org/podcast.rss",
	},
	{ key: "syntax_fm", url: "https://feeds.megaphone.fm/FSI1483080183" },
	{ key: "talk_python", url: "https://talkpython.fm/episodes/rss" },
	{
		key: "aws_podcast",
		url: "https://d3gih7jbfe3jlq.cloudfront.net/aws-podcast.rss",
	},
	{
		key: "aws_developers_podcast",
		url: "https://aws-podcast.s3.amazonaws.com/awsdevelopers/AWS_Developers_Podcast.xml",
	},
	{ key: "talking_serverless", url: "https://anchor.fm/s/e2c52c8/podcast/rss" },
	{
		key: "rust_in_production",
		url: "https://letscast.fm/podcasts/rust-in-production-82281512/feed",
	},
	{ key: "onda_aws", url: "https://rss.art19.com/podcast-aws-latam" },
	{
		key: "writing_on_the_wall",
		url: "https://feeds.captivate.fm/writing-on-the-wall/",
	},
	{
		key: "el_sonido_kexp",
		// wave 26b: replaced wave-24a placeholder with canonical Omny Studio
		// playlist URL discovered via Apple iTunes lookup (id=1677011949).
		url: "https://www.omnycontent.com/d/playlist/bad5d079-8dcb-4630-8770-aa090049131d/8b13edbf-a871-4333-9331-afbf01766a62/9ed4d2cd-fdc6-4cff-88a0-afbf01777950/podcast.rss",
	},
	{
		key: "fight_for_our_existence",
		url: "https://media.rss.com/fight4ourexistence/feed.xml",
	},
];

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
});

/** Strip HTML tags and trim whitespace from a string. */
function stripHtml(str) {
	if (!str) return "";
	return String(str)
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 200);
}

/** Normalize a date string to ISO yyyy-mm-dd, or return the raw string on failure. */
function normalizeDate(raw) {
	if (!raw) return "";
	try {
		return new Date(raw).toISOString().split("T")[0];
	} catch {
		return String(raw);
	}
}

/** Extract a scalar text value from a parsed XML node (handles #text wrapper). */
function getText(val) {
	if (!val) return "";
	if (typeof val === "object") return String(val["#text"] ?? "");
	return String(val);
}

/** Decode common XML/HTML character entities in a string. */
function decodeEntities(str) {
	return String(str)
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, h) =>
			String.fromCharCode(parseInt(h, 16)),
		);
}

/** Fetch and parse one RSS feed. Returns an array of post objects (up to limit). */
async function fetchFeed(url, limit) {
	const res = await fetch(url, {
		headers: { "User-Agent": "AWSUGCloudDelNorte-fetch-feeds" },
		signal: AbortSignal.timeout(15_000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
	const xml = await res.text();
	const parsed = parser.parse(xml);

	// Support both RSS 2.0 (rss.channel.item) and Atom (feed.entry)
	const channel = parsed?.rss?.channel ?? parsed?.feed ?? {};
	const rawItems = channel.item ?? channel.entry ?? [];
	const items = Array.isArray(rawItems) ? rawItems : [rawItems];

	return items.slice(0, limit).map((item) => ({
		title: String(item.title ?? "").trim(),
		link: String(item.link?.["#text"] ?? item.link ?? item.guid ?? "").trim(),
		pubDate: normalizeDate(
			item.pubDate ?? item.published ?? item.updated ?? "",
		),
		excerpt: stripHtml(item.description ?? item.summary ?? item.content ?? ""),
	}));
}

/** Parse iTunes duration string to seconds.
 *  Accepts: "HH:MM:SS", "MM:SS", "M:SS", or a bare integer (seconds). */
function parseDurationToSeconds(raw) {
	if (raw === null || raw === undefined) return 0;
	const s = String(raw).trim();
	if (!s) return 0;
	if (/^\d+$/.test(s)) return Number(s);
	const parts = s.split(":").map((p) => Number(p.trim()));
	if (parts.some((n) => Number.isNaN(n))) return 0;
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	if (parts.length === 1) return parts[0];
	return 0;
}

/** Extract the first podcast:transcript URL from an item, if present.
 *  Handles the colon-prefixed key fast-xml-parser preserves with
 *  ignoreAttributes:false, plus the rare itunes:transcript fallback.
 *  Returns null when no transcript tag is found. */
function extractTranscriptUrl(item) {
	const candidates = [
		item["podcast:transcript"],
		item.podcast_transcript,
		item["itunes:transcript"],
		item.itunes_transcript,
	];
	for (const cand of candidates) {
		if (!cand) continue;
		const list = Array.isArray(cand) ? cand : [cand];
		for (const node of list) {
			if (!node) continue;
			if (typeof node === "string" && node) return node;
			const url = node["@_url"];
			if (typeof url === "string" && url) return url;
		}
	}
	return null;
}

/** Build episode rows (up to MAX_EPISODES) from a parsed RSS items array. */
const MAX_EPISODES = 50;
function buildEpisodes(items) {
	return items.slice(0, MAX_EPISODES).map((item, idx) => {
		const title = decodeEntities(
			getText(item.title)
				.replace(/<!\[CDATA\[|\]\]>/g, "")
				.trim(),
		);
		const enclosureUrl =
			item?.enclosure?.["@_url"] ?? item?.enclosure?.url ?? "";
		const guid = String(
			item.guid?.["#text"] ?? item.guid ?? enclosureUrl ?? `idx-${idx}`,
		).trim();
		const pubDateRaw = item.pubDate ?? item.published ?? item.updated ?? null;
		let pubDate = "";
		try {
			pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString() : "";
		} catch {
			pubDate = String(pubDateRaw ?? "");
		}
		const duration = parseDurationToSeconds(
			item["itunes:duration"] ?? item.itunes_duration ?? null,
		);
		const transcriptUrl = extractTranscriptUrl(item);
		return {
			guid: guid || `idx-${idx}`,
			title: title || "(untitled)",
			pubDate,
			duration,
			enclosureUrl: String(enclosureUrl || ""),
			...(transcriptUrl ? { transcriptUrl } : {}),
		};
	});
}

/** Fetch latest episode metadata from a podcast RSS feed.
 *  Returns { title, subtitle, display, enclosureUrl, episodes } or null on failure.
 *
 *  enclosureUrl (wave 28c): the playable audio URL for the latest episode,
 *  pulled from <item><enclosure url="..."/></item>. Hydrated into
 *  public/data/podcast-episodes.json so the runtime can always start from
 *  the freshest URL — eliminating the stale-enclosure failure mode where a
 *  hardcoded streams.ts URL points to an expired Triton signed CDN link or
 *  a rotated captivate UUID. The frontend prefers this over the streams.ts
 *  url and falls back to the streams.ts url only when this is missing.
 *
 *  episodes (wave 24c): array (up to MAX_EPISODES) of EpisodeRow shapes
 *  consumed by the podcast-episode-scroller. Existing consumers that only
 *  read .display continue to work unchanged. */
async function fetchPodcastLatest(url) {
	const res = await fetch(url, {
		headers: { "User-Agent": "AWSUGCloudDelNorte-fetch-feeds" },
		signal: AbortSignal.timeout(15_000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
	const xml = await res.text();
	const parsed = parser.parse(xml);

	const channel = parsed?.rss?.channel ?? {};
	const rawItems = channel.item ?? [];
	const items = Array.isArray(rawItems) ? rawItems : [rawItems];
	const item = items[0];
	if (!item) return null;

	const title = decodeEntities(
		getText(item.title)
			.replace(/<!\[CDATA\[|\]\]>/g, "")
			.trim(),
	);
	// fast-xml-parser preserves the itunes: prefix; check both colon and underscore forms
	const rawSub = decodeEntities(
		getText(item["itunes:subtitle"] ?? item.itunes_subtitle ?? null).trim() ||
			getText(item["itunes:summary"] ?? item.itunes_summary ?? null)
				.replace(/<[^>]*>/g, " ")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 200),
	);

	const subtitle = rawSub && rawSub !== title ? rawSub.slice(0, 120) : null;
	const display = subtitle
		? `${title} — ${subtitle.slice(0, 90)}`
		: title || null;

	// Extract the first enclosure URL — fast-xml-parser exposes attributes as
	// @_url under the enclosure node. Some feeds emit a single object, others
	// an array; normalize to the first item.
	const rawEnclosure = item.enclosure;
	const encNode = Array.isArray(rawEnclosure) ? rawEnclosure[0] : rawEnclosure;
	const enclosureUrl =
		encNode && typeof encNode === "object"
			? String(encNode["@_url"] ?? "").trim() || null
			: null;

	const episodes = buildEpisodes(items);

	return {
		title: title || null,
		subtitle,
		display,
		enclosureUrl,
		episodes,
	};
}

// Ensure output directory exists
mkdirSync(OUT_DIR, { recursive: true });

// — blog feeds ——————————————————————————————————————————————————————————
const output = {};

for (const { key, url, limit } of FEEDS) {
	try {
		const posts = await fetchFeed(url, limit);
		output[key] = posts;
		console.log(`[fetch-feeds] ${key}: ${posts.length} posts`);
	} catch (err) {
		console.warn(
			`[fetch-feeds] warn: ${key} fetch failed — ${err.message}. Writing empty array.`,
		);
		output[key] = [];
	}
}

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
console.log(`[fetch-feeds] wrote ${OUT_PATH}`);

// — podcast episode metadata ——————————————————————————————————————————
const podcastOutput = {};

for (const { key, url } of PODCAST_FEEDS) {
	try {
		const episode = await fetchPodcastLatest(url);
		podcastOutput[key] = episode;
		console.log(
			`[fetch-feeds] podcast ${key}: ${episode?.display ?? "(no display)"}${
				episode?.enclosureUrl ? ` [enc ok]` : ` [enc missing]`
			} (${episode?.episodes?.length ?? 0} episodes)`,
		);
	} catch (err) {
		console.warn(
			`[fetch-feeds] warn: podcast ${key} fetch failed — ${err.message}. Writing null.`,
		);
		podcastOutput[key] = null;
	}
}

writeFileSync(PODCAST_OUT_PATH, JSON.stringify(podcastOutput, null, 2));
console.log(`[fetch-feeds] wrote ${PODCAST_OUT_PATH}`);
