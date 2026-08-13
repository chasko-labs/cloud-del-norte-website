const { chromium } = require("playwright");

(async () => {
	const browser = await chromium.launch({ headless: true });
	const issues = [];

	// Desktop dark mode
	let ctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
	});
	let page = await ctx.newPage();
	await page.goto("https://quantum.clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(2000);

	// 1. Card text audit - check font-family, size, weight, line-height inside Cloudscape containers
	const cardText = await page.$$eval(
		'[class*="awsui_root"] *, [class*="awsui_content"] *',
		(els) => {
			return els
				.filter(
					(el) =>
						el.offsetWidth > 0 &&
						el.textContent.trim().length > 2 &&
						el.children.length === 0,
				)
				.map((el) => {
					const cs = getComputedStyle(el);
					return {
						text: el.textContent.trim().substring(0, 40),
						fontFamily: cs.fontFamily.substring(0, 50),
						fontSize: cs.fontSize,
						fontWeight: cs.fontWeight,
						lineHeight: cs.lineHeight,
						color: cs.color,
						bg: cs.backgroundColor,
					};
				})
				.slice(0, 30);
		},
	);

	console.log("=== CARD TEXT AUDIT ===");
	for (const t of cardText.slice(0, 15)) {
		const size = parseFloat(t.fontSize);
		const lh = parseFloat(t.lineHeight) / size;
		const isMonospace =
			t.fontFamily.includes("JetBrains") || t.fontFamily.includes("monospace");
		const readability = [];
		if (size < 15) readability.push(`small(${size}px)`);
		if (lh < 1.4) readability.push(`tight-lh(${lh.toFixed(2)})`);
		if (isMonospace && size < 16) readability.push("monospace-at-small-size");
		if (parseInt(t.fontWeight) < 400) readability.push("thin");
		if (readability.length > 0) {
			issues.push(
				`CARD TEXT: "${t.text}" — ${readability.join(", ")} | font: ${t.fontFamily.substring(0, 30)}`,
			);
			console.log(
				`  ✗ "${t.text}" | ${t.fontSize} ${t.fontWeight}w lh:${lh.toFixed(2)} | ${readability.join(", ")}`,
			);
		}
	}

	// 2. Touch targets
	const smallTargets = await page.$$eval(
		'button, a, [role="button"], input, select',
		(els) => {
			return els
				.filter((el) => {
					const rect = el.getBoundingClientRect();
					return (
						rect.width > 0 &&
						rect.height > 0 &&
						(rect.width < 44 || rect.height < 44)
					);
				})
				.map((el) => {
					const rect = el.getBoundingClientRect();
					return {
						text: (el.textContent || el.getAttribute("aria-label") || "")
							.trim()
							.substring(0, 30),
						width: Math.round(rect.width),
						height: Math.round(rect.height),
						tag: el.tagName,
					};
				})
				.slice(0, 10);
		},
	);

	console.log("\n=== TOUCH TARGETS < 44px ===");
	for (const t of smallTargets) {
		issues.push(
			`SMALL TARGET: <${t.tag}> "${t.text}" — ${t.width}×${t.height}px`,
		);
		console.log(`  ✗ <${t.tag}> "${t.text}" — ${t.width}×${t.height}px`);
	}

	// 3. Mobile check
	await ctx.close();
	ctx = await browser.newContext({
		viewport: { width: 375, height: 812 },
		colorScheme: "dark",
	});
	page = await ctx.newPage();
	await page.goto("https://quantum.clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(2000);

	const mobileSmallTargets = await page.$$eval(
		'button, a, [role="button"]',
		(els) => {
			return els
				.filter((el) => {
					const rect = el.getBoundingClientRect();
					return (
						rect.width > 0 &&
						rect.height > 0 &&
						(rect.width < 44 || rect.height < 44)
					);
				})
				.map((el) => {
					const rect = el.getBoundingClientRect();
					return {
						text: (el.textContent || "").trim().substring(0, 30),
						width: Math.round(rect.width),
						height: Math.round(rect.height),
					};
				})
				.slice(0, 10);
		},
	);

	console.log("\n=== MOBILE TOUCH TARGETS < 44px ===");
	for (const t of mobileSmallTargets) {
		issues.push(`MOBILE SMALL: "${t.text}" — ${t.width}×${t.height}px`);
		console.log(`  ✗ "${t.text}" — ${t.width}×${t.height}px`);
	}

	console.log(`\n=== TOTAL ISSUES: ${issues.length} ===`);
	await browser.close();
	process.exit(issues.length > 0 ? 1 : 0);
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
