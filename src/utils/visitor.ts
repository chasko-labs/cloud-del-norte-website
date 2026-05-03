// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Shared visitor IP-geo source. Single fetch per page load even when both
// LioraFrame (sticky note 2 greeting) and Shell (auto-locale detection) call
// loadVisitorInfo() concurrently — module-level promise dedupes. 24h
// localStorage cache survives across page loads.

export interface VisitorInfo {
	ip: string;
	country: string; // ISO 3166-1 alpha-2, uppercase
	greeting: string;
	flag: string;
}

export const VISITOR_CACHE_KEY = "cdn.visitor.v2";
const VISITOR_TTL_MS = 24 * 60 * 60 * 1000;

// Common ISO codes → display country names. Falls back to the raw country
// code if not in this map. Keeps bundle slim vs shipping a full ISO 3166 dict.
const COUNTRY_NAME: Record<string, string> = {
	US: "USA",
	MX: "Mexico",
	CA: "Canada",
	GB: "the UK",
	DE: "Germany",
	FR: "France",
	ES: "Spain",
	BR: "Brazil",
	JP: "Japan",
	KR: "Korea",
	CN: "China",
	IN: "India",
	AU: "Australia",
	NL: "the Netherlands",
	IT: "Italy",
	PL: "Poland",
	SE: "Sweden",
	NO: "Norway",
	DK: "Denmark",
	FI: "Finland",
	IE: "Ireland",
	PT: "Portugal",
	GR: "Greece",
	TR: "Turkey",
	AR: "Argentina",
	CL: "Chile",
	CO: "Colombia",
	PE: "Peru",
	VE: "Venezuela",
	CR: "Costa Rica",
	PA: "Panama",
	GT: "Guatemala",
	HN: "Honduras",
	NI: "Nicaragua",
	SV: "El Salvador",
	DO: "the Dominican Republic",
	CU: "Cuba",
	PR: "Puerto Rico",
	UY: "Uruguay",
	PY: "Paraguay",
	BO: "Bolivia",
	EC: "Ecuador",
	GQ: "Equatorial Guinea",
	NG: "Nigeria",
	ZA: "South Africa",
	KE: "Kenya",
	EG: "Egypt",
	IL: "Israel",
	SA: "Saudi Arabia",
	AE: "the UAE",
	PK: "Pakistan",
	BD: "Bangladesh",
	ID: "Indonesia",
	TH: "Thailand",
	VN: "Vietnam",
	PH: "the Philippines",
	MY: "Malaysia",
	SG: "Singapore",
	NZ: "New Zealand",
	RU: "Russia",
	UA: "Ukraine",
};

// ISO 3166-1 alpha-2 → regional-indicator pair → flag emoji.
// 65 (charCode 'A') → 0x1F1E6 (regional indicator A) requires offset 127397.
function countryToFlag(code: string): string {
	if (!/^[A-Za-z]{2}$/.test(code)) return "";
	return code
		.toUpperCase()
		.split("")
		.map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
		.join("");
}

// Synchronous cache read — returns null if no entry, expired, or unparseable.
// Used by Shell on mount before kicking off the async fetch path; lets the
// auto-locale flip happen on second pageview without any network round-trip.
export function readCachedVisitor(): VisitorInfo | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(VISITOR_CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { ts: number; data: VisitorInfo };
		if (Date.now() - parsed.ts >= VISITOR_TTL_MS) return null;
		return parsed.data;
	} catch {
		return null;
	}
}

// Module-level promise — second/third concurrent caller gets the same in-flight
// fetch instead of triggering parallel network requests.
let inFlight: Promise<VisitorInfo | null> | null = null;

export function loadVisitorInfo(): Promise<VisitorInfo | null> {
	const cached = readCachedVisitor();
	if (cached) return Promise.resolve(cached);
	if (inFlight) return inFlight;

	inFlight = (async () => {
		try {
			if (typeof fetch === "undefined") return null;
			const res = await fetch("https://ipinfo.io/json", {
				headers: { accept: "application/json" },
			});
			if (!res.ok) return null;
			const data = (await res.json()) as { ip?: string; country?: string };
			if (!data.ip || !data.country) return null;
			const code = data.country.toUpperCase();
			const info: VisitorInfo = {
				ip: data.ip,
				country: code,
				greeting: COUNTRY_NAME[code] ?? code,
				flag: countryToFlag(code),
			};
			try {
				localStorage.setItem(
					VISITOR_CACHE_KEY,
					JSON.stringify({ ts: Date.now(), data: info }),
				);
			} catch {
				// localStorage disabled — non-fatal, in-memory dedupe still holds
			}
			return info;
		} catch {
			return null;
		} finally {
			// Allow retry on next caller after this resolves (failed fetch
			// returns null; success means subsequent calls hit the cache anyway)
			inFlight = null;
		}
	})();

	return inFlight;
}
