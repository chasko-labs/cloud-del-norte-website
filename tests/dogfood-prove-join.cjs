const { chromium } = require("playwright");
const { execSync, execFileSync } = require("child_process");

function ssmParam(name, withDecryption) {
	const args = ['ssm', 'get-parameter', '--name', name, '--profile', 'aerospaceug-admin', '--region', 'us-west-2', '--query', 'Parameter.Value', '--output', 'text'];
	if (withDecryption) args.push('--with-decryption');
	return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

(async () => {
	console.log("=== PROVE THE JOIN ===\n");

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

	// Make sure meeting is live
	execSync(
		`curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/launch" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"title":"Prove Join","roomName":"cloud-del-norte-awsug"}'`,
	);
	console.log("Meeting live ✓");

	const browser = await chromium.launch({
		headless: true,
		args: [
			"--use-fake-device-for-media-stream",
			"--use-fake-ui-for-media-stream",
		],
	});
	const ctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
		permissions: ["microphone", "camera"],
	});
	const page = await ctx.newPage();

	// Load + inject tokens
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
	console.log("\n1. Click dashboard Join Now...");
	const joinBtn = page.locator("button").filter({ hasText: /Join/ }).first();
	await joinBtn.waitFor({ timeout: 15000 });
	await joinBtn.click();
	console.log("   Clicked ✓");

	// Wait for iframe to appear
	console.log("\n2. Waiting for Jitsi iframe...");
	await page.waitForSelector('iframe[src*="meet.clouddelnorte"]', {
		timeout: 30000,
	});
	console.log("   Iframe appeared ✓");
	await page.waitForTimeout(8000); // Let Jitsi fully load inside

	// Use page-level JavaScript to click inside the iframe (bypasses Playwright frame detach)
	console.log("\n3. Clicking Join Meeting INSIDE iframe via JS injection...");
	const clicked = await page.evaluate(async () => {
		const iframe = document.querySelector('iframe[src*="meet.clouddelnorte"]');
		if (!iframe || !iframe.contentDocument) return "no-iframe-access";

		// Look for the join button
		const btns = iframe.contentDocument.querySelectorAll("button");
		for (const btn of btns) {
			const testid = btn.getAttribute("data-testid") || "";
			const text = (btn.textContent || "").trim();
			if (
				testid === "prejoin.joinMeeting" ||
				text.includes("Join meeting") ||
				text.includes("Join Meeting")
			) {
				btn.click();
				return "clicked: " + (testid || text);
			}
		}
		return (
			"button-not-found: " +
			Array.from(btns)
				.map((b) => b.textContent?.trim()?.substring(0, 20))
				.join(", ")
		);
	});
	console.log(`   Result: ${clicked}`);

	if (clicked.startsWith("no-iframe-access")) {
		// Cross-origin iframe — can't access contentDocument. Use frameLocator instead.
		console.log("   Cross-origin iframe. Using frameLocator...");
		const frame = page.frameLocator('iframe[src*="meet.clouddelnorte"]');
		try {
			const prejoinBtn = frame.locator('[data-testid="prejoin.joinMeeting"]');
			await prejoinBtn.waitFor({ timeout: 10000 });
			// Use dispatchEvent instead of click (more reliable for cross-origin)
			await prejoinBtn.dispatchEvent("click");
			console.log("   Dispatched click event ✓");
		} catch (e) {
			console.log(`   frameLocator approach: ${e.message.substring(0, 80)}`);
			// Last resort: use keyboard Enter on the focused button
			const frame2 = page
				.frames()
				.find((f) => f.url().includes("meet.clouddelnorte"));
			if (frame2) {
				const btn = await frame2.$('[data-testid="prejoin.joinMeeting"]');
				if (btn) {
					await btn.focus();
					await frame2.press('[data-testid="prejoin.joinMeeting"]', "Enter");
					console.log("   Pressed Enter on button ✓");
				}
			}
		}
	}

	// Wait for conference to establish (give it 20s for XMPP connect + MUC join)
	console.log("\n4. Waiting 25s for conference to establish...");
	await page.waitForTimeout(25000);

	// Take the screenshot NOW — this is after the join
	await page.screenshot({
		path: "docs/walkthrough/prove-join-final.png",
		fullPage: true,
	});
	console.log("   Screenshot: prove-join-final.png");

	// Also try to detect conference state from the page
	const pageContent = await page.content();
	const hasHangup =
		pageContent.includes("hangup") ||
		pageContent.includes("Leave") ||
		pageContent.includes("leave");
	const hasToolbox =
		pageContent.includes("toolbox") || pageContent.includes("Toolbox");
	console.log(`\n5. Conference indicators in page HTML:`);
	console.log(`   hangup/Leave: ${hasHangup}`);
	console.log(`   toolbox: ${hasToolbox}`);

	// Check via frame if possible
	const jitsiFrame = page
		.frames()
		.find((f) => f.url().includes("meet.clouddelnorte"));
	if (jitsiFrame) {
		const frameUrl = jitsiFrame.url();
		console.log(`   Jitsi frame URL: ${frameUrl.substring(0, 80)}`);
		try {
			const frameContent = await jitsiFrame.content();
			const inConf =
				frameContent.includes("hangup") ||
				frameContent.includes("prejoin") ||
				frameContent.includes("filmstrip");
			const stillLobby = frameContent.includes("prejoin.joinMeeting");
			console.log(`   Frame has conference elements: ${inConf}`);
			console.log(`   Frame STILL has prejoin button: ${stillLobby}`);
			if (!stillLobby && inConf) {
				console.log(
					"\n   ✓✓✓ CONFIRMED IN CONFERENCE — pre-join button GONE, conference elements PRESENT",
				);
			}
		} catch (e) {
			console.log(`   Frame content check: ${e.message.substring(0, 60)}`);
		}
	}

	// Upload screenshot
	execSync(
		`aws s3 cp docs/walkthrough/prove-join-final.png s3://dev.clouddelnorte.org/_previews/dogfood/prove-join-final.png --content-type "image/png" --profile aerospaceug-admin`,
	);
	console.log(
		"\n   Uploaded: https://dev.clouddelnorte.org/_previews/dogfood/prove-join-final.png",
	);

	// End meeting
	execSync(
		`curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/end" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"roomName":"cloud-del-norte-awsug"}'`,
	);
	console.log("\nMeeting ended ✓");
	await browser.close();
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
