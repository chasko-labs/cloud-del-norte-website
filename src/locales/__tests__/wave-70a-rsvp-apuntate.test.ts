/**
 * wave 70a — RSVP → Apúntate regression guard
 *
 * Bryan: "replace RSVP language on spanish mode with Apúntate"
 * All es-MX values that previously contained 'RSVP' now use Apúntate / apuntarte
 * or a contextually appropriate form. en-US is unchanged.
 */
import { describe, expect, it } from "vitest";
import enUS from "../en-US.json";
import esMX from "../es-MX.json";

// Flatten nested JSON to dot-notation key→value pairs
function flatten(
	obj: Record<string, unknown>,
	prefix = "",
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [k, v] of Object.entries(obj)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (typeof v === "object" && v !== null && !Array.isArray(v)) {
			Object.assign(result, flatten(v as Record<string, unknown>, key));
		} else if (typeof v === "string") {
			result[key] = v;
		}
	}
	return result;
}

const esMXFlat = flatten(esMX as Record<string, unknown>);
const enUSFlat = flatten(enUS as Record<string, unknown>);

describe("wave 70a — RSVP → Apúntate (es-MX)", () => {
	it("no es-MX value contains the word RSVP (case-insensitive)", () => {
		const rsvpInEs = Object.entries(esMXFlat).filter(([, v]) =>
			/rsvp/i.test(v),
		);
		expect(
			rsvpInEs,
			`Found es-MX values still containing RSVP: ${rsvpInEs.map(([k]) => k).join(", ")}`,
		).toHaveLength(0);
	});

	it("en-US values still contain RSVP (unchanged)", () => {
		const rsvpInEn = Object.entries(enUSFlat).filter(([, v]) =>
			/rsvp/i.test(v),
		);
		// en-US should still have RSVP values
		expect(rsvpInEn.length).toBeGreaterThan(0);
	});

	it("featuredEventSpotsRemaining uses Regístrate in es-MX", () => {
		expect(esMX.feedPage.featuredEventSpotsRemaining).toMatch(/regístrate/i);
	});

	it("featuredEventRsvpMeetup uses Regístrate in es-MX", () => {
		expect(esMX.feedPage.featuredEventRsvpMeetup).toMatch(/regístrate/i);
	});

	it("meetings.rsvpButton uses Apúntate in es-MX", () => {
		expect(esMX.meetings.rsvpButton).toMatch(/apúntate/i);
	});

	it("rsvp.breadcrumb is translated (not RSVP) in es-MX", () => {
		expect(esMX.rsvp.breadcrumb).not.toMatch(/^rsvp$/i);
	});

	it("rsvp.header uses Apúntate in es-MX", () => {
		expect(esMX.rsvp.header).toMatch(/apúntate/i);
	});

	it("rsvp.rsvpButton uses Apúntate or lugar in es-MX (no RSVP)", () => {
		expect(esMX.rsvp.rsvpButton).not.toMatch(/rsvp/i);
	});

	it("helpPanel.rsvpHeader uses Apúntate in es-MX", () => {
		expect(esMX.helpPanel.rsvpHeader).toMatch(/apúntate/i);
	});

	it("meetings.rsvpOnMeetup uses Apúntate in es-MX", () => {
		expect(esMX.meetings.rsvpOnMeetup).toMatch(/apúntate/i);
	});
});
