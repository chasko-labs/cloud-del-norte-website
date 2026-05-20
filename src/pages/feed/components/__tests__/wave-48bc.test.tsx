// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 48b/c — tests for:
//   B.1 — FeedAndmore single-line compact header (brand star + title + co-org inline)
//   B.2 — AndresYoutubeLive fanfare (brand star, sigil, ayl-header-row)
//   C   — FeaturedVideoCard desktop right-column alignment (align-items: start in CSS)

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import AndresYoutubeLive from "../andres-youtube-live";
import FeaturedVideoCard from "../featured-video-card";
import { FeedAndmore, type FeedPost } from "../feed-section";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function withLocale(ui: React.ReactElement, locale: "us" | "mx" = "us") {
	return render(<LocaleProvider locale={locale}>{ui}</LocaleProvider>);
}

function mockFeedsOk(posts: FeedPost[]) {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({ andmore: posts, awsml: posts, readysetcloud: posts }),
		}),
	);
}

const SAMPLE_POSTS: FeedPost[] = [
	{
		title: "Post one",
		link: "https://andmore.dev/p1",
		pubDate: "2026-05-20",
		excerpt: "Brief excerpt.",
	},
];

// IntersectionObserver stub for lazy-embed tests
type IOCallback = (entries: IntersectionObserverEntry[]) => void;
let lastIOCb: IOCallback | null = null;

beforeEach(() => {
	lastIOCb = null;
	class IOMock {
		disconnect = vi.fn();
		constructor(cb: IOCallback) {
			lastIOCb = cb;
		}
		observe() {}
	}
	globalThis.IntersectionObserver =
		IOMock as unknown as typeof IntersectionObserver;
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// B.1 — FeedAndmore compact single-line header
// ---------------------------------------------------------------------------

describe("Wave 48b.1 — FeedAndmore compact header", () => {
	beforeEach(() => {
		mockFeedsOk(SAMPLE_POSTS);
	});

	it("brand star, title, and co-organizer are all within .feed-andmore-header-row (single line)", async () => {
		withLocale(<FeedAndmore />);
		await waitFor(() => {
			const row = document.querySelector(
				".feed-andmore-header-row",
			) as HTMLElement | null;
			expect(row).not.toBeNull();
			// brand star inside the row
			const star = row?.querySelector(".feed-andmore-brand-star");
			expect(star).not.toBeNull();
			// co-organizer label inside the same row
			const coorg = row?.querySelector(".feed-andmore-coorg");
			expect(coorg).not.toBeNull();
			expect(coorg?.textContent).toBeTruthy();
		});
	});

	it("no .feed-card-header-sub stacked below header (removed stacking)", async () => {
		withLocale(<FeedAndmore />);
		await waitFor(() => {
			// feed-card-header-sub would be the old stacked sub-header; should not appear
			const sub = document.querySelector(".feed-card-header-sub");
			expect(sub).toBeNull();
		});
	});

	it("brand star img is 24px (tightened from 32px wave 45)", async () => {
		withLocale(<FeedAndmore />);
		await waitFor(() => {
			const img = document.querySelector(
				".feed-andmore-brand-star img",
			) as HTMLImageElement | null;
			expect(img).not.toBeNull();
			expect(img?.getAttribute("width")).toBe("24");
		});
	});

	it("co-organizer text visible in Spanish locale", async () => {
		withLocale(<FeedAndmore />, "mx");
		await waitFor(() => {
			// Spanish locale key renders some co-organizer text
			const coorg = document.querySelector(".feed-andmore-coorg");
			expect(coorg?.textContent).toBeTruthy();
		});
	});
});

// ---------------------------------------------------------------------------
// B.2 — AndresYoutubeLive fanfare
// ---------------------------------------------------------------------------

describe("Wave 48b.2 — AndresYoutubeLive fanfare", () => {
	it("renders ayl-container wrapper for GPU compositing gate", () => {
		withLocale(<AndresYoutubeLive videoId="abc123" />);
		const container = document.querySelector(".ayl-container");
		expect(container).not.toBeNull();
	});

	it("renders ayl-header-row with brand star and sigil", () => {
		withLocale(<AndresYoutubeLive videoId="abc123" />);
		const row = document.querySelector(".ayl-header-row");
		expect(row).not.toBeNull();
		const star = row?.querySelector(".ayl-brand-star");
		expect(star).not.toBeNull();
		const sigil = row?.querySelector(".ayl-sigil");
		expect(sigil).not.toBeNull();
	});

	it("brand star img loads /brand/logo.svg", () => {
		withLocale(<AndresYoutubeLive videoId="abc123" />);
		const img = document.querySelector(
			".ayl-brand-star img",
		) as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/brand/logo.svg");
		expect(img?.getAttribute("aria-hidden")).toBe("true");
	});

	it("brand star onError hides the img", () => {
		withLocale(<AndresYoutubeLive videoId="abc123" />);
		const img = document.querySelector(
			".ayl-brand-star img",
		) as HTMLImageElement | null;
		expect(img).not.toBeNull();
		fireEvent.error(img as HTMLImageElement);
		expect((img as HTMLImageElement).style.display).toBe("none");
	});

	it("sigil SVG is aria-hidden (decorative)", () => {
		withLocale(<AndresYoutubeLive videoId="abc123" />);
		const sigil = document.querySelector(".ayl-sigil");
		expect(sigil?.getAttribute("aria-hidden")).toBe("true");
	});

	it("live-broadcast sigil CSS has reduced-motion + cdn-scrolling guards", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const css = readFileSync(
			resolve("src/pages/feed/components/andres-youtube-live.css"),
			"utf-8",
		);
		expect(css).toContain("prefers-reduced-motion: no-preference");
		expect(css).toContain("prefers-reduced-motion: reduce");
		expect(css).toContain("body.cdn-scrolling");
		expect(css).toContain("animation-play-state: paused");
		// GPU gate: desktop only
		expect(css).toContain("min-width: 768px");
		expect(css).toContain("will-change: transform");
	});
});

// ---------------------------------------------------------------------------
// C — FeaturedVideoCard desktop spacing
// ---------------------------------------------------------------------------

describe("Wave 48c — FeaturedVideoCard desktop right-column spacing", () => {
	const PROPS = {
		videoId: "0PedFnnH_Ic",
		title: "Women in Tech",
		author: "Shubham gour",
		authorUrl: "https://www.youtube.com/@Shubhamgourtech",
	};

	it("renders featured-video-card__fallback as grid column 2", () => {
		withLocale(<FeaturedVideoCard {...PROPS} />);
		const fallback = document.querySelector(".featured-video-card__fallback");
		expect(fallback).not.toBeNull();
	});

	it("Wave 42b2 grid fix: align-items:start in styles.css (not center)", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const css = readFileSync(resolve("src/pages/feed/styles.css"), "utf-8");
		// After wave 48c, the lavender carousel grid must use align-items: start
		// We match the block containing the lavender selector
		const lavenderIdx = css.indexOf(
			".feed-card-shell--lavender .feed-carousel {",
		);
		expect(lavenderIdx).toBeGreaterThan(-1);
		const block = css.slice(lavenderIdx, lavenderIdx + 300);
		expect(block).toContain("align-items: start");
		expect(block).not.toContain("align-items: center");
	});
});
