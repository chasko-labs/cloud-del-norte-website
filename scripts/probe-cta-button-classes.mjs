import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({
	viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();

await page.goto(`https://clouddelnorte.org/?_cb=${Date.now()}`, {
	waitUntil: "domcontentloaded",
});
await page.waitForTimeout(3500);

const result = await page.evaluate(() => {
	const btn = Array.from(document.querySelectorAll("button")).find((el) =>
		/propose a talk/i.test(el.textContent ?? ""),
	);
	if (!btn) return { error: "button not found" };

	const ancestors = [];
	let node = btn.parentElement;
	for (let i = 0; i < 6 && node; i++) {
		ancestors.push({ tag: node.tagName, className: node.className });
		node = node.parentElement;
	}

	const cs = getComputedStyle(btn);
	return {
		buttonClassName: btn.className,
		parentClassName: btn.parentElement?.className ?? null,
		grandparentClassName: btn.parentElement?.parentElement?.className ?? null,
		computedBackgroundColor: cs.backgroundColor,
		computedBackgroundImage: cs.backgroundImage,
		ancestors,
	};
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
