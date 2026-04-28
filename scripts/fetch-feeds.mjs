#!/usr/bin/env node
// scripts/fetch-feeds.mjs
// Fetches RSS feeds and writes public/data/feeds.json before the Vite build.
// Uses built-in fetch (Node 22+). Parses XML with fast-xml-parser.
// On any fetch error: writes empty arrays + console.warn — does not fail the build.

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { XMLParser } from 'fast-xml-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public/data');
const OUT_PATH = join(OUT_DIR, 'feeds.json');

const FEEDS = [
  { key: 'andmore', url: 'https://www.andmore.dev/index.xml', limit: 5 },
  { key: 'awsml', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', limit: 5 },
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

// Ensure output directory exists
mkdirSync(OUT_DIR, { recursive: true });

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
