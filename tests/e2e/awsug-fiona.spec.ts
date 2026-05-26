import { expect, test } from "playwright/test";

// Skipped pending auth context for awsug subdomain.
//
// awsug.clouddelnorte.org redirects unauthenticated users to login (Cognito),
// so an unauthenticated Playwright run cannot reach the awsug landing page —
// every assertion here times out before the FionaFrame DOM is observable.
//
// Three ways to restore coverage (see #369 follow-up):
//   1. Wire a Playwright storageState with valid Cognito tokens, sourced from
//      SSM via Roles Anywhere (same pattern .woodpecker/device-farm.yml uses).
//   2. Re-target a public path on awsug if/when one exists.
//   3. Port these assertions into the Device Farm pytest suite under
//      tests/device-farm/, where auth context is already wired.
//
// Until then, leaving these tests live causes spurious local-run failures
// (the e2e suite is not invoked by any Woodpecker pipeline today, so no CI
// regression — just developer noise).
//
// TODO(#369): restore awsug FionaFrame e2e coverage with auth context.
test.describe
	.skip("awsug — FionaFrame mounts (skipped: auth context required, refs #369)", () => {
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
