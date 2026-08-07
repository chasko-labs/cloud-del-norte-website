// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

interface CalendarEventParams {
	title: string;
	scheduledStart: string; // ISO 8601
	durationMinutes: number;
	description: string;
	roomHash: string;
}

/**
 * Formats a Date to Google Calendar UTC format: YYYYMMDDTHHmmssZ
 */
function toGoogleCalendarDate(date: Date): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const d = String(date.getUTCDate()).padStart(2, "0");
	const h = String(date.getUTCHours()).padStart(2, "0");
	const min = String(date.getUTCMinutes()).padStart(2, "0");
	const s = String(date.getUTCSeconds()).padStart(2, "0");
	return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * Builds a pre-filled Google Calendar event URL.
 */
export function buildGoogleCalendarUrl(params: CalendarEventParams): string {
	const { title, scheduledStart, durationMinutes, description, roomHash } =
		params;
	const joinUrl = `https://clouddelnorte.org/m/${roomHash}`;

	const start = new Date(scheduledStart);
	const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

	const dates = `${toGoogleCalendarDate(start)}/${toGoogleCalendarDate(end)}`;

	const url = new URL("https://calendar.google.com/calendar/event");
	url.searchParams.set("action", "TEMPLATE");
	url.searchParams.set("text", title);
	url.searchParams.set("dates", dates);
	url.searchParams.set("details", description);
	url.searchParams.set("location", joinUrl);

	return url.toString();
}
