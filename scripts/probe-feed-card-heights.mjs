// Probe feed card heights — identifies oversized iframe-containing cards
// relative to the "on YouTube" benchmark card.
//
// usage: node scripts/probe-feed-card-heights.mjs [url]
//
// Launches headless Chromium at desktop (1024×768) and mobile (375×812),
// measures all .feed-carousel__frame and .feed-twitch__frame elements,
// and reports which exceed the benchmark by >20%.
//
// Expected max-heights after fix:
//   desktop: 315px (560px * 9/16)
//   mobile:  210px

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

const url = process.argv[2] ?? "https://clouddelnorte.org/feed/";

async function measure(viewport) {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport });
	await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
	await page.waitForTimeout(2000);

	const cards = await page.evaluate(() => {
		const results = [];
		document.querySelectorAll(".feed-carousel__frame, .feed-twitch__frame").forEach((el) => {
			const rect = el.getBoundingClientRect();
			const card = el.closest(".cdn-card, .feed-grid__cell");
			const name = card?.querySelector("[class*='awsui_header']")?.textContent?.trim()?.slice(0, 40) || "unknown";
			results.push({
				name,
				selector: `.${[...el.classList].join(".")}`,
				computed_height: Math.round(rect.height),
				contains_iframe: el.querySelector("iframe") !== null,
			});
		});
		return results;
	});

	await browser.close();
	return cards;
}

for (const [label, vp] of [["desktop", { width: 1024, height: 768 }], ["mobile", { width: 375, height: 812 }]]) {
	console.log(`\n=== ${label} (${vp.width}×${vp.height}) ===`);
	try {
		const cards = await measure(vp);
		const benchmark = cards.find((c) => c.name.toLowerCase().includes("youtube")) ?? cards[0];
		const benchmarkHeight = benchmark?.computed_height ?? 315;
		const oversized = cards.filter((c) => c.computed_height > benchmarkHeight * 1.2);
		console.log(JSON.stringify({ cards, benchmark_height: benchmarkHeight, oversized: oversized.map((c) => c.name) }, null, 2));
	} catch (e) {
		console.log(`  (skipped — ${e.message})`);
	}
}
