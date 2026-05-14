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
});
