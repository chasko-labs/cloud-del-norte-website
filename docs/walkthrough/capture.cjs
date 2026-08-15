const { chromium } = require("playwright");
const OUT =
	"/home/bryanchasko/code/websites/cloud-del-norte-website/docs/walkthrough";

(async () => {
	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
	});
	const page = await ctx.newPage();

	console.log("1. Landing...");
	await page.goto("https://quantum.clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(2000);
	await page.screenshot({ path: `${OUT}/01-landing.png`, fullPage: true });
	console.log("   done");

	console.log("2. Register...");
	await page.goto("https://quantum.clouddelnorte.org/register/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(2000);
	await page.screenshot({ path: `${OUT}/02-register.png`, fullPage: true });
	console.log("   done");

	console.log("3. Fill form...");
	await page.locator("input").first().fill("quantum-walkthrough@example.com");
	await page.locator("input").nth(1).fill("Quantum Walker");
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${OUT}/03-form-filled.png`, fullPage: true });
	console.log("   done");

	console.log("4. Submit...");
	await page.locator("button", { hasText: "Register" }).first().click();
	await page.waitForTimeout(4000);
	await page.screenshot({ path: `${OUT}/04-success.png`, fullPage: true });
	console.log("   done");

	await browser.close();
	console.log("BATCH 1 DONE");
})().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
