#!/usr/bin/env node
// scripts/fetch-releases.mjs

import { writeFileSync, readFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SEED_PATH = join(ROOT, 'src/data/releases.seed.json');
const MANUAL_PATH = join(ROOT, 'src/data/releases.manual.json');
const OUT_PATH = join(ROOT, 'src/data/releases.generated.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const FORCE = process.argv.includes('--force');
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Freshness check
if (!FORCE && existsSync(OUT_PATH)) {
  const age = Date.now() - statSync(OUT_PATH).mtimeMs;
  if (age < MAX_AGE_MS) {
    console.log(`releases.generated.json is fresh (${Math.round(age / 60000)}m old). Skipping fetch. Use --force to override.`);
    process.exit(0);
  }
}

if (!GITHUB_TOKEN) {
  console.warn('⚠️  GITHUB_TOKEN not set — using unauthenticated GitHub API (60 req/hr limit)');
}

// Load seed + manual
const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
const manual = JSON.parse(readFileSync(MANUAL_PATH, 'utf8'));

// Helper: GitHub releases API
async function fetchGitHubReleases(owner, repo, count = 10) {
  const headers = { 'User-Agent': 'AWSUGCloudDelNorte-fetch-releases' };
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=${count}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${owner}/${repo}`);
  return res.json();
}

// Helper: normalize a GitHub release to ReleaseEntry
function ghToEntry(rel, isLTS = false) {
  return {
    version: rel.tag_name,
    date: rel.published_at?.split('T')[0] ?? rel.created_at?.split('T')[0],
    releaseNotesUrl: rel.html_url,
    isLTS,
  };
}

// Per-tech fetchers (implement as many as practical)
// Each should return a Partial<TechCalendar> or null on failure

async function fetchPython() {
  const releases = await fetchGitHubReleases('python', 'cpython', 20);
  const stable = releases.filter(r => !r.prerelease && !r.draft);
  const lts = stable.filter(r => /^v?3\.\d+\.0$/.test(r.tag_name));
  const mostRecentAny = stable[0] ? ghToEntry(stable[0]) : null;
  const mostRecentLTS = lts[0] ? ghToEntry(lts[0], true) : null;
  const priorLTS = lts[1] ? ghToEntry(lts[1], true) : null;
  const secondPriorLTS = lts[2] ? ghToEntry(lts[2], true) : null;
  return { id: 'python', mostRecentAny, mostRecentLTS, priorLTS, secondPriorLTS };
}

async function fetchRust() {
  const releases = await fetchGitHubReleases('rust-lang', 'rust', 20);
  const stable = releases.filter(r => !r.prerelease && !r.draft);
  return {
    id: 'rust',
    mostRecentAny: stable[0] ? ghToEntry(stable[0]) : null,
    mostRecentLTS: null, // Rust has no LTS model
  };
}

async function fetchTypeScript() {
  const releases = await fetchGitHubReleases('microsoft', 'TypeScript', 20);
  const stable = releases.filter(r => !r.prerelease && !r.draft);
  return { id: 'typescript', mostRecentAny: stable[0] ? ghToEntry(stable[0]) : null };
}

async function fetchReact() {
  const releases = await fetchGitHubReleases('facebook', 'react', 20);
  const stable = releases.filter(r => !r.prerelease && !r.draft);
  return { id: 'react', mostRecentAny: stable[0] ? ghToEntry(stable[0]) : null };
}

async function fetchDotnet() {
  const releases = await fetchGitHubReleases('dotnet', 'core', 20);
  const stable = releases.filter(r => !r.prerelease && !r.draft);
  const lts = stable.filter(r => r.name?.toLowerCase().includes('lts'));
  return {
    id: 'dotnet',
    mostRecentAny: stable[0] ? ghToEntry(stable[0]) : null,
    mostRecentLTS: lts[0] ? ghToEntry(lts[0], true) : null,
  };
}

async function fetchOpenWebUI() {
  const releases = await fetchGitHubReleases('open-webui', 'open-webui', 10);
  const stable = releases.filter(r => !r.prerelease && !r.draft);
  return { id: 'open-webui', mostRecentAny: stable[0] ? ghToEntry(stable[0]) : null };
}

async function fetchGIMP() {
  const releases = await fetchGitHubReleases('GNOME', 'gimp', 10);
  const stable = releases.filter(r => !r.prerelease && !r.draft);
  return { id: 'gimp', mostRecentAny: stable[0] ? ghToEntry(stable[0]) : null };
}

async function fetchPHP() {
  const releases = await fetchGitHubReleases('php', 'php-src', 20);
  const stable = releases.filter(r => !r.prerelease && !r.draft);
  return { id: 'php', mostRecentAny: stable[0] ? ghToEntry(stable[0]) : null };
}

async function fetchAWSMCP() {
  const releases = await fetchGitHubReleases('aws', 'mcp', 10);
  const stable = releases.filter(r => !r.prerelease && !r.draft);
  return { id: 'aws-mcp', mostRecentAny: stable[0] ? ghToEntry(stable[0]) : null };
}

// AWS What's New RSS — fetch once, filter per tech in memory
async function fetchAWSWhatsNew() {
  const res = await fetch('https://aws.amazon.com/about-aws/whats-new/recent/feed/');
  if (!res.ok) throw new Error(`AWS RSS ${res.status}`);
  const xml = await res.text();

  function extractItems(filterFn) {
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
    return items
      .filter(filterFn)
      .slice(0, 1)
      .map(item => {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? '';
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
        const date = pubDate ? new Date(pubDate).toISOString().split('T')[0] : '';
        return { version: title, date, releaseNotesUrl: link, isLTS: false };
      });
  }

  const lambdaEntry = extractItems(i => /lambda/i.test(i))[0] ?? null;
  const s3Entry = extractItems(i => /amazon s3/i.test(i))[0] ?? null;
  const bedrockEntry = extractItems(i => /bedrock|sagemaker/i.test(i))[0] ?? null;
  const iotEntry = extractItems(i => /iot/i.test(i))[0] ?? null;
  const aiEntry = extractItems(i => /machine learning|ai|artificial intelligence/i.test(i))[0] ?? null;

  console.log(`[fetch-releases] AWS RSS matches — lambda:${lambdaEntry ? 1 : 0} s3:${s3Entry ? 1 : 0} bedrock:${bedrockEntry ? 1 : 0} iot:${iotEntry ? 1 : 0} ai:${aiEntry ? 1 : 0}`);

  return [
    lambdaEntry && { id: 'aws-lambda', mostRecentAny: lambdaEntry },
    s3Entry && { id: 'aws-s3', mostRecentAny: s3Entry },
    bedrockEntry && { id: 'amazon-bedrock', mostRecentAny: bedrockEntry },
    iotEntry && { id: 'aws-iot', mostRecentAny: iotEntry },
    aiEntry && { id: 'aws-ai', mostRecentAny: aiEntry },
  ].filter(Boolean);
}

// Run all fetchers with graceful degradation
const fetchers = [
  fetchPython, fetchRust, fetchTypeScript, fetchReact,
  fetchDotnet, fetchOpenWebUI, fetchGIMP, fetchPHP, fetchAWSMCP,
];

const results = new Map(seed.map(t => [t.id, { ...t }]));

// Run individual fetchers
for (const fetcher of fetchers) {
  try {
    const partial = await fetcher();
    if (partial && results.has(partial.id)) {
      results.set(partial.id, { ...results.get(partial.id), ...partial });
    }
  } catch (err) {
    console.warn(`⚠️  ${fetcher.name} failed: ${err.message} — using seed data`);
  }
}

// AWS What's New (batch)
try {
  const awsResults = await fetchAWSWhatsNew();
  for (const partial of awsResults) {
    if (results.has(partial.id)) {
      results.set(partial.id, { ...results.get(partial.id), ...partial });
    }
  }
} catch (err) {
  console.warn(`⚠️  fetchAWSWhatsNew failed: ${err.message} — using seed data`);
}

// Apply manual overrides (manual always wins)
for (const manualEntry of manual) {
  if (results.has(manualEntry.id)) {
    results.set(manualEntry.id, { ...results.get(manualEntry.id), ...manualEntry });
  }
}

// Check for stale manual entries (> 90 days)
const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;
for (const entry of results.values()) {
  if (entry.lastManualUpdate) {
    const age = Date.now() - new Date(entry.lastManualUpdate).getTime();
    if (age > STALE_THRESHOLD_MS) {
      console.warn(`⛔ STALE: ${entry.name} manual data is ${Math.round(age / 86400000)} days old`);
    }
  }
}

// Write output
const output = Array.from(results.values());
writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
console.log(`✅ releases.generated.json written (${output.length} techs)`);
