import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MEET_URL = "https://meet.google.com/qst-czph-egy";

function redirectHtml(): string {
	return readFileSync(
		resolve(__dirname, "../../public/join/reinvent15/index.html"),
		"utf-8",
	);
}

describe("join/reinvent15 vanity redirect", () => {
	it("sends every redirect path to the re:Invent Session Reservations Google Meet", () => {
		const html = redirectHtml();

		expect(html).toContain(
			`<meta http-equiv="refresh" content="0; url=${MEET_URL}"`,
		);
		expect(html).toContain(`<link rel="canonical" href="${MEET_URL}"`);
		expect(html).toContain(`window.location.replace("${MEET_URL}")`);
		expect(html).toContain(`<a href="${MEET_URL}"`);
	});

	it("stays out of search indexes", () => {
		expect(redirectHtml()).toContain(
			'name="robots" content="noindex, nofollow"',
		);
	});
});
