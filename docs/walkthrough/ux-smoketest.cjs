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
	const errors = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});
	page.on("pageerror", (err) => errors.push(err.message));

	console.log("=== QUANTUM UX SMOKETEST ===\n");

	// 1. Landing page
	console.log("1. Landing page...");
	await page.goto("https://quantum.clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(2000);
	const landingTitle = await page
		.locator("h1")
		.first()
		.textContent()
		.catch(() => "NO H1");
	const signInLink = await page.locator("text=Sign in").count();
	const registerBtn = await page
		.locator('[data-tool-name="register_for_workshop"]')
		.count();
	const meetupLogos = await page.locator("svg").count();
	console.log(`   h1: "${landingTitle}"`);
	console.log(`   Sign in link visible: ${signInLink > 0}`);
	console.log(`   Register CTA (WebMCP annotated): ${registerBtn > 0}`);
	console.log(`   SVGs on page: ${meetupLogos}`);
	await page.screenshot({ path: `${OUT}/ux-01-landing.png`, fullPage: true });

	// 2. Click Register
	console.log("\n2. Navigate to register...");
	await page.click('[data-tool-name="register_for_workshop"]');
	await page.waitForTimeout(2000);
	const regTitle = await page.title();
	console.log(`   title: "${regTitle}"`);
	await page.screenshot({ path: `${OUT}/ux-02-register.png`, fullPage: true });

	// 3. Fill and submit registration
	console.log("\n3. Fill registration form...");
	const inputs = await page.$$("input");
	if (inputs[0]) await inputs[0].fill("ux-smoketest@example.com");
	if (inputs[1]) await inputs[1].fill("UX Smoketest");
	await page.waitForTimeout(500);

	console.log("   Submitting...");
	const submitBtn = await page.$('button[class*="primary"]');
	if (submitBtn) await submitBtn.click();
	await page.waitForTimeout(4000);

	// Check success state
	const successVisible = await page.locator("text=registered").count();
	const dashboardLink = await page.locator("text=Dashboard").count();
	console.log(`   Success message visible: ${successVisible > 0}`);
	console.log(`   Dashboard link visible: ${dashboardLink > 0}`);
	await page.screenshot({
		path: `${OUT}/ux-03-register-success.png`,
		fullPage: true,
	});

	// 4. Navigate to dashboard
	console.log("\n4. Go to dashboard...");
	await page.goto("https://quantum.clouddelnorte.org/dashboard/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(3000);

	// Check toolbar has registered badge
	const registeredBadge = await page.locator("text=Registered").count();
	console.log(`   Toolbar "Registered" badge: ${registeredBadge > 0}`);

	// Check lobo celebration
	const lobos = await page.locator("text=pack").count();
	console.log(`   Wolf celebration visible: ${lobos > 0}`);

	// Check sessions list
	const testCall = await page.locator("text=Bryan").count();
	const braketWorkshop = await page.locator("text=Braket").count();
	console.log(`   Test call session visible: ${testCall > 0}`);
	console.log(`   Braket workshop session visible: ${braketWorkshop > 0}`);

	// Check calendar actions
	const calButtons = await page.locator("text=Google").count();
	console.log(`   Calendar buttons visible: ${calButtons > 0}`);

	// Check NOT showing sign-in wall
	const signInWall = await page.locator("text=Sign in to access").count();
	console.log(`   Sign-in wall (should be 0): ${signInWall}`);

	await page.screenshot({
		path: `${OUT}/ux-04-dashboard-registered.png`,
		fullPage: true,
	});

	// 5. Check dark/light toggle
	console.log("\n5. Toggle theme...");
	const themeBtn = await page.$(
		'[aria-label*="theme"], [aria-label*="Theme"], button:has(svg.cdn-svg-sun), button:has(svg.cdn-svg-moon)',
	);
	if (themeBtn) {
		await themeBtn.click();
		await page.waitForTimeout(1000);
		console.log("   Theme toggled");
	} else {
		console.log("   Theme toggle button not found");
	}
	await page.screenshot({
		path: `${OUT}/ux-05-light-mode.png`,
		fullPage: true,
	});

	// 6. Check locale toggle
	console.log("\n6. Toggle locale...");
	const flagBtn = await page.$(
		'[aria-label*="locale"], [aria-label*="Locale"], [aria-label*="Español"], [aria-label*="English"]',
	);
	if (flagBtn) {
		await flagBtn.click();
		await page.waitForTimeout(1000);
		const h1After = await page
			.locator("h1")
			.first()
			.textContent()
			.catch(() => "NO H1");
		console.log(`   h1 after locale toggle: "${h1After}"`);
	} else {
		console.log("   Locale toggle button not found");
	}
	await page.screenshot({ path: `${OUT}/ux-06-spanish.png`, fullPage: true });

	// Summary
	console.log("\n=== CONSOLE ERRORS:", errors.length, "===");
	for (const e of errors.slice(0, 5)) console.log("  ", e.substring(0, 120));

	console.log("\n=== VERDICT ===");
	const issues = [];
	if (signInLink === 0) issues.push("No sign-in link on landing");
	if (registerBtn === 0) issues.push("Register CTA missing WebMCP annotation");
	if (!successVisible) issues.push("Registration success not shown");
	if (!dashboardLink) issues.push("No dashboard link after registration");
	if (registeredBadge === 0) issues.push("No registered badge in toolbar");
	if (signInWall > 0) issues.push("SIGN-IN WALL showing for registered user");
	if (testCall === 0) issues.push("Test call not visible on dashboard");
	if (calButtons === 0) issues.push("Calendar buttons missing");

	if (issues.length === 0) {
		console.log("PASS — full flow works end-to-end");
	} else {
		console.log(`ISSUES (${issues.length}):`);
		for (const i of issues) console.log(`  ✗ ${i}`);
	}

	await browser.close();
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
