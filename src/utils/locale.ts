// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export type Locale = "us" | "mx";

const CDN_LOCALE_KEY = "cdn-locale";
// Set when the user manually toggles the locale via the top-nav flag button.
// Once set, IP-geo auto-detection MUST NOT override the user's choice.
const CDN_LOCALE_EXPLICIT_KEY = "cdn-locale-explicit";

// ISO 3166-1 alpha-2 codes for countries with Spanish as an official language.
// Used by the auto-locale detector — visitors from any of these get es-MX as
// the initial locale (only when no stored / explicit choice exists).
export const SPANISH_SPEAKING_COUNTRIES: ReadonlySet<string> = new Set([
	"AR", // Argentina
	"BO", // Bolivia
	"CL", // Chile
	"CO", // Colombia
	"CR", // Costa Rica
	"CU", // Cuba
	"DO", // Dominican Republic
	"EC", // Ecuador
	"SV", // El Salvador
	"GQ", // Equatorial Guinea
	"GT", // Guatemala
	"HN", // Honduras
	"MX", // Mexico
	"NI", // Nicaragua
	"PA", // Panama
	"PY", // Paraguay
	"PE", // Peru
	"PR", // Puerto Rico
	"ES", // Spain
	"UY", // Uruguay
	"VE", // Venezuela
]);

export function isSpanishSpeakingCountry(
	code: string | null | undefined,
): boolean {
	if (!code) return false;
	return SPANISH_SPEAKING_COUNTRIES.has(code.toUpperCase());
}

export function getStoredLocale(): Locale | null {
	try {
		const stored = localStorage.getItem(CDN_LOCALE_KEY);
		if (stored === "us" || stored === "mx") {
			return stored;
		}
	} catch {
		// localStorage not available
	}
	return null;
}

export function setStoredLocale(locale: Locale): void {
	try {
		localStorage.setItem(CDN_LOCALE_KEY, locale);
	} catch {
		// localStorage not available
	}
}

export function isLocaleExplicit(): boolean {
	try {
		return localStorage.getItem(CDN_LOCALE_EXPLICIT_KEY) === "1";
	} catch {
		return false;
	}
}

export function markLocaleExplicit(): void {
	try {
		localStorage.setItem(CDN_LOCALE_EXPLICIT_KEY, "1");
	} catch {
		// localStorage not available — auto-detect will keep firing, acceptable
	}
}

export function applyLocale(locale: Locale): void {
	document.documentElement.lang = locale === "us" ? "en-US" : "es-MX";
	document.documentElement.setAttribute("data-locale", locale);
}

// Synchronous browser-language probe. navigator.languages is the prioritized
// list ("es-MX", "en-US"), navigator.language is the top entry. Either path
// returning an "es*" tag → Spanish speaker. Defensive against SSR (no
// navigator), undefined values, and exotic non-string entries.
export function detectBrowserLocaleIsSpanish(): boolean {
	if (typeof navigator === "undefined") return false;
	const langs: readonly string[] =
		Array.isArray(navigator.languages) && navigator.languages.length > 0
			? navigator.languages
			: typeof navigator.language === "string"
				? [navigator.language]
				: [];
	for (const tag of langs) {
		if (typeof tag !== "string") continue;
		if (tag.toLowerCase().startsWith("es")) return true;
	}
	return false;
}

export function initializeLocale(): Locale {
	const stored = getStoredLocale();
	if (stored) {
		applyLocale(stored);
		return stored;
	}

	// No stored choice → check the browser's preferred languages synchronously.
	// This runs before first paint so an "es-*" browser sees Spanish immediately
	// (no flash of English). IP-geo backstop in Shell handles the case where
	// the browser is en-US but the visitor is geographically in a Spanish-
	// speaking country.
	if (detectBrowserLocaleIsSpanish()) {
		applyLocale("mx");
		return "mx";
	}

	const defaultLocale: Locale = "us";
	applyLocale(defaultLocale);
	return defaultLocale;
}

// Navigation drawer state persistence
const CDN_NAV_KEY = "cdn-navigation-open";

export function getStoredNavState(): boolean | null {
	try {
		const stored = localStorage.getItem(CDN_NAV_KEY);
		if (stored === null) return null;
		return stored === "true";
	} catch {
		return null;
	}
}

export function setStoredNavState(open: boolean): void {
	try {
		localStorage.setItem(CDN_NAV_KEY, String(open));
	} catch {
		// localStorage not available
	}
}
