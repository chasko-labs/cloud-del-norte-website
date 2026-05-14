#!/usr/bin/env node
// Fetches next AWS UG Cloud Del Norte event from meetup.com iCal → public/data/next-meetup.json
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public/data/next-meetup.json");
const ICAL_URL = "https://www.meetup.com/awsugclouddelnorte/events/ical/";

function parseIcal(text) {
	const events = [];
	for (const block of text.split("BEGIN:VEVENT").slice(1)) {
		const body = block.slice(0, block.indexOf("END:VEVENT"));
		const get = (name) => {
			const m = body.match(
				new RegExp(`^${name}[^:]*:(.+?)(?=\\r?\\n[^ \\t]|$)`, "ms"),
			);
			return m ? m[1].replace(/\r?\n[ \t]/g, "").trim() : "";
		};
		const raw = get("DTSTART");
		if (!raw) continue;
		const iso = raw.replace(
			/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z?))?$/,
			(_, y, mo, d, _t, h = "00", mi = "00", s = "00", z = "") =>
				`${y}-${mo}-${d}T${h}:${mi}:${s}${z || "+00:00"}`,
		);
		events.push({
			summary: get("SUMMARY"),
			dtstart: iso,
			location: get("LOCATION") || undefined,
			url: get("URL") || undefined,
			description: (get("DESCRIPTION") || "").slice(0, 200) || undefined,
		});
	}
	const now = new Date();
	const future = events
		.filter((e) => new Date(e.dtstart) >= now)
		.sort((a, b) => a.dtstart.localeCompare(b.dtstart));
	if (future.length) return { ...future[0], isPast: false };
	const past = events.sort((a, b) => b.dtstart.localeCompare(a.dtstart));
	return past.length ? { ...past[0], isPast: true } : null;
}

try {
	const res = await fetch(ICAL_URL, {
		headers: { "User-Agent": "cdn-website-ci/1.0" },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const event = parseIcal(await res.text());
	if (!event) {
		console.warn("no events found");
		process.exit(0);
	}
	mkdirSync(dirname(OUT), { recursive: true });
	writeFileSync(
		OUT,
		JSON.stringify({ ...event, fetchedAt: new Date().toISOString() }, null, 2),
	);
	console.log(`✓ ${OUT}`);
} catch (err) {
	console.warn(`fetch-meetup: ${err.message} (non-fatal, build continues)`);
}
