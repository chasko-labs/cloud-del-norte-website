// probe-sidepanel-scrollbar — validate the side-nav scrollbar-hole fix.
//
// loads dev.clouddelnorte.org/feed/, injects the new css rules so the
// screenshot reflects post-fix appearance without waiting for a deploy,
// then captures the side-nav region at desktop (1280) + mobile (375).
//
// usage:  node scripts/probe-sidepanel-scrollbar.mjs

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

const URL = process.argv[2] ?? "https://dev.clouddelnorte.org/feed/index.html";

// the same css the fix adds to src/layouts/shell/styles.css — injected here
// so the screenshot reflects the fix without waiting for a CI deploy.
const FIX_CSS = `
[class*="awsui_navigation_"] [class*="awsui_content-container_"] {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
[class*="awsui_navigation_"] [class*="awsui_content-container_"]::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
nav[class*="awsui_navigation_"]:not([class*="awsui_navigation-toggle_"]),
[class*="awsui_navigation__drawer"],
[class*="awsui_navigation-container"] [class*="awsui_drawer-content"],
[class*="awsui_drawer"] [class*="awsui_drawer-content"],
[class*="awsui_drawer-content-container"] {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
nav[class*="awsui_navigation_"]:not([class*="awsui_navigation-toggle_"])::-webkit-scrollbar,
[class*="awsui_navigation__drawer"]::-webkit-scrollbar,
[class*="awsui_navigation-container"] [class*="awsui_drawer-content"]::-webkit-scrollbar,
[class*="awsui_drawer"] [class*="awsui_drawer-content"]::-webkit-scrollbar,
[class*="awsui_drawer-content-container"]::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
`;

const browser = await chromium.launch({
	headless: true,
	args: ["--autoplay-policy=no-user-gesture-required"],
});

async function shot(width, height, outPath, openMobileNav) {
	const ctx = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: 2,
	});
	const page = await ctx.newPage();
	await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
	// wait for cloudscape to mount the nav (may be drawer-closed on mobile,
	// so use attached state, not visible)
	await page.waitForSelector('[class*="awsui_navigation_"]', {
		state: "attached",
		timeout: 15000,
	});
	await page.addStyleTag({ content: FIX_CSS });
	if (openMobileNav) {
		// dump candidate toggles for debugging
		const candidates = await page.evaluate(() => {
			const out = [];
			for (const b of document.querySelectorAll("button")) {
				const al = b.getAttribute("aria-label") || "";
				if (/nav/i.test(al) || /menu/i.test(al)) {
					const r = b.getBoundingClientRect();
					out.push({
						al,
						visible: r.width > 0 && r.height > 0,
						x: r.x,
						y: r.y,
					});
				}
			}
			return out;
		});
		console.log("[probe] nav button candidates:", JSON.stringify(candidates));
		// pick the first visible nav-labeled button
		const opened = await page.evaluate(() => {
			for (const b of document.querySelectorAll("button")) {
				const al = (b.getAttribute("aria-label") || "").toLowerCase();
				if (al.includes("nav") || al.includes("menu")) {
					const r = b.getBoundingClientRect();
					if (r.width > 0 && r.height > 0) {
						b.click();
						return al;
					}
				}
			}
			return null;
		});
		console.log("[probe] clicked toggle:", opened);
		await page.waitForTimeout(600);
	}
	// settle: let canvas/wallpaper paint, fonts load
	await page.waitForTimeout(1500);
	await page.screenshot({ path: outPath, fullPage: false });
	const navBox = await page.evaluate(() => {
		const el =
			document.querySelector('nav[class*="awsui_navigation_"]:not([class*="awsui_navigation-toggle_"])') ||
			document.querySelector('[class*="awsui_navigation__drawer"]');
		if (!el) return null;
		const r = el.getBoundingClientRect();
		const cs = getComputedStyle(el);
		return {
			rect: { x: r.x, y: r.y, w: r.width, h: r.height },
			scrollHeight: el.scrollHeight,
			clientHeight: el.clientHeight,
			scrollbarWidth: cs.scrollbarWidth,
			canScroll: el.scrollHeight > el.clientHeight,
		};
	});
	console.log(`[${width}x${height}] saved ${outPath}  nav=${JSON.stringify(navBox)}`);
	await ctx.close();
}

await shot(1280, 900, "/tmp/sidepanel-after-1280.png", false);
await shot(375, 800, "/tmp/sidepanel-after-375.png", true);

await browser.close();
console.log("done");
