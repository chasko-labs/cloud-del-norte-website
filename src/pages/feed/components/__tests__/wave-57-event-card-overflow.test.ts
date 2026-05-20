import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Wave 57 — event card right-edge overflow regression guard.
 *
 * Bryan: 'right side margins on the event cards the buttons & text currently
 * go over the edges on the right, the left side margins are good'.
 *
 * Root cause: wave 44 added min-width:0 to grid items inside the desktop
 * @container query for upcoming-virtual-event only. The same fix was never
 * applied to featured-event or next-meetup — their title/date elements with
 * white-space:nowrap pushed past the right edge of the minmax(0,1fr) column.
 *
 * These tests pin the surgical fix so it can't regress.
 */

const feedCss = readFileSync(
	resolve(__dirname, "..", "..", "styles.css"),
	"utf-8",
);

/** Extract the content of a @container block by name + breakpoint. */
function extractContainerBlock(name: string, minWidth: string): string {
	const pattern = new RegExp(
		`@container\\s+${name}\\s*\\(min-width:\\s*${minWidth}\\)\\s*\\{`,
	);
	const match = feedCss.match(pattern);
	if (!match?.index) return "";
	let depth = 0;
	let start = match.index + match[0].length;
	for (let i = start; i < feedCss.length; i++) {
		if (feedCss[i] === "{") depth++;
		if (feedCss[i] === "}") {
			if (depth === 0) return feedCss.slice(start, i);
			depth--;
		}
	}
	return "";
}

describe("Wave 57 — featured-event right-edge overflow containment", () => {
	const block = extractContainerBlock("cdn-feed-featured", "860px");

	it("desktop container query applies min-width:0 to .feed-featured-event__title", () => {
		expect(block).toMatch(
			/\.feed-featured-event__layout\s+\.feed-featured-event__title[\s\S]*?min-width:\s*0/,
		);
	});

	it("desktop container query applies min-width:0 to .feed-featured-event__date", () => {
		expect(block).toMatch(
			/\.feed-featured-event__layout\s+\.feed-featured-event__date[\s\S]*?min-width:\s*0/,
		);
	});

	it(".feed-featured-event__title has overflow:hidden + text-overflow:ellipsis", () => {
		expect(feedCss).toMatch(
			/\.feed-featured-event__title\s*\{[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis/,
		);
	});
});

describe("Wave 57 — next-meetup right-edge overflow containment", () => {
	const block = extractContainerBlock("cdn-feed-next-meetup", "860px");

	it("desktop container query applies min-width:0 to .feed-next-meetup__title", () => {
		expect(block).toMatch(
			/\.feed-next-meetup__layout\s+\.feed-next-meetup__title[\s\S]*?min-width:\s*0/,
		);
	});

	it("desktop container query applies min-width:0 to .feed-next-meetup__date", () => {
		expect(block).toMatch(
			/\.feed-next-meetup__layout\s+\.feed-next-meetup__date[\s\S]*?min-width:\s*0/,
		);
	});

	it(".feed-next-meetup__title has overflow:hidden + text-overflow:ellipsis", () => {
		expect(feedCss).toMatch(
			/\.feed-next-meetup__title\s*\{[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis/,
		);
	});
});

describe("Wave 57 — upcoming-virtual-event right-edge overflow containment", () => {
	const block = extractContainerBlock(
		"cdn-feed-upcoming-virtual-event",
		"860px",
	);

	it("desktop container query applies min-width:0 to .feed-upcoming-virtual-event__title", () => {
		expect(block).toMatch(
			/\.feed-upcoming-virtual-event__layout\s+\.feed-upcoming-virtual-event__title[\s\S]*?min-width:\s*0/,
		);
	});

	it("desktop container query applies min-width:0 to .feed-upcoming-virtual-event__date (wave 44 preserved)", () => {
		expect(block).toMatch(
			/\.feed-upcoming-virtual-event__layout\s+\.feed-upcoming-virtual-event__date[\s\S]*?min-width:\s*0/,
		);
	});

	it(".feed-upcoming-virtual-event__title has overflow:hidden + text-overflow:ellipsis", () => {
		expect(feedCss).toMatch(
			/\.feed-upcoming-virtual-event__title\s*\{[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis/,
		);
	});
});
