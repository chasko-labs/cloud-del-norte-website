// cdn-recordings Lambda
// Lists recording files from S3 and returns presigned download URLs.
// Auth: Cognito JWT via API Gateway authorizer, moderators group required.
// Route: GET /admin/recordings

import {
	GetObjectCommand,
	ListObjectsV2Command,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.RECORDINGS_BUCKET || "jitsi-video-platform-recordings-4b917dff";
const REGION = process.env.AWS_REGION || "us-west-2";
const PRESIGN_EXPIRY = 3600; // 1 hour

const s3 = new S3Client({ region: REGION });

const ALLOWED_ORIGINS = new Set([
	"https://quantum.clouddelnorte.org",
	"https://awsug.clouddelnorte.org",
	"https://dev.clouddelnorte.org",
]);

function corsHeaders(requestOrigin) {
	const origin = ALLOWED_ORIGINS.has(requestOrigin)
		? requestOrigin
		: "https://quantum.clouddelnorte.org";
	return {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Headers": "Content-Type,Authorization",
		"Access-Control-Allow-Methods": "GET,OPTIONS",
	};
}

function response(statusCode, body, headers) {
	return { statusCode, headers, body: JSON.stringify(body) };
}

function extractGroups(event) {
	try {
		const auth = event.headers?.authorization || event.headers?.Authorization;
		if (!auth?.startsWith("Bearer ")) return [];
		const token = auth.slice(7);
		const parts = token.split(".");
		if (parts.length < 2) return [];
		const payload = JSON.parse(
			Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
		);
		return payload["cognito:groups"] || [];
	} catch {
		return [];
	}
}

export async function handler(event) {
	const requestOrigin = event.headers?.origin || event.headers?.Origin || "";
	const headers = corsHeaders(requestOrigin);

	const method = event.requestContext?.http?.method || event.httpMethod || "UNKNOWN";
	if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

	// Auth check — moderators only
	const groups = extractGroups(event);
	if (!groups.includes("moderators")) {
		return response(403, { error: "moderator_access_required" }, headers);
	}

	try {
		// List all recordings (prefix: recordings/)
		const listResult = await s3.send(
			new ListObjectsV2Command({
				Bucket: BUCKET,
				Prefix: "recordings/",
			}),
		);

		const objects = (listResult.Contents || [])
			.filter((obj) => obj.Key.endsWith(".mp4") || obj.Key.endsWith(".webm"))
			.sort((a, b) => (b.LastModified || 0) - (a.LastModified || 0));

		// Generate presigned URLs for each recording
		const recordings = await Promise.all(
			objects.map(async (obj) => {
				const url = await getSignedUrl(
					s3,
					new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }),
					{ expiresIn: PRESIGN_EXPIRY },
				);

				// Parse filename from key: recordings/YYYY-MM-DD/roomname_timestamp.mp4
				const parts = obj.Key.split("/");
				const date = parts[1] || "unknown";
				const filename = parts[2] || obj.Key;

				return {
					key: obj.Key,
					filename,
					date,
					size: obj.Size,
					lastModified: obj.LastModified?.toISOString(),
					downloadUrl: url,
				};
			}),
		);

		return response(200, { recordings }, headers);
	} catch (err) {
		console.error("recordings list error:", err);
		return response(500, { error: "internal_server_error" }, headers);
	}
}
