// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export const TZ_ZONES: { label: string; tz: string }[] = [
	{ label: "El Paso", tz: "America/Denver" },
	{ label: "Boston", tz: "America/New_York" },
	{ label: "Seattle", tz: "America/Los_Angeles" },
	{ label: "Greenwich", tz: "UTC" },
	{ label: "Shahrisabz", tz: "Asia/Samarkand" },
];

/** Format a date+time (interpreted as America/Denver) into the given tz. */
export function formatInTz(isoDate: string, isoTime: string, tz: string): string {
	const [y, m, d] = isoDate.split("-").map(Number);
	const [h, min] = isoTime.split(":").map(Number);
	const denverFmt = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Denver",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	const approxUtc = Date.UTC(y, m - 1, d, h, min);
	const denverParts = denverFmt.formatToParts(approxUtc);
	const get = (type: string) =>
		Number(denverParts.find((p) => p.type === type)?.value ?? 0);
	const offsetMin =
		(get("hour") - new Date(approxUtc).getUTCHours()) * 60 +
		(get("minute") - new Date(approxUtc).getUTCMinutes());
	const absoluteMs = approxUtc - offsetMin * 60_000;
	return new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(absoluteMs);
}
