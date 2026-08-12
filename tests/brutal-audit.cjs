const { chromium } = require("playwright");

(async () => {
	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
	});
	const page = await ctx.newPage();
	const issues = [];
	const consoleErrors = [];
	page.on("console", (msg) => {
		if (msg.type() === "error")
			consoleErrors.push(
				`${msg.location().url}:${msg.location().lineNumber} ${msg.text()}`,
			);
	});
	page.on("pageerror", (err) =>
		consoleErrors.push(`PAGEERROR: ${err.message}`),
	);

	const PAGES = [
		{ url: "https://quantum.clouddelnorte.org/", name: "landing" },
		{ url: "https://quantum.clouddelnorte.org/register/", name: "register" },
		{ url: "https://quantum.clouddelnorte.org/dashboard/", name: "dashboard" },
	];

	for (const { url, name } of PAGES) {
		console.log(`\n=== ${name.toUpperCase()} ===`);
		await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
		await page.waitForTimeout(2000);

		// 1. Broken links
		const links = await page.$$eval("a[href]", (els) =>
			els.map((e) => ({
				href: e.href,
				text: (e.textContent || "").trim().substring(0, 50),
				visible: e.offsetWidth > 0,
			})),
		);
		for (const link of links) {
			if (
				!link.href.startsWith("http") ||
				link.href.includes("calendar.google") ||
				link.href.includes("outlook.live") ||
				link.href.includes("yahoo.com")
			)
				continue;
			try {
				const resp = await page.request.head(link.href, { timeout: 8000 });
				if (resp.status() >= 400) {
					issues.push(
						`[${name}] BROKEN LINK: "${link.text}" → ${link.href} (${resp.status()})`,
					);
				}
			} catch (e) {
				issues.push(
					`[${name}] UNREACHABLE: "${link.text}" → ${link.href} (${e.message.substring(0, 60)})`,
				);
			}
		}

		// 2. Broken images
		const imgs = await page.$$("img");
		for (const img of imgs) {
			const [complete, src] = await img.evaluate((el) => [
				el.complete && el.naturalWidth > 0,
				el.src,
			]);
			if (!complete) issues.push(`[${name}] BROKEN IMAGE: ${src}`);
		}

		// 3. Text contrast / readability — find any text < 12px
		const tinyText = await page.$$eval("*", (els) => {
			const tiny = [];
			for (const el of els) {
				if (el.children.length > 0) continue;
				const text = (el.textContent || "").trim();
				if (!text || text.length < 2) continue;
				const cs = getComputedStyle(el);
				const size = parseFloat(cs.fontSize);
				if (size < 12 && el.offsetWidth > 0 && el.offsetHeight > 0) {
					tiny.push({
						text: text.substring(0, 30),
						size: Math.round(size * 10) / 10,
						tag: el.tagName,
					});
				}
			}
			return tiny.slice(0, 5);
		});
		for (const t of tinyText)
			issues.push(`[${name}] TINY TEXT (${t.size}px): "${t.text}" <${t.tag}>`);

		// 4. Overflow — any element wider than viewport
		const overflow = await page.evaluate(() => {
			const overflows = [];
			document.querySelectorAll("*").forEach((el) => {
				const rect = el.getBoundingClientRect();
				if (rect.right > window.innerWidth + 2 && el.offsetWidth > 0) {
					overflows.push({
						tag: el.tagName,
						class: el.className.substring(0, 40),
						overflow: Math.round(rect.right - window.innerWidth),
					});
				}
			});
			return overflows.slice(0, 3);
		});
		for (const o of overflow)
			issues.push(`[${name}] OVERFLOW ${o.overflow}px: <${o.tag}> .${o.class}`);

		// 5. Empty interactive elements (buttons/links with no text or aria-label)
		const emptyInteractive = await page.$$eval("button, a", (els) => {
			return els
				.filter((el) => {
					const text = (el.textContent || "").trim();
					const aria = el.getAttribute("aria-label") || "";
					return !text && !aria && el.offsetWidth > 0;
				})
				.map((el) => ({
					tag: el.tagName,
					href: el.getAttribute("href")?.substring(0, 40) || "",
					class: el.className.substring(0, 30),
				}));
		});
		for (const e of emptyInteractive)
			issues.push(
				`[${name}] EMPTY INTERACTIVE: <${e.tag}> .${e.class} href=${e.href}`,
			);

		// 6. Stale/wrong content
		const body = await page.locator("body").textContent();
		if (body.includes("free") || body.includes("Free") || body.includes("FREE"))
			issues.push(`[${name}] CONTAINS "free"`);
		if (body.includes("Dismiss welcome"))
			issues.push(`[${name}] CONTAINS "Dismiss welcome"`);
		if (body.includes("No account needed"))
			issues.push(`[${name}] CONTAINS "No account needed"`);
		if (body.includes("full access"))
			issues.push(`[${name}] CONTAINS "full access"`);
		if (body.includes("sign in for full"))
			issues.push(`[${name}] CONTAINS "sign in for full"`);
		if (body.includes("not just watching"))
			issues.push(`[${name}] CONTAINS "not just watching"`);
		if (body.includes("Sign in") && !body.includes("sign in"))
			issues.push(`[${name}] CAPITALIZED "Sign in" (should be lowercase)`);
	}

	// 7. Mobile check
	console.log("\n=== MOBILE 375px ===");
	await page.setViewportSize({ width: 375, height: 812 });
	for (const { url, name } of PAGES) {
		await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
		await page.waitForTimeout(1500);
		const hScroll = await page.evaluate(
			() =>
				document.documentElement.scrollWidth >
				document.documentElement.clientWidth,
		);
		if (hScroll) issues.push(`[${name}] MOBILE OVERFLOW`);
	}

	// Report
	console.log("\n\n========================================");
	console.log("BRUTAL AUDIT RESULTS");
	console.log("========================================");
	if (consoleErrors.length > 0) {
		console.log(`\nCONSOLE ERRORS (${consoleErrors.length}):`);
		for (const e of consoleErrors.slice(0, 10))
			console.log(`  ✗ ${e.substring(0, 120)}`);
	}
	if (issues.length === 0) {
		console.log("\nZERO ISSUES. Site is clean.");
	} else {
		console.log(`\n${issues.length} ISSUES FOUND:`);
		for (const i of issues) console.log(`  ✗ ${i}`);
	}
	console.log("\n========================================");

	await browser.close();
	process.exit(issues.length > 0 ? 1 : 0);
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
