const { chromium } = require("playwright");
const { execFileSync } = require("child_process");

function ssmParam(name, withDecryption) {
	const args = ['ssm', 'get-parameter', '--name', name, '--profile', 'aerospaceug-admin', '--region', 'us-west-2', '--query', 'Parameter.Value', '--output', 'text'];
	if (withDecryption) args.push('--with-decryption');
	return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

(async () => {
	const CDN_MEMBER_USERNAME = ssmParam('/device-farm/test-users/member-username', false);
	const CDN_MEMBER_PASSWORD = ssmParam('/device-farm/test-users/member-password', true);

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

	console.log("=== AUTHENTICATED MEMBER FLOW ===\n");

	// Step 1: Login on auth subdomain
	console.log("1. Login on auth.clouddelnorte.org...");
	await page.goto("https://auth.clouddelnorte.org/login/index.html", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page
		.locator('input[type="email"]')
		.fill(CDN_MEMBER_USERNAME);
	await page
		.locator('input[type="password"]')
		.fill(CDN_MEMBER_PASSWORD);
	await page.locator("button", { hasText: "Sign in" }).first().click();
	await page.waitForTimeout(8000);
	console.log("   post-login url:", page.url());

	// Check if we got tokens on the main site
	const mainTokens = await page.evaluate(() => ({
		idToken: sessionStorage.getItem("cdn.idToken")?.substring(0, 20) || null,
		email: (() => {
			try {
				const t = sessionStorage.getItem("cdn.idToken");
				if (!t) return null;
				return JSON.parse(
					atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
				).email;
			} catch {
				return null;
			}
		})(),
	}));
	console.log("   tokens on main site:", mainTokens.idToken ? "YES" : "NO");
	console.log("   email from token:", mainTokens.email || "none");

	// Step 2: Get the actual token to pass to quantum
	const fullIdToken = await page.evaluate(() =>
		sessionStorage.getItem("cdn.idToken"),
	);
	const fullAccessToken = await page.evaluate(() =>
		sessionStorage.getItem("cdn.accessToken"),
	);
	const fullRefreshToken = await page.evaluate(() =>
		sessionStorage.getItem("cdn.refreshToken"),
	);

	if (!fullIdToken) {
		console.log(
			"\n   FAIL: No idToken after login. Checking if MFA required...",
		);
		await page.screenshot({ path: "docs/walkthrough/smoketest-auth-fail.png" });
		const pageContent = await page.locator("body").textContent();
		console.log("   page text:", pageContent.substring(0, 200));
		await browser.close();
		process.exit(1);
	}

	// Step 3: Navigate to quantum auth-callback with tokens in fragment
	console.log(
		"\n2. Token propagation to quantum.clouddelnorte.org/auth-callback/...",
	);
	const fragment = `id_token=${encodeURIComponent(fullIdToken)}&access_token=${encodeURIComponent(fullAccessToken)}&refresh_token=${encodeURIComponent(fullRefreshToken || "")}&return_to=/register/`;
	await page.goto(
		`https://quantum.clouddelnorte.org/auth-callback/#${fragment}`,
		{ waitUntil: "networkidle", timeout: 20000 },
	);
	await page.waitForTimeout(3000);
	console.log("   redirected to:", page.url());

	// Step 4: Check if register page shows member view
	console.log("\n3. Register page (should show member RSVP view)...");
	const quantumTokens = await page.evaluate(() => ({
		idToken: sessionStorage.getItem("cdn.idToken")?.substring(0, 20) || null,
	}));
	console.log(
		"   tokens in quantum sessionStorage:",
		quantumTokens.idToken ? "YES" : "NO",
	);

	await page.waitForTimeout(2000);
	const pageText = await page.locator("body").textContent();
	const hasMemberView =
		pageText.includes("Welcome back") || pageText.includes("Confirm");
	const hasGuestForm = pageText.includes("Which group");
	console.log("   member view visible:", hasMemberView);
	console.log("   guest form visible:", hasGuestForm);

	// Screenshot the result
	await page.screenshot({
		path: "docs/walkthrough/12-member-rsvp.png",
		fullPage: true,
	});
	console.log("   screenshot saved: 12-member-rsvp.png");

	// Step 5: Check Google Calendar link
	const calLink = await page
		.locator('a[href*="calendar.google.com"]')
		.first()
		.getAttribute("href")
		.catch(() => null);
	console.log("\n4. Google Calendar link:", calLink ? "PRESENT" : "MISSING");
	if (calLink) console.log("   url:", calLink.substring(0, 80) + "...");

	// Step 6: Click Confirm RSVP if visible
	if (hasMemberView) {
		console.log("\n5. Confirm RSVP...");
		const confirmBtn = await page.locator('button[class*="primary"]').first();
		if (await confirmBtn.isVisible()) {
			await confirmBtn.click();
			await page.waitForTimeout(4000);
			const successText = await page.locator("body").textContent();
			const confirmed =
				successText.includes("registered") || successText.includes("confirmed");
			console.log("   RSVP confirmed:", confirmed);
			await page.screenshot({
				path: "docs/walkthrough/13-member-confirmed.png",
				fullPage: true,
			});
		}
	}

	// Summary
	console.log("\n=== CONSOLE ERRORS:", errors.length, "===");
	for (const e of errors.slice(0, 5)) console.log("  ", e.substring(0, 120));

	console.log("\n=== VERDICT ===");
	if (hasMemberView && !hasGuestForm) {
		console.log("PASS — authenticated member sees RSVP confirmation view");
	} else if (hasGuestForm && !hasMemberView) {
		console.log("FAIL — member still sees guest form (token decode failed?)");
	} else {
		console.log("PARTIAL — check screenshots");
	}

	await browser.close();
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
