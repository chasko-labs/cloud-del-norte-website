#!/usr/bin/env node
/**
 * verify-phantom-nav-fix.mjs — Playwright verification for #162
 * Checks: access-denied card on /admin + 'create meeting' link hidden for non-moderators.
 */
import { createRequire } from "module";

const require = createRequire(
	"/home/bryanchasko/.nvm/versions/node/v24.14.0/lib/node_modules/playwright/",
);
const { chromium } = require("playwright");

import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");
mkdirSync(OUTPUT_DIR, { recursive: true });

const TS = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13) + "Z";
const AUTH_URL = "https://auth.clouddelnorte.org/login/index.html";
const AWSUG_URL = "https://awsug.clouddelnorte.org";
const ADMIN_URL = "https://awsug.clouddelnorte.org/admin/index.html";
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
	console.error("TEST_EMAIL and TEST_PASSWORD env vars required");
	process.exit(1);
}

const results = { access_denied_card: "FAIL", create_meeting_hidden: "FAIL" };
const evidence = {};

async function run() {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ ignoreHTTPSErrors: true });
	const page = await context.newPage();

	try {
		// Login
		console.log(`[login] Navigating to ${AUTH_URL}`);
		await page.goto(AUTH_URL, { waitUntil: "networkidle", timeout: 30000 });
		await page.fill('input[type="email"], input[name="email"], #email', EMAIL);
		await page.fill(
			'input[type="password"], input[name="password"], #password',
			PASSWORD,
		);
		await page.click('button[type="submit"]');

		// Wait for the full auth flow: login → redeem → /index.html redirect
		// The redeem page stores tokens then redirects to /index.html
		console.log("[login] Waiting for auth redeem to complete...");
		await page.waitForURL("**/index.html", { timeout: 30000 }).catch(() => {});
		await page.waitForTimeout(3000);
		console.log(`[login] Post-auth URL: ${page.url()}`);

		// Now navigate to AWSUG home — tokens should be in localStorage
		console.log(`[nav] Going to ${AWSUG_URL}`);
		await page.goto(AWSUG_URL, { waitUntil: "networkidle", timeout: 30000 });
		// Wait for React to render
		await page
			.waitForFunction(
				() => {
					const root = document.getElementById("root");
					return root && root.innerHTML.trim().length > 50;
				},
				{ timeout: 20000 },
			)
			.catch(() => console.log("[warn] Home page React root slow"));
		await page.waitForTimeout(2000);

		// Check 1: 'create meeting' link hidden
		const links = await page.$$eval("a", (els) =>
			els.map((e) => ({
				text: (e.textContent || "").trim().substring(0, 80),
				href: e.href,
			})),
		);
		const navItems = links.filter((d) => d.text && d.text.length < 60);
		evidence.nav_items = navItems;

		const createMeetingFound = navItems.some((d) =>
			d.text.toLowerCase().includes("create meeting"),
		);
		evidence.create_meeting_found = createMeetingFound;

		if (!createMeetingFound) {
			results.create_meeting_hidden = "PASS";
			console.log(
				'[CHECK] PASS: "create meeting" link NOT visible for non-moderator',
			);
		} else {
			console.log(
				'[CHECK] FAIL: "create meeting" link IS visible for non-moderator',
			);
		}

		const scrNav = join(OUTPUT_DIR, `phantom-nav-home-${TS}.png`);
		await page.screenshot({ path: scrNav, fullPage: true });
		evidence.screenshot_nav = scrNav;

		// Check 2: /admin shows access-denied card
		console.log(`[nav] Going to ${ADMIN_URL}`);

		// Capture console errors
		const consoleMessages = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") consoleMessages.push(msg.text());
		});
		page.on("pageerror", (err) =>
			consoleMessages.push(`PAGE_ERROR: ${err.message}`),
		);

		const response = await page.goto(ADMIN_URL, {
			waitUntil: "networkidle",
			timeout: 30000,
		});
		console.log(
			`[admin] Response status: ${response?.status()}, URL after goto: ${page.url()}`,
		);

		// Wait for React to mount and render content inside #root
		await page
			.waitForFunction(
				() => {
					const root = document.getElementById("root");
					return root && root.innerHTML.trim().length > 50;
				},
				{ timeout: 30000 },
			)
			.catch(() =>
				console.log("[warn] React root did not populate within 30s"),
			);
		await page.waitForTimeout(3000);

		// Check if we got redirected (requireAuth might redirect to login)
		const finalUrl = page.url();
		console.log(`[admin] Final URL: ${finalUrl}`);
		console.log(
			`[admin] Console errors: ${JSON.stringify(consoleMessages.slice(0, 5))}`,
		);

		// Check the full page HTML to understand what's happening
		const fullHtml = await page.content();
		const rootContent = await page
			.$eval("#root", (el) => el.innerHTML)
			.catch(() => "NO_ROOT");
		console.log(`[admin] #root content length: ${rootContent.length}`);
		console.log(`[admin] #root snippet: ${rootContent.substring(0, 200)}`);

		const scrAdmin = join(OUTPUT_DIR, `phantom-nav-admin-${TS}.png`);
		await page.screenshot({ path: scrAdmin, fullPage: true });
		evidence.screenshot_admin = scrAdmin;

		const bodyText = await page.innerText("body").catch(() => "");
		evidence.admin_body_text = bodyText.substring(0, 500);
		console.log(`[admin] Body text (first 200): ${bodyText.substring(0, 200)}`);

		// Check for access-denied signals
		const denialKeywords = [
			"don't have access",
			"moderators only",
			"moderator access",
			"no tienes acceso",
			"solo para moderadores",
			"access denied",
			"not authorized",
		];
		const hasDenial = denialKeywords.some((kw) =>
			bodyText.toLowerCase().includes(kw),
		);

		// Check for Cloudscape Alert component
		const hasAlert = (await page.$('[class*="awsui_alert"]')) !== null;

		// Check it's NOT blank
		const isBlank = bodyText.trim().length < 20;

		evidence.has_denial_text = hasDenial;
		evidence.has_alert_component = hasAlert;
		evidence.is_blank = isBlank;

		if ((hasDenial || hasAlert) && !isBlank) {
			results.access_denied_card = "PASS";
			console.log(
				`[CHECK] PASS: access-denied card visible (denial_text=${hasDenial}, alert=${hasAlert})`,
			);
		} else {
			console.log(
				`[CHECK] FAIL: access-denied card NOT visible (denial_text=${hasDenial}, alert=${hasAlert}, blank=${isBlank})`,
			);
		}

		// Capture DOM snippet for evidence
		const adminHtml = await page
			.innerHTML('main, [class*="awsui_content"], body')
			.catch(() => "");
		evidence.admin_dom_snippet = adminHtml.substring(0, 1000);
	} catch (err) {
		console.error(`[ERROR] ${err.message}`);
		evidence.error = err.message;
	} finally {
		await browser.close();
	}
}

await run();

// Write evidence
const evidencePath = join(OUTPUT_DIR, `phantom-nav-evidence-${TS}.json`);
writeFileSync(
	evidencePath,
	JSON.stringify({ results, evidence, timestamp: TS, user: EMAIL }, null, 2),
);

console.log(`\n${"=".repeat(60)}`);
console.log(`PHANTOM-NAV FIX VERIFICATION (#162) — ${TS}`);
console.log(`${"=".repeat(60)}`);
console.log(`  access_denied_card:    ${results.access_denied_card}`);
console.log(`  create_meeting_hidden: ${results.create_meeting_hidden}`);
console.log(`${"=".repeat(60)}`);
console.log(`Evidence: ${evidencePath}`);
console.log(
	`Screenshots: ${evidence.screenshot_nav || "N/A"}, ${evidence.screenshot_admin || "N/A"}`,
);

const allPass = Object.values(results).every((v) => v === "PASS");
process.exit(allPass ? 0 : 1);
