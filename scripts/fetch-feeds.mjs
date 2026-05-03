#!/usr/bin/env node
// scripts/fetch-feeds.mjs
// Fetches RSS feeds and writes public/data/feeds.json before the Vite build.
// Also fetches latest podcast episode metadata → public/data/podcast-episodes.json
// (server-side: no CORS restrictions, so CORS-blocked feeds work here).
// Uses built-in fetch (Node 22+). Parses XML with fast-xml-parser.
// On any fetch error: writes empty arrays/nulls + console.warn — does not fail the build.

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { XMLParser } from 'fast-xml-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public/data');
const OUT_PATH = join(OUT_DIR, 'feeds.json');
const PODCAST_OUT_PATH = join(OUT_DIR, 'podcast-episodes.json');

const FEEDS = [
  { key: 'andmore', url: 'https://www.andmore.dev/index.xml', limit: 5 },
  { key: 'awsml', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', limit: 5 },
];

// Podcast entries whose browser fetch is CORS-blocked but accessible server-side.
// All five are fetched; CORS-open feeds (rustacean_station, syntax_fm, talk_python)
// benefit from having a pre-built fallback for cold-start latency.
const PODCAST_FEEDS = [
  { key: 'rustacean_station', url: 'https://rustacean-station.org/podcast.rss' },
  { key: 'syntax_fm', url: 'https://feeds.megaphone.fm/FSI1483080183' },
  { key: 'talk_python', url: 'https://talkpython.fm/episodes/rss' },
  { key: 'aws_podcast', url: 'https://d3gih7jbfe3jlq.cloudfront.net/aws-podcast.rss' },
  {
    key: 'aws_developers_podcast',
    url: 'https://aws-podcast.s3.amazonaws.com/awsdevelopers/AWS_Developers_Podcast.xml',
  },
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/** Strip HTML tags and trim whitespace from a string. */
function stripHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** Normalize a date string to ISO yyyy-mm-dd, or return the raw string on failure. */
function normalizeDate(raw) {
  if (!raw) return '';
  try {
    return new Date(raw).toISOString().split('T')[0];
  } catch {
    return String(raw);
  }
}

/** Extract a scalar text value from a parsed XML node (handles #text wrapper). */
function getText(val) {
  if (!val) return '';
  if (typeof val === 'object') return String(val['#text'] ?? '');
  return String(val);
}

/** Decode common XML/HTML character entities in a string. */
function decodeEntities(str) {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Fetch and parse one RSS feed. Returns an array of post objects (up to limit). */
async function fetchFeed(url, limit) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AWSUGCloudDelNorte-fetch-feeds' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const xml = await res.text();
  const parsed = parser.parse(xml);

  // Support both RSS 2.0 (rss.channel.item) and Atom (feed.entry)
  const channel = parsed?.rss?.channel ?? parsed?.feed ?? {};
  const rawItems = channel.item ?? channel.entry ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.slice(0, limit).map(item => ({
    title: String(item.title ?? '').trim(),
    link: String(item.link?.['#text'] ?? item.link ?? item.guid ?? '').trim(),
    pubDate: normalizeDate(item.pubDate ?? item.published ?? item.updated ?? ''),
    excerpt: stripHtml(item.description ?? item.summary ?? item.content ?? ''),
  }));
}

/** Fetch latest episode metadata from a podcast RSS feed.
 *  Returns { title, subtitle, display } or null on failure. */
async function fetchPodcastLatest(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AWSUGCloudDelNorte-fetch-feeds' },
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

  const title = decodeEntities(getText(item.title).replace(/<!\[CDATA\[|\]\]>/g, '').trim());
  // fast-xml-parser preserves the itunes: prefix; check both colon and underscore forms
  const rawSub = decodeEntities(
    getText(item['itunes:subtitle'] ?? item['itunes_subtitle'] ?? null).trim() ||
    getText(item['itunes:summary'] ?? item['itunes_summary'] ?? null)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200),
  );

  const subtitle = rawSub && rawSub !== title ? rawSub.slice(0, 120) : null;
  const display = subtitle ? `${title} — ${subtitle.slice(0, 90)}` : title || null;

  return { title: title || null, subtitle, display };
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
    console.warn(`[fetch-feeds] warn: ${key} fetch failed — ${err.message}. Writing empty array.`);
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
    console.log(`[fetch-feeds] podcast ${key}: ${episode?.display ?? '(no display)'}`);
  } catch (err) {
    console.warn(`[fetch-feeds] warn: podcast ${key} fetch failed — ${err.message}. Writing null.`);
    podcastOutput[key] = null;
  }
}

writeFileSync(PODCAST_OUT_PATH, JSON.stringify(podcastOutput, null, 2));
console.log(`[fetch-feeds] wrote ${PODCAST_OUT_PATH}`);
