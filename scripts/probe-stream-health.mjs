#!/usr/bin/env node
// Probes every non-hidden stream URL in src/lib/streams.ts via HTTP HEAD.
// Exits non-zero with structured report if any non-hidden station returns non-200.
// Used by .github/workflows/stream-health.yml weekly cron to detect URL rot
// before users do.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const streamsTs = readFileSync(
	join(__dirname, "..", "src", "lib", "streams.ts"),
	"utf8",
);

// Extract { key, url, hidden } from each StreamDef literal. Lightweight regex parse —
// avoids importing TS into bare node. Robust enough for the stable streams.ts shape.
const entries = [];
// Simpler: split on `key: "` + grab key + url + hidden flag
for (const block of streamsTs.split(/\{\s*key:\s*"/).slice(1)) {
	const keyMatch = block.match(/^([^"]+)"/);
	const urlMatch = block.match(/url:\s*"([^"]+)"/);
	const hidden = /hidden:\s*true/.test(
		block.split("\n").slice(0, 30).join("\n"),
	);
	if (keyMatch && urlMatch) {
		entries.push({ key: keyMatch[1], url: urlMatch[1], hidden });
	}
}

const active = entries.filter((e) => !e.hidden);
console.log(
	`probing ${active.length} active streams (${entries.length - active.length} hidden) ...`,
);

const results = await Promise.all(
	active.map(async (e) => {
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort(), 8000);
		try {
			const res = await fetch(e.url, {
				method: "HEAD",
				signal: ctrl.signal,
				redirect: "follow",
			});
			return {
				...e,
				status: res.status,
				ok: res.status >= 200 && res.status < 400,
			};
		} catch (err) {
			return { ...e, status: 0, ok: false, error: err.message };
		} finally {
			clearTimeout(t);
		}
	}),
);

const failures = results.filter((r) => !r.ok);
for (const r of results) {
	console.log(
		`  ${r.ok ? "OK" : "FAIL"}  ${String(r.status).padEnd(4)}  ${r.key.padEnd(30)} ${r.url}${r.error ? ` — ${r.error}` : ""}`,
	);
}
console.log(
	`\n${results.length - failures.length}/${results.length} streams healthy`,
);

if (failures.length > 0) {
	console.error(`\n${failures.length} stream(s) failed:`);
	for (const f of failures)
		console.error(`  - ${f.key}: ${f.url} (status ${f.status})`);
	process.exit(1);
}
