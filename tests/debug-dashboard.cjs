const { chromium } = require("playwright");
const { execSync, execFileSync } = require("child_process");

function ssmParam(name, withDecryption) {
	const args = ['ssm', 'get-parameter', '--name', name, '--profile', 'aerospaceug-admin', '--region', 'us-west-2', '--query', 'Parameter.Value', '--output', 'text'];
	if (withDecryption) args.push('--with-decryption');
	return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

(async () => {
	const CDN_TEST_USERNAME = ssmParam('/device-farm/test-users/admin-username', false);
	const CDN_TEST_PASSWORD = ssmParam('/device-farm/test-users/admin-password', true);

	const modAuth = JSON.parse(execFileSync('aws', [
		'cognito-idp', 'initiate-auth',
		'--auth-flow', 'USER_PASSWORD_AUTH',
		'--client-id', '57eikmt418ea6vti2f6h0pl74r',
		'--auth-parameters', `USERNAME=${CDN_TEST_USERNAME},PASSWORD=${CDN_TEST_PASSWORD}`,
		'--profile', 'jitsi-video-hosting',
		'--region', 'us-west-2',
		'--query', 'AuthenticationResult.{IdToken:IdToken,AccessToken:AccessToken,RefreshToken:RefreshToken}',
		'--output', 'json'
	], { encoding: 'utf8' }));

	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
	});
	const page = await ctx.newPage();
	const errors = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text().substring(0, 100));
	});

	await page.goto("https://quantum.clouddelnorte.org/dashboard/", {
		waitUntil: "networkidle",
		timeout: 20000,
	});
	await page.evaluate((t) => {
		sessionStorage.setItem("cdn.idToken", t.IdToken);
		sessionStorage.setItem("cdn.accessToken", t.AccessToken);
		if (t.RefreshToken)
			sessionStorage.setItem("cdn.refreshToken", t.RefreshToken);
		const p = JSON.parse(
			atob(t.IdToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
		);
		if (p.exp) sessionStorage.setItem("cdn.expiresAt", String(p.exp * 1000));
	}, modAuth);
	await page.reload({ waitUntil: "networkidle" });
	await page.waitForTimeout(8000);

	// Check meeting status API directly
	const statusResp = execSync(
		`curl -s "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/meetings/status"`,
		{ encoding: "utf8" },
	);
	console.log("API status:", statusResp);

	// Check what the page shows
	const body = await page.locator("body").textContent();
	console.log("\nPage text (first 600):", body.substring(0, 600));

	// Check for buttons
	const buttons = await page.$$eval("button", (els) =>
		els
			.map((e) => ({
				text: e.textContent.trim().substring(0, 30),
				visible: e.offsetWidth > 0,
			}))
			.filter((b) => b.visible),
	);
	console.log(
		"\nVisible buttons:",
		buttons.map((b) => b.text),
	);

	// Check for "Join" anywhere
	const hasJoin = body.includes("Join");
	const hasSession =
		body.includes("SESSION IN PROGRESS") || body.includes("session");
	console.log('\nContains "Join":', hasJoin);
	console.log("Contains SESSION:", hasSession);
	console.log("Console errors:", errors.slice(0, 5));

	await page.screenshot({ path: "/tmp/debug-dashboard.png", fullPage: true });
	await browser.close();
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
