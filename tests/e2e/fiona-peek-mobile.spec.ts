import { expect, test } from "playwright/test";

test.describe("Fiona peek-out — mobile collapsed drawer", () => {
	test.use({ viewport: { width: 412, height: 915 } });

	test("peek badge visible in collapsed state without opening drawer", async ({
		page,
	}) => {
		await page.goto("https://clouddelnorte.org/");
		await page.waitForLoadState("networkidle");

		// Drawer must be closed — do NOT click the hamburger
		const mobileBar = page.locator("[class*='awsui_mobile-bar']");
		await expect(mobileBar).toBeVisible();

		// Screenshot baseline — captures the peek badge in collapsed state
		await expect(page).toHaveScreenshot("fiona-peek-pixel9.png", {
			clip: { x: 0, y: 0, width: 412, height: 60 },
		});
	});
});
