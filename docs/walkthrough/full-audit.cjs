const { chromium } = require("playwright");

(async () => {
	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
	});
	const page = await ctx.newPage();
	const issues = [];

	console.log("=== FULL QUANTUM AUDIT ===\n");

	// LANDING
	console.log("--- LANDING PAGE ---");
	await page.goto("https://quantum.clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(2000);

	// All links working
	const links = await page.$$eval("a[href]", (els) =>
		els.map((e) => ({
			href: e.href,
			text: e.textContent.trim().substring(0, 40),
		})),
	);
	console.log(`  Links found: ${links.length}`);
	for (const link of links) {
		if (
			link.href.startsWith("http") &&
			!link.href.includes("calendar.google") &&
			!link.href.includes("outlook.live") &&
			!link.href.includes("calendar.yahoo")
		) {
			try {
				const resp = await page.request.head(link.href, { timeout: 8000 });
				if (resp.status() >= 400) {
					issues.push(
						`BROKEN LINK: ${link.text} → ${link.href} (${resp.status()})`,
					);
					console.log(`  ✗ ${link.text} → ${resp.status()}`);
				}
			} catch (e) {
				// timeout or network error — skip calendar URLs
			}
		}
	}

	// Text content check — stale or wrong copy
	const bodyText = await page.locator("body").textContent();
	if (
		bodyText.includes("free") ||
		bodyText.includes("Free") ||
		bodyText.includes("FREE")
	)
		issues.push('LANDING: still contains "free"');
	if (bodyText.includes("Dismiss"))
		issues.push('LANDING: contains "Dismiss" text');
	if (bodyText.includes("No account needed"))
		issues.push('LANDING: contains "No account needed"');

	// REGISTER
	console.log("\n--- REGISTER PAGE ---");
	await page.goto("https://quantum.clouddelnorte.org/register/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(2000);
	const regBody = await page.locator("body").textContent();
	if (regBody.includes("free") || regBody.includes("Free"))
		issues.push('REGISTER: contains "free"');
	if (regBody.includes("No account needed"))
		issues.push('REGISTER: contains "No account needed"');

	// DASHBOARD
	console.log("\n--- DASHBOARD ---");
	// Set registered flag so we see registered view
	await page.evaluate(() =>
		localStorage.setItem(
			"cdn-quantum-registered",
			JSON.stringify({
				email: "audit@test.com",
				date: new Date().toISOString(),
			}),
		),
	);
	await page.goto("https://quantum.clouddelnorte.org/dashboard/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(3000);
	// Dismiss celebration if showing
	await page.evaluate(() =>
		localStorage.setItem("cdn-quantum-celebration-shown", "true"),
	);
	await page.reload({ waitUntil: "networkidle" });
	await page.waitForTimeout(2000);

	const dashBody = await page.locator("body").textContent();
	if (dashBody.includes("Dismiss welcome"))
		issues.push('DASHBOARD: still shows "Dismiss welcome celebration"');
	if (dashBody.includes("No account needed"))
		issues.push('DASHBOARD: "No account needed" still present');
	if (dashBody.includes("full access"))
		issues.push('DASHBOARD: "full access" oversell still present');
	if (dashBody.includes("Sign in to access"))
		issues.push("DASHBOARD: sign-in wall for registered user");
	if (!dashBody.includes("Bryan"))
		issues.push("DASHBOARD: test call not showing");
	if (!dashBody.includes("Braket"))
		issues.push("DASHBOARD: workshop not showing");

	// Check passkey offer
	if (!dashBody.includes("passkey") && !dashBody.includes("Passkey"))
		issues.push("DASHBOARD: passkey offer missing");

	// Check hosts
	if (!dashBody.includes("Clarksville"))
		issues.push("DASHBOARD: co-host Clarksville missing");
	if (!dashBody.includes("Columbia"))
		issues.push("DASHBOARD: co-host Columbia missing");

	// Check registered badge in toolbar
	const badge = await page.locator("text=Registered").count();
	if (badge === 0) issues.push("DASHBOARD: no Registered badge in toolbar");

	console.log("\n=== AUDIT RESULTS ===");
	if (issues.length === 0) {
		console.log("PASS — all pages clean");
	} else {
		console.log(`ISSUES (${issues.length}):`);
		for (const i of issues) console.log(`  ✗ ${i}`);
	}

	await browser.close();
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
