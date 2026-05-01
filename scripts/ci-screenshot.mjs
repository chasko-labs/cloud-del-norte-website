// scripts/ci-screenshot.mjs
// usage: node scripts/ci-screenshot.mjs <baseUrl> <outDir>
//   e.g. node scripts/ci-screenshot.mjs https://dev.clouddelnorte.org /tmp/shots

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

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

const LAUNCH_ARGS = [
    "--autoplay-policy=no-user-gesture-required",
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization",
    "--use-gl=angle",
    "--use-angle=gl",
];

const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
const SETTLE_MS = 5000;
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
                await page.goto(`${baseUrl}${p.path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
                await page.evaluate((mode) => {
                    if (mode === "dark") document.documentElement.classList.add("awsui-dark-mode");
                    else document.documentElement.classList.remove("awsui-dark-mode");
                }, t);
                await new Promise(r => setTimeout(r, SETTLE_MS));
                const file = path.join(outDir, `${p.name}-${v.name}-${t}.png`);
                await page.screenshot({ path: file });
                console.log(`captured ${file}`);
            } catch (e) {
                errors.push({ page: p.name, viewport: v.name, theme: t, error: e.message });
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
console.log(JSON.stringify({ status: "ok", count: VIEWPORTS.length * THEMES.length * PAGES.length }));
