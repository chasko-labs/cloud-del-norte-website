import { expect, test } from "playwright/test";

test.describe("/learning/ redirect", () => {
	test("bare /learning/ redirects to /learning/api/index.html", async ({
		page,
	}) => {
		await page.goto("https://clouddelnorte.org/learning/index.html");
		await page.waitForURL("**/learning/api/index.html", { timeout: 5_000 });
		expect(page.url()).toContain("/learning/api/index.html");
	});

	test("/learning/api/index.html renders content with at least one heading", async ({
		page,
	}) => {
		await page.goto("https://clouddelnorte.org/learning/api/index.html");
		const heading = page.getByRole("heading").first();
		await expect(heading).toBeVisible({ timeout: 8_000 });
	});

	test("/learning/api/index.html visual baseline", async ({ page }) => {
		await page.goto("https://clouddelnorte.org/learning/api/index.html");
		await page.getByRole("main").waitFor({ state: "visible" });
		await page.waitForLoadState("networkidle");
		await expect(page).toHaveScreenshot("learning-api-page.png", {
			maxDiffPixelRatio: 0.02,
		});
	});
});
