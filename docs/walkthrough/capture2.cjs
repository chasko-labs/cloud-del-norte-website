const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const OUT =
	"/home/bryanchasko/code/websites/cloud-del-norte-website/docs/walkthrough";

function ssmParam(name, withDecryption) {
	const args = ['ssm', 'get-parameter', '--name', name, '--profile', 'aerospaceug-admin', '--region', 'us-west-2', '--query', 'Parameter.Value', '--output', 'text'];
	if (withDecryption) args.push('--with-decryption');
	return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

(async () => {
	const CDN_MEMBER_USERNAME = ssmParam('/device-farm/test-users/member-username', false);
	const CDN_MEMBER_PASSWORD = ssmParam('/device-farm/test-users/member-password', true);

	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
	});
	const page = await ctx.newPage();

	console.log("5. Login page...");
	await page.goto("https://auth.clouddelnorte.org/login/index.html", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(2000);
	await page.screenshot({ path: `${OUT}/05-login.png`, fullPage: true });
	console.log("   done");

	console.log("6. Fill login...");
	await page
		.locator('input[type="email"]')
		.fill(CDN_MEMBER_USERNAME);
	await page
		.locator('input[type="password"]')
		.fill(CDN_MEMBER_PASSWORD);
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${OUT}/06-login-filled.png`, fullPage: true });
	console.log("   done");

	console.log("7. Submit login...");
	await page.locator("button", { hasText: "Sign in" }).first().click();
	await page.waitForTimeout(10000);
	await page.screenshot({ path: `${OUT}/07-post-login.png`, fullPage: true });
	console.log("   url:", page.url());

	console.log("8. Meetings...");
	await page.goto("https://awsug.clouddelnorte.org/meetings/index.html", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(3000);
	await page.screenshot({ path: `${OUT}/08-meetings.png`, fullPage: true });
	console.log("   done");

	console.log("9. Feed...");
	await page.goto("https://clouddelnorte.org/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.waitForTimeout(3000);
	await page.screenshot({ path: `${OUT}/09-feed.png`, fullPage: false });
	console.log("   done");

	await browser.close();
	console.log("BATCH 2 DONE");
})().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
