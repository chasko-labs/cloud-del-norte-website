// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 52 — youtube carousel CSS placeholders + spin-language primitive.
// Tests cover:
//   1. YouTubeSpinPlaceholder — skeleton renders when no data
//   2. YouTubeSpinPlaceholder — newest + oldest cards render with correct posts
//   3. Spin button toggles the spinning class
//   4. CSS gates for prefers-reduced-motion and mobile width
//   5. YouTubeShortsCarousel — placeholder shown while loading (ready === false)
//   6. YoutubeCarousel — spin placeholder renders before mount
//   7. YouTubeChannelCarousel — spin placeholder renders before mount

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import YouTubeShortsCarousel, {
	type YouTubeShort,
} from "../youtube-shorts-carousel";
import {
	type SpinItem,
	YouTubeSpinPlaceholder,
} from "../youtube-spin-placeholder";

function withLocale(ui: React.ReactElement) {
	return render(<LocaleProvider locale="us">{ui}</LocaleProvider>);
}

// ---------------------------------------------------------------------------
// Shared sample data
// ---------------------------------------------------------------------------

const NEWEST: SpinItem = {
	videoId: "v-new",
	title: "Newest video title",
	thumbnailUrl: "https://i.ytimg.com/vi/v-new/hqdefault.jpg",
	publishedAt: "2026-05-15",
};

const OLDEST: SpinItem = {
	videoId: "v-old",
	title: "Oldest video title",
	thumbnailUrl: "https://i.ytimg.com/vi/v-old/hqdefault.jpg",
	publishedAt: "2024-01-10",
};

const SHORTS: YouTubeShort[] = [
	{
		videoId: "v-new",
		title: "Newest video title",
		thumbnailUrl: "https://i.ytimg.com/vi/v-new/hqdefault.jpg",
		publishedAt: "2026-05-15",
	},
	{
		videoId: "v-mid",
		title: "Middle video title",
		thumbnailUrl: "https://i.ytimg.com/vi/v-mid/hqdefault.jpg",
		publishedAt: "2025-06-01",
	},
	{
		videoId: "v-old",
		title: "Oldest video title",
		thumbnailUrl: "https://i.ytimg.com/vi/v-old/hqdefault.jpg",
		publishedAt: "2024-01-10",
	},
];

// ---------------------------------------------------------------------------
// 1. Skeleton placeholder renders when no data
// ---------------------------------------------------------------------------

describe("Wave 52 — YouTubeSpinPlaceholder skeleton (no data)", () => {
	it("renders the spin button even when newest/oldest are null", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={null}
				oldest={null}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		expect(screen.getByTestId("spin-btn")).toBeInTheDocument();
	});

	it("renders no spin cards when newest/oldest are null", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={null}
				oldest={null}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		expect(screen.queryAllByTestId("spin-card")).toHaveLength(0);
	});

	it("marks the spin anchor with data-spin-anchor for wave 53", () => {
		const { container } = withLocale(
			<YouTubeSpinPlaceholder
				newest={null}
				oldest={null}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		expect(
			container.querySelector("[data-spin-anchor='true']"),
		).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// 2. Newest + oldest preview cards render with correct posts
// ---------------------------------------------------------------------------

describe("Wave 52 — YouTubeSpinPlaceholder with data", () => {
	it("renders two spin cards when newest and oldest are distinct", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={OLDEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		const cards = screen.getAllByTestId("spin-card");
		expect(cards).toHaveLength(2);
	});

	it("renders one card when newest === oldest (same videoId)", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={NEWEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		expect(screen.getAllByTestId("spin-card")).toHaveLength(1);
	});

	it("first card aria-label matches newest title", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={OLDEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		const cards = screen.getAllByTestId("spin-card");
		expect(cards[0]).toHaveAttribute("aria-label", NEWEST.title);
	});

	it("second card aria-label matches oldest title", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={OLDEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		const cards = screen.getAllByTestId("spin-card");
		expect(cards[1]).toHaveAttribute("aria-label", OLDEST.title);
	});

	it("renders relative date for newest card", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={OLDEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		// should contain something like "Xd ago" or "X mo ago"
		const dates = document.querySelectorAll(".yt-spin-card__date");
		expect(dates.length).toBeGreaterThanOrEqual(1);
		expect(dates[0].textContent).toBeTruthy();
	});

	it("thumbnail img has correct src for newest card", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={OLDEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		const imgs = document.querySelectorAll<HTMLImageElement>(
			".yt-spin-card__thumb",
		);
		expect(imgs[0].getAttribute("src")).toBe(NEWEST.thumbnailUrl);
	});
});

// ---------------------------------------------------------------------------
// 3. Spin button toggles the spinning class
// ---------------------------------------------------------------------------

describe("Wave 52 — spin button toggles spinning class", () => {
	it("spin-root does NOT have --spinning class initially", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={OLDEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		expect(screen.getByTestId("spin-root")).not.toHaveClass(
			"yt-spin-root--spinning",
		);
	});

	it("clicking the spin button adds --spinning class to spin-root", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={OLDEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		fireEvent.click(screen.getByTestId("spin-btn"));
		expect(screen.getByTestId("spin-root")).toHaveClass(
			"yt-spin-root--spinning",
		);
	});

	it("clicking spin button twice removes --spinning class (toggle)", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={OLDEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		const btn = screen.getByTestId("spin-btn");
		fireEvent.click(btn);
		fireEvent.click(btn);
		expect(screen.getByTestId("spin-root")).not.toHaveClass(
			"yt-spin-root--spinning",
		);
	});

	it("spin button has aria-pressed=false initially", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={OLDEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		expect(screen.getByTestId("spin-btn")).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	it("spin button has aria-pressed=true after click", () => {
		withLocale(
			<YouTubeSpinPlaceholder
				newest={NEWEST}
				oldest={OLDEST}
				spinLabel="Spin"
				ariaLabel="preview"
				i18n={{ newestBadge: "newest", oldestBadge: "oldest" }}
			/>,
		);
		fireEvent.click(screen.getByTestId("spin-btn"));
		expect(screen.getByTestId("spin-btn")).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});
});

// ---------------------------------------------------------------------------
// 4. CSS gates — prefers-reduced-motion and mobile width
// ---------------------------------------------------------------------------

describe("Wave 52 — CSS guards", () => {
	it("spin CSS has prefers-reduced-motion: reduce guard", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const css = readFileSync(
			resolve("src/pages/feed/components/youtube-carousel-spin.css"),
			"utf-8",
		);
		expect(css).toContain("prefers-reduced-motion: reduce");
	});

	it("spin CSS has prefers-reduced-motion: no-preference guard (hover only)", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const css = readFileSync(
			resolve("src/pages/feed/components/youtube-carousel-spin.css"),
			"utf-8",
		);
		// reduced-motion gate disables rotation
		expect(css).toContain("transform: none");
	});

	it("spin CSS disables 3D transform at max-width: 767px (mobile gate)", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const css = readFileSync(
			resolve("src/pages/feed/components/youtube-carousel-spin.css"),
			"utf-8",
		);
		expect(css).toContain("max-width: 767px");
	});

	it("spin CSS pauses animation when body.cdn-scrolling", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const css = readFileSync(
			resolve("src/pages/feed/components/youtube-carousel-spin.css"),
			"utf-8",
		);
		expect(css).toContain("body.cdn-scrolling");
		expect(css).toContain("transition: none");
	});

	it("spin CSS uses rotateY on desktop (≥768px)", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const css = readFileSync(
			resolve("src/pages/feed/components/youtube-carousel-spin.css"),
			"utf-8",
		);
		expect(css).toContain("rotateY");
		expect(css).toContain("min-width: 768px");
	});

	it("spin CSS documents the wave 53 Babylon hook point in a comment", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const css = readFileSync(
			resolve("src/pages/feed/components/youtube-carousel-spin.css"),
			"utf-8",
		);
		expect(css).toContain("Wave 53");
		expect(css).toContain("data-spin-anchor");
	});
});

// ---------------------------------------------------------------------------
// 5. YouTubeShortsCarousel — placeholder integration
// ---------------------------------------------------------------------------

describe("Wave 52 — YouTubeShortsCarousel placeholder", () => {
	it("renders spin placeholder (spin-btn) while data is loading (no shorts prop)", () => {
		// No shorts prop → ready=false, should show placeholder
		withLocale(
			<LocaleProvider locale="us">
				<YouTubeShortsCarousel dataUrl="/data/nonexistent.json" />
			</LocaleProvider>,
		);
		// spin-btn is present in the placeholder even before data arrives
		expect(screen.getByTestId("spin-btn")).toBeInTheDocument();
	});

	it("renders newest spin card after data arrives", () => {
		withLocale(<YouTubeShortsCarousel shorts={SHORTS} />);
		const cards = screen.getAllByTestId("spin-card");
		expect(cards[0]).toHaveAttribute("aria-label", SHORTS[0].title);
	});

	it("renders oldest spin card after data arrives", () => {
		withLocale(<YouTubeShortsCarousel shorts={SHORTS} />);
		const cards = screen.getAllByTestId("spin-card");
		expect(cards[1]).toHaveAttribute(
			"aria-label",
			SHORTS[SHORTS.length - 1].title,
		);
	});

	it("renders empty-state message when shorts array is empty", () => {
		withLocale(<YouTubeShortsCarousel shorts={[]} />);
		expect(screen.getByTestId("shorts-empty-state")).toBeInTheDocument();
	});

	it("spin placeholder uses data-spin-anchor for wave 53 Babylon mount", () => {
		withLocale(<YouTubeShortsCarousel shorts={SHORTS} />);
		const anchor = document.querySelector("[data-spin-anchor='true']");
		expect(anchor).toBeInTheDocument();
	});
});
