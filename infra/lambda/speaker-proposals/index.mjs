import { createHash, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import {
	DynamoDBDocumentClient,
	PutCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

// ── Bot rejection is handled at the edge by AWS WAF Challenge before this Lambda
// is ever invoked. The WAF WebACL (cdn-speaker-proposals-webacl) enforces:
//   - Challenge on POST /proposals
//   - Rate limit 100 req/5 min per IP (WAF) + 3 req/hr soft policy (app layer)
//   - Amazon IP Reputation managed rule
// No CAPTCHA verification is performed inside this function.

// ── module-scope singletons ──────────────────────────────────────────────────
const dynamo = DynamoDBDocumentClient.from(
	new DynamoDBClient({ region: "us-west-2" }),
);
const ssm = new SSMClient({ region: "us-west-2" });
const ses = new SESv2Client({ region: "us-west-2" });

// ── helpers ──────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
	"https://clouddelnorte.org",
	"https://dev.clouddelnorte.org",
	"https://awsug.clouddelnorte.org",
]);

function corsHeaders(requestOrigin) {
	const origin = ALLOWED_ORIGINS.has(requestOrigin)
		? requestOrigin
		: "https://clouddelnorte.org";
	return {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Headers":
			"Content-Type,Authorization,x-aws-waf-token",
		"Access-Control-Allow-Methods": "POST,OPTIONS",
	};
}

function log(level, msg, extra = {}) {
	console.log(JSON.stringify({ level, msg, ...extra }));
}

function respond(statusCode, body, headers) {
	return { statusCode, headers, body: JSON.stringify(body) };
}

function getRequestIp(event) {
	return (
		event.requestContext?.http?.sourceIp ||
		event.requestContext?.identity?.sourceIp ||
		"unknown"
	);
}

function hourBucket() {
	return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

function hashIp(ip) {
	const salt = process.env.IP_HASH_SALT || "";
	return createHash("sha256")
		.update(salt + ip)
		.digest("hex")
		.slice(0, 16);
}

function decodeJwtSub(authHeader) {
	try {
		if (!authHeader?.startsWith("Bearer ")) return null;
		const token = authHeader.slice(7);
		const parts = token.split(".");
		if (parts.length < 2) return null;
		const payload = JSON.parse(
			Buffer.from(
				parts[1].replace(/-/g, "+").replace(/_/g, "/"),
				"base64",
			).toString("utf8"),
		);
		return payload.sub || null;
	} catch {
		return null;
	}
}

const VALID_FORMATS = new Set(["in_person_west_tx_nm", "virtual", "either"]);
const VALID_DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const VALID_TOD = new Set(["morning", "afternoon", "evening"]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateBody(body) {
	const errors = [];
	if (!body.name || typeof body.name !== "string" || !body.name.trim())
		errors.push("name required");
	if (
		!body.email ||
		typeof body.email !== "string" ||
		!EMAIL_RE.test(body.email)
	)
		errors.push("valid email required");
	if (!body.topic || typeof body.topic !== "string" || !body.topic.trim())
		errors.push("topic required");
	if (
		!body.abstract ||
		typeof body.abstract !== "string" ||
		!body.abstract.trim()
	)
		errors.push("abstract required");
	if (!body.format || !VALID_FORMATS.has(body.format))
		errors.push(`format must be one of: ${[...VALID_FORMATS].join(", ")}`);
	if (
		!Array.isArray(body.preferredDays) ||
		body.preferredDays.length === 0 ||
		!body.preferredDays.every((d) => VALID_DAYS.has(d))
	)
		errors.push("preferredDays must be non-empty array of weekday codes");
	if (
		!Array.isArray(body.preferredTimeOfDay) ||
		body.preferredTimeOfDay.length === 0 ||
		!body.preferredTimeOfDay.every((t) => VALID_TOD.has(t))
	)
		errors.push(
			"preferredTimeOfDay must be non-empty array of morning|afternoon|evening",
		);
	if (!body.earliestDate || !ISO_DATE_RE.test(body.earliestDate))
		errors.push("earliestDate must be ISO date (YYYY-MM-DD)");
	if (
		body.bioUrl !== undefined &&
		body.bioUrl !== null &&
		typeof body.bioUrl !== "string"
	)
		errors.push("bioUrl must be string");
	if (
		body.notes !== undefined &&
		body.notes !== null &&
		typeof body.notes !== "string"
	)
		errors.push("notes must be string");
	if (
		body.submittedFromUrl !== undefined &&
		body.submittedFromUrl !== null &&
		typeof body.submittedFromUrl !== "string"
	)
		errors.push("submittedFromUrl must be string");
	return errors;
}

// ── GitHub issue side-effect ─────────────────────────────────────────────────
async function createGitHubIssue(proposal) {
	const GH_REPO = process.env.GH_REPO || "chasko-labs/cloud-del-norte-website";
	let token;
	try {
		const param = await ssm.send(
			new GetParameterCommand({
				Name: "/cloud-del-norte/speaker-proposals/github-token",
				WithDecryption: true,
			}),
		);
		token = param.Parameter?.Value;
	} catch (err) {
		log("warn", "[github-issue] SSM token unavailable — skipping", {
			err: err.message,
		});
		return null;
	}
	if (!token) {
		log("warn", "[github-issue] SSM token empty — skipping");
		return null;
	}

	const days = Array.isArray(proposal.preferredDays)
		? proposal.preferredDays.join(", ")
		: proposal.preferredDays || "any";
	const tod = Array.isArray(proposal.preferredTimeOfDay)
		? proposal.preferredTimeOfDay.join(", ")
		: proposal.preferredTimeOfDay || "any";
	const body = [
		"## Speaker proposal received",
		"",
		`**Submitter:** ${proposal.name} (${proposal.email})`,
		`**Topic:** ${proposal.topic}`,
		`**Format:** ${proposal.format}`,
		`**Earliest available:** ${proposal.earliestDate}`,
		`**Preferred days:** ${days}`,
		`**Preferred time:** ${tod}`,
		...(proposal.bioUrl ? [`**Bio:** ${proposal.bioUrl}`] : []),
		"",
		"### Abstract",
		proposal.abstract,
		"",
		...(proposal.notes ? [`### Notes`, proposal.notes, ""] : []),
		"---",
		"",
		`**Submission ID:** \`${proposal.id}\``,
		`**Source:** ${proposal.source || "web"}`,
		`**Cognito sub:** \`${proposal.cognitoSub || "anonymous"}\``,
		"",
		`[Review in admin panel](https://awsug.clouddelnorte.org/admin/?tab=proposals&id=${proposal.id})`,
	].join("\n");

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);
	try {
		const res = await fetch(`https://api.github.com/repos/${GH_REPO}/issues`, {
			method: "POST",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				title: `[CFP] ${proposal.topic} — ${proposal.name}`,
				body,
				labels: ["speaker-proposal", "needs-review"],
			}),
		});
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			log("error", "[github-issue] API error", {
				status: res.status,
				body: text,
			});
			return null;
		}
		const data = await res.json();
		log("info", "[github-issue] filed", {
			issue: data.number,
			url: data.html_url,
		});
		return data;
	} catch (err) {
		log("error", "[github-issue] fetch failed", { err: err.message });
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

// ── handler ──────────────────────────────────────────────────────────────────
// Event shape: AWS Lambda payload format v2 (compatible with both API Gateway
// HTTP API proxy integration and Lambda Function URL — both use the same v2 shape).
export async function handler(event) {
	const requestId = event.requestContext?.requestId || "local";
	const method =
		event.requestContext?.http?.method || event.httpMethod || "UNKNOWN";
	const requestOrigin = event.headers?.origin || event.headers?.Origin || "";
	const headers = corsHeaders(requestOrigin);

	if (method === "OPTIONS") return { statusCode: 200, headers, body: "" };

	if (method !== "POST") {
		return respond(405, { error: "method_not_allowed" }, headers);
	}

	try {
		// ── parse body ───────────────────────────────────────────────────────
		let body;
		try {
			body = JSON.parse(event.body || "{}");
		} catch {
			return respond(400, { error: "invalid_json" }, headers);
		}

		// ── honeypot ─────────────────────────────────────────────────────────
		if (body.website) {
			log("info", "honeypot triggered", { requestId });
			return respond(200, { ok: true }, headers);
		}

		// ── rate limit ───────────────────────────────────────────────────────
		const ip = getRequestIp(event);
		const ipHash = hashIp(ip);
		const rateKey = `${ipHash}#${hourBucket()}`;
		const nowSec = Math.floor(Date.now() / 1000);
		try {
			await dynamo.send(
				new UpdateCommand({
					TableName: process.env.RATE_TABLE_NAME,
					Key: { ipHashHour: rateKey },
					ConditionExpression: "attribute_not_exists(#k) OR #c < :max",
					UpdateExpression:
						"SET #c = if_not_exists(#c, :zero) + :one, #ttl = :exp",
					ExpressionAttributeNames: {
						"#k": "ipHashHour",
						"#c": "count",
						"#ttl": "expiresAt",
					},
					ExpressionAttributeValues: {
						":max": 3,
						":zero": 0,
						":one": 1,
						":exp": nowSec + 7200,
					},
				}),
			);
		} catch (err) {
			if (err.name === "ConditionalCheckFailedException") {
				log("warn", "rate limit hit", { requestId, ipHash });
				return respond(429, { error: "rate_limit" }, headers);
			}
			throw err;
		}

		// ── validate ─────────────────────────────────────────────────────────
		const validationErrors = validateBody(body);
		if (validationErrors.length > 0) {
			return respond(
				400,
				{ error: "validation", details: validationErrors },
				headers,
			);
		}

		// ── JWT sub (optional) ───────────────────────────────────────────────
		const cognitoSub = decodeJwtSub(
			event.headers?.authorization || event.headers?.Authorization,
		);

		// ── persist ──────────────────────────────────────────────────────────
		const item = {
			id: randomUUID(),
			name: body.name.trim(),
			email: body.email.trim(),
			cognitoSub,
			topic: body.topic.trim(),
			abstract: body.abstract.trim(),
			format: body.format,
			bioUrl: body.bioUrl || null,
			preferredDays: body.preferredDays,
			preferredTimeOfDay: body.preferredTimeOfDay,
			earliestDate: body.earliestDate,
			notes: body.notes || null,
			submittedFromUrl: body.submittedFromUrl || null,
			ipHash,
			wafCaptchaPassed: true,
			status: "pending",
			createdAt: new Date().toISOString(),
		};

		await dynamo.send(
			new PutCommand({
				TableName: process.env.TABLE_NAME,
				Item: item,
			}),
		);

		log("info", "proposal saved", { requestId, id: item.id });

		// ── SES + GitHub issue (parallel best-effort) ───────────────────────
		const adminLink = `${process.env.ADMIN_PANEL_URL}?proposalId=${item.id}`;
		const textBody = [
			`New speaker proposal: ${item.topic}`,
			"",
			`Name: ${item.name}`,
			`Email: ${item.email}`,
			`Format: ${item.format}`,
			`Earliest date: ${item.earliestDate}`,
			`Preferred days: ${item.preferredDays.join(", ")}`,
			`Preferred time: ${item.preferredTimeOfDay.join(", ")}`,
			`Bio URL: ${item.bioUrl || "(none)"}`,
			"",
			"Abstract:",
			item.abstract,
			"",
			`Notes: ${item.notes || "(none)"}`,
			`Submitted from: ${item.submittedFromUrl || "(unknown)"}`,
			"",
			`Review: ${adminLink}`,
		].join("\n");

		const htmlBody = `<h2>New speaker proposal: ${item.topic}</h2>
<table>
<tr><th>Name</th><td>${item.name}</td></tr>
<tr><th>Email</th><td>${item.email}</td></tr>
<tr><th>Format</th><td>${item.format}</td></tr>
<tr><th>Earliest date</th><td>${item.earliestDate}</td></tr>
<tr><th>Preferred days</th><td>${item.preferredDays.join(", ")}</td></tr>
<tr><th>Preferred time</th><td>${item.preferredTimeOfDay.join(", ")}</td></tr>
<tr><th>Bio URL</th><td>${item.bioUrl || "(none)"}</td></tr>
</table>
<h3>Abstract</h3><p>${item.abstract}</p>
<h3>Notes</h3><p>${item.notes || "(none)"}</p>
<p>Submitted from: ${item.submittedFromUrl || "(unknown)"}</p>
<p><a href="${adminLink}">Review proposal</a></p>`;

		const sesSend = ses.send(
			new SendEmailCommand({
				FromEmailAddress: process.env.FROM_ADDRESS,
				Destination: { ToAddresses: [process.env.NOTIFICATION_EMAIL] },
				Content: {
					Simple: {
						Subject: { Data: `New speaker proposal: ${item.topic}` },
						Body: {
							Text: { Data: textBody },
							Html: { Data: htmlBody },
						},
					},
				},
			}),
		);

		const [sesResult, ghResult] = await Promise.allSettled([
			sesSend,
			createGitHubIssue(item),
		]);
		if (sesResult.status === "rejected") {
			log("error", "SES send failed (non-fatal)", {
				requestId,
				id: item.id,
				err: sesResult.reason?.message,
			});
		}
		if (ghResult.status === "rejected") {
			log("error", "[github-issue] allSettled rejection (non-fatal)", {
				requestId,
				id: item.id,
				err: ghResult.reason?.message,
			});
		}

		return respond(201, { ok: true, id: item.id }, headers);
	} catch (err) {
		log("error", "unhandled error", {
			requestId,
			err: err.message,
			stack: err.stack,
		});
		return respond(500, { error: "internal_server_error" }, headers);
	}
}
