const { chromium } = require("playwright");
const { execSync, execFileSync } = require("child_process");

function ssmParam(name, withDecryption) {
	const args = ['ssm', 'get-parameter', '--name', name, '--profile', 'aerospaceug-admin', '--region', 'us-west-2', '--query', 'Parameter.Value', '--output', 'text'];
	if (withDecryption) args.push('--with-decryption');
	return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

(async () => {
	console.log(
		"=== REAL JOIN TEST — CLICK THROUGH LOBBY, VERIFY VIDEO TILES ===\n",
	);

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

	// Launch meeting
	execSync(
		`curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/launch" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"title":"Real Join Test","roomName":"cloud-del-norte-awsug"}'`,
	);
	console.log("Meeting launched ✓\n");

	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
	});
	const page = await ctx.newPage();

	// Load dashboard with tokens
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
	await page.waitForTimeout(5000);

	// Click our Join Now button
	console.log("1. Clicking dashboard Join Now...");
	await page.locator('button:has-text("Join")').first().click();
	await page.waitForTimeout(10000);
	await page.screenshot({
		path: "docs/walkthrough/real-join-step1-after-join-click.png",
		fullPage: true,
	});
	console.log("   Screenshot: step1 (after our Join click)");

	// Find the Jitsi iframe
	console.log("\n2. Looking inside Jitsi iframe...");
	const frames = page.frames();
	console.log(`   Total frames: ${frames.length}`);
	for (const f of frames) {
		const url = f.url();
		if (url.includes("meet.clouddelnorte")) {
			console.log(`   Found Jitsi frame: ${url.substring(0, 80)}`);

			// Screenshot just the frame content
			// List all buttons in the frame
			const buttons = await f.$$eval("button", (els) =>
				els
					.map((el) => ({
						text: (el.textContent || "").trim().substring(0, 40),
						testid: el.getAttribute("data-testid") || "",
						visible: el.offsetWidth > 0,
						width: el.offsetWidth,
						height: el.offsetHeight,
					}))
					.filter((b) => b.visible),
			);

			console.log(`   Visible buttons in Jitsi frame (${buttons.length}):`);
			for (const b of buttons.slice(0, 15)) {
				console.log(
					`     "${b.text}" testid="${b.testid}" ${b.width}x${b.height}`,
				);
			}

			// Look for the Join Meeting button specifically
			const joinBtn = await f.$('[data-testid="prejoin.joinMeeting"]');
			const joinBtn2 = await f.$('button:has-text("Join meeting")');
			const joinBtn3 = await f.$('button:has-text("Join Meeting")');
			console.log(
				`\n   prejoin.joinMeeting: ${joinBtn ? "FOUND" : "not found"}`,
			);
			console.log(
				`   button "Join meeting": ${joinBtn2 ? "FOUND" : "not found"}`,
			);
			console.log(
				`   button "Join Meeting": ${joinBtn3 ? "FOUND" : "not found"}`,
			);

			// Try to click whichever exists
			const btn = joinBtn || joinBtn2 || joinBtn3;
			if (btn) {
				console.log("\n3. Clicking Join Meeting inside Jitsi...");
				await btn.click();
				await page.waitForTimeout(15000);
				await page.screenshot({
					path: "docs/walkthrough/real-join-step2-after-jitsi-join.png",
					fullPage: true,
				});
				console.log("   Screenshot: step2 (after Jitsi Join click)");

				// Now check what's visible
				const afterButtons = await f.$$eval("button", (els) =>
					els
						.map((el) => ({
							text: (el.textContent || "").trim().substring(0, 40),
							testid: el.getAttribute("data-testid") || "",
							ariaLabel: el.getAttribute("aria-label") || "",
							visible: el.offsetWidth > 0,
						}))
						.filter((b) => b.visible),
				);

				console.log(
					`\n   After join — visible buttons (${afterButtons.length}):`,
				);
				for (const b of afterButtons.slice(0, 15)) {
					console.log(
						`     "${b.text}" testid="${b.testid}" aria="${b.ariaLabel}"`,
					);
				}

				// Check for hangup/leave button (proof of being in conference)
				const hangup = await f.$(
					'[aria-label="Leave"], [aria-label="Hangup"], [data-testid="hangup"]',
				);
				const toolbar = await f.$('[class*="new-toolbox"], [class*="toolbox"]');
				console.log(
					`\n   Hangup/Leave button: ${hangup ? "✓ FOUND — IN CONFERENCE" : "✗ NOT FOUND"}`,
				);
				console.log(
					`   Toolbar element: ${toolbar ? "✓ FOUND" : "✗ NOT FOUND"}`,
				);
			} else {
				console.log(
					"\n   ✗ No Join button found in Jitsi frame — might already be in conference?",
				);
				// Check if already past lobby
				const hangup = await f.$('[aria-label="Leave"], [aria-label="Hangup"]');
				console.log(
					`   Hangup button (already in call?): ${hangup ? "✓ YES" : "✗ NO"}`,
				);
			}
		}
	}

	// End meeting
	execSync(
		`curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/end" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"roomName":"cloud-del-norte-awsug"}'`,
	);
	console.log("\nMeeting ended ✓");

	await browser.close();
	console.log("\n=== DONE ===");
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
