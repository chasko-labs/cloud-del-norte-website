// scripts/ci-screenshot.mjs
// usage: node scripts/ci-screenshot.mjs <baseUrl> <outDir>
//   e.g. node scripts/ci-screenshot.mjs https://dev.clouddelnorte.org /tmp/shots

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// Cap the Node process hosting Playwright. CI containers on shared workstations
// have seen unbounded Chrome/Node growth cause system freezes (2026-05-16).
process.env.NODE_OPTIONS = "--max-old-space-size=768";

const baseUrl = process.argv[2];
const outDir = process.argv[3];
if (!baseUrl || !outDir) {
	console.error("usage: node ci-screenshot.mjs <baseUrl> <outDir>");
	process.exit(1);
}
await fs.mkdir(outDir, { recursive: true });

const VIEWPORTS = [
	{ name: "desktop", width: 1440, height: 900 },
	{ name: "tablet", width: 768, height: 1024 },
	{ name: "mobile", width: 375, height: 667 },
];
const THEMES = ["light", "dark"];
const PAGES = [
	{ name: "home", path: "/home/index.html" },
	{ name: "feed", path: "/feed/index.html" },
];

// Memory-safe flags for CI screenshots. GPU rasterization/ANGLE flags removed —
// they raise rendering memory for quality we don't need here. Caps applied at
// both the V8 (--max-old-space-size) and process (NODE_OPTIONS above) layers.
const LAUNCH_ARGS = [
	"--autoplay-policy=no-user-gesture-required",
	"--disable-dev-shm-usage",
	"--disable-gpu",
	"--no-sandbox",
	"--js-flags=--max-old-space-size=512",
	"--disable-background-networking",
	"--disable-default-apps",
	"--disable-extensions",
	"--disable-sync",
	"--metrics-recording-only",
	"--no-first-run",
];

const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
const _SETTLE_MS = 5000;
const errors = [];

for (const v of VIEWPORTS) {
	for (const t of THEMES) {
		for (const p of PAGES) {
			const ctx = await browser.newContext({
				viewport: { width: v.width, height: v.height },
				colorScheme: t,
			});
			const page = await ctx.newPage();
			try {
				// force wallpaper mount even when ANGLE reports SwiftShader —
				// see src/lib/background-viz/index.ts:shouldSkipDune
				const url = `${baseUrl}${p.path}${p.path.includes("?") ? "&" : "?"}__cdn_force_wallpaper=1`;
				await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
				await page.evaluate((mode) => {
					if (mode === "dark")
						document.documentElement.classList.add("awsui-dark-mode");
					else document.documentElement.classList.remove("awsui-dark-mode");
				}, t);
				// wait for at least one canvas to be visible — signals the dune scene's
				// 2s opacity entrance fade has completed and the BabylonJS render loop
				// is producing frames. falls back to timeout if no canvas appears (dark
				// mode, reduced-motion, or genuine failure — all fine, screenshot still taken).
				await page.waitForFunction(
					() => {
						const cs = document.querySelectorAll("canvas");
						if (!cs.length) return false;
						for (const c of cs) {
							const o = parseFloat(getComputedStyle(c).opacity);
							if (c.width > 100 && o > 0.5) return true;
						}
						return false;
					},
					{ timeout: 30000, polling: 500 },
				);
				// extra settle: shader compile + first frames + perf-gate retry window
				// (DUNE_PERF_GATE_DELAY_MS=2000 + DUNE_PERF_GATE_RETRY_DELAY_MS=4000 + buffer)
				await new Promise((r) => setTimeout(r, 8000));
				const file = path.join(outDir, `${p.name}-${v.name}-${t}.png`);
				await page.screenshot({ path: file });
				console.log(`captured ${file}`);
			} catch (e) {
				errors.push({
					page: p.name,
					viewport: v.name,
					theme: t,
					error: e.message,
				});
				console.error(`failed ${p.name} ${v.name} ${t}: ${e.message}`);
			} finally {
				await ctx.close();
			}
		}
	}
}
await browser.close();

if (errors.length) {
	console.error(JSON.stringify({ status: "partial", errors }, null, 2));
	process.exit(2);
}
console.log(
	JSON.stringify({
		status: "ok",
		count: VIEWPORTS.length * THEMES.length * PAGES.length,
	}),
);
