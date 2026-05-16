// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export const FALLBACK_ZONES: string[] = [
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Anchorage",
	"America/Honolulu",
	"America/Toronto",
	"America/Vancouver",
	"America/Mexico_City",
	"America/Bogota",
	"America/Lima",
	"America/Sao_Paulo",
	"America/Buenos_Aires",
	"America/Santiago",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Europe/Madrid",
	"Europe/Rome",
	"Europe/Warsaw",
	"Europe/Istanbul",
	"Asia/Dubai",
	"Asia/Kolkata",
	"Asia/Bangkok",
	"Asia/Singapore",
	"Asia/Shanghai",
	"Asia/Tokyo",
	"Asia/Seoul",
	"Australia/Sydney",
	"Pacific/Auckland",
	"UTC",
];

/** Return sorted IANA timezone list, preferring Intl.supportedValuesOf if available. */
export function getSupportedZones(): string[] {
	try {
		// biome-ignore lint/suspicious/noExplicitAny: runtime feature detection
		const all = (Intl as any).supportedValuesOf("timeZone") as string[];
		return all;
	} catch {
		return [...FALLBACK_ZONES].sort();
	}
}

export const LS_TZ_KEY = "cdn-meetings-tz";

export function getBrowserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "UTC";
	}
}

export function getStoredTimezone(): string {
	try {
		return localStorage.getItem(LS_TZ_KEY) ?? getBrowserTimezone();
	} catch {
		return getBrowserTimezone();
	}
}

export function setStoredTimezone(tz: string): void {
	try {
		localStorage.setItem(LS_TZ_KEY, tz);
	} catch {
		// ignore — storage may be unavailable in private mode
	}
}

/** Format a meeting date+time (stored as America/Denver) into the given tz.
 *  Returns "date time ABBR", e.g. "Sat, May 17, 2:00 PM MDT" */
export function formatInTz(
	isoDate: string,
	isoTime: string,
	tz: string,
): string {
	const [y, m, d] = isoDate.split("-").map(Number);
	const [h, min] = isoTime.split(":").map(Number);
	// Determine the UTC instant from the Denver-local date+time
	const approxUtc = Date.UTC(y, m - 1, d, h, min);
	const denverFmt = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Denver",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	const denverParts = denverFmt.formatToParts(approxUtc);
	const get = (type: string) =>
		Number(denverParts.find((p) => p.type === type)?.value ?? 0);
	const offsetMin =
		(get("hour") - new Date(approxUtc).getUTCHours()) * 60 +
		(get("minute") - new Date(approxUtc).getUTCMinutes());
	const absoluteMs = approxUtc - offsetMin * 60_000;
	// Format with abbreviated timezone name
	return new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZoneName: "short",
	}).format(absoluteMs);
}

/** Legacy popover zones kept for backward-compat if anything still imports TZ_ZONES. */
export const TZ_ZONES: { label: string; tz: string }[] = [
	{ label: "El Paso", tz: "America/Denver" },
	{ label: "Boston", tz: "America/New_York" },
	{ label: "Seattle", tz: "America/Los_Angeles" },
	{ label: "Greenwich", tz: "UTC" },
	{ label: "Shahrisabz", tz: "Asia/Samarkand" },
];
