import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These tests define the contract for src/utils/locale.ts
// They will pass once the locale utility is implemented (PR #4)

// Helper — stub navigator.language(s) for the synchronous browser-language
// probe. Restored by restoreNavigatorLanguages() in afterEach.
const ORIGINAL_LANGUAGE_DESCRIPTOR = Object.getOwnPropertyDescriptor(
	window.navigator,
	"language",
);
const ORIGINAL_LANGUAGES_DESCRIPTOR = Object.getOwnPropertyDescriptor(
	window.navigator,
	"languages",
);

function stubNavigatorLanguages(
	primary: string | undefined,
	list?: readonly string[],
): void {
	Object.defineProperty(window.navigator, "language", {
		configurable: true,
		get: () => primary,
	});
	Object.defineProperty(window.navigator, "languages", {
		configurable: true,
		get: () => list,
	});
}

function restoreNavigatorLanguages(): void {
	if (ORIGINAL_LANGUAGE_DESCRIPTOR) {
		Object.defineProperty(
			window.navigator,
			"language",
			ORIGINAL_LANGUAGE_DESCRIPTOR,
		);
	}
	if (ORIGINAL_LANGUAGES_DESCRIPTOR) {
		Object.defineProperty(
			window.navigator,
			"languages",
			ORIGINAL_LANGUAGES_DESCRIPTOR,
		);
	}
}

describe("locale utility", () => {
	beforeEach(() => {
		localStorage.clear();
		document.documentElement.lang = "";
		document.documentElement.removeAttribute("data-locale");
		// Default browser language for tests — en-US so initializeLocale doesn't
		// silently flip to mx unless a test asks for it
		stubNavigatorLanguages("en-US", ["en-US", "en"]);
		// Clear module cache so each test gets fresh imports
		vi.resetModules();
	});

	afterEach(() => {
		restoreNavigatorLanguages();
	});

	describe("getStoredLocale", () => {
		it("returns null when localStorage is empty", async () => {
			const { getStoredLocale } = await import("../locale");
			expect(getStoredLocale()).toBeNull();
		});

		it('returns "us" when stored value is "us"', async () => {
			localStorage.setItem("cdn-locale", "us");
			const { getStoredLocale } = await import("../locale");
			expect(getStoredLocale()).toBe("us");
		});

		it('returns "mx" when stored value is "mx"', async () => {
			localStorage.setItem("cdn-locale", "mx");
			const { getStoredLocale } = await import("../locale");
			expect(getStoredLocale()).toBe("mx");
		});

		it("returns null for invalid stored value", async () => {
			localStorage.setItem("cdn-locale", "fr");
			const { getStoredLocale } = await import("../locale");
			expect(getStoredLocale()).toBeNull();
		});

		it("returns null for empty string stored value", async () => {
			localStorage.setItem("cdn-locale", "");
			const { getStoredLocale } = await import("../locale");
			expect(getStoredLocale()).toBeNull();
		});
	});

	describe("setStoredLocale", () => {
		it('persists "mx" to localStorage', async () => {
			const { setStoredLocale } = await import("../locale");
			setStoredLocale("mx");
			expect(localStorage.getItem("cdn-locale")).toBe("mx");
		});

		it('persists "us" to localStorage', async () => {
			const { setStoredLocale } = await import("../locale");
			setStoredLocale("us");
			expect(localStorage.getItem("cdn-locale")).toBe("us");
		});

		it("overwrites previous value", async () => {
			const { setStoredLocale } = await import("../locale");
			setStoredLocale("mx");
			setStoredLocale("us");
			expect(localStorage.getItem("cdn-locale")).toBe("us");
		});
	});

	describe("applyLocale", () => {
		it('sets document lang to "en-US" for us locale', async () => {
			const { applyLocale } = await import("../locale");
			applyLocale("us");
			expect(document.documentElement.lang).toBe("en-US");
		});

		it('sets document lang to "es-MX" for mx locale', async () => {
			const { applyLocale } = await import("../locale");
			applyLocale("mx");
			expect(document.documentElement.lang).toBe("es-MX");
		});

		it('sets data-locale attribute to "us"', async () => {
			const { applyLocale } = await import("../locale");
			applyLocale("us");
			expect(document.documentElement.getAttribute("data-locale")).toBe("us");
		});

		it('sets data-locale attribute to "mx"', async () => {
			const { applyLocale } = await import("../locale");
			applyLocale("mx");
			expect(document.documentElement.getAttribute("data-locale")).toBe("mx");
		});
	});

	describe("initializeLocale", () => {
		it("returns stored locale and applies it", async () => {
			localStorage.setItem("cdn-locale", "mx");
			const { initializeLocale } = await import("../locale");
			const result = initializeLocale();
			expect(result).toBe("mx");
			expect(document.documentElement.lang).toBe("es-MX");
			expect(document.documentElement.getAttribute("data-locale")).toBe("mx");
		});

		it('defaults to "us" when nothing stored', async () => {
			const { initializeLocale } = await import("../locale");
			const result = initializeLocale();
			expect(result).toBe("us");
			expect(document.documentElement.lang).toBe("en-US");
			expect(document.documentElement.getAttribute("data-locale")).toBe("us");
		});
	});

	describe("Locale type", () => {
		it("exports Locale type (compile-time check)", async () => {
			const mod = await import("../locale");
			// Type check: these should be valid Locale values
			const us: typeof mod.getStoredLocale extends () => infer R ? R : never =
				"us";
			const mx: typeof mod.getStoredLocale extends () => infer R ? R : never =
				"mx";
			expect(us).toBe("us");
			expect(mx).toBe("mx");
		});
	});

	describe("SPANISH_SPEAKING_COUNTRIES", () => {
		it("contains all 21 ISO 3166-1 alpha-2 codes for Spanish-official countries", async () => {
			const { SPANISH_SPEAKING_COUNTRIES } = await import("../locale");
			expect(SPANISH_SPEAKING_COUNTRIES.size).toBe(21);
			const expected = [
				"AR",
				"BO",
				"CL",
				"CO",
				"CR",
				"CU",
				"DO",
				"EC",
				"SV",
				"GQ",
				"GT",
				"HN",
				"MX",
				"NI",
				"PA",
				"PY",
				"PE",
				"PR",
				"ES",
				"UY",
				"VE",
			];
			for (const code of expected) {
				expect(SPANISH_SPEAKING_COUNTRIES.has(code)).toBe(true);
			}
		});

		it("does not include English-speaking or other major countries", async () => {
			const { SPANISH_SPEAKING_COUNTRIES } = await import("../locale");
			for (const code of [
				"US",
				"GB",
				"CA",
				"AU",
				"BR",
				"FR",
				"DE",
				"PT",
				"IT",
			]) {
				expect(SPANISH_SPEAKING_COUNTRIES.has(code)).toBe(false);
			}
		});
	});

	describe("isSpanishSpeakingCountry", () => {
		it("returns true for codes in the set, case-insensitive", async () => {
			const { isSpanishSpeakingCountry } = await import("../locale");
			expect(isSpanishSpeakingCountry("MX")).toBe(true);
			expect(isSpanishSpeakingCountry("mx")).toBe(true);
			expect(isSpanishSpeakingCountry("ES")).toBe(true);
			expect(isSpanishSpeakingCountry("PR")).toBe(true);
			expect(isSpanishSpeakingCountry("GQ")).toBe(true);
		});

		it("returns false for non-Spanish countries", async () => {
			const { isSpanishSpeakingCountry } = await import("../locale");
			expect(isSpanishSpeakingCountry("US")).toBe(false);
			expect(isSpanishSpeakingCountry("BR")).toBe(false);
			expect(isSpanishSpeakingCountry("FR")).toBe(false);
		});

		it("returns false for null, undefined, or empty input", async () => {
			const { isSpanishSpeakingCountry } = await import("../locale");
			expect(isSpanishSpeakingCountry(null)).toBe(false);
			expect(isSpanishSpeakingCountry(undefined)).toBe(false);
			expect(isSpanishSpeakingCountry("")).toBe(false);
		});
	});

	describe("explicit-toggle flag", () => {
		it("isLocaleExplicit returns false initially", async () => {
			const { isLocaleExplicit } = await import("../locale");
			expect(isLocaleExplicit()).toBe(false);
		});

		it("markLocaleExplicit persists the flag and isLocaleExplicit reflects it", async () => {
			const { isLocaleExplicit, markLocaleExplicit } = await import(
				"../locale"
			);
			markLocaleExplicit();
			expect(isLocaleExplicit()).toBe(true);
			expect(localStorage.getItem("cdn-locale-explicit")).toBe("1");
		});

		it("isLocaleExplicit returns false for any value other than '1'", async () => {
			localStorage.setItem("cdn-locale-explicit", "true");
			const { isLocaleExplicit } = await import("../locale");
			expect(isLocaleExplicit()).toBe(false);
		});
	});

	describe("detectBrowserLocaleIsSpanish", () => {
		it("returns true when navigator.language starts with es", async () => {
			stubNavigatorLanguages("es-MX", ["es-MX", "es", "en"]);
			vi.resetModules();
			const { detectBrowserLocaleIsSpanish } = await import("../locale");
			expect(detectBrowserLocaleIsSpanish()).toBe(true);
		});

		it("returns true when navigator.languages contains an es tag (lower priority)", async () => {
			stubNavigatorLanguages("en-US", ["en-US", "es-ES"]);
			vi.resetModules();
			const { detectBrowserLocaleIsSpanish } = await import("../locale");
			expect(detectBrowserLocaleIsSpanish()).toBe(true);
		});

		it("returns false for purely English browser", async () => {
			stubNavigatorLanguages("en-US", ["en-US", "en"]);
			vi.resetModules();
			const { detectBrowserLocaleIsSpanish } = await import("../locale");
			expect(detectBrowserLocaleIsSpanish()).toBe(false);
		});

		it("returns false when navigator.language is undefined / no languages list", async () => {
			stubNavigatorLanguages(undefined, undefined);
			vi.resetModules();
			const { detectBrowserLocaleIsSpanish } = await import("../locale");
			expect(detectBrowserLocaleIsSpanish()).toBe(false);
		});

		it("is case-insensitive on the language tag", async () => {
			stubNavigatorLanguages("ES-es", ["ES-es"]);
			vi.resetModules();
			const { detectBrowserLocaleIsSpanish } = await import("../locale");
			expect(detectBrowserLocaleIsSpanish()).toBe(true);
		});
	});

	describe("initializeLocale auto-detection from browser language", () => {
		it("returns 'mx' when no stored locale and browser is Spanish", async () => {
			stubNavigatorLanguages("es-MX", ["es-MX", "es"]);
			vi.resetModules();
			const { initializeLocale } = await import("../locale");
			const result = initializeLocale();
			expect(result).toBe("mx");
			expect(document.documentElement.lang).toBe("es-MX");
		});

		it("stored locale wins over browser language preference", async () => {
			stubNavigatorLanguages("es-MX", ["es-MX"]);
			localStorage.setItem("cdn-locale", "us");
			vi.resetModules();
			const { initializeLocale } = await import("../locale");
			expect(initializeLocale()).toBe("us");
		});

		it("falls back to 'us' when neither stored nor Spanish browser", async () => {
			stubNavigatorLanguages("en-US", ["en-US"]);
			vi.resetModules();
			const { initializeLocale } = await import("../locale");
			expect(initializeLocale()).toBe("us");
		});
	});
});
