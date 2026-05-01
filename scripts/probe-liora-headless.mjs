// probe liora-panel state in headless chromium.
// reports network failures, console errors, MIME mismatches on liora resources,
// and visible panel text after a 15s settle. captures full-page screenshot.
//
// usage:
//   node scripts/probe-liora-headless.mjs [url] [screenshot-path] [headless-mode]
//
// args:
//   url             default https://dev.clouddelnorte.org/home/index.html
//   screenshot-path default /tmp/headless-liora.png
//   headless-mode   'true' (default), 'new', or 'false'
//
// playwright resolves from the global nvm install at
// ~/.nvm/versions/node/<ver>/lib/node_modules/playwright. invoke from repo
// root so this script doesn't need a project-level dependency.
//
// required launch args (proven 2026-05-01 against prod and dev):
//   --autoplay-policy=no-user-gesture-required
//   --ignore-gpu-blocklist
//   --enable-gpu-rasterization
//   --use-gl=angle
//   --use-angle=gl
//
// expected SUCCESS signals:
//   resp 200 application/javascript .../liora-embed/liora-embed.js
//   resp 200 model/gltf-binary .../liora/*.glb
//   shimmerOpacity == "0" (placeholder faded out)
//   canvasMounted == "1" (BabylonJS attached)
//
// FAILURE signal that proves the dev s3 sync wiped liora-embed/*:
//   resp [MIME] 200 text/html .../liora-embed/liora-embed.js
//   "Failed to load module script: Expected a JavaScript-or-Wasm module
//    script but the server responded with a MIME type of text/html"
//   shimmerText stays "modem connecting▓▓▓"

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let playwrightPath;
try {
	playwrightPath = require.resolve("playwright");
} catch {
	// fall back to nvm global install
	const ver = process.versions.node;
	playwrightPath = `${process.env.HOME}/.nvm/versions/node/v${ver}/lib/node_modules/playwright/index.mjs`;
}
const { chromium } = await import(playwrightPath);

const targetUrl = process.argv[2] ?? "https://dev.clouddelnorte.org/home/index.html";
const screenshotPath = process.argv[3] ?? "/tmp/headless-liora.png";
const headlessArg = process.argv[4] ?? "true";
const WAIT_MS = 15000;

let headless;
if (headlessArg === "false") headless = false;
else if (headlessArg === "new") headless = "new";
else headless = true;

const launchArgs = [
	"--autoplay-policy=no-user-gesture-required",
	"--ignore-gpu-blocklist",
	"--enable-gpu-rasterization",
	"--use-gl=angle",
	"--use-angle=gl",
];

console.log(`[probe] url=${targetUrl} headless=${headlessArg}`);
console.log(`[probe] args=${launchArgs.join(" ")}`);

const browser = await chromium.launch({ headless, args: launchArgs });
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

const ts = () => new Date().toISOString().slice(11, 23);

page.on("console", (msg) => {
	const t = msg.type();
	if (t === "error" || t === "warning") {
		console.log(`[${ts()}] console.${t}: ${msg.text()}`);
	}
});
page.on("pageerror", (err) => {
	console.log(`[${ts()}] pageerror: ${err.message}`);
});
page.on("requestfailed", (req) => {
	console.log(`[${ts()}] requestfailed: ${req.url()} -- ${req.failure()?.errorText}`);
});
page.on("response", (resp) => {
	const url = resp.url();
	if (/liora|\.wasm(\?|$)/i.test(url)) {
		const status = resp.status();
		const ct = resp.headers()["content-type"] ?? "";
		const flag =
			status >= 400 ? "[ERR]" :
			(/\.js(\?|$)/i.test(url) && !/javascript|ecmascript|wasm/i.test(ct)) ? "[MIME]" :
			"";
		console.log(`[${ts()}] resp ${flag} ${status} ${ct} ${url}`);
	}
});

console.log(`[${ts()}] goto ${targetUrl}`);
await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
console.log(`[${ts()}] dom loaded, waiting ${WAIT_MS}ms for scene mount`);

await page.waitForTimeout(WAIT_MS);

const state = await page.evaluate(() => {
	const shimmer = document.getElementById("liora-shimmer");
	const canvas = document.getElementById("liora-canvas");
	const bezel = document.querySelector(".liora-bezel");
	return {
		shimmerOpacity: shimmer ? getComputedStyle(shimmer).opacity : null,
		shimmerText: shimmer?.textContent?.trim().replace(/\s+/g, " ") ?? null,
		canvasW: canvas ? canvas.clientWidth : null,
		canvasH: canvas ? canvas.clientHeight : null,
		canvasMounted: canvas?.dataset.lioraMounted ?? null,
		bezelClasses: bezel?.className ?? null,
		bezelTextSample: bezel?.textContent?.trim().slice(0, 300) ?? null,
	};
});

console.log(`[${ts()}] panel state:`, JSON.stringify(state, null, 2));

await page.screenshot({ path: screenshotPath, fullPage: true });
console.log(`[${ts()}] screenshot -> ${screenshotPath}`);

await browser.close();

const stuck = state.shimmerOpacity !== "0" || state.canvasMounted !== "1";
console.log(`[${ts()}] result: ${stuck ? "STUCK" : "OK"}`);
process.exit(stuck ? 1 : 0);
