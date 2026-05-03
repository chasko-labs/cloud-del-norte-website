// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { describe, expect, it } from "vitest";
import {
	badgeForAuthor,
	deckForLocale,
} from "../components/builder-center-data";

describe("badgeForAuthor", () => {
	it("returns 'employee' for AWS employees", () => {
		expect(badgeForAuthor("Morgan")).toBe("employee");
		expect(badgeForAuthor("Gunnar Grosch")).toBe("employee");
		expect(badgeForAuthor("Lisa Bagley")).toBe("employee");
		expect(badgeForAuthor("Maria Encinar")).toBe("employee");
	});

	it("returns 'communityBuilder' for community builders", () => {
		expect(badgeForAuthor("Endah Bongo-Awah")).toBe("communityBuilder");
		expect(badgeForAuthor("Habeeb Babasulaiman")).toBe("communityBuilder");
		expect(badgeForAuthor("Joselyn Lagunas")).toBe("communityBuilder");
		expect(badgeForAuthor("Brenda Galicia")).toBe("communityBuilder");
		expect(badgeForAuthor("Hector David Martinez Montilla")).toBe(
			"communityBuilder",
		);
		expect(badgeForAuthor("Barbara Gaspar")).toBe("communityBuilder");
		expect(badgeForAuthor("Alex Parra")).toBe("communityBuilder");
		expect(badgeForAuthor("Vicente G. Guzmán Lucio")).toBe("communityBuilder");
		expect(badgeForAuthor("Andres Moreno")).toBe("communityBuilder");
		expect(badgeForAuthor("Christian Perez")).toBe("communityBuilder");
	});

	it("returns 'hero' for AWS heroes", () => {
		expect(badgeForAuthor("Bryan Chasko")).toBe("hero");
		expect(badgeForAuthor("David Victoria")).toBe("hero");
	});

	it("returns null for unknown authors", () => {
		expect(badgeForAuthor("Random Person")).toBeNull();
		expect(badgeForAuthor("")).toBeNull();
	});
});

describe("deckForLocale", () => {
	// v0.0.0098 — bryan: ranks shuffle per page load. Tests assert SET
	// membership + counts rather than fixed positions.
	it("returns 4 primary + 4 carousel cards for en-US (8 total)", () => {
		const deck = deckForLocale("us");
		expect(deck.primary).toHaveLength(4);
		expect(deck.carousel).toHaveLength(4);
	});

	it("en-US deck contains the 8 expected authors regardless of order", () => {
		const deck = deckForLocale("us");
		const allAuthors = [...deck.primary, ...deck.carousel].map((c) => c.author);
		expect(allAuthors.sort()).toEqual(
			[
				"Endah Bongo-Awah",
				"Morgan",
				"Habeeb Babasulaiman",
				"Gunnar Grosch",
				"Vicente G. Guzmán Lucio",
				"Lisa Bagley",
				"Christian Perez",
				"Maria Encinar",
			].sort(),
		);
	});

	it("en-US deck has no duplicate URLs after shuffle", () => {
		const deck = deckForLocale("us");
		const urls = [...deck.primary, ...deck.carousel].map((c) => c.url);
		expect(new Set(urls).size).toBe(urls.length);
	});

	it("AIdeas card carries the 'Software Engineering' sub-track", () => {
		const deck = deckForLocale("us");
		const all = [...deck.primary, ...deck.carousel];
		const aideas = all.find((c) =>
			c.title.includes("AIdeas Finalist: Predict-Epidem"),
		);
		expect(aideas?.sub).toBe("Software Engineering");
	});

	it("returns 4 primary + 3 carousel cards for es-MX (7 total)", () => {
		const deck = deckForLocale("mx");
		expect(deck.primary).toHaveLength(4);
		expect(deck.carousel).toHaveLength(3);
	});

	it("es-MX deck is fully Spanish — every card author is from the MX set", () => {
		const deck = deckForLocale("mx");
		const all = [...deck.primary, ...deck.carousel];
		const expectedAuthors = new Set([
			"Joselyn Lagunas",
			"Brenda Galicia",
			"David Victoria",
			"Hector David Martinez Montilla",
			"Barbara Gaspar",
			"Alex Parra",
		]);
		for (const card of all) {
			expect(expectedAuthors.has(card.author)).toBe(true);
		}
	});

	it("es-MX deck has 7 cards with no duplicate URLs", () => {
		const deck = deckForLocale("mx");
		const urls = [...deck.primary, ...deck.carousel].map((c) => c.url);
		expect(urls).toHaveLength(7);
		expect(new Set(urls).size).toBe(urls.length);
	});

	it("en-US and es-MX decks share zero card URLs (full swap)", () => {
		const en = deckForLocale("us");
		const mx = deckForLocale("mx");
		const enUrls = new Set([...en.primary, ...en.carousel].map((c) => c.url));
		const mxUrls = [...mx.primary, ...mx.carousel].map((c) => c.url);
		const overlap = mxUrls.filter((u) => enUrls.has(u));
		expect(overlap).toEqual([]);
	});

	it("every card has a non-empty title, author, url, and blurb", () => {
		for (const locale of ["us", "mx"] as const) {
			const deck = deckForLocale(locale);
			for (const card of [...deck.primary, ...deck.carousel]) {
				expect(card.title.length).toBeGreaterThan(0);
				expect(card.author.length).toBeGreaterThan(0);
				expect(card.url).toMatch(/^https:\/\/builder\.aws\.com\//);
				expect(card.blurb.length).toBeGreaterThan(0);
			}
		}
	});

	it("every card author has a resolvable badge", () => {
		for (const locale of ["us", "mx"] as const) {
			const deck = deckForLocale(locale);
			for (const card of [...deck.primary, ...deck.carousel]) {
				expect(
					badgeForAuthor(card.author),
					`author "${card.author}" missing from badge map`,
				).not.toBeNull();
			}
		}
	});
});
