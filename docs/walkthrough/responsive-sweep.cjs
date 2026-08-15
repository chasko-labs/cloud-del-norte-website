const { chromium } = require("playwright");

const VIEWPORTS = [
	{ name: "desktop", width: 1280, height: 800 },
	{ name: "tablet", width: 768, height: 1024 },
	{ name: "mobile", width: 375, height: 812 },
];

const PAGES = [
	{ url: "https://clouddelnorte.org/", label: "landing" },
	{
		url: "https://clouddelnorte.org/meetings/index.html",
		label: "meetings (auth gate)",
	},
	{
		url: "https://clouddelnorte.org/learning/api/index.html",
		label: "learning/api",
	},
	{ url: "https://clouddelnorte.org/theme/index.html", label: "theme preview" },
];

const issues = [];

function issue(viewport, page, check, detail) {
	const msg = `[${viewport}] ${page} — ${check}: ${detail}`;
	issues.push(msg);
	console.log("  ⚠️ " + msg);
}

(async () => {
	const browser = await chromium.launch({ headless: true });

	for (const vp of VIEWPORTS) {
		console.log(`\n=== VIEWPORT: ${vp.name} (${vp.width}x${vp.height}) ===`);

		const ctx = await browser.newContext({
			viewport: { width: vp.width, height: vp.height },
			colorScheme: "dark",
		});
		const page = await ctx.newPage();

		for (const target of PAGES) {
			console.log(`\n  Page: ${target.label} — ${target.url}`);

			try {
				const resp = await page.goto(target.url, {
					waitUntil: "domcontentloaded",
					timeout: 20000,
				});
				if (!resp || resp.status() >= 400) {
					issue(
						vp.name,
						target.label,
						"HTTP",
						`status ${resp ? resp.status() : "null"}`,
					);
					continue;
				}
				// wait for rendering
				await page.waitForTimeout(2000);
			} catch (err) {
				issue(vp.name, target.label, "LOAD", err.message.slice(0, 120));
				continue;
			}

			// 1. Horizontal overflow check
			const hasOverflow = await page.evaluate(() => {
				return (
					document.documentElement.scrollWidth >
					document.documentElement.clientWidth
				);
			});
			if (hasOverflow) {
				const scrollW = await page.evaluate(
					() => document.documentElement.scrollWidth,
				);
				const clientW = await page.evaluate(
					() => document.documentElement.clientWidth,
				);
				issue(
					vp.name,
					target.label,
					"HORIZONTAL_OVERFLOW",
					`scrollWidth=${scrollW} > clientWidth=${clientW}`,
				);
			} else {
				console.log("    ✓ No horizontal overflow");
			}

			// 2. Text clipping — check for elements with overflow:hidden + text that overflows
			const clippedEls = await page.evaluate(() => {
				const results = [];
				const els = document.querySelectorAll(
					'h1, h2, h3, p, span, a, button, [class*="header"], [class*="title"]',
				);
				for (const el of els) {
					const style = getComputedStyle(el);
					if (
						style.overflow === "hidden" &&
						style.textOverflow !== "ellipsis"
					) {
						if (
							el.scrollWidth > el.clientWidth + 2 ||
							el.scrollHeight > el.clientHeight + 2
						) {
							const text = el.textContent.trim().slice(0, 60);
							if (text.length > 3) {
								results.push({
									tag: el.tagName,
									text,
									sw: el.scrollWidth,
									cw: el.clientWidth,
								});
							}
						}
					}
				}
				return results.slice(0, 5);
			});
			if (clippedEls.length > 0) {
				for (const el of clippedEls) {
					issue(
						vp.name,
						target.label,
						"TEXT_CLIP",
						`<${el.tag}> "${el.text}" scroll=${el.sw} client=${el.cw}`,
					);
				}
			} else {
				console.log("    ✓ No text clipping detected");
			}

			// 3. Navigation usability
			const navCheck = await page.evaluate(() => {
				const navLinks = document.querySelectorAll(
					'nav a, [class*="navigation"] a, [class*="nav"] a, header a',
				);
				if (navLinks.length === 0)
					return { ok: false, reason: "no nav links found" };
				let hiddenCount = 0;
				for (const link of navLinks) {
					const rect = link.getBoundingClientRect();
					const style = getComputedStyle(link);
					if (
						rect.width === 0 ||
						rect.height === 0 ||
						style.display === "none" ||
						style.visibility === "hidden"
					) {
						hiddenCount++;
					}
				}
				return { ok: true, total: navLinks.length, hidden: hiddenCount };
			});
			if (!navCheck.ok) {
				issue(vp.name, target.label, "NAV", navCheck.reason);
			} else if (navCheck.hidden > navCheck.total / 2) {
				issue(
					vp.name,
					target.label,
					"NAV",
					`${navCheck.hidden}/${navCheck.total} nav links hidden/zero-size`,
				);
			} else {
				console.log(
					`    ✓ Navigation: ${navCheck.total - navCheck.hidden}/${navCheck.total} links visible`,
				);
			}

			// 4. Card/container overlap check
			const overlaps = await page.evaluate(() => {
				const cards = document.querySelectorAll(
					'[class*="card"], [class*="container"], [class*="box"], [class*="panel"]',
				);
				const rects = [];
				for (const card of cards) {
					const r = card.getBoundingClientRect();
					if (r.width > 10 && r.height > 10) {
						rects.push({
							top: r.top,
							left: r.left,
							bottom: r.bottom,
							right: r.right,
							tag: card.tagName,
							cls: (card.className || "").toString().slice(0, 40),
						});
					}
				}
				const found = [];
				for (let i = 0; i < rects.length && found.length < 3; i++) {
					for (let j = i + 1; j < rects.length && found.length < 3; j++) {
						const a = rects[i],
							b = rects[j];
						// skip if one contains the other (parent/child)
						if (
							a.top <= b.top &&
							a.left <= b.left &&
							a.bottom >= b.bottom &&
							a.right >= b.right
						)
							continue;
						if (
							b.top <= a.top &&
							b.left <= a.left &&
							b.bottom >= a.bottom &&
							b.right >= a.right
						)
							continue;
						// check actual overlap
						const overlapX = Math.max(
							0,
							Math.min(a.right, b.right) - Math.max(a.left, b.left),
						);
						const overlapY = Math.max(
							0,
							Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
						);
						if (overlapX > 20 && overlapY > 20) {
							found.push(
								`${a.cls} overlaps ${b.cls} by ${overlapX.toFixed(0)}x${overlapY.toFixed(0)}px`,
							);
						}
					}
				}
				return found;
			});
			if (overlaps.length > 0) {
				for (const o of overlaps) {
					issue(vp.name, target.label, "OVERLAP", o);
				}
			} else {
				console.log("    ✓ No card/container overlaps");
			}

			// 5. Footer full-width check
			const footerCheck = await page.evaluate(() => {
				const footer = document.querySelector('footer, [class*="footer"]');
				if (!footer) return { exists: false };
				const rect = footer.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				return {
					exists: true,
					width: rect.width,
					viewportWidth,
					full: rect.width >= viewportWidth - 2,
				};
			});
			if (!footerCheck.exists) {
				console.log(
					"    — No footer element found (may be expected for auth gate)",
				);
			} else if (!footerCheck.full) {
				issue(
					vp.name,
					target.label,
					"FOOTER_WIDTH",
					`footer=${footerCheck.width}px viewport=${footerCheck.viewportWidth}px`,
				);
			} else {
				console.log("    ✓ Footer spans full width");
			}

			// 6. Featured event card readability (landing only)
			if (target.label === "landing") {
				const eventCard = await page.evaluate(() => {
					const cards = document.querySelectorAll(
						'[class*="event"], [class*="featured"], [class*="meetup"], [class*="next-event"]',
					);
					if (cards.length === 0) return { found: false };
					const card = cards[0];
					const rect = card.getBoundingClientRect();
					const style = getComputedStyle(card);
					const text = card.textContent.trim().slice(0, 100);
					return {
						found: true,
						visible: rect.width > 50 && rect.height > 30,
						clipped: card.scrollHeight > card.clientHeight + 5,
						text,
						height: rect.height,
					};
				});
				if (!eventCard.found) {
					console.log("    — No featured event card found");
				} else if (!eventCard.visible) {
					issue(
						vp.name,
						target.label,
						"EVENT_CARD",
						"not visible or too small",
					);
				} else if (eventCard.clipped) {
					issue(
						vp.name,
						target.label,
						"EVENT_CARD",
						`content clipped (height=${eventCard.height}px)`,
					);
				} else {
					console.log(
						`    ✓ Featured event card readable (h=${eventCard.height.toFixed(0)}px)`,
					);
				}

				// 7. Fiona opt-in prompt readability
				const fionaCheck = await page.evaluate(() => {
					const els = document.querySelectorAll(
						'[class*="fiona"], [class*="opt-in"], [class*="avatar"], [class*="host"]',
					);
					if (els.length === 0) {
						// try text search
						const allText = document.body.innerText;
						if (allText.includes("Fiona") || allText.includes("fiona")) {
							return { found: true, method: "text", clipped: false };
						}
						return { found: false };
					}
					const el = els[0];
					const rect = el.getBoundingClientRect();
					return {
						found: true,
						method: "selector",
						visible: rect.width > 20 && rect.height > 20,
						clipped:
							el.scrollHeight > el.clientHeight + 5 ||
							el.scrollWidth > el.clientWidth + 5,
						inViewport: rect.top < window.innerHeight && rect.bottom > 0,
						height: rect.height,
					};
				});
				if (!fionaCheck.found) {
					console.log("    — No Fiona opt-in prompt found on page");
				} else if (fionaCheck.method === "text") {
					console.log("    ✓ Fiona reference found in page text");
				} else if (!fionaCheck.visible) {
					issue(
						vp.name,
						target.label,
						"FIONA_PROMPT",
						"element exists but not visible",
					);
				} else if (fionaCheck.clipped) {
					issue(
						vp.name,
						target.label,
						"FIONA_PROMPT",
						`content clipped (h=${fionaCheck.height}px)`,
					);
				} else {
					console.log(`    ✓ Fiona opt-in prompt readable`);
				}
			}

			// Screenshot for evidence
			const screenshotPath = `docs/walkthrough/responsive-${vp.name}-${target.label.replace(/[^a-z0-9]/g, "-")}.png`;
			await page.screenshot({ path: screenshotPath, fullPage: true });
			console.log(`    📸 ${screenshotPath}`);
		}

		await ctx.close();
	}

	await browser.close();

	// Summary
	console.log("\n\n=== RESPONSIVE SWEEP SUMMARY ===");
	console.log(`Total issues: ${issues.length}`);
	if (issues.length === 0) {
		console.log("✅ No responsiveness or readability issues detected");
	} else {
		console.log("\nIssues found:");
		for (const i of issues) {
			console.log("  • " + i);
		}
	}
	process.exit(issues.length > 0 ? 1 : 0);
})();
