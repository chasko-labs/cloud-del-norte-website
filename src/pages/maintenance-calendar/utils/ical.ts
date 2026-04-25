import type { TechCalendar } from "../types";

const ICAL_HEADER = [
	"BEGIN:VCALENDAR",
	"VERSION:2.0",
	"PRODID:-//AWSUGCloudDelNorte//MaintenanceCalendar//EN",
	"CALSCALE:GREGORIAN",
	"METHOD:PUBLISH",
].join("\r\n");

const ICAL_FOOTER = "END:VCALENDAR";

function formatDate(isoDate: string): string {
	// Convert ISO date "2025-09-15" → "20250915" for DTSTART;VALUE=DATE
	return isoDate.replace(/-/g, "");
}

function sanitize(text: string): string {
	// Escape commas, semicolons, backslashes per RFC 5545
	return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function makeUID(techId: string, label: string): string {
	return `${techId}-${label.toLowerCase().replace(/\s+/g, "-")}@awsug-cloudnorte`;
}

export interface ICalEvent {
	uid: string;
	summary: string;
	dtstart: string; // formatted YYYYMMDD
	description: string;
	url?: string;
}

export function techToEvents(tech: TechCalendar): ICalEvent[] {
	const events: ICalEvent[] = [];

	if (tech.projectedNextVersion) {
		events.push({
			uid: makeUID(tech.id, "next-release"),
			summary: sanitize(`${tech.name}: Projected Next Release`),
			dtstart: formatDate(tech.projectedNextVersion.projectedDate),
			description: sanitize(tech.projectedNextVersion.basedOn),
			url: tech.sourceUrl,
		});
	}

	if (tech.projectedNextLTS) {
		events.push({
			uid: makeUID(tech.id, "next-lts"),
			summary: sanitize(`${tech.name}: Projected Next LTS`),
			dtstart: formatDate(tech.projectedNextLTS.projectedDate),
			description: sanitize(tech.projectedNextLTS.basedOn),
			url: tech.sourceUrl,
		});
	}

	return events;
}

function eventToVEVENT(event: ICalEvent): string {
	const lines = [
		"BEGIN:VEVENT",
		`UID:${event.uid}`,
		`DTSTART;VALUE=DATE:${event.dtstart}`,
		`SUMMARY:${event.summary}`,
		`DESCRIPTION:${event.description}`,
	];
	if (event.url) lines.push(`URL:${event.url}`);
	lines.push("END:VEVENT");
	return lines.join("\r\n");
}

export function generateICS(techs: TechCalendar[]): string {
	const events = techs.flatMap(techToEvents).map(eventToVEVENT);
	if (events.length === 0) return [ICAL_HEADER, ICAL_FOOTER].join("\r\n");
	return [ICAL_HEADER, ...events, ICAL_FOOTER].join("\r\n");
}

export function generateICSForTech(tech: TechCalendar): string {
	return generateICS([tech]);
}

export function downloadICS(filename: string, content: string): void {
	const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
