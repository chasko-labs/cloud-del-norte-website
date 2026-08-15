const { chromium } = require("playwright");
const { execSync, execFileSync } = require("child_process");

function ssmParam(name, withDecryption) {
	const args = ['ssm', 'get-parameter', '--name', name, '--profile', 'aerospaceug-admin', '--region', 'us-west-2', '--query', 'Parameter.Value', '--output', 'text'];
	if (withDecryption) args.push('--with-decryption');
	return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

(async () => {
	console.log("=== SIMULTANEOUS JOIN TEST — HOST + GUEST ===\n");

	// 1. Auth both users
	console.log("1. Authenticating...");
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
	const memAuth = JSON.parse(execFileSync('aws', [
		'cognito-idp', 'initiate-auth',
		'--auth-flow', 'USER_PASSWORD_AUTH',
		'--client-id', '57eikmt418ea6vti2f6h0pl74r',
		'--auth-parameters', `USERNAME=${ssmParam('/device-farm/test-users/member-username', false)},PASSWORD=${ssmParam('/device-farm/test-users/member-password', true)}`,
		'--profile', 'jitsi-video-hosting',
		'--region', 'us-west-2',
		'--query', 'AuthenticationResult.{IdToken:IdToken,AccessToken:AccessToken,RefreshToken:RefreshToken}',
		'--output', 'json'
	], { encoding: 'utf8' }));
	console.log("   Moderator (host): ✓");
	console.log("   Member (guest): ✓");

	// 2. Launch meeting
	console.log("\n2. Launching meeting...");
	const launchResp = JSON.parse(
		execSync(
			`curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/launch" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"title":"Simultaneous Join Test","roomName":"cloud-del-norte-awsug"}'`,
			{ encoding: "utf8" },
		),
	);
	console.log(
		`   Launch: ${launchResp.ok ? "✓" : "✗"} — ${launchResp.infrastructure_status}`,
	);

	// 3. Launch browser with TWO contexts (simulates two separate users)
	const browser = await chromium.launch({ headless: true });

	// HOST context
	const hostCtx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
	});
	const hostPage = await hostCtx.newPage();

	// GUEST context
	const guestCtx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: "dark",
	});
	const guestPage = await guestCtx.newPage();

	// 4. Both load dashboard and inject tokens
	console.log("\n3. Loading dashboards...");
	await Promise.all([
		hostPage.goto("https://quantum.clouddelnorte.org/dashboard/", {
			waitUntil: "networkidle",
			timeout: 20000,
		}),
		guestPage.goto("https://quantum.clouddelnorte.org/dashboard/", {
			waitUntil: "networkidle",
			timeout: 20000,
		}),
	]);

	await hostPage.evaluate((t) => {
		sessionStorage.setItem("cdn.idToken", t.IdToken);
		sessionStorage.setItem("cdn.accessToken", t.AccessToken);
		if (t.RefreshToken)
			sessionStorage.setItem("cdn.refreshToken", t.RefreshToken);
		const p = JSON.parse(
			atob(t.IdToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
		);
		if (p.exp) sessionStorage.setItem("cdn.expiresAt", String(p.exp * 1000));
	}, modAuth);

	await guestPage.evaluate((t) => {
		sessionStorage.setItem("cdn.idToken", t.IdToken);
		sessionStorage.setItem("cdn.accessToken", t.AccessToken);
		if (t.RefreshToken)
			sessionStorage.setItem("cdn.refreshToken", t.RefreshToken);
		const p = JSON.parse(
			atob(t.IdToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
		);
		if (p.exp) sessionStorage.setItem("cdn.expiresAt", String(p.exp * 1000));
	}, memAuth);

	await Promise.all([
		hostPage.reload({ waitUntil: "networkidle" }),
		guestPage.reload({ waitUntil: "networkidle" }),
	]);
	await Promise.all([
		hostPage.waitForTimeout(5000),
		guestPage.waitForTimeout(5000),
	]);
	console.log("   Host dashboard: ✓");
	console.log("   Guest dashboard: ✓");

	// 5. Both click Join Now
	console.log("\n4. Both clicking Join Now...");
	const hostJoin = await hostPage.locator('button:has-text("Join")').first();
	const guestJoin = await guestPage.locator('button:has-text("Join")').first();

	const hostVisible = await hostJoin.isVisible().catch(() => false);
	const guestVisible = await guestJoin.isVisible().catch(() => false);
	console.log(`   Host Join visible: ${hostVisible ? "✓" : "✗"}`);
	console.log(`   Guest Join visible: ${guestVisible ? "✓" : "✗"}`);

	if (hostVisible && guestVisible) {
		await Promise.all([hostJoin.click(), guestJoin.click()]);
		await Promise.all([
			hostPage.waitForTimeout(10000),
			guestPage.waitForTimeout(10000),
		]);

		// 6. Both click through Jitsi pre-join lobby
		console.log("\n5. Clicking through Jitsi pre-join lobby...");

		for (const [name, page] of [
			["Host", hostPage],
			["Guest", guestPage],
		]) {
			try {
				const jitsiFrame = page.frameLocator(
					'iframe[src*="meet.clouddelnorte"]',
				);
				const joinMeetingBtn = jitsiFrame
					.locator(
						'[data-testid="prejoin.joinMeeting"], button:has-text("Join meeting"), button:has-text("Join Meeting")',
					)
					.first();
				await joinMeetingBtn.waitFor({ timeout: 15000 });
				await joinMeetingBtn.click();
				console.log(`   ${name} clicked Jitsi Join Meeting: ✓`);

				// Wait for conference
				await jitsiFrame
					.locator(
						'[class*="toolbox"], [aria-label="Leave"], [data-testid="toolbox"]',
					)
					.first()
					.waitFor({ timeout: 20000 });
				console.log(`   ${name} IN CONFERENCE: ✓`);
			} catch (e) {
				console.log(`   ${name} join failed: ${e.message.substring(0, 80)}`);
			}
		}

		// 7. Wait for both to be in the call simultaneously, then screenshot
		console.log("\n6. Both in call — capturing evidence...");
		await Promise.all([
			hostPage.waitForTimeout(3000),
			guestPage.waitForTimeout(3000),
		]);

		// Check participant count
		for (const [name, page] of [
			["Host", hostPage],
			["Guest", guestPage],
		]) {
			try {
				const frame = page.frameLocator('iframe[src*="meet.clouddelnorte"]');
				// Look for participant indicators
				const participantCount = await frame
					.locator(
						'[class*="participants-count"], [data-testid="participants-count"]',
					)
					.textContent()
					.catch(() => "?");
				console.log(`   ${name} participant count: ${participantCount}`);
			} catch (e) {
				console.log(
					`   ${name} participant check: ${e.message.substring(0, 60)}`,
				);
			}
		}

		await hostPage.screenshot({
			path: "docs/walkthrough/dogfood-host-incall-simultaneous.png",
			fullPage: true,
		});
		await guestPage.screenshot({
			path: "docs/walkthrough/dogfood-guest-incall-simultaneous.png",
			fullPage: true,
		});
		console.log("   Screenshots captured: ✓");
	} else {
		console.log("   ✗ Join buttons not visible — cannot proceed");
		await hostPage.screenshot({
			path: "docs/walkthrough/dogfood-host-nojoin.png",
			fullPage: true,
		});
		await guestPage.screenshot({
			path: "docs/walkthrough/dogfood-guest-nojoin.png",
			fullPage: true,
		});
	}

	// 8. End meeting
	console.log("\n7. Ending meeting...");
	const endResp = JSON.parse(
		execSync(
			`curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/end" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"roomName":"cloud-del-norte-awsug"}'`,
			{ encoding: "utf8" },
		),
	);
	console.log(`   End: ${endResp.ok ? "✓" : "✗"}`);

	await browser.close();
	console.log("\n========================================");
	console.log("SIMULTANEOUS JOIN TEST COMPLETE");
	console.log("========================================");
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
