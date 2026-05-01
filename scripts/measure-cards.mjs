// measure-cards.mjs — observe every card on /feed/ for geometry mutations
// over 30s with no user interaction. flags any card whose ResizeObserver
// reports more than one distinct (width × height) pair during the window
//
// install-then-wait-then-read pattern: page.evaluate() at install time only
// sets up the observer + a window queue, returns immediately. Node sleeps.
// a second page.evaluate() at the end reads the queue back. avoids the
// page.evaluate-with-async-setTimeout timeout problem
//
// usage: node /tmp/measure-cards.mjs [url] [screenshot] [seconds]

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

const url = process.argv[2] ?? "https://dev.clouddelnorte.org/feed/";
const screenshot = process.argv[3] ?? "/tmp/feed-cards-after.png";
const seconds = Number.parseInt(process.argv[4] ?? "30", 10);

const args = [
	"--use-gl=angle",
	"--use-angle=gl",
	"--ignore-gpu-blocklist",
	"--enable-gpu-rasterization",
	"--autoplay-policy=no-user-gesture-required",
];

const ts = () => new Date().toISOString().slice(11, 23);
console.log(`[${ts()}] launch chromium`);
const browser = await chromium.launch({ headless: true, args });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.log(`[${ts()}] pageerror: ${e.message}`));

console.log(`[${ts()}] goto ${url}`);
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(3000); // let initial mount + first paint settle

console.log(`[${ts()}] install ResizeObserver on every card`);
await page.evaluate(() => {
	window.__resizeEvents = [];
	const selectors = [
		".feed-grid__cell",
		".feed-grid__cell--full",
		".feed-live-hero__card",
		".feed-live-hero",
		".cdn-card",
		".cdn-card-slot",
	];
	const seen = new Map(); // element -> stable id
	let nextId = 0;
	const ro = new ResizeObserver((entries) => {
		for (const e of entries) {
			const el = e.target;
			const id = seen.get(el);
			const r = el.getBoundingClientRect();
			window.__resizeEvents.push({
				t: performance.now(),
				id,
				cls: el.className,
				w: Math.round(r.width),
				h: Math.round(r.height),
			});
		}
	});
	for (const sel of selectors) {
		for (const el of document.querySelectorAll(sel)) {
			if (seen.has(el)) continue;
			seen.set(el, `el${nextId++}`);
			ro.observe(el);
		}
	}
	window.__cardCount = seen.size;
});

const cardCount = await page.evaluate(() => window.__cardCount);
console.log(`[${ts()}] observing ${cardCount} cards for ${seconds}s`);

await page.waitForTimeout(seconds * 1000);

console.log(`[${ts()}] read events`);
const events = await page.evaluate(() => window.__resizeEvents);

// group events by element identity (stable id assigned at observe time)
// so we can tell whether a single element changed size vs N different
// elements with the same className each fired once
const byCard = new Map();
for (const ev of events) {
	const key = ev.id;
	if (!byCard.has(key)) byCard.set(key, { cls: ev.cls, sizes: new Map() });
	const entry = byCard.get(key);
	const sig = `${ev.w}x${ev.h}`;
	entry.sizes.set(sig, (entry.sizes.get(sig) ?? 0) + 1);
}

console.log(`\n[${ts()}] ===== summary =====`);
console.log(`total events: ${events.length}`);
console.log(`unique class signatures: ${byCard.size}`);

console.log("\nevent timeline (t=ms since install):");
for (const ev of events) {
	const head = ev.cls.length > 55 ? `${ev.cls.slice(0, 52)}…` : ev.cls;
	console.log(`  t=${ev.t.toFixed(0).padStart(7)} [${ev.id}] ${ev.w}x${ev.h} ${head}`);
}
console.log("");

const mutating = [];
for (const [id, entry] of byCard.entries()) {
	const sigs = [...entry.sizes.keys()];
	const total = [...entry.sizes.values()].reduce((a, b) => a + b, 0);
	const head = entry.cls.length > 70 ? `${entry.cls.slice(0, 67)}…` : entry.cls;
	console.log(`[${id}] [${sigs.length} sizes / ${total} events] ${head}`);
	for (const [sig, count] of entry.sizes.entries()) {
		console.log(`    ${sig} × ${count}`);
	}
	if (sigs.length > 1) mutating.push({ id, cls: entry.cls, sizes: sigs });
}

console.log("");
if (mutating.length === 0) {
	console.log(`[${ts()}] OK — no card mutated geometry during the ${seconds}s window`);
} else {
	console.log(`[${ts()}] MUTATING — ${mutating.length} card class(es) changed size:`);
	for (const m of mutating) {
		console.log(`  ${m.cls}: ${m.sizes.join(", ")}`);
	}
}

await page.screenshot({ path: screenshot, fullPage: true });
console.log(`[${ts()}] screenshot -> ${screenshot}`);

await browser.close();
process.exit(mutating.length > 0 ? 1 : 0);
