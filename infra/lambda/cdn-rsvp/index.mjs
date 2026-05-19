import {
	AdminGetUserCommand,
	CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
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

// ── helpers ──────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
	"https://clouddelnorte.org",
	"https://awsug.clouddelnorte.org",
	"https://dev.clouddelnorte.org",
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

function validateCreateBody(body) {
	const errors = [];
	if (!validEventId(body.eventId))
		errors.push("eventId must match ^[a-z0-9-]+$ (max 64 chars)");
	if (
		body.name !== undefined &&
		body.name !== null &&
		(typeof body.name !== "string" || body.name.length > 200)
	)
		errors.push("name must be a string ≤200 chars");
	if (
		body.email !== undefined &&
		body.email !== null &&
		(typeof body.email !== "string" || !EMAIL_RE.test(body.email))
	)
		errors.push("email must be a valid address");
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
	const authHeader =
		event.headers?.authorization || event.headers?.Authorization;
	const userSub = decodeJwtSub(authHeader);
	if (!userSub) return respond(401, { error: "unauthorized" }, headers);

	let body;
	try {
		body = JSON.parse(event.body || "{}");
	} catch {
		return respond(400, { error: "invalid_json" }, headers);
	}

	const errors = validateCreateBody(body);
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

	log("info", "rsvp created", { userSub, eventId });
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
