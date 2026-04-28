#!/usr/bin/env node
// scripts/fetch-next-meetup.mjs
// Fetches the AWS UG Cloud Del Norte iCal feed from meetup.com and writes
// public/data/next-meetup.json before the Vite build.
//
// Strategy: pick the next future event by DTSTART; if none upcoming, pick the
// most recent past event. Output null when the feed is empty or fails to fetch
// (the consuming React component renders a graceful CTA fallback in that case).
//
// Why a build-time fetch instead of a browser fetch: meetup.com does not serve
// CORS headers for direct browser fetches. This script runs in CI/local build,
// produces a static JSON file at /data/next-meetup.json that the SPA loads.

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public/data');
const OUT_PATH = join(OUT_DIR, 'next-meetup.json');

const ICAL_URL = 'https://www.meetup.com/awsugclouddelnorte/events/ical/';
const GROUP_URL = 'https://www.meetup.com/awsugclouddelnorte/';

// hardcoded past-event fallback. used only when the ical feed returns 0
// parseable events (current state, since meetup.com does not always include
// past events in the public ical export). update this when a more recent
// past meetup should display, or when an upcoming meetup is scheduled (the
// upcoming event from ical wins automatically once it appears).
const PAST_FALLBACK = {
  status: 'past',
  summary: '👩🏾‍💻 Beginner Friendly 👩🏻‍🎓 Overview from AWS 🤖 Learn AI & Cloud 📚',
  url: 'https://www.meetup.com/awsugclouddelnorte/events/312792622/',
  location: 'Online event',
  description:
    'AWS Strands Agents — beginner-friendly overview hosted by Bryan C. Hands-on with live expert guidance: compute basics, databases, serverless, AI applications, cost management. Part of the 10,000 AIdeas competition for $1000 in cloud credits using AWS Free Tier 2026.',
  // 2026-01-15 13:00 MST (UTC-7) = 2026-01-15 20:00 UTC
  dtstart: '2026-01-15T20:00:00.000Z',
  dtend: '2026-01-15T21:00:00.000Z',
};

// ── iCal parsing ──────────────────────────────────────────────────────────
// minimal RFC 5545 parser sufficient for meetup.com VEVENTs
// handles line unfolding (CRLF + leading space/tab continues previous line)
// and value unescaping per spec (\\, \,, \;, \n / \N → newline)

function unfoldLines(raw) {
  // RFC 5545: lines longer than 75 octets are split with CRLF + WSP
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (out.length > 0) out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeValue(s) {
  return String(s).replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

// parse an iCal date-time. supports:
//   20260605T180000Z   → utc
//   20260605T180000    → floating local (treated as utc to keep things simple)
//   20260605           → date-only
function parseICalDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', se = '00'] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se));
}

function parseEvents(icalText) {
  const lines = unfoldLines(icalText);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    // split key (with optional params) from value at first unquoted ':'
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const left = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    // key is the segment before the first ';' (params follow)
    const key = left.split(';')[0].toUpperCase();

    switch (key) {
      case 'SUMMARY':
        current.summary = unescapeValue(value);
        break;
      case 'DTSTART':
        current.dtstartRaw = value;
        current.dtstart = parseICalDate(value);
        break;
      case 'DTEND':
        current.dtend = parseICalDate(value);
        break;
      case 'LOCATION':
        current.location = unescapeValue(value);
        break;
      case 'URL':
        current.url = value.trim();
        break;
      case 'DESCRIPTION':
        current.description = unescapeValue(value);
        break;
      case 'UID':
        current.uid = value.trim();
        break;
    }
  }
  return events;
}

// pick next upcoming, otherwise most recent past, otherwise null
function selectMeetup(events) {
  const now = Date.now();
  const withDates = events.filter(e => e.dtstart instanceof Date && !Number.isNaN(e.dtstart.getTime()));
  if (withDates.length === 0) return null;

  const upcoming = withDates
    .filter(e => e.dtstart.getTime() >= now)
    .sort((a, b) => a.dtstart.getTime() - b.dtstart.getTime());
  if (upcoming.length > 0) return { ...upcoming[0], status: 'upcoming' };

  const past = withDates
    .filter(e => e.dtstart.getTime() < now)
    .sort((a, b) => b.dtstart.getTime() - a.dtstart.getTime());
  if (past.length > 0) return { ...past[0], status: 'past' };

  return null;
}

function shapeForOutput(meetup) {
  if (!meetup) return null;
  // 200-char excerpt for description, strip control chars
  const description = meetup.description ? String(meetup.description).replace(/\s+/g, ' ').trim().slice(0, 240) : '';
  return {
    status: meetup.status,
    summary: meetup.summary ?? '',
    url: meetup.url ?? GROUP_URL,
    location: meetup.location ?? '',
    description,
    dtstart: meetup.dtstart ? meetup.dtstart.toISOString() : null,
    dtend: meetup.dtend ? meetup.dtend.toISOString() : null,
  };
}

// ── main ──────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

let payload = null;
try {
  const res = await fetch(ICAL_URL, {
    headers: {
      'User-Agent': 'AWSUGCloudDelNorte-fetch-next-meetup',
      Accept: 'text/calendar, text/plain, */*',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${ICAL_URL}`);
  const text = await res.text();
  const events = parseEvents(text);
  console.log(`[fetch-next-meetup] parsed ${events.length} events from ical feed`);
  const selected = selectMeetup(events);
  payload = shapeForOutput(selected);
  if (payload) {
    console.log(`[fetch-next-meetup] selected ${payload.status} event: ${payload.title} (${payload.dtstart})`);
  } else {
    console.log('[fetch-next-meetup] feed had no parseable events; using PAST_FALLBACK');
    payload = PAST_FALLBACK;
  }
} catch (err) {
  console.warn(`[fetch-next-meetup] warn: fetch/parse failed — ${err.message}. Using PAST_FALLBACK.`);
  payload = PAST_FALLBACK;
}

writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
console.log(`[fetch-next-meetup] wrote ${OUT_PATH}`);
