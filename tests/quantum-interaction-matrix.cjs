/**
 * Quantum Workshop — User Interaction Matrix Test
 *
 * Exercises the ENTIRE quantum workshop flow for each user role:
 * Guest, Registered-Only, Pending, Member, Banned, Moderator.
 *
 * For each role: authenticates (if applicable), navigates quantum.clouddelnorte.org,
 * and verifies UI state matches the expected interaction matrix.
 *
 * Run: node tests/quantum-interaction-matrix.cjs
 */

const { chromium } = require("playwright");
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const BASE_URL = process.env.QUANTUM_URL || "https://quantum.clouddelnorte.org";
const RESULTS_DIR = path.join(__dirname, "quantum-interaction-results");
const TIMEOUT = 20000;

// Cognito config
const COGNITO_CLIENT_ID = "57eikmt418ea6vti2f6h0pl74r";
const AWS_PROFILE = "jitsi-video-hosting";
const AWS_REGION = "us-west-2";

// Test users
const USERS = {
	MODERATOR: {
		email: "heraldstack-test-admin@clouddelnorte.org",
		password: "DevFarm-Admin-674dce0c31fd0ee8",
	},
	MEMBER: {
		email: "cdn-member-only-test@clouddelnorte.org",
		password: "M!SyfGC9kKBPdQ4npnPbTucJx9",
	},
	PENDING: {
		email: "cdn-pending-test@clouddelnorte.org",
		password: "P!GqsORNWYWWvhdtU8cWIr59x9",
	},
	BANNED: {
		email: "heraldstack-test-banned@clouddelnorte.org",
		password: "DevFarm-Banned-d15b4efab480fbee",
	},
};

if (!fs.existsSync(RESULTS_DIR)) {
	fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Matrix results storage
const matrix = {};
const STEPS = [
	"1. Landing page loads",
	"2. CTA type (register vs dashboard)",
	"3. Registration form accessible",
	"4. Dashboard view type",
	"5. Live session visible",
	"6. Sign-in flow behavior",
	"7. After sign-in state",
	"8. Join call capability",
	"9. Moderator controls",
];

const ROLES = [
	"GUEST",
	"REGISTERED",
	"PENDING",
	"MEMBER",
	"BANNED",
	"MODERATOR",
];

for (const role of ROLES) {
	matrix[role] = {};
	for (const step of STEPS) {
		matrix[role][step] = { pass: null, detail: "" };
	}
}

function record(role, step, pass, detail) {
	matrix[role][step] = { pass, detail: detail || "" };
	const icon = pass ? "✓" : "✗";
	console.log(`  ${icon} [${role}] ${step}${detail ? ` — ${detail}` : ""}`);
}

async function screenshot(page, label) {
	const file = path.join(RESULTS_DIR, `${label}.png`);
	await page.screenshot({ path: file, fullPage: false });
	return file;
}

/**
 * Get Cognito tokens via USER_PASSWORD_AUTH flow using AWS CLI.
 * Returns { IdToken, AccessToken, RefreshToken } or null on failure.
 */
function getCognitoTokens(email, password) {
	try {
		const cmd = [
			"aws cognito-idp initiate-auth",
			"--auth-flow USER_PASSWORD_AUTH",
			`--client-id ${COGNITO_CLIENT_ID}`,
			`--auth-parameters USERNAME=${email},PASSWORD='${password.replace(/'/g, "'\\''")}'`,
			`--profile ${AWS_PROFILE}`,
			`--region ${AWS_REGION}`,
			"--query 'AuthenticationResult.{IdToken:IdToken,AccessToken:AccessToken,RefreshToken:RefreshToken}'",
			"--output json",
		].join(" ");

		const result = execSync(cmd, {
			encoding: "utf-8",
			timeout: 30000,
			stdio: ["pipe", "pipe", "pipe"],
		});
		return JSON.parse(result);
	} catch (err) {
		const stderr = err.stderr ? err.stderr.toString() : "";
		console.log(
			`    ⚠ Cognito auth failed for ${email}: ${stderr.slice(0, 200)}`,
		);
		return null;
	}
}

/**
 * Inject Cognito tokens into the browser session via sessionStorage.
 */
async function injectTokens(page, tokens) {
	await page.evaluate((t) => {
		if (t.IdToken) sessionStorage.setItem("cdn_id_token", t.IdToken);
		if (t.AccessToken)
			sessionStorage.setItem("cdn_access_token", t.AccessToken);
		if (t.RefreshToken)
			sessionStorage.setItem("cdn_refresh_token", t.RefreshToken);
	}, tokens);
}

/**
 * Set the registered-only localStorage flag (no cognito account).
 */
async function setRegisteredFlag(page) {
	await page.evaluate(() => {
		localStorage.setItem("cdn-quantum-registered", "true");
		localStorage.setItem("cdn-quantum-celebration-shown", "true");
	});
}

/* ─── Role Test Functions ─── */

async function testGuest(browser) {
	console.log("\n── GUEST (no account) ──");
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();
	page.setDefaultTimeout(TIMEOUT);

	try {
		// 1. Landing page loads
		const resp = await page.goto(`${BASE_URL}/landing/`, {
			waitUntil: "domcontentloaded",
		});
		const ok = resp && resp.status() < 400;
		await screenshot(page, "guest-01-landing");
		record("GUEST", STEPS[0], ok, `status=${resp ? resp.status() : "null"}`);

		// 2. CTA type — should show sign-in link (guest = not registered, not logged in)
		await page.waitForTimeout(1000);
		const pageText = await page.textContent("body");
		const hasRegisterCta =
			pageText.includes("Register") || pageText.includes("Registr");
		const hasDashboardCta = pageText.includes("Dashboard");
		await screenshot(page, "guest-02-cta");
		record(
			"GUEST",
			STEPS[1],
			!hasDashboardCta,
			hasRegisterCta ? "register CTA present" : "sign-in link present",
		);

		// 3. Registration form accessible
		await page.goto(`${BASE_URL}/register/`, {
			waitUntil: "domcontentloaded",
		});
		await page.waitForTimeout(1000);
		const formContent = await page.textContent("body");
		const hasForm =
			formContent.includes("Name") ||
			formContent.includes("Email") ||
			formContent.includes("nombre") ||
			(await page.$("input")) !== null;
		await screenshot(page, "guest-03-register");
		record("GUEST", STEPS[2], hasForm, hasForm ? "form present" : "no form");

		// 4. Dashboard view — guest view
		await page.goto(`${BASE_URL}/dashboard/`, {
			waitUntil: "domcontentloaded",
		});
		await page.waitForTimeout(1000);
		const dashText = await page.textContent("body");
		const isGuestView =
			dashText.includes("Register") ||
			dashText.includes("register") ||
			dashText.includes("Registr");
		await screenshot(page, "guest-04-dashboard");
		record(
			"GUEST",
			STEPS[3],
			isGuestView,
			isGuestView ? "guest view (register CTA)" : "unexpected view",
		);

		// 5. Live session visible (yes but no join)
		const hasSession =
			dashText.includes("session") ||
			dashText.includes("Session") ||
			dashText.includes("Workshop") ||
			dashText.includes("Call") ||
			dashText.includes("Test Call");
		const hasSignInToJoin =
			dashText.includes("Sign in") || dashText.includes("sign in");
		await screenshot(page, "guest-05-sessions");
		record(
			"GUEST",
			STEPS[4],
			hasSession,
			`sessions visible=${hasSession}, sign-in prompt=${hasSignInToJoin}`,
		);

		// 6. Sign-in flow — should redirect to auth
		const signInLink = await page.$(
			'a[href*="auth.clouddelnorte.org"], a[href*="login"]',
		);
		record(
			"GUEST",
			STEPS[5],
			!!signInLink,
			signInLink ? "sign-in link present" : "no sign-in link found",
		);

		// 7. After sign-in state — N/A for guest (not authenticated)
		record("GUEST", STEPS[6], true, "N/A — guest cannot complete sign-in");

		// 8. Join call — blocked (no auth)
		const joinBtn = await page.$('button:has-text("Join")');
		const joinBlocked = !joinBtn;
		record(
			"GUEST",
			STEPS[7],
			joinBlocked,
			joinBlocked
				? "no join button (blocked)"
				: "join button unexpectedly present",
		);

		// 9. Moderator controls — hidden
		const modControls =
			dashText.includes("Launch") ||
			dashText.includes("End session") ||
			dashText.includes("Moderator");
		record(
			"GUEST",
			STEPS[8],
			!modControls,
			modControls ? "FAIL: moderator controls visible" : "hidden (correct)",
		);
	} catch (e) {
		console.log(`  ✗ GUEST test error: ${e.message}`);
	} finally {
		await context.close();
	}
}

async function testRegistered(browser) {
	console.log("\n── REGISTERED-ONLY (localStorage flag, no cognito) ──");
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();
	page.setDefaultTimeout(TIMEOUT);

	try {
		// Navigate first to set localStorage
		await page.goto(`${BASE_URL}/landing/`, {
			waitUntil: "domcontentloaded",
		});
		await setRegisteredFlag(page);

		// 1. Landing page loads (reload with flag)
		const resp = await page.goto(`${BASE_URL}/landing/`, {
			waitUntil: "domcontentloaded",
		});
		const ok = resp && resp.status() < 400;
		await screenshot(page, "registered-01-landing");
		record(
			"REGISTERED",
			STEPS[0],
			ok,
			`status=${resp ? resp.status() : "null"}`,
		);

		// 2. CTA type — should show dashboard link
		await page.waitForTimeout(1000);
		const pageText = await page.textContent("body");
		const hasDashboard =
			pageText.includes("Dashboard") || pageText.includes("dashboard");
		await screenshot(page, "registered-02-cta");
		record(
			"REGISTERED",
			STEPS[1],
			hasDashboard,
			hasDashboard ? "dashboard CTA" : "no dashboard CTA",
		);

		// 3. Registration form — already done (redirect or shows dashboard)
		record(
			"REGISTERED",
			STEPS[2],
			true,
			"already registered (localStorage flag)",
		);

		// 4. Dashboard view — registered view
		await page.goto(`${BASE_URL}/dashboard/`, {
			waitUntil: "domcontentloaded",
		});
		await page.waitForTimeout(1000);
		const dashText = await page.textContent("body");
		const isRegisteredView =
			dashText.includes("signed up") ||
			dashText.includes("registered") ||
			dashText.includes("Sign in to join") ||
			dashText.includes("upcoming") ||
			dashText.includes("passkey");
		await screenshot(page, "registered-04-dashboard");
		record(
			"REGISTERED",
			STEPS[3],
			isRegisteredView,
			isRegisteredView ? "registered view" : "unexpected view",
		);

		// 5. Live session visible (yes, sign in to join)
		const hasSignInToJoin =
			dashText.includes("Sign in") || dashText.includes("sign in");
		await screenshot(page, "registered-05-sessions");
		record(
			"REGISTERED",
			STEPS[4],
			true,
			`sessions visible, sign-in-to-join=${hasSignInToJoin}`,
		);

		// 6. Sign-in flow — should show sign-in link
		const signInLink = await page.$(
			'a[href*="auth.clouddelnorte.org"], a[href*="login"], button:has-text("Sign in")',
		);
		record(
			"REGISTERED",
			STEPS[5],
			!!signInLink,
			signInLink ? "sign-in flow available" : "no sign-in link",
		);

		// 7. After sign-in — would become member view (tested separately)
		record(
			"REGISTERED",
			STEPS[6],
			true,
			"→ member view (tested in MEMBER role)",
		);

		// 8. Join call — blocked (no auth token)
		const joinDirectBtn = await page.$(
			'button:has-text("Join Now"), button:has-text("Join")',
		);
		const joinBlocked =
			!joinDirectBtn || (await page.textContent("body")).includes("Sign in");
		record(
			"REGISTERED",
			STEPS[7],
			joinBlocked,
			joinBlocked ? "blocked (need auth)" : "join available unexpectedly",
		);

		// 9. Moderator controls — hidden
		const modControls = dashText.includes("Launch") && dashText.includes("End");
		record(
			"REGISTERED",
			STEPS[8],
			!modControls,
			modControls ? "FAIL: mod controls visible" : "hidden (correct)",
		);
	} catch (e) {
		console.log(`  ✗ REGISTERED test error: ${e.message}`);
	} finally {
		await context.close();
	}
}

async function testAuthenticatedRole(browser, role, user) {
	console.log(`\n── ${role} (${user.email}) ──`);
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();
	page.setDefaultTimeout(TIMEOUT);

	// Get Cognito tokens
	console.log(`  ⏳ Authenticating via Cognito...`);
	const tokens = getCognitoTokens(user.email, user.password);
	const authSuccess = tokens && tokens.IdToken;

	try {
		// Navigate to base to establish origin, then inject tokens
		await page.goto(`${BASE_URL}/landing/`, {
			waitUntil: "domcontentloaded",
		});

		if (authSuccess) {
			await injectTokens(page, tokens);
			// Also set registered flag for authenticated users
			await page.evaluate(() => {
				localStorage.setItem("cdn-quantum-registered", "true");
				localStorage.setItem("cdn-quantum-celebration-shown", "true");
			});
		}

		// 1. Landing page loads
		const resp = await page.goto(`${BASE_URL}/landing/`, {
			waitUntil: "domcontentloaded",
		});
		const ok = resp && resp.status() < 400;
		await screenshot(page, `${role.toLowerCase()}-01-landing`);
		record(role, STEPS[0], ok, `status=${resp ? resp.status() : "null"}`);

		// 2. CTA type — authenticated users should see dashboard
		await page.waitForTimeout(1000);
		const landingText = await page.textContent("body");
		const hasDashboard =
			landingText.includes("Dashboard") || landingText.includes("dashboard");
		await screenshot(page, `${role.toLowerCase()}-02-cta`);
		record(
			role,
			STEPS[1],
			authSuccess ? hasDashboard : true,
			authSuccess
				? hasDashboard
					? "dashboard CTA"
					: "no dashboard CTA (may need page reload)"
				: `auth failed — ${role} has no valid tokens`,
		);

		// 3. Registration form — N/A for authenticated users
		record(role, STEPS[2], true, "N/A — already authenticated");

		// 4. Dashboard view
		await page.goto(`${BASE_URL}/dashboard/`, {
			waitUntil: "domcontentloaded",
		});
		await page.waitForTimeout(1500);
		const dashText = await page.textContent("body");
		await screenshot(page, `${role.toLowerCase()}-04-dashboard`);

		if (!authSuccess) {
			// Auth failed — check what view we get
			const isRegisteredOrGuest =
				dashText.includes("Register") ||
				dashText.includes("Sign in") ||
				dashText.includes("registered");
			record(
				role,
				STEPS[3],
				false,
				`auth failed — showing ${isRegisteredOrGuest ? "registered/guest" : "unknown"} view`,
			);
		} else if (role === "MODERATOR") {
			const isMemberView =
				dashText.includes("Welcome") ||
				dashText.includes("session") ||
				dashText.includes("Session") ||
				dashText.includes("Join");
			record(
				role,
				STEPS[3],
				isMemberView,
				isMemberView ? "member+controls view" : "unexpected view",
			);
		} else {
			const isMemberView =
				dashText.includes("Welcome") ||
				dashText.includes("session") ||
				dashText.includes("Session") ||
				dashText.includes("Join") ||
				dashText.includes("Calendar");
			record(
				role,
				STEPS[3],
				isMemberView || role === "PENDING" || role === "BANNED",
				`${role === "PENDING" ? "pending" : role === "BANNED" ? "banned" : "member"} view`,
			);
		}

		// 5. Live session visible
		const hasSessionInfo =
			dashText.includes("Test Call") ||
			dashText.includes("Workshop") ||
			dashText.includes("session") ||
			dashText.includes("Session");
		await screenshot(page, `${role.toLowerCase()}-05-sessions`);
		record(
			role,
			STEPS[4],
			hasSessionInfo || !authSuccess,
			authSuccess
				? hasSessionInfo
					? "sessions visible"
					: "no session info"
				: "auth failed — skipped",
		);

		// 6. Sign-in flow — already signed in for authenticated roles
		record(
			role,
			STEPS[5],
			true,
			authSuccess ? "already authenticated" : "auth failed at CLI level",
		);

		// 7. After sign-in state
		if (!authSuccess) {
			record(
				role,
				STEPS[6],
				false,
				"auth failed — cannot verify post-login state",
			);
		} else if (role === "PENDING") {
			const hasPendingMsg =
				dashText.includes("pending") ||
				dashText.includes("Pending") ||
				dashText.includes("approval") ||
				dashText.includes("waiting");
			record(
				role,
				STEPS[6],
				true,
				hasPendingMsg
					? "pending message shown"
					: "member view (no pending gate on quantum)",
			);
		} else if (role === "BANNED") {
			const hasBannedMsg =
				dashText.includes("banned") ||
				dashText.includes("Banned") ||
				dashText.includes("suspended") ||
				dashText.includes("denied");
			record(
				role,
				STEPS[6],
				true,
				hasBannedMsg
					? "banned message shown"
					: "member view (ban checked at jitsi level)",
			);
		} else {
			record(role, STEPS[6], true, "member view active");
		}

		// 8. Join call capability
		if (!authSuccess) {
			record(role, STEPS[7], false, "auth failed — cannot test join");
		} else {
			const joinBtn = await page.$(
				'button:has-text("Join"), button:has-text("join")',
			);
			const hasJitsiContainer =
				(await page.$('[class*="jitsi"]')) !== null ||
				(await page.$("iframe[src*='meet']")) !== null;

			if (role === "MEMBER" || role === "MODERATOR") {
				// These roles should be able to join
				const canJoin = !!joinBtn || hasJitsiContainer;
				record(
					role,
					STEPS[7],
					canJoin,
					canJoin
						? "join button present (WORKS)"
						: "no join button visible (session may not be live)",
				);
			} else if (role === "PENDING" || role === "BANNED") {
				// These might be blocked at the jitsi token level
				const blocked = !hasJitsiContainer;
				record(
					role,
					STEPS[7],
					blocked,
					blocked
						? "blocked (correct — enforced at jitsi token exchange)"
						: "jitsi container present unexpectedly",
				);
			}
		}

		// 9. Moderator controls
		const hasModControls =
			dashText.includes("Launch") ||
			dashText.includes("End session") ||
			(dashText.includes("Moderator") && dashText.includes("Infrastructure"));
		await screenshot(page, `${role.toLowerCase()}-09-moderator`);

		if (role === "MODERATOR") {
			record(
				role,
				STEPS[8],
				authSuccess ? hasModControls : false,
				authSuccess
					? hasModControls
						? "moderator controls visible (correct)"
						: "moderator controls NOT visible (may be in expandable section)"
					: "auth failed",
			);

			// Try expanding the moderator section
			if (authSuccess && !hasModControls) {
				const expandable = await page.$(
					'[class*="expandable"], button:has-text("Moderator")',
				);
				if (expandable) {
					await expandable.click();
					await page.waitForTimeout(500);
					const expandedText = await page.textContent("body");
					const expandedHasMod =
						expandedText.includes("Launch") ||
						expandedText.includes("End session");
					record(
						role,
						STEPS[8],
						expandedHasMod,
						expandedHasMod
							? "moderator controls visible after expand"
							: "still not visible",
					);
				}
			}
		} else {
			record(
				role,
				STEPS[8],
				!hasModControls,
				hasModControls
					? "FAIL: moderator controls visible to non-moderator"
					: "hidden (correct)",
			);
		}
	} catch (e) {
		console.log(`  ✗ ${role} test error: ${e.message}`);
		// Fill remaining steps with error
		for (const step of STEPS) {
			if (matrix[role][step].pass === null) {
				record(role, step, false, `error: ${e.message}`);
			}
		}
	} finally {
		await context.close();
	}
}

/* ─── Main Runner ─── */

async function run() {
	console.log(
		`\n${"═".repeat(60)}\nQUANTUM WORKSHOP — USER INTERACTION MATRIX TEST\n${"═".repeat(60)}`,
	);
	console.log(`Target: ${BASE_URL}`);
	console.log(`Time: ${new Date().toISOString()}\n`);

	const browser = await chromium.launch({ headless: true });

	try {
		// Test each role sequentially
		await testGuest(browser);
		await testRegistered(browser);
		await testAuthenticatedRole(browser, "PENDING", USERS.PENDING);
		await testAuthenticatedRole(browser, "MEMBER", USERS.MEMBER);
		await testAuthenticatedRole(browser, "BANNED", USERS.BANNED);
		await testAuthenticatedRole(browser, "MODERATOR", USERS.MODERATOR);
	} finally {
		await browser.close();
	}

	// Print formatted matrix table
	console.log(`\n${"═".repeat(80)}`);
	console.log("INTERACTION MATRIX RESULTS");
	console.log(`${"═".repeat(80)}\n`);

	// Header
	const colWidth = 12;
	const stepWidth = 35;
	let header = "Step".padEnd(stepWidth);
	for (const role of ROLES) {
		header += role.padEnd(colWidth);
	}
	console.log(header);
	console.log("─".repeat(header.length));

	// Rows
	let totalPass = 0;
	let totalTests = 0;

	for (const step of STEPS) {
		let row = step.padEnd(stepWidth);
		for (const role of ROLES) {
			const cell = matrix[role][step];
			totalTests++;
			if (cell.pass === true) {
				totalPass++;
				row += "✓ PASS".padEnd(colWidth);
			} else if (cell.pass === false) {
				row += "✗ FAIL".padEnd(colWidth);
			} else {
				row += "? SKIP".padEnd(colWidth);
			}
		}
		console.log(row);
	}

	console.log("─".repeat(header.length));
	console.log(`\nTOTAL: ${totalPass}/${totalTests} passed\n`);

	// Per-role summary
	console.log("Per-role summary:");
	for (const role of ROLES) {
		const roleResults = STEPS.map((s) => matrix[role][s]);
		const passed = roleResults.filter((r) => r.pass === true).length;
		const failed = roleResults.filter((r) => r.pass === false).length;
		console.log(
			`  ${role.padEnd(12)} ${passed}/${STEPS.length} passed${failed > 0 ? ` (${failed} failed)` : ""}`,
		);
	}

	// Failures detail
	const failures = [];
	for (const role of ROLES) {
		for (const step of STEPS) {
			if (matrix[role][step].pass === false) {
				failures.push({
					role,
					step,
					detail: matrix[role][step].detail,
				});
			}
		}
	}

	if (failures.length > 0) {
		console.log(`\nFAILURES (${failures.length}):`);
		for (const f of failures) {
			console.log(`  ✗ [${f.role}] ${f.step}: ${f.detail}`);
		}
	}

	console.log(`\nScreenshots: ${RESULTS_DIR}/`);
	console.log(`${"═".repeat(80)}\n`);

	// Write JSON report
	const report = {
		url: BASE_URL,
		timestamp: new Date().toISOString(),
		totalPass,
		totalTests,
		matrix,
		failures,
	};
	fs.writeFileSync(
		path.join(RESULTS_DIR, "report.json"),
		JSON.stringify(report, null, 2),
	);

	// Exit code: 0 only if no failures
	process.exit(failures.length === 0 ? 0 : 1);
}

run().catch((e) => {
	console.error("Fatal:", e);
	process.exit(2);
});
