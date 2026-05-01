// probe card geometry stability in headless chromium.
// samples a target selector's bounding rect at a fixed cadence over a window
// and reports min / max / variance of top + height. zero variance = no jump.
//
// usage:
//   node scripts/probe-card-geometry.mjs [url] [selector] [duration-ms] [interval-ms]
//
// args:
//   url          default https://dev.clouddelnorte.org/feed/index.html
//   selector     default [data-cdn-card-id="feed-live-hero"]
//   duration-ms  default 30000 (30s window)
//   interval-ms  default 1000  (1Hz sampling)
//
// playwright resolves from the global nvm install — same pattern as
// scripts/probe-liora-headless.mjs.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let playwrightPath;
try {
	playwrightPath = require.resolve("playwright");
} catch {
	const ver = process.versions.node;
	playwrightPath = `${process.env.HOME}/.nvm/versions/node/v${ver}/lib/node_modules/playwright/index.mjs`;
}
const { chromium } = await import(playwrightPath);

const targetUrl = process.argv[2] ?? "https://dev.clouddelnorte.org/feed/index.html";
// comma-separated selectors; each is sampled independently every tick
const selectorArg = process.argv[3] ?? '[data-cdn-card-id="feed-live-hero"],.feed-next-meetup';
const selectors = selectorArg.split(",").map((s) => s.trim()).filter(Boolean);
const durationMs = Number(process.argv[4] ?? 30000);
const intervalMs = Number(process.argv[5] ?? 1000);

console.log(`[probe-card-geometry] url=${targetUrl}`);
console.log(`[probe-card-geometry] selectors=${selectors.join(" | ")}`);
console.log(`[probe-card-geometry] duration=${durationMs}ms interval=${intervalMs}ms`);

const browser = await chromium.launch({
	headless: true,
	args: ["--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const ts = () => new Date().toISOString().slice(11, 23);

await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
console.log(`[${ts()}] dom loaded`);

// give the page a beat to mount + initial render
await page.waitForTimeout(2000);

/** map<selector, sample[]> */
const samplesBySel = new Map(selectors.map((s) => [s, []]));
const start = Date.now();

while (Date.now() - start < durationMs) {
	const rects = await page.evaluate((sels) => {
		return sels.map((sel) => {
			const el = document.querySelector(sel);
			if (!el) return null;
			const r = el.getBoundingClientRect();
			return { top: r.top, height: r.height, width: r.width };
		});
	}, selectors);

	for (let i = 0; i < selectors.length; i++) {
		const r = rects[i];
		if (r) samplesBySel.get(selectors[i]).push({ t: Date.now() - start, ...r });
	}

	await page.waitForTimeout(intervalMs);
}

await browser.close();

let allStable = true;
let anyMatched = false;

for (const sel of selectors) {
	const samples = samplesBySel.get(sel);
	if (samples.length === 0) {
		console.log(`[${ts()}] selector "${sel}" — NO MATCH (0 samples)`);
		continue;
	}
	anyMatched = true;
	const tops = samples.map((s) => s.top);
	const heights = samples.map((s) => s.height);
	const topVar = Math.max(...tops) - Math.min(...tops);
	const heightVar = Math.max(...heights) - Math.min(...heights);
	const stable = topVar < 2 && heightVar < 2;
	if (!stable) allStable = false;
	console.log(
		`[${ts()}] "${sel}" samples=${samples.length} top-var=${topVar.toFixed(1)}px height-var=${heightVar.toFixed(1)}px → ${stable ? "STABLE" : "UNSTABLE"}`,
	);
}

if (!anyMatched) {
	console.log(`[${ts()}] FAIL — no selector matched, page state likely wrong`);
	process.exit(2);
}
console.log(`[${ts()}] result: ${allStable ? "STABLE" : "UNSTABLE"}`);
process.exit(allStable ? 0 : 1);
