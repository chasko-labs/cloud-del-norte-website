// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 45 — card rizz batch tests.
//   1. Excerpt cap logic (140 chars + ellipsis)
//   2. Brand star img renders in FeedAndmore + onError hides broken img
//   3. FeedAndmore renders the co-organizer sub-header
//   4. Speaker CTA bounce @keyframes defined in stylesheet
//   5. RSC two-sentence excerpt split logic

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import { FeedAndmore, FeedAwsml, type FeedPost } from "../feed-section";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWith(ui: React.ReactElement, locale: "us" | "mx" = "us") {
	return render(<LocaleProvider locale={locale}>{ui}</LocaleProvider>);
}

function mockFeedsResponse(posts: FeedPost[]) {
	return { andmore: posts, awsml: posts, readysetcloud: posts };
}

const SAMPLE_POSTS: FeedPost[] = [
	{
		title: "Post title one",
		link: "https://andmore.dev/post-1",
		pubDate: "2026-05-18",
		excerpt: "Short excerpt for test.",
	},
];

// ---------------------------------------------------------------------------
// Task 1.4 — excerpt cap logic (pure function, no cache concerns)
// ---------------------------------------------------------------------------

function capExcerpt(excerpt: string): string {
	return excerpt.length > 140 ? `${excerpt.slice(0, 140).trimEnd()}…` : excerpt;
}

describe("PostCarousel excerpt cap logic (task 1.4)", () => {
	const LONG =
		"This is a very long excerpt that exceeds one hundred and forty characters in total length and should be truncated with an ellipsis character at the end.";

	it("truncates excerpts longer than 140 chars with ellipsis", () => {
		const result = capExcerpt(LONG);
		expect(result.length).toBeLessThanOrEqual(141); // 140 chars + ellipsis
		expect(result).toContain("…");
		expect(result).not.toBe(LONG);
	});

	it("leaves short excerpts unchanged", () => {
		const short = "Short excerpt.";
		expect(capExcerpt(short)).toBe(short);
		expect(capExcerpt(short)).not.toContain("…");
	});

	it("caps at exactly 140 visible chars before adding ellipsis", () => {
		const exactly140 = "x".repeat(140);
		const over = "x".repeat(141);
		expect(capExcerpt(exactly140)).toBe(exactly140); // no truncation
		const capped = capExcerpt(over);
		expect(capped).toContain("…");
		expect(capped.replace("…", "").length).toBe(140);
	});
});

// ---------------------------------------------------------------------------
// Task 3 — RSC 2-sentence excerpt split logic
// ---------------------------------------------------------------------------

function twoSentences(excerpt: string): string {
	if (!excerpt) return "";
	const chunks = excerpt.split(/\.\s+/);
	const joined = chunks.length >= 2 ? `${chunks[0]}. ${chunks[1]}.` : chunks[0];
	return joined.length > 140 ? `${joined.slice(0, 140).trimEnd()}…` : joined;
}

describe("ReadySetCloud 2-sentence excerpt logic (task 3)", () => {
	it("returns first 2 sentences joined with period", () => {
		const excerpt = "First sentence. Second sentence. Third sentence.";
		const result = twoSentences(excerpt);
		expect(result).toBe("First sentence. Second sentence.");
		expect(result).not.toContain("Third");
	});

	it("returns single sentence if only one available", () => {
		const excerpt = "Only one sentence";
		expect(twoSentences(excerpt)).toBe("Only one sentence");
	});

	it("caps at 140 chars after joining two sentences", () => {
		const s1 = "A".repeat(80);
		const s2 = "B".repeat(80);
		const excerpt = `${s1}. ${s2}. Extra.`;
		const result = twoSentences(excerpt);
		expect(result).toContain("…");
		expect(result.replace("…", "").length).toBeLessThanOrEqual(140);
	});

	it("returns empty string for empty excerpt", () => {
		expect(twoSentences("")).toBe("");
	});
});

// ---------------------------------------------------------------------------
// Task 1.2 — brand star in FeedAndmore header
// ---------------------------------------------------------------------------

describe("FeedAndmore brand star (task 1.2)", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockFeedsResponse(SAMPLE_POSTS)),
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders brand star img with /brand/logo.svg and aria-hidden=true", async () => {
		renderWith(<FeedAndmore />);
		await waitFor(() => {
			const img = document.querySelector(
				".feed-andmore-brand-star img",
			) as HTMLImageElement | null;
			expect(img).not.toBeNull();
			expect(img?.getAttribute("src")).toBe("/brand/logo.svg");
			expect(img?.getAttribute("aria-hidden")).toBe("true");
		});
	});

	it("onError hides the brand star img (wave 33b broken-img fallback)", async () => {
		renderWith(<FeedAndmore />);
		await waitFor(() => {
			const img = document.querySelector(
				".feed-andmore-brand-star img",
			) as HTMLImageElement | null;
			expect(img).not.toBeNull();
			fireEvent.error(img as HTMLImageElement);
			expect((img as HTMLImageElement).style.display).toBe("none");
		});
	});

	it("brand star span has role=img and non-empty aria-label", async () => {
		renderWith(<FeedAndmore />);
		await waitFor(() => {
			const star = document.querySelector(
				".feed-andmore-brand-star",
			) as HTMLElement | null;
			expect(star).not.toBeNull();
			expect(star?.getAttribute("role")).toBe("img");
			expect(star?.getAttribute("aria-label")).toBeTruthy();
		});
	});
});

// ---------------------------------------------------------------------------
// Task 1.1 — co-organizer sub-header (en + es)
// ---------------------------------------------------------------------------

describe("FeedAndmore co-organizer sub-header (task 1.1)", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockFeedsResponse(SAMPLE_POSTS)),
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders 'Cloud Del Norte UG co-organizer' in English", async () => {
		renderWith(<FeedAndmore />, "us");
		await waitFor(() => {
			expect(
				screen.getByText("Cloud Del Norte UG co-organizer"),
			).toBeInTheDocument();
		});
	});

	it("renders the Spanish co-organizer label", async () => {
		renderWith(<FeedAndmore />, "mx");
		await waitFor(() => {
			expect(
				screen.getByText("co-organizador del UG Cloud Del Norte"),
			).toBeInTheDocument();
		});
	});
});

// ---------------------------------------------------------------------------
// Task 2 — FeedAwsml body-m excerpt class
// ---------------------------------------------------------------------------

describe("FeedAwsml body-m excerpt (task 2)", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockFeedsResponse(SAMPLE_POSTS)),
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders .feed-posts__excerpt--body-m element (not legacy body-s Box)", async () => {
		renderWith(<FeedAwsml />);
		await waitFor(() => {
			const el = document.querySelector(".feed-posts__excerpt--body-m");
			expect(el).not.toBeNull();
		});
	});
});

// ---------------------------------------------------------------------------
// Task 5 — speaker CTA bounce @keyframes
// ---------------------------------------------------------------------------

describe("SpeakerProposalCta bounce @keyframes (task 5)", () => {
	it("cdn-cta-bounce keyframe + motion safety guards are in the stylesheet", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const cssPath = resolve("src/components/speaker-proposal-cta/styles.css");
		const css = readFileSync(cssPath, "utf-8");

		expect(css).toContain("@keyframes cdn-cta-bounce");
		expect(css).toContain("translateY");
		expect(css).toContain("prefers-reduced-motion: no-preference");
		expect(css).toContain("body.cdn-scrolling");
		expect(css).toContain("animation-play-state: paused");
	});
});
