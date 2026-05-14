import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	PutCommand,
	ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME || "cdn-speaker-proposals";

export async function handler(event) {
	const method = event.requestContext?.http?.method || event.httpMethod;
	const path = event.requestContext?.http?.path || event.path;

	const headers = {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "https://awsug.clouddelnorte.org",
		"Access-Control-Allow-Headers": "Content-Type,Authorization",
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	};

	if (method === "OPTIONS") return { statusCode: 200, headers, body: "" };

	try {
		if (method === "POST" && path === "/proposals") {
			const body = JSON.parse(event.body);
			const item = {
				id: randomUUID(),
				name: body.name,
				topic: body.topic,
				description: body.description,
				preferredDates: body.preferredDates,
				email: body.email,
				status: "pending",
				createdAt: new Date().toISOString(),
			};
			await client.send(new PutCommand({ TableName: TABLE, Item: item }));
			return {
				statusCode: 201,
				headers,
				body: JSON.stringify({ ok: true, id: item.id }),
			};
		}

		if (method === "GET" && path === "/proposals") {
			const result = await client.send(new ScanCommand({ TableName: TABLE }));
			return {
				statusCode: 200,
				headers,
				body: JSON.stringify({ proposals: result.Items }),
			};
		}

		return {
			statusCode: 404,
			headers,
			body: JSON.stringify({ error: "not found" }),
		};
	} catch (err) {
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({ error: err.message }),
		};
	}
}
