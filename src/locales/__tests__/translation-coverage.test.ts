import { describe, expect, it } from "vitest";
import enUS from "../en-US.json";
import esMX from "../es-MX.json";

function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
	const keys: string[] = [];
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			keys.push(...collectKeys(value as Record<string, unknown>, fullKey));
		} else {
			keys.push(fullKey);
		}
	}
	return keys.sort();
}

describe("translation coverage", () => {
	const enKeys = collectKeys(enUS as Record<string, unknown>);
	const mxKeys = collectKeys(esMX as Record<string, unknown>);

	it("en-US and es-MX have identical key structures", () => {
		expect(enKeys).toEqual(mxKeys);
	});

	it("en-US has no missing keys compared to es-MX", () => {
		const missingInEn = mxKeys.filter((k) => !enKeys.includes(k));
		expect(missingInEn).toEqual([]);
	});

	it("es-MX has no missing keys compared to en-US", () => {
		const missingInMx = enKeys.filter((k) => !mxKeys.includes(k));
		expect(missingInMx).toEqual([]);
	});

	it("no empty string values in en-US", () => {
		for (const key of enKeys) {
			const value = key.split(".").reduce(
				(obj: Record<string, unknown>, k: string) => {
					if (obj && typeof obj === "object")
						return (obj as Record<string, unknown>)[k] as Record<
							string,
							unknown
						>;
					return undefined as unknown as Record<string, unknown>;
				},
				enUS as unknown as Record<string, unknown>,
			);
			expect(value, `en-US key "${key}" should not be empty`).not.toBe("");
		}
	});

	it("no empty string values in es-MX", () => {
		for (const key of mxKeys) {
			const value = key.split(".").reduce(
				(obj: Record<string, unknown>, k: string) => {
					if (obj && typeof obj === "object")
						return (obj as Record<string, unknown>)[k] as Record<
							string,
							unknown
						>;
					return undefined as unknown as Record<string, unknown>;
				},
				esMX as unknown as Record<string, unknown>,
			);
			expect(value, `es-MX key "${key}" should not be empty`).not.toBe("");
		}
	});

	it("both files have at least 3 top-level sections", () => {
		expect(Object.keys(enUS).length).toBeGreaterThanOrEqual(3);
		expect(Object.keys(esMX).length).toBeGreaterThanOrEqual(3);
	});

	it("es-MX translations differ from en-US (no untranslated values)", () => {
		// Allowlist for keys that should be identical (proper nouns, technical terms, common tech terms)
		const allowIdentical = new Set([
			"shell.siteTitle", // "Cloud Del Norte" - proper noun
			"breadcrumbs.home", // "Cloud Del Norte" - proper noun
			"home.infoLink", // "Info" - universal abbreviation
			"home.metrics.est", // "Est." - abbreviation used in both locales
			"home.topics.serverlessLens", // "Serverless Lens" - AWS technical term
			"common.info", // "Info" - universal abbreviation
			"footer.goBuild", // "Go Build" - AWS tagline
			"navigation.apiGuide", // "API" - common in Spanish
			"navigation.cacheable", // "Cacheable" - technical term used in Spanish
			"apiGuide.api", // "API" - acronym
			"meetingDetail.rsvp", // "RSVP" - universal abbreviation
			"createMeeting.url", // "URL" - universal abbreviation
			"createMeeting.api", // "API" - acronym
			"createMeeting.details.no", // "No" - same in Spanish
			"createMeeting.meetingDetails.errorIconAriaLabel", // "Error" - common tech term
			"createMeeting.meetingType.virtual", // "Virtual" - same in Spanish
			"maintenanceCalendar.lts", // "LTS" - technical acronym
			"maintenanceCalendar.releaseNotes", // "Release Notes" - technical term
			"meetings.tableHeaders.onDemand", // "On-Demand" - technical term
			"home.userGroupHeader", // Contains "#AWS User Group" - proper noun
			"helpPanel.bryanChasko", // Proper name
			"helpPanel.jacobWright", // Proper name
			"helpPanel.userGroupTitle", // "AWS User Group" - proper noun
			"navigation.roadmap", // "Roadmap" - universally understood term
			"roadmap.title", // "Roadmap" - universally understood term
			"roadmap.breadcrumb", // "Roadmap" - universally understood term
			"roadmap.idea", // "Idea" - same in Spanish
			"navigation.admin", // "Admin" - technical term used in both locales
			"admin.breadcrumb", // "Admin" - technical term
			"aboutPage.infoLink", // "Info" - universal abbreviation
			"feedPage.infoLink", // "Info" - universal abbreviation
			"helpPanel.andresWebsite", // "andmore.dev" - proper domain name
			"feedPage.andmoreDevHeader", // "andmore.dev" - proper domain name
			"helpPanel.andresMoreno", // Proper name
			"helpPanel.aslLeadRole", // "ASL" - acronym
			"helpPanel.lsmLead", // "LSM" - acronym
			"helpPanel.arrowheadSoundstage", // Proper noun
			"feedPage.builderBadge.communityBuilder", // "aws community builder" - AWS program name (kept untranslated as bryan's directive)
			"feedPage.builderBadge.hero", // "aws hero" - AWS program name (kept untranslated as bryan's directive)
			"feedPage.andresMediumHeader", // "Andres Moreno — andmoredev" - proper name + handle
			"feedPage.builderCenterHeader", // "AWS Builder Center" - AWS program proper noun
			"helpPanel.arrowheadPark", // "Arrowhead Research Park" - proper noun
			"helpPanel.communityFoundedSuffix", // ", NMSU." - punctuation + acronym
			"feedPage.pastMeetupSpeaker1Name", // proper name
			"feedPage.pastMeetupSpeaker2Name", // proper name
			"feedPage.pastMeetupSpeaker3Name", // proper name
			"feedPage.pastMeetupSpeaker4Name", // proper name
		]);

		// Helper to get value by dot-notation key
		const getValue = (obj: Record<string, unknown>, key: string): string => {
			const value = key.split(".").reduce((o: unknown, k: string) => {
				if (o && typeof o === "object")
					return (o as Record<string, unknown>)[k];
				return undefined;
			}, obj);
			return value as string;
		};

		const untranslated: string[] = [];
		for (const key of enKeys) {
			if (allowIdentical.has(key)) continue;

			const enValue = getValue(enUS as Record<string, unknown>, key);
			const mxValue = getValue(esMX as Record<string, unknown>, key);

			// Skip if either value is not a string (nested objects)
			if (typeof enValue !== "string" || typeof mxValue !== "string") continue;

			// Flag if values are identical (case-insensitive comparison)
			if (enValue.toLowerCase().trim() === mxValue.toLowerCase().trim()) {
				untranslated.push(key);
			}
		}

		if (untranslated.length > 0) {
			// Helpful error message showing which keys need translation
			const message = `Found ${untranslated.length} key(s) with identical en-US and es-MX values (likely untranslated):\n${untranslated.slice(0, 10).join("\n")}${untranslated.length > 10 ? `\n... and ${untranslated.length - 10} more` : ""}`;
			expect(untranslated, message).toEqual([]);
		}
	});
});
