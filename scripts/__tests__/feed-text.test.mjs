import { describe, expect, it } from "vitest";
import { decodeEntities, excerptText, stripHtml } from "../feed-text.mjs";

describe("excerptText", () => {
	it("decodes entities feeds leave in descriptions (readysetcloud rsquo)", () => {
		expect(excerptText("tried several times I&rsquo;ve tried")).toBe(
			"tried several times I\u2019ve tried",
		);
	});

	it("strips tags before decoding so &lt; never becomes a live tag", () => {
		expect(excerptText("<p>hi</p> &lt;script&gt; &amp; bye")).toBe(
			"hi <script> & bye",
		);
	});

	it("returns empty string for empty input", () => {
		expect(excerptText("")).toBe("");
		expect(excerptText(null)).toBe("");
	});
});

describe("stripHtml", () => {
	it("removes tags and collapses whitespace", () => {
		expect(stripHtml("<p>a  <b>b</b></p>")).toBe("a b");
	});
});

describe("decodeEntities", () => {
	it("decodes named, decimal, and hex entities", () => {
		expect(decodeEntities("&amp; &#39; &#x27; &quot;")).toBe("& ' ' \"");
	});
});
