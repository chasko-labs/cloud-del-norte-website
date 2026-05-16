// Probe: identify the white-background element behind the breadcrumb on /feed/ mobile light mode.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const URL = "https://clouddelnorte.org/feed/";
const SCREENSHOT = "/tmp/breadcrumb-banner-probe.png";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
	viewport: { width: 375, height: 812 },
	colorScheme: "light",
});
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(8000);
await page.screenshot({ path: SCREENSHOT });

const result = await page.evaluate(() => {
	// Find the breadcrumb link containing 'feed'
	const links = [...document.querySelectorAll("a")];
	const feedLink = links.find(
		(a) => a.textContent.trim().toLowerCase() === "feed"
	);
	if (!feedLink) return { error: "no feed link found" };

	const chain = [];
	let offending = null;
	let el = feedLink;

	while (el && el !== document.body) {
		const style = window.getComputedStyle(el);
		const bg = style.backgroundColor;
		const classes = el.className || "";
		const tag = el.tagName.toLowerCase();

		chain.push({ tag, classes: classes.substring(0, 200), bg });

		// Check for non-transparent background (not rgba(0,0,0,0) and not transparent)
		if (
			!offending &&
			bg &&
			bg !== "transparent" &&
			bg !== "rgba(0, 0, 0, 0)" &&
			bg !== "inherit"
		) {
			offending = { tag, classes, bg };
		}
		el = el.parentElement;
	}

	return {
		offending_class: offending ? offending.classes : null,
		computed_background: offending ? offending.bg : null,
		ancestor_chain: chain,
		screenshot_path: "/tmp/breadcrumb-banner-probe.png",
	};
});

await browser.close();

writeFileSync("/tmp/breadcrumb-banner-probe.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(0);
