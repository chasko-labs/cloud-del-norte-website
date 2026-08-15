const { chromium } = require("playwright");
const OUT =
	"/home/bryanchasko/code/websites/cloud-del-norte-website/docs/walkthrough";

(async () => {
	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "light",
	});
	const page = await ctx.newPage();

	console.log("10. Light mode...");
	await page.goto("https://quantum.clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.evaluate(() =>
		localStorage.setItem("awsaerospace-theme", "light"),
	);
	await page.reload({ waitUntil: "networkidle" });
	await page.waitForTimeout(2000);
	await page.screenshot({ path: `${OUT}/10-light-mode.png`, fullPage: true });
	console.log("   done");

	console.log("11. Spanish...");
	await page.evaluate(() => {
		localStorage.setItem("awsaerospace-theme", "dark");
		localStorage.setItem("awsaerospace-locale", "mx");
	});
	await page.reload({ waitUntil: "networkidle" });
	await page.waitForTimeout(2000);
	await page.screenshot({ path: `${OUT}/11-spanish.png`, fullPage: true });
	console.log("   done");

	await browser.close();
	console.log("BATCH 3 DONE");
})().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
