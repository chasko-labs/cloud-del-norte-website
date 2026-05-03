// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { describe, expect, it } from "vitest";
import {
	badgeForAuthor,
	deckForLocale,
} from "../components/builder-center-data";

// v0.0.0105 — bryan: 4-card window with rotation. Deck shape flattened
// from {primary, carousel} → {cards}. `sub` field deleted at the source.
// Tests assert the new flat shape + window math (4 visible at a time).
const VISIBLE = 4;

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
	it("returns a flat deck of 8 cards for en-US", () => {
		const deck = deckForLocale("us");
		expect(deck.cards).toHaveLength(8);
	});

	it("en-US deck contains the 8 expected authors regardless of order", () => {
		const deck = deckForLocale("us");
		const allAuthors = deck.cards.map((c) => c.author);
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
		const urls = deck.cards.map((c) => c.url);
		expect(new Set(urls).size).toBe(urls.length);
	});

	it("returns 7 cards for es-MX", () => {
		const deck = deckForLocale("mx");
		expect(deck.cards).toHaveLength(7);
	});

	it("es-MX deck is fully Spanish — every card author is from the MX set", () => {
		const deck = deckForLocale("mx");
		const expectedAuthors = new Set([
			"Joselyn Lagunas",
			"Brenda Galicia",
			"David Victoria",
			"Hector David Martinez Montilla",
			"Barbara Gaspar",
			"Alex Parra",
		]);
		for (const card of deck.cards) {
			expect(expectedAuthors.has(card.author)).toBe(true);
		}
	});

	it("es-MX deck has 7 cards with no duplicate URLs", () => {
		const deck = deckForLocale("mx");
		const urls = deck.cards.map((c) => c.url);
		expect(urls).toHaveLength(7);
		expect(new Set(urls).size).toBe(urls.length);
	});

	it("en-US and es-MX decks share zero card URLs (full swap)", () => {
		const en = deckForLocale("us");
		const mx = deckForLocale("mx");
		const enUrls = new Set(en.cards.map((c) => c.url));
		const overlap = mx.cards.map((c) => c.url).filter((u) => enUrls.has(u));
		expect(overlap).toEqual([]);
	});

	it("every card has a non-empty title, author, url, and blurb", () => {
		for (const locale of ["us", "mx"] as const) {
			const deck = deckForLocale(locale);
			for (const card of deck.cards) {
				expect(card.title.length).toBeGreaterThan(0);
				expect(card.author.length).toBeGreaterThan(0);
				expect(card.url).toMatch(/^https:\/\/builder\.aws\.com\//);
				expect(card.blurb.length).toBeGreaterThan(0);
			}
		}
	});

	it("cards do not carry a `sub` field (v0.0.0105 — bryan dropped work title / company)", () => {
		for (const locale of ["us", "mx"] as const) {
			const deck = deckForLocale(locale);
			for (const card of deck.cards) {
				// `sub` was removed from BuilderCenterCard; assert the runtime
				// shape doesn't leak the property either.
				expect(
					Object.hasOwn(card, "sub"),
					`card "${card.title}" still carries a sub field`,
				).toBe(false);
			}
		}
	});

	it("every card author has a resolvable badge", () => {
		for (const locale of ["us", "mx"] as const) {
			const deck = deckForLocale(locale);
			for (const card of deck.cards) {
				expect(
					badgeForAuthor(card.author),
					`author "${card.author}" missing from badge map`,
				).not.toBeNull();
			}
		}
	});
});

describe("4-card window invariant (v0.0.0105)", () => {
	// Component slices a window of 4 with wrap-around. These tests cover
	// the math the component runs against the deck so renders don't drift
	// out of sync with what deckForLocale actually returns.

	it("en-US deck: 8 cards → 2 windows of 4 (no wrap needed)", () => {
		const deck = deckForLocale("us");
		expect(deck.cards.length).toBe(8);
		expect(Math.ceil(deck.cards.length / VISIBLE)).toBe(2);
	});

	it("es-MX deck: 7 cards → 2 windows of 4 (last window wraps 1 card from the front)", () => {
		const deck = deckForLocale("mx");
		expect(deck.cards.length).toBe(7);
		expect(Math.ceil(deck.cards.length / VISIBLE)).toBe(2);
		// emulate the component's wrap-around at start=4: window picks cards
		// at indexes 4,5,6,0 — exactly VISIBLE entries with no holes.
		const start = 4;
		const window = Array.from(
			{ length: VISIBLE },
			(_, i) => deck.cards[(start + i) % deck.cards.length],
		);
		expect(window).toHaveLength(VISIBLE);
		for (const card of window) expect(card).toBeDefined();
		// the wrap entry is the card at index 0
		expect(window[3]?.url).toBe(deck.cards[0].url);
	});
});

// Bryan v0.0.0098 shuffle contract — Fisher-Yates at module load. The
// resulting deck must be stable through the session (same order on every
// deckForLocale call) AND must preserve the underlying SET of cards
// exactly: no drops, no dupes, no extras. Reload = re-execute module = new
// order (untestable in a single Vitest run; covered by the implementation
// mirroring src/components/weather/cities.ts).

describe("shuffle invariants", () => {
	it("en-US deck is stable within the session (multiple calls return identical order)", () => {
		const a = deckForLocale("us");
		const b = deckForLocale("us");
		expect(a.cards.map((c) => c.url)).toEqual(b.cards.map((c) => c.url));
	});

	it("es-MX deck is stable within the session", () => {
		const a = deckForLocale("mx");
		const b = deckForLocale("mx");
		expect(a.cards.map((c) => c.url)).toEqual(b.cards.map((c) => c.url));
	});

	it("en-US shuffle preserves length: 8 cards total", () => {
		const deck = deckForLocale("us");
		expect(deck.cards.length).toBe(8);
	});

	it("en-US shuffle: every expected URL appears exactly once", () => {
		const expected = [
			"https://builder.aws.com/content/3Bl58QC80ISb84FaIxwuYeebYcD/from-germany-to-cameroon-one-trip-every-hat-and-a-room-full-of-future-cloud-engineers",
			"https://builder.aws.com/content/3D3890U2niEPp5gxlssoI9HVvWm/what-is-an-agent-harness-a-hands-on-guide-with-agentcore-harness",
			"https://builder.aws.com/content/394qjN5YE7kYSfZWPTeDYey1fwM/the-ultimate-guide-to-container-secrets-management-on-aws-a-deep-dive-into-parameter-store-secrets-manager-and-hashicorp-vault",
			"https://builder.aws.com/content/3AmPDxn7EBkb5DTI9ERcCwPWjqk/can-it-run-doom-playing-doom-in-claude-code-with-doom-mcp",
			"https://builder.aws.com/content/3B5n19jnSCfSKN6WqDvm1K1H5FK/aideas-finalist-predict-epidem",
			"https://builder.aws.com/content/3Aj9DyqICgKltRSuEBMyVyOCfo6/nfl-iq-how-aws-is-bringing-front-office-intelligence-to-every-fan",
			"https://builder.aws.com/content/3BwChAzvUtvN1kq4uw1JfpuCEL5/aideas-finalist-regain-your-professional-edge",
			"https://builder.aws.com/content/3Cx2x4C2gHfena1soKDOGrXzNWZ/openclaw-on-aws-a-curated-collection-of-aws-builder-center-articles",
		];
		const deck = deckForLocale("us");
		const actual = deck.cards.map((c) => c.url);
		expect(actual.sort()).toEqual([...expected].sort());
	});

	it("es-MX shuffle preserves length: 7 cards total", () => {
		const deck = deckForLocale("mx");
		expect(deck.cards.length).toBe(7);
	});

	it("es-MX shuffle: every expected URL appears exactly once", () => {
		const expected = [
			"https://builder.aws.com/content/3DM63Cm4Mwy4WSwOoFzjRXkzgjM/1000-formas-para-entender-la-nube",
			"https://builder.aws.com/content/31DAIHTTyQpGstNeYTZIJDPPF8Q/amazon-quicksight-la-bolita-magica-que-revela-las-tendencias-de-los-platillos-mexicanos",
			"https://builder.aws.com/content/2zvRNS8S6oYdFZotYfuZfDcnA2j/aws-lanza-su-nueva-capa-gratuita-lo-que-debes-saber-lo-que-nadie-te-dice-y-por-que-es-buena-aunque-imperfecta",
			"https://builder.aws.com/content/3CMgTMtoT7Z2SVDml20197gZ2AL/mas-alla-del-check-in-usando-ia-y-vibe-coding-para-asombrar-a-nuestra-comunidad",
			"https://builder.aws.com/content/36xbEYQNKtJis0lvljZgczbtVMr/todo-lo-nuevo-de-finops-en-aws-reinvent-2025",
			"https://builder.aws.com/content/2vAmGD3DOoPwHe9qgcmBV5AJg7T/modernizacion-desde-la-mirada-de-un-platform-engineer",
			"https://builder.aws.com/content/2uqAzjCPmlToCMYGslLuElriiSa/construir-mas-alla-del-codigo-cuando-la-comunidad-tech-conecta-con-el-mundo-emprendedor",
		];
		const deck = deckForLocale("mx");
		const actual = deck.cards.map((c) => c.url);
		expect(actual.sort()).toEqual([...expected].sort());
	});
});
