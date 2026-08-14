// cdn-scheduled-meetings CRUD Lambda
// Handles: create, list, get, delete scheduled meetings
// Auth: Cognito JWT, moderators group required
import { randomUUID, randomBytes } from "node:crypto";

const TABLE_NAME = process.env.TABLE_NAME || "cdn-scheduled-meetings";
const REGION = process.env.AWS_REGION || "us-west-2";

// Lazy-init DynamoDB client
let ddbClient;
async function getDDB() {
	if (ddbClient) return ddbClient;
	const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
	const { DynamoDBDocumentClient } = await import(
		"@aws-sdk/lib-dynamodb"
	);
	const client = new DynamoDBClient({ region: REGION });
	ddbClient = DynamoDBDocumentClient.from(client);
	return ddbClient;
}

function response(statusCode, body, headers = {}) {
	return {
		statusCode,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "https://awsug.clouddelnorte.org",
			"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
			"Access-Control-Allow-Headers": "content-type,authorization",
			...headers,
		},
		body: JSON.stringify(body),
	};
}

function extractGroups(event) {
	try {
		const claims =
			event.requestContext?.authorizer?.jwt?.claims ||
			event.requestContext?.authorizer?.claims ||
			{};
		const groups = claims["cognito:groups"] || "";
		return typeof groups === "string" ? groups.split(",") : groups;
	} catch {
		return [];
	}
}

function extractSub(event) {
	try {
		const claims =
			event.requestContext?.authorizer?.jwt?.claims ||
			event.requestContext?.authorizer?.claims ||
			{};
		return claims.sub || null;
	} catch {
		return null;
	}
}

async function createScheduled(event) {
	const body = JSON.parse(event.body || "{}");
	const { title, description, scheduled_start, duration_minutes, speaker_bio_url, meetup_rsvp_url } = body;

	if (!title || !scheduled_start) {
		return response(400, { error: "title and scheduled_start are required" });
	}

	const meeting_id = randomUUID();
	const room_hash = randomBytes(16).toString("hex");
	const now = new Date().toISOString();
	const startEpoch = Math.floor(new Date(scheduled_start).getTime() / 1000);
	const dur = duration_minutes || 60;
	const ttl_epoch = startEpoch + dur * 60 + 30 * 24 * 3600;

	const item = {
		meeting_id,
		scheduled_start,
		title,
		description: description || "",
		duration_minutes: dur,
		room_hash,
		created_by_sub: extractSub(event),
		status: "scheduled",
		speaker_bio_url: speaker_bio_url || "",
		meetup_rsvp_url: meetup_rsvp_url || "",
		created_at: now,
		updated_at: now,
		ttl_epoch,
	};

	const ddb = await getDDB();
	const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
	await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

	return response(201, { meeting: item });
}

async function listScheduled(event) {
	const view = event.queryStringParameters?.view || "upcoming";
	const now = new Date().toISOString();

	const ddb = await getDDB();
	const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");

	// Scan with filter — acceptable at community-group scale (tens of meetings)
	const params = {
		TableName: TABLE_NAME,
		FilterExpression:
			view === "past"
				? "scheduled_start < :now"
				: "scheduled_start >= :now",
		ExpressionAttributeValues: { ":now": now },
	};

	const result = await ddb.send(new ScanCommand(params));
	const meetings = (result.Items || []).sort((a, b) =>
		view === "past"
			? b.scheduled_start.localeCompare(a.scheduled_start)
			: a.scheduled_start.localeCompare(b.scheduled_start),
	);

	return response(200, { meetings });
}

async function getScheduled(event) {
	const meeting_id = event.pathParameters?.meeting_id;
	if (!meeting_id) return response(400, { error: "meeting_id required" });

	const ddb = await getDDB();
	const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");

	// Need to scan because we only have the PK (meeting_id) without the SK
	const result = await ddb.send(
		new ScanCommand({
			TableName: TABLE_NAME,
			FilterExpression: "meeting_id = :id",
			ExpressionAttributeValues: { ":id": meeting_id },
			Limit: 1,
		}),
	);

	if (!result.Items || result.Items.length === 0) {
		return response(404, { error: "not found" });
	}

	return response(200, { meeting: result.Items[0] });
}

async function updateScheduled(event) {
	const meeting_id = event.pathParameters?.meeting_id;
	if (!meeting_id) return response(400, { error: "meeting_id required" });

	const body = JSON.parse(event.body || "{}");

	const ddb = await getDDB();
	const { ScanCommand, PutCommand } = await import("@aws-sdk/lib-dynamodb");

	// Fetch existing
	const existing = await ddb.send(
		new ScanCommand({
			TableName: TABLE_NAME,
			FilterExpression: "meeting_id = :id",
			ExpressionAttributeValues: { ":id": meeting_id },
			Limit: 1,
		}),
	);

	if (!existing.Items || existing.Items.length === 0) {
		return response(404, { error: "not found" });
	}

	const item = { ...existing.Items[0] };

	// Update allowed fields
	if (body.title !== undefined) item.title = body.title;
	if (body.description !== undefined) item.description = body.description;
	if (body.scheduled_start !== undefined) item.scheduled_start = body.scheduled_start;
	if (body.duration_minutes !== undefined) item.duration_minutes = body.duration_minutes;
	if (body.status !== undefined) item.status = body.status;
	if (body.speaker_bio_url !== undefined) item.speaker_bio_url = body.speaker_bio_url;
	if (body.meetup_rsvp_url !== undefined) item.meetup_rsvp_url = body.meetup_rsvp_url;
	item.updated_at = new Date().toISOString();

	// Recalculate TTL if start changed
	if (body.scheduled_start) {
		const startEpoch = Math.floor(new Date(body.scheduled_start).getTime() / 1000);
		item.ttl_epoch = startEpoch + (item.duration_minutes || 60) * 60 + 30 * 24 * 3600;
	}

	// If scheduled_start changed, we need to delete old + put new (composite key)
	if (body.scheduled_start && body.scheduled_start !== existing.Items[0].scheduled_start) {
		const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
		await ddb.send(
			new DeleteCommand({
				TableName: TABLE_NAME,
				Key: {
					meeting_id: existing.Items[0].meeting_id,
					scheduled_start: existing.Items[0].scheduled_start,
				},
			}),
		);
	}

	await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
	return response(200, { meeting: item });
}

async function deleteScheduled(event) {
	const meeting_id = event.pathParameters?.meeting_id;
	if (!meeting_id) return response(400, { error: "meeting_id required" });

	const ddb = await getDDB();
	const { ScanCommand, DeleteCommand } = await import("@aws-sdk/lib-dynamodb");

	// Find the item first (need SK for delete)
	const result = await ddb.send(
		new ScanCommand({
			TableName: TABLE_NAME,
			FilterExpression: "meeting_id = :id",
			ExpressionAttributeValues: { ":id": meeting_id },
			Limit: 1,
		}),
	);

	if (!result.Items || result.Items.length === 0) {
		return response(404, { error: "not found" });
	}

	await ddb.send(
		new DeleteCommand({
			TableName: TABLE_NAME,
			Key: {
				meeting_id: result.Items[0].meeting_id,
				scheduled_start: result.Items[0].scheduled_start,
			},
		}),
	);

	return response(200, { deleted: true });
}

export async function handler(event) {
	// CORS preflight
	if (event.requestContext?.http?.method === "OPTIONS") {
		return response(200, {});
	}

	const method = event.requestContext?.http?.method || event.httpMethod;
	const path = event.requestContext?.http?.path || event.path || "";

	// Auth check — require moderators group
	const groups = extractGroups(event);
	if (!groups.includes("moderators")) {
		return response(403, { error: "moderators group required" });
	}

	// Route
	if (method === "POST" && path === "/admin/scheduled-meetings") {
		return createScheduled(event);
	}
	if (method === "GET" && path === "/admin/scheduled-meetings") {
		return listScheduled(event);
	}
	if (method === "GET" && path.startsWith("/admin/scheduled-meetings/")) {
		return getScheduled(event);
	}
	if (method === "PUT" && path.startsWith("/admin/scheduled-meetings/")) {
		return updateScheduled(event);
	}
	if (method === "DELETE" && path.startsWith("/admin/scheduled-meetings/")) {
		return deleteScheduled(event);
	}

	return response(404, { error: "not found" });
}
