const { chromium } = require("playwright");

(async () => {
	const browser = await chromium.launch({ headless: true });
	const results = { pass: [], fail: [], warn: [] };

	function pass(msg) {
		results.pass.push(msg);
		console.log(`  ✓ ${msg}`);
	}
	function fail(msg) {
		results.fail.push(msg);
		console.log(`  ✗ ${msg}`);
	}
	function warn(msg) {
		results.warn.push(msg);
		console.log(`  ⚠ ${msg}`);
	}

	// ─── 1. LANDING PAGE — horizontal scroll, broken images, console errors ───
	console.log("\n=== 1. LANDING PAGE (desktop 1280×800) ===");
	const ctx1 = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page1 = await ctx1.newPage();
	const consoleErrors = [];
	page1.on("console", (msg) => {
		if (msg.type() === "error") consoleErrors.push(msg.text());
	});

	await page1.goto("https://clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 30000,
	});
	await page1.waitForTimeout(2000);

	// Horizontal scroll check
	const scrollWidth = await page1.evaluate(
		() => document.documentElement.scrollWidth,
	);
	const clientWidth = await page1.evaluate(
		() => document.documentElement.clientWidth,
	);
	if (scrollWidth > clientWidth) {
		fail(
			`Horizontal scroll detected: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`,
		);
	} else {
		pass("No horizontal scroll on desktop");
	}

	// Broken images
	const brokenImages = await page1.evaluate(() => {
		return Array.from(document.querySelectorAll("img"))
			.filter((img) => !img.complete || img.naturalWidth === 0)
			.map((img) => img.src);
	});
	if (brokenImages.length > 0) {
		fail(`Broken images: ${brokenImages.join(", ")}`);
	} else {
		pass("All images loaded successfully");
	}

	// Console errors
	if (consoleErrors.length > 0) {
		fail(
			`Console errors (${consoleErrors.length}): ${consoleErrors.slice(0, 3).join(" | ")}`,
		);
	} else {
		pass("No console errors");
	}

	await ctx1.close();

	// ─── 2. FEATURED EVENT CARD links to quantum.clouddelnorte.org ───
	console.log("\n=== 2. FEATURED EVENT CARD LINK ===");
	const ctx2 = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page2 = await ctx2.newPage();
	await page2.goto("https://clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 30000,
	});
	await page2.waitForTimeout(1000);

	// Look for event card links — check for quantum.clouddelnorte.org
	const eventLinks = await page2.evaluate(() => {
		const anchors = Array.from(document.querySelectorAll("a[href]"));
		return anchors
			.filter((a) => a.href.includes("quantum") || a.href.includes("meetup"))
			.map((a) => ({
				href: a.href,
				text: a.textContent.trim().substring(0, 60),
			}));
	});

	const quantumLinks = eventLinks.filter((l) =>
		l.href.includes("quantum.clouddelnorte.org"),
	);
	const meetupLinks = eventLinks.filter((l) => l.href.includes("meetup.com"));

	if (quantumLinks.length > 0) {
		pass(
			`Featured event links to quantum.clouddelnorte.org (${quantumLinks.length} link(s))`,
		);
	} else if (meetupLinks.length > 0) {
		fail(
			`Featured event still links to meetup.com instead of quantum.clouddelnorte.org: ${meetupLinks[0].href}`,
		);
	} else {
		warn(
			"No quantum or meetup links found on landing page — check event card markup",
		);
	}

	await ctx2.close();

	// ─── 3. FOOTER FULL WIDTH ───
	console.log("\n=== 3. FOOTER FULL WIDTH ===");
	const ctx3 = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page3 = await ctx3.newPage();
	await page3.goto("https://clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 30000,
	});
	await page3.waitForTimeout(1000);

	const footerMetrics = await page3.evaluate(() => {
		const footer =
			document.querySelector("footer") ||
			document.querySelector('[class*="footer"]');
		if (!footer) return null;
		const rect = footer.getBoundingClientRect();
		return {
			width: rect.width,
			viewportWidth: window.innerWidth,
			left: rect.left,
			right: rect.right,
		};
	});

	if (!footerMetrics) {
		warn("No <footer> or [class*=footer] element found");
	} else if (footerMetrics.width < footerMetrics.viewportWidth - 2) {
		fail(
			`Footer not full width: footer=${footerMetrics.width}px, viewport=${footerMetrics.viewportWidth}px (left=${footerMetrics.left}, right=${footerMetrics.right})`,
		);
	} else {
		pass(
			`Footer spans full width (${footerMetrics.width}px / viewport ${footerMetrics.viewportWidth}px)`,
		);
	}

	await ctx3.close();

	// ─── 4. MOBILE VIEWPORT (375px) — no overflow ───
	console.log("\n=== 4. MOBILE VIEWPORT (375px) ===");
	const ctx4 = await browser.newContext({
		viewport: { width: 375, height: 812 },
	});
	const page4 = await ctx4.newPage();
	await page4.goto("https://clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 30000,
	});
	await page4.waitForTimeout(2000);

	const mobileOverflow = await page4.evaluate(() => {
		return {
			scrollWidth: document.documentElement.scrollWidth,
			clientWidth: document.documentElement.clientWidth,
			bodyScrollWidth: document.body.scrollWidth,
		};
	});

	if (mobileOverflow.scrollWidth > mobileOverflow.clientWidth + 1) {
		fail(
			`Mobile overflow: scrollWidth=${mobileOverflow.scrollWidth} > clientWidth=${mobileOverflow.clientWidth}`,
		);
	} else {
		pass(
			`No mobile overflow (scrollWidth=${mobileOverflow.scrollWidth}, clientWidth=${mobileOverflow.clientWidth})`,
		);
	}

	await ctx4.close();

	// ─── 5. MEETINGS PAGE (auth-gated) ───
	console.log("\n=== 5. MEETINGS PAGE (auth gate) ===");
	const ctx5 = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page5 = await ctx5.newPage();

	let meetingsUrl;
	try {
		const resp = await page5.goto(
			"https://clouddelnorte.org/meetings/index.html",
			{ waitUntil: "networkidle", timeout: 30000 },
		);
		meetingsUrl = page5.url();
		const status = resp.status();

		if (
			meetingsUrl.includes("auth") ||
			meetingsUrl.includes("login") ||
			meetingsUrl.includes("cognito")
		) {
			pass(`Meetings page redirected to auth: ${meetingsUrl.substring(0, 80)}`);
		} else {
			// Check for auth gate UI on the page itself
			const hasAuthGate = await page5.evaluate(() => {
				const text = document.body.innerText.toLowerCase();
				return (
					text.includes("sign in") ||
					text.includes("log in") ||
					text.includes("authenticate")
				);
			});
			if (hasAuthGate) {
				pass(`Meetings page shows auth gate UI (status ${status})`);
			} else {
				warn(
					`Meetings page loaded (status ${status}) at ${meetingsUrl.substring(0, 80)} — may not be gated`,
				);
			}
		}
	} catch (e) {
		fail(`Meetings page failed to load: ${e.message.substring(0, 80)}`);
	}

	await ctx5.close();

	// ─── 6. AUTH LOGIN PAGE — 'Reset my password' CTA ───
	console.log("\n=== 6. AUTH LOGIN PAGE ===");
	const ctx6 = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page6 = await ctx6.newPage();

	try {
		await page6.goto("https://auth.clouddelnorte.org/login/index.html", {
			waitUntil: "networkidle",
			timeout: 30000,
		});
		await page6.waitForTimeout(2000);
		const finalUrl = page6.url();

		const pageText = await page6.evaluate(() => document.body.innerText);

		if (pageText.includes("Reset my password")) {
			pass("Auth login page has 'Reset my password' CTA");
		} else if (pageText.includes("Email me a sign-in link")) {
			fail(
				"Auth login page still shows old 'Email me a sign-in link' — should be 'Reset my password'",
			);
		} else {
			// Check if we got redirected to Cognito Hosted UI
			if (
				finalUrl.includes("amazoncognito.com") ||
				finalUrl.includes("auth.clouddelnorte.org")
			) {
				const cognitoText = await page6.evaluate(() => document.body.innerText);
				if (cognitoText.includes("Reset") || cognitoText.includes("Forgot")) {
					pass(
						`Auth page (Cognito hosted UI) has password reset option at: ${finalUrl.substring(0, 60)}`,
					);
				} else {
					warn(
						`Auth page loaded at ${finalUrl.substring(0, 60)} — could not find password reset CTA. Page text sample: ${pageText.substring(0, 100)}`,
					);
				}
			} else {
				warn(
					`Auth page loaded at ${finalUrl.substring(0, 60)} — neither CTA text found. Text sample: "${pageText.substring(0, 120)}"`,
				);
			}
		}
	} catch (e) {
		fail(`Auth login page failed to load: ${e.message.substring(0, 80)}`);
	}

	await ctx6.close();

	// ─── SUMMARY ───
	console.log("\n=== SUMMARY ===");
	console.log(`  PASS: ${results.pass.length}`);
	console.log(`  FAIL: ${results.fail.length}`);
	console.log(`  WARN: ${results.warn.length}`);

	if (results.fail.length > 0) {
		console.log("\n  FAILURES:");
		results.fail.forEach((f) => console.log(`    ✗ ${f}`));
	}
	if (results.warn.length > 0) {
		console.log("\n  WARNINGS:");
		results.warn.forEach((w) => console.log(`    ⚠ ${w}`));
	}

	console.log("\nDone.");
	await browser.close();
	process.exit(results.fail.length > 0 ? 1 : 0);
})();
