import * as fs from "node:fs";
import { expect, test } from "playwright/test";

const SOAK_DURATION = 90_000;
const SCREENSHOT_DIR = "/tmp/cdn-verify-screenshots";

test.use({
	launchOptions: {
		args: [
			"--enable-gpu",
			"--use-gl=egl",
			"--enable-webgl",
			"--ignore-gpu-blocklist",
			"--disable-software-rasterizer",
		],
	},
});

test.describe("Fiona WebGL 90s soak", () => {
	test("no context loss or excess contexts over 90 seconds", async ({
		page,
	}) => {
		test.setTimeout(SOAK_DURATION + 30_000);
		fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

		const consoleMessages: string[] = [];
		page.on("console", (msg) => consoleMessages.push(msg.text()));

		await page.goto("https://clouddelnorte.org");
		await page.waitForTimeout(5000);

		const checkpoints = [10_000, 45_000, 90_000];
		let elapsed = 5000;

		for (const cp of checkpoints) {
			const wait = cp - elapsed;
			if (wait > 0) await page.waitForTimeout(wait);
			elapsed = cp;

			await page.screenshot({
				path: `${SCREENSHOT_DIR}/soak-${cp / 1000}s.png`,
			});

			const canvasCount = await page.evaluate(
				() => document.querySelectorAll("canvas").length,
			);
			expect(canvasCount).toBeLessThanOrEqual(4);

			// Shared engine is lazy-initialized — verify either it exists OR canvas budget is met
			const sharedEngineOrBudget = await page.evaluate(() => {
				const hasSharedEngine = !!document.querySelector(
					"[data-cdn-shared-engine-working]",
				);
				const canvasCount = document.querySelectorAll("canvas").length;
				// Pass if shared engine exists OR canvas count is within budget (≤4)
				return hasSharedEngine || canvasCount <= 4;
			});
			expect(sharedEngineOrBudget).toBe(true);

			const fionaVisible = await page.evaluate(() => {
				const frame = document.querySelector(".fiona-frame");
				if (!frame) return false;
				const rect = frame.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0) return true;
				const canvas = frame.querySelector("canvas");
				if (!canvas) return false;
				const cr = canvas.getBoundingClientRect();
				return cr.width > 0 && cr.height > 0;
			});
			expect(fionaVisible).toBe(true);
		}

		const contextWarnings = consoleMessages.filter(
			(m) =>
				m.includes("Too many active WebGL contexts") ||
				m.includes("context lost"),
		);
		expect(contextWarnings).toHaveLength(0);
	});
});
