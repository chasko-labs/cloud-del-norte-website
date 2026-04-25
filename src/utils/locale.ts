// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export type Locale = "us" | "mx";

const CDN_LOCALE_KEY = "cdn-locale";

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

export function applyLocale(locale: Locale): void {
	document.documentElement.lang = locale === "us" ? "en-US" : "es-MX";
	document.documentElement.setAttribute("data-locale", locale);
}

export function initializeLocale(): Locale {
	const stored = getStoredLocale();
	if (stored) {
		applyLocale(stored);
		return stored;
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
