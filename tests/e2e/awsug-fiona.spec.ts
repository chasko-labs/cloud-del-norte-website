import { expect, test } from "playwright/test";

test.describe("awsug — FionaFrame mounts", () => {
	test("liora-embed.js is requested from clouddelnorte.org", async ({
		page,
	}) => {
		const embedRequest = page.waitForRequest(
			(req) =>
				req.url().includes("clouddelnorte.org/liora-embed/liora-embed.js"),
			{ timeout: 10_000 },
		);

		await page.goto("https://awsug.clouddelnorte.org/index.html");
		await embedRequest;
	});

	test("liora canvas element is present in the DOM", async ({ page }) => {
		await page.goto("https://awsug.clouddelnorte.org/index.html");
		const canvas = page.locator("#liora-canvas");
		await expect(canvas).toBeAttached({ timeout: 10_000 });
	});

	test("liora bezel visual baseline", async ({ page }) => {
		await page.goto("https://awsug.clouddelnorte.org/index.html");
		await page.locator(".liora-bezel").waitFor({ state: "visible" });
		await expect(page.locator(".liora-bezel")).toHaveScreenshot(
			"awsug-liora-bezel.png",
		);
	});
});
