import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({ region: "us-west-2" });
const s3 = new S3Client({ region: "us-west-2" });

const ATTACHMENTS_BUCKET =
	process.env.ATTACHMENTS_BUCKET ?? "cdn-feedback-attachments";

const ALLOWED_ORIGINS = new Set([
	"https://clouddelnorte.org",
	"https://dev.clouddelnorte.org",
	"https://awsug.clouddelnorte.org",
]);

function corsHeaders(origin) {
	const allowed = ALLOWED_ORIGINS.has(origin)
		? origin
		: "https://clouddelnorte.org";
	return {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": allowed,
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "POST,OPTIONS",
	};
}

function respond(status, body, headers) {
	return { statusCode: status, headers, body: JSON.stringify(body) };
}

// In-memory rate limit: 5 per IP per hour per Lambda instance.
const rateMap = new Map();

function hourBucket() {
	return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

function checkRate(ip) {
	const key = `${ip}:${hourBucket()}`;
	const count = rateMap.get(key) ?? 0;
	if (count >= 5) return false;
	rateMap.set(key, count + 1);
	if (rateMap.size > 500) {
		const cur = hourBucket();
		for (const k of rateMap.keys()) {
			if (!k.endsWith(cur)) rateMap.delete(k);
		}
	}
	return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_MIME = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
]);

const MIME_TO_EXT = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
};

function checkMagicBytes(buf, contentType) {
	if (contentType === "image/png") {
		return (
			buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
		);
	}
	if (contentType === "image/jpeg") {
		return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
	}
	if (contentType === "image/gif") {
		return (
			buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38
		);
	}
	if (contentType === "image/webp") {
		// RIFF????WEBP
		return (
			buf[0] === 0x52 &&
			buf[1] === 0x49 &&
			buf[2] === 0x46 &&
			buf[3] === 0x46 &&
			buf[8] === 0x57 &&
			buf[9] === 0x45 &&
			buf[10] === 0x42 &&
			buf[11] === 0x50
		);
	}
	return false;
}

function validate(body) {
	const errs = [];
	if (!body.type || !["bug", "wish"].includes(body.type))
		errs.push("type must be bug or wish");
	if (
		!body.summary ||
		typeof body.summary !== "string" ||
		body.summary.trim().length < 8
	)
		errs.push("summary min 8 chars");
	if (body.summary?.trim().length > 120) errs.push("summary max 120 chars");
	if (!body.details || typeof body.details !== "string" || !body.details.trim())
		errs.push("details required");
	if (body.details?.length > 2000) errs.push("details max 2000 chars");
	if (body.contactEmail && !EMAIL_RE.test(body.contactEmail))
		errs.push("contactEmail invalid");
	if (body.attachments !== undefined) {
		if (!Array.isArray(body.attachments))
			errs.push("attachments must be array");
		else if (body.attachments.length > 3) errs.push("attachments max 3");
		else {
			for (const att of body.attachments) {
				if (
					!att.filename ||
					typeof att.filename !== "string" ||
					!att.contentType ||
					!att.base64Data
				) {
					errs.push("each attachment needs filename, contentType, base64Data");
					break;
				}
				if (!ALLOWED_MIME.has(att.contentType)) {
					errs.push(`unsupported contentType: ${att.contentType}`);
					break;
				}
				const rawSize = Math.floor((att.base64Data.length * 3) / 4);
				if (rawSize > 2_000_000) {
					errs.push(`attachment ${att.filename} exceeds 2MB`);
					break;
				}
			}
		}
	}
	return errs;
}

async function uploadAttachments(attachments) {
	if (!attachments?.length) return [];
	const urls = [];
	for (const att of attachments) {
		try {
			const buf = Buffer.from(att.base64Data, "base64");
			if (!checkMagicBytes(buf, att.contentType)) {
				console.log(
					JSON.stringify({
						level: "warn",
						msg: "magic byte mismatch, skipping",
						filename: att.filename,
						contentType: att.contentType,
					}),
				);
				continue;
			}
			const ext = MIME_TO_EXT[att.contentType];
			const uuid = crypto.randomUUID();
			const key = `attachments/${uuid}.${ext}`;
			await s3.send(
				new PutObjectCommand({
					Bucket: ATTACHMENTS_BUCKET,
					Key: key,
					Body: buf,
					ContentType: att.contentType,
				}),
			);
			urls.push(
				`https://${ATTACHMENTS_BUCKET}.s3.us-west-2.amazonaws.com/${key}`,
			);
		} catch (err) {
			console.log(
				JSON.stringify({
					level: "error",
					msg: "attachment upload failed",
					filename: att.filename,
					err: err.message,
				}),
			);
		}
	}
	return urls;
}

async function getGitHubToken() {
	try {
		const r = await ssm.send(
			new GetParameterCommand({
				Name: "/cloud-del-norte/speaker-proposals/github-token",
				WithDecryption: true,
			}),
		);
		return r.Parameter?.Value ?? null;
	} catch (err) {
		console.log(
			JSON.stringify({
				level: "warn",
				msg: "SSM unavailable",
				err: err.message,
			}),
		);
		return null;
	}
}

async function createIssue(
	type,
	summary,
	details,
	contactEmail,
	attachmentUrls,
) {
	const token = await getGitHubToken();
	if (!token) return null;

	const repo = process.env.GH_REPO ?? "chasko-labs/cloud-del-norte-website";
	const prefix = type === "bug" ? "[BUG]" : "[WISH]";
	const label = type === "bug" ? "bug" : "wish";

	const lines = [`**Summary:** ${summary}`, "", "**Details:**", details];
	if (contactEmail) lines.push("", `**Contact:** ${contactEmail}`);

	if (attachmentUrls?.length) {
		lines.push("");
		attachmentUrls.forEach((url, i) => {
			lines.push(`![screenshot ${i + 1}](${url})`);
		});
	}

	lines.push(
		"",
		"---",
		`*Source: feedback-form · ${new Date().toISOString()}*`,
	);

	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), 5000);
	try {
		const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
			method: "POST",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				title: `${prefix} ${summary}`,
				body: lines.join("\n"),
				labels: [label, "community-feedback"],
			}),
		});
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			console.log(
				JSON.stringify({
					level: "error",
					msg: "github api error",
					status: res.status,
					body: text,
				}),
			);
			return null;
		}
		const data = await res.json();
		console.log(
			JSON.stringify({
				level: "info",
				msg: "issue filed",
				number: data.number,
				url: data.html_url,
			}),
		);
		return data.html_url;
	} catch (err) {
		console.log(
			JSON.stringify({
				level: "error",
				msg: "github fetch failed",
				err: err.message,
			}),
		);
		return null;
	} finally {
		clearTimeout(t);
	}
}

export async function handler(event) {
	const method =
		event.requestContext?.http?.method ?? event.httpMethod ?? "UNKNOWN";
	const origin = event.headers?.origin ?? event.headers?.Origin ?? "";
	const headers = corsHeaders(origin);

	if (method === "OPTIONS") return { statusCode: 200, headers, body: "" };
	if (method !== "POST")
		return respond(405, { error: "method_not_allowed" }, headers);

	let body;
	try {
		body = JSON.parse(event.body ?? "{}");
	} catch {
		return respond(400, { error: "invalid_json" }, headers);
	}

	// honeypot
	if (body.website) return respond(200, { ok: true }, headers);

	const ip = event.requestContext?.http?.sourceIp ?? "unknown";
	if (!checkRate(ip)) {
		return respond(429, { error: "rate_limit" }, headers);
	}

	const errors = validate(body);
	if (errors.length > 0) {
		return respond(400, { error: "validation", details: errors }, headers);
	}

	const attachmentUrls = await uploadAttachments(body.attachments);

	const issueUrl = await createIssue(
		body.type,
		body.summary.trim(),
		body.details.trim(),
		body.contactEmail?.trim() || undefined,
		attachmentUrls,
	);

	if (!issueUrl) {
		return respond(502, { error: "github_unavailable" }, headers);
	}

	return respond(200, { ok: true, issueUrl }, headers);
}
