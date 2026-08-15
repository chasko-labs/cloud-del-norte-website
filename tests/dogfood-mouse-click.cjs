const { chromium } = require("playwright");
const { execSync, execFileSync } = require("child_process");

function ssmParam(name, withDecryption) {
	const args = ['ssm', 'get-parameter', '--name', name, '--profile', 'aerospaceug-admin', '--region', 'us-west-2', '--query', 'Parameter.Value', '--output', 'text'];
	if (withDecryption) args.push('--with-decryption');
	return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

(async () => {
	console.log("=== PROVE JOIN — REAL MOUSE CLICK ===\n");

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

	// Ensure meeting is live
	const status = JSON.parse(
		execSync(
			`curl -s "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/meetings/status"`,
			{ encoding: "utf8" },
		),
	);
	if (!status.live) {
		execSync(
			`curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/launch" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"title":"Mouse Click Test","roomName":"cloud-del-norte-awsug"}'`,
		);
	}
	console.log("Meeting live ✓");

	const browser = await chromium.launch({
		headless: true,
		args: [
			"--use-fake-device-for-media-stream",
			"--use-fake-ui-for-media-stream",
			"--disable-web-security",
		],
	});
	const ctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
		permissions: ["microphone", "camera"],
	});
	const page = await ctx.newPage();

	await page.goto("https://quantum.clouddelnorte.org/dashboard/", {
		waitUntil: "networkidle",
		timeout: 30000,
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

	// Click our Join button
	console.log("1. Click dashboard Join...");
	await page.locator("button").filter({ hasText: /Join/ }).first().click();
	await page.waitForTimeout(12000);

	// Get the actual frame object (not frameLocator)
	console.log("\n2. Finding Jitsi frame...");
	const jitsiFrame = page
		.frames()
		.find((f) => f.url().includes("meet.clouddelnorte"));
	if (!jitsiFrame) {
		console.log("   ✗ No Jitsi frame found");
		await page.screenshot({
			path: "docs/walkthrough/prove-no-frame.png",
			fullPage: true,
		});
		process.exit(1);
	}
	console.log(`   Frame: ${jitsiFrame.url().substring(0, 60)}...`);

	// Wait for the pre-join button to be ready
	console.log("\n3. Waiting for pre-join button...");
	try {
		await jitsiFrame.waitForSelector('[data-testid="prejoin.joinMeeting"]', {
			timeout: 15000,
		});
		console.log("   Button found ✓");

		// Use frame.click() which does REAL mouse events
		console.log("   Performing REAL click (mouse down + up)...");
		await jitsiFrame.click('[data-testid="prejoin.joinMeeting"]');
		console.log("   Click executed ✓");
	} catch (e) {
		console.log(`   Error: ${e.message.substring(0, 100)}`);
		// Try alternate selector
		try {
			await jitsiFrame.click("button >> text=Join", { timeout: 5000 });
			console.log("   Alt click executed ✓");
		} catch (e2) {
			console.log(`   Alt also failed: ${e2.message.substring(0, 60)}`);
		}
	}

	// Wait for conference (XMPP connect takes time)
	console.log("\n4. Waiting 20s for conference...");
	await page.waitForTimeout(20000);

	// Screenshot
	await page.screenshot({
		path: "docs/walkthrough/prove-join-mouse.png",
		fullPage: true,
	});

	// Check if we're past the lobby
	console.log("\n5. Checking state...");
	try {
		const newFrame = page
			.frames()
			.find((f) => f.url().includes("meet.clouddelnorte"));
		if (newFrame) {
			const hasPrejoin = await newFrame.$(
				'[data-testid="prejoin.joinMeeting"]',
			);
			const hasFilmstrip = await newFrame.$(
				'[id="filmstrip"], [class*="filmstrip"]',
			);
			const hasHangup = await newFrame.$(
				'[aria-label="Leave"], [aria-label="Hangup"], [class*="hangup"]',
			);
			console.log(`   Pre-join button still there: ${!!hasPrejoin}`);
			console.log(`   Filmstrip (in conference): ${!!hasFilmstrip}`);
			console.log(`   Hangup button: ${!!hasHangup}`);

			if (!hasPrejoin && (hasFilmstrip || hasHangup)) {
				console.log("\n   ✓✓✓ IN THE CONFERENCE");
			} else if (hasPrejoin) {
				console.log("\n   ✗ STILL IN LOBBY — click didn't work");
			}
		}
	} catch (e) {
		console.log(`   Frame check error: ${e.message.substring(0, 60)}`);
	}

	// Upload
	execSync(
		`aws s3 cp docs/walkthrough/prove-join-mouse.png s3://dev.clouddelnorte.org/_previews/dogfood/prove-join-mouse.png --content-type "image/png" --profile aerospaceug-admin`,
	);
	console.log(
		"\n   https://dev.clouddelnorte.org/_previews/dogfood/prove-join-mouse.png",
	);

	// End
	execSync(
		`curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/end" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"roomName":"cloud-del-norte-awsug"}'`,
	);
	console.log("\nMeeting ended ✓");
	await browser.close();
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
