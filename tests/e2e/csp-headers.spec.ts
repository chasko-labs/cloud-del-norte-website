import { expect, test } from "playwright/test";

test.describe("CSP headers — no blocked resources", () => {
	test("awsug: no CSP violations on page load", async ({ page }) => {
		const violations: string[] = [];
		page.on("console", (msg) => {
			if (
				msg.type() === "error" &&
				msg.text().includes("Content Security Policy")
			) {
				violations.push(msg.text());
			}
		});

		await page.goto("https://awsug.clouddelnorte.org/index.html");
		await page.waitForTimeout(6000);

		expect(violations).toHaveLength(0);
	});

	test("awsug: liora-embed.js fetch is not blocked by CSP", async ({
		page,
	}) => {
		const blocked: string[] = [];
		page.on("requestfailed", (req) => {
			if (req.url().includes("liora-embed")) {
				blocked.push(`${req.failure()?.errorText ?? "unknown"}: ${req.url()}`);
			}
		});

		await page.goto("https://awsug.clouddelnorte.org/index.html");
		await page.waitForTimeout(6000);

		expect(blocked).toHaveLength(0);
	});

	test("awsug: response header contains expected script-src and connect-src origins", async ({
		page,
	}) => {
		const response = await page.goto(
			"https://awsug.clouddelnorte.org/index.html",
		);
		const csp = response?.headers()["content-security-policy"] ?? "";
		expect(csp).toContain("clouddelnorte.org");
		expect(csp).toContain("cognito-idp.us-west-2.amazonaws.com");
		expect(csp).toContain("execute-api.us-west-2.amazonaws.com");
	});

	test("main site: no CSP violations with persistent player and station skipping", async ({
		page,
	}) => {
		test.setTimeout(60_000);
		const violations: string[] = [];
		page.on("console", (msg) => {
			if (
				msg.type() === "error" &&
				msg.text().includes("Content Security Policy")
			) {
				violations.push(msg.text());
			}
		});

		await page.goto("https://clouddelnorte.org");
		await page.waitForTimeout(3000);

		// Click play (resume playback button)
		const playBtn = page.locator('[aria-label="resume playback"]');
		if (await playBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
			await playBtn.click();
			await page.waitForTimeout(3000);
		}

		// Skip through 3 stations
		const skipBtn = page.locator('[aria-label="next station"]');
		for (let i = 0; i < 3; i++) {
			await skipBtn.click();
			await page.waitForTimeout(3000);
		}

		expect(violations).toHaveLength(0);
	});

	test("main site: KEXP album art loads when KEXP is active", async ({
		page,
	}) => {
		test.setTimeout(90_000);
		const imgViolations: string[] = [];
		page.on("console", (msg) => {
			if (
				msg.type() === "error" &&
				msg.text().includes("Content Security Policy") &&
				msg.text().includes("img-src")
			) {
				imgViolations.push(msg.text());
			}
		});

		await page.goto("https://clouddelnorte.org");
		await page.waitForTimeout(3000);

		// Skip stations until KEXP art is visible
		const skipBtn = page.locator('[aria-label="next station"]');
		let foundKexp = false;
		for (let i = 0; i < 21; i++) {
			const visible = await page
				.locator(".cdn-pp__kexp-art")
				.isVisible()
				.catch(() => false);
			if (visible) {
				foundKexp = true;
				break;
			}
			await skipBtn.click();
			await page.waitForTimeout(2000);
		}

		if (foundKexp) {
			await page.waitForTimeout(4000);
			const naturalWidth = await page
				.locator(".cdn-pp__kexp-art")
				.evaluate((el: HTMLImageElement) => el.naturalWidth);
			expect(naturalWidth).toBeGreaterThan(0);
		}

		// Assert no img-src CSP violations (relevant to album art loading)
		expect(imgViolations).toHaveLength(0);
	});
});
