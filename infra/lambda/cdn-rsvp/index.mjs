import { createHash } from "node:crypto";
import {
	AdminGetUserCommand,
	CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
	DynamoDBDocumentClient,
	PutCommand,
	QueryCommand,
	ScanCommand,
} from "@aws-sdk/lib-dynamodb";

// ── module-scope singletons ──────────────────────────────────────────────────
const dynamo = DynamoDBDocumentClient.from(
	new DynamoDBClient({ region: "us-west-2" }),
);
const cognito = new CognitoIdentityProviderClient({ region: "us-west-2" });
const s3 = new S3Client({ region: "us-east-1" });
const SNAPSHOT_BUCKET = "clouddelnorte.org";
const SNAPSHOT_KEY = "data/rsvp-counts.json";

// ── helpers ──────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
	"https://clouddelnorte.org",
	"https://awsug.clouddelnorte.org",
	"https://dev.clouddelnorte.org",
	"https://quantum.clouddelnorte.org",
]);

function corsHeaders(requestOrigin) {
	const origin = ALLOWED_ORIGINS.has(requestOrigin)
		? requestOrigin
		: "https://clouddelnorte.org";
	return {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Headers": "Content-Type,Authorization",
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	};
}

function log(level, msg, extra = {}) {
	console.log(JSON.stringify({ level, msg, ...extra }));
}

function respond(statusCode, body, headers) {
	return { statusCode, headers, body: JSON.stringify(body) };
}

// Copied verbatim from infra/lambda/speaker-proposals/index.mjs
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

// Deterministic anonymous key: "anon:" + first 16 hex chars of SHA-256 of
// lowercased trimmed email. Matches the strategy used by the
// github-issue-migration import so returning registrants hit the same
// partition key instead of creating a duplicate.
function deriveAnonSub(email) {
	const normalized = email.trim().toLowerCase();
	const hash = createHash("sha256").update(normalized).digest("hex");
	return `anon:${hash.slice(0, 16)}`;
}

// Maximum request body size (bytes). Rejects obviously abusive payloads before
// JSON parsing. 4 KB is generous for a name + email + eventId + group.
const MAX_BODY_BYTES = 4096;

// ── per-IP rate limit (mirror feedback/index.mjs rateMap) ────────────────────
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

// ── validation ───────────────────────────────────────────────────────────────
const EVENT_ID_RE = /^[a-z0-9-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getCapacities() {
	try {
		return JSON.parse(process.env.EVENT_CAPACITIES || "{}");
	} catch {
		return {};
	}
}

function validEventId(id) {
	return (
		typeof id === "string" &&
		id.length > 0 &&
		id.length <= 64 &&
		EVENT_ID_RE.test(id)
	);
}

function validateCreateBody(body, isAuthenticated) {
	const errors = [];
	if (!validEventId(body.eventId))
		errors.push("eventId must match ^[a-z0-9-]+$ (max 64 chars)");
	if (
		body.name !== undefined &&
		body.name !== null &&
		(typeof body.name !== "string" || body.name.length > 200)
	)
		errors.push("name must be a string ≤200 chars");
	if (!isAuthenticated) {
		// Anonymous path requires a valid email (used as the deterministic key)
		if (
			!body.email ||
			typeof body.email !== "string" ||
			!EMAIL_RE.test(body.email) ||
			body.email.length > 254
		)
			errors.push("email is required and must be a valid address (≤254 chars)");
		if (
			!body.name ||
			typeof body.name !== "string" ||
			body.name.trim().length === 0
		)
			errors.push("name is required for anonymous registration");
	} else {
		// Authenticated path: email is optional but must be valid if present
		if (
			body.email !== undefined &&
			body.email !== null &&
			(typeof body.email !== "string" ||
				!EMAIL_RE.test(body.email) ||
				body.email.length > 254)
		)
			errors.push("email must be a valid address (≤254 chars)");
	}
	return errors;
}

function buildTicketPayload(eventId, userSub) {
	// Same wire format as src/lib/rsvp.ts buildTicketPayload (v1, no signature).
	// Phase 3 door check-in will validate by looking the record up server-side
	// using cognito:AdminGetUser — no HMAC needed because volunteer-in-the-loop.
	return `cdn-ticket:v1:${eventId}:${userSub}`;
}

// ── DDB helpers ──────────────────────────────────────────────────────────────
// Table schema is PK=user_sub HASH, SK=event_id RANGE (no GSI). To count RSVPs
// for a single event we must Scan with a FilterExpression. Acceptable at our
// scale (≤50 items per event). If we add many events with hundreds of seats,
// switch to a GSI on event_id or a counter item.
async function countRsvpsForEvent(eventId) {
	let total = 0;
	let lastKey;
	do {
		const out = await dynamo.send(
			new ScanCommand({
				TableName: process.env.RSVP_TABLE,
				FilterExpression: "event_id = :e",
				ExpressionAttributeValues: { ":e": eventId },
				Select: "COUNT",
				ExclusiveStartKey: lastKey,
			}),
		);
		total += out.Count ?? 0;
		lastKey = out.LastEvaluatedKey;
	} while (lastKey);
	return total;
}

// Build a snapshot of {eventId: {capacity, taken, remaining}} for every event
// in EVENT_CAPACITIES and write it to s3://clouddelnorte.org/data/rsvp-counts.json.
// Used by:
//   - the EventBridge scheduled handler (refresh every 5 minutes)
//   - the POST /rsvp success path (immediate refresh after a confirmed RSVP)
// Failures are logged but never throw — a snapshot write failure must never
// break the user-facing RSVP flow.
async function writeSnapshot() {
	const capacities = getCapacities();
	const eventIds = Object.keys(capacities);
	const counts = {};
	for (const eventId of eventIds) {
		try {
			const capacity = capacities[eventId];
			const taken = await countRsvpsForEvent(eventId);
			counts[eventId] = {
				capacity,
				taken,
				remaining: Math.max(0, capacity - taken),
			};
		} catch (err) {
			log("warn", "snapshot_event_count_failed", { eventId, err: err.message });
		}
	}
	const body = JSON.stringify({
		generatedAt: new Date().toISOString(),
		counts,
	});
	try {
		await s3.send(
			new PutObjectCommand({
				Bucket: SNAPSHOT_BUCKET,
				Key: SNAPSHOT_KEY,
				Body: body,
				ContentType: "application/json",
				CacheControl: "public, max-age=60",
			}),
		);
		log("info", "snapshot_written", { events: eventIds.length });
	} catch (err) {
		log("error", "snapshot_write_failed", { err: err.message });
	}
}

async function findExistingRsvp(userSub, eventId) {
	const out = await dynamo.send(
		new QueryCommand({
			TableName: process.env.RSVP_TABLE,
			KeyConditionExpression: "user_sub = :u AND event_id = :e",
			ExpressionAttributeValues: { ":u": userSub, ":e": eventId },
		}),
	);
	return out.Items?.[0] ?? null;
}

// ── Phase 3 prep: volunteer-mediated door check-in helper ────────────────────
// Not wired to any current route. The volunteer-facing scanner UI (separate
// wave) will import this to look up the RSVP'd user's profile when scanning a
// ticket QR at the door. Kept here to exercise the Cognito/AdminGetUser import
// surface so Phase 3 only needs the route, not new IAM.
export async function lookupUser(userSub) {
	const out = await cognito.send(
		new AdminGetUserCommand({
			UserPoolId: process.env.USER_POOL_ID,
			Username: userSub,
		}),
	);
	return out;
}

// ── admin route handlers ─────────────────────────────────────────────────────

/** Decode the cognito:groups claim from the JWT to verify moderator status. */
function decodeJwtGroups(authHeader) {
	try {
		if (!authHeader?.startsWith("Bearer ")) return [];
		const token = authHeader.slice(7);
		const parts = token.split(".");
		if (parts.length < 2) return [];
		const payload = JSON.parse(
			Buffer.from(
				parts[1].replace(/-/g, "+").replace(/_/g, "/"),
				"base64",
			).toString("utf8"),
		);
		return payload["cognito:groups"] || [];
	} catch {
		return [];
	}
}

async function handleAdminListRsvps(event, headers) {
	const authHeader =
		event.headers?.authorization || event.headers?.Authorization;
	const userSub = decodeJwtSub(authHeader);
	if (!userSub) return respond(401, { error: "unauthorized" }, headers);

	const groups = decodeJwtGroups(authHeader);
	if (!groups.includes("moderators")) {
		return respond(403, { error: "moderator_access_required" }, headers);
	}

	const eventId = event.pathParameters?.eventId || "";
	if (!validEventId(eventId)) {
		return respond(400, { error: "invalid_event_id" }, headers);
	}

	// Scan for all records matching this event_id.
	let items = [];
	let lastKey;
	do {
		const out = await dynamo.send(
			new ScanCommand({
				TableName: process.env.RSVP_TABLE,
				FilterExpression: "event_id = :e",
				ExpressionAttributeValues: { ":e": eventId },
				ExclusiveStartKey: lastKey,
			}),
		);
		items = items.concat(out.Items ?? []);
		lastKey = out.LastEvaluatedKey;
	} while (lastKey);

	const records = items.map((it) => ({
		event_id: it.event_id,
		user_sub: it.user_sub,
		name: it.name ?? null,
		email: it.email ?? null,
		group: it.group ?? null,
		created_at: it.created_at ?? null,
		migrated: it.source === "github-issue-migration" || !!it.migrated_at,
		is_test: !!it.is_test,
	}));

	return respond(200, { records }, headers);
}

// ── route handlers ───────────────────────────────────────────────────────────
async function handleSpots(eventId, headers) {
	if (!validEventId(eventId))
		return respond(400, { error: "invalid_event_id" }, headers);

	const capacities = getCapacities();
	const capacity = capacities[eventId];
	if (typeof capacity !== "number")
		return respond(404, { error: "unknown_event" }, headers);

	const taken = await countRsvpsForEvent(eventId);
	const remaining = Math.max(0, capacity - taken);
	return respond(200, { eventId, capacity, taken, remaining }, headers);
}

async function handleListMine(authHeader, headers) {
	const userSub = decodeJwtSub(authHeader);
	if (!userSub) return respond(401, { error: "unauthorized" }, headers);

	const out = await dynamo.send(
		new QueryCommand({
			TableName: process.env.RSVP_TABLE,
			KeyConditionExpression: "user_sub = :u",
			ExpressionAttributeValues: { ":u": userSub },
		}),
	);
	const rsvps = (out.Items ?? []).map((it) => ({
		eventId: it.event_id,
		createdAt: it.created_at,
		ticketPayload: buildTicketPayload(it.event_id, it.user_sub),
	}));
	return respond(200, { rsvps }, headers);
}

async function handleCreate(event, headers) {
	// ── body size guard ──────────────────────────────────────────────────────
	const rawBody = event.body || "";
	if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
		return respond(413, { error: "payload_too_large" }, headers);
	}

	// ── auth: optional ──────────────────────────────────────────────────────
	const authHeader =
		event.headers?.authorization || event.headers?.Authorization;
	const cognitoSub = decodeJwtSub(authHeader);
	const isAuthenticated = !!cognitoSub;

	let body;
	try {
		body = JSON.parse(rawBody || "{}");
	} catch {
		return respond(400, { error: "invalid_json" }, headers);
	}

	// Reject unexpected top-level keys to limit abuse surface
	const ALLOWED_KEYS = new Set(["eventId", "name", "email", "group"]);
	const unexpected = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k));
	if (unexpected.length > 0) {
		return respond(
			400,
			{
				error: "validation",
				details: [`unexpected fields: ${unexpected.join(", ")}`],
			},
			headers,
		);
	}

	const errors = validateCreateBody(body, isAuthenticated);
	if (errors.length > 0)
		return respond(400, { error: "validation", details: errors }, headers);

	const eventId = body.eventId;
	const capacities = getCapacities();
	const capacity = capacities[eventId];
	if (typeof capacity !== "number")
		return respond(404, { error: "unknown_event" }, headers);

	const ip =
		event.requestContext?.http?.sourceIp ||
		event.requestContext?.identity?.sourceIp ||
		"unknown";
	if (!checkRate(ip)) return respond(429, { error: "rate_limit" }, headers);

	// Derive the partition key: Cognito sub for authenticated users,
	// deterministic hash for anonymous (matches github-issue-migration keys).
	const userSub = isAuthenticated ? cognitoSub : deriveAnonSub(body.email);

	// Idempotent: if user already has an RSVP for this event, return it (200).
	const existing = await findExistingRsvp(userSub, eventId);
	if (existing) {
		return respond(
			200,
			{
				ok: true,
				eventId,
				createdAt: existing.created_at,
				ticketPayload: buildTicketPayload(eventId, userSub),
				alreadyRsvpd: true,
			},
			headers,
		);
	}

	// Capacity check (best-effort; small race window acceptable at this scale).
	const taken = await countRsvpsForEvent(eventId);
	if (taken >= capacity) {
		return respond(409, { error: "capacity_full", capacity, taken }, headers);
	}

	const createdAt = new Date().toISOString();
	const item = {
		user_sub: userSub,
		event_id: eventId,
		name: body.name?.trim() || null,
		email: body.email?.trim() || null,
		created_at: createdAt,
	};

	try {
		await dynamo.send(
			new PutCommand({
				TableName: process.env.RSVP_TABLE,
				Item: item,
				// Belt-and-braces against a race between findExistingRsvp() and PutItem.
				ConditionExpression:
					"attribute_not_exists(user_sub) AND attribute_not_exists(event_id)",
			}),
		);
	} catch (err) {
		if (err.name === "ConditionalCheckFailedException") {
			const racey = await findExistingRsvp(userSub, eventId);
			if (racey) {
				return respond(
					200,
					{
						ok: true,
						eventId,
						createdAt: racey.created_at,
						ticketPayload: buildTicketPayload(eventId, racey.user_sub),
						alreadyRsvpd: true,
					},
					headers,
				);
			}
		}
		throw err;
	}

	// Refresh the static snapshot so the next page load reflects the new count.
	// Fire-and-await: a few hundred ms of latency on the create response is
	// acceptable; the user has already submitted and is waiting for confirmation.
	await writeSnapshot();

	log("info", "rsvp created", {
		userSub,
		eventId,
		authenticated: isAuthenticated,
	});
	return respond(
		201,
		{
			ok: true,
			eventId,
			createdAt,
			ticketPayload: buildTicketPayload(eventId, userSub),
			alreadyRsvpd: false,
		},
		headers,
	);
}

// ── handler ──────────────────────────────────────────────────────────────────
// Event shape: AWS Lambda payload format v2 (API Gateway HTTP V2).
export async function handler(event) {
	// EventBridge scheduled invocation — refresh the static rsvp-counts.json snapshot.
	// No HTTP response is consumed; the rule's purpose is to keep the JSON fresh
	// for static-served reads from /data/rsvp-counts.json.
	if (
		event.source === "aws.events" ||
		event["detail-type"] === "Scheduled Event"
	) {
		await writeSnapshot();
		return { statusCode: 200, body: "snapshot_refreshed" };
	}
	const requestId = event.requestContext?.requestId || "local";
	const requestOrigin = event.headers?.origin || event.headers?.Origin || "";
	const headers = corsHeaders(requestOrigin);

	const method =
		event.requestContext?.http?.method || event.httpMethod || "UNKNOWN";
	const routeKey = event.routeKey || "";

	if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

	try {
		if (routeKey === "POST /rsvp") return await handleCreate(event, headers);
		if (routeKey === "GET /rsvp") {
			const authHeader =
				event.headers?.authorization || event.headers?.Authorization;
			return await handleListMine(authHeader, headers);
		}
		if (routeKey === "GET /rsvp/{eventId}/spots") {
			const eventId = event.pathParameters?.eventId || "";
			return await handleSpots(eventId, headers);
		}
		if (routeKey === "GET /admin/rsvps/{eventId}") {
			return await handleAdminListRsvps(event, headers);
		}
		return respond(404, { error: "not_found", routeKey }, headers);
	} catch (err) {
		log("error", "unhandled error", {
			requestId,
			err: err.message,
			stack: err.stack,
		});
		return respond(500, { error: "internal_server_error" }, headers);
	}
}
