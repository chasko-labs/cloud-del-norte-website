import { expect, test } from "playwright/test";

test.describe("/learning/ redirect", () => {
	test("bare /learning/ redirects to /learning/api/index.html", async ({
		page,
	}) => {
		await page.goto("https://clouddelnorte.org/learning/index.html");
		await page.waitForURL("**/learning/api/index.html", { timeout: 5_000 });
		expect(page.url()).toContain("/learning/api/index.html");
	});

	test("/learning/api/index.html renders a page heading", async ({ page }) => {
		await page.goto("https://clouddelnorte.org/learning/api/index.html");
		const heading = page.getByRole("heading", { level: 1 });
		await expect(heading).toBeVisible({ timeout: 8_000 });
	});

	test("/learning/api/index.html visual baseline", async ({ page }) => {
		await page.goto("https://clouddelnorte.org/learning/api/index.html");
		await page
			.locator("[class*='awsui_content-layout']")
			.waitFor({ state: "visible" });
		await expect(page).toHaveScreenshot("learning-api-page.png");
	});
});
