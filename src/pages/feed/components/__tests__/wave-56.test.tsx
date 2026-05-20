// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 56 tests (post-wave-69 rollback):
//   B — FeaturedVideoCard palette prop
//   C — feed/app.tsx SECTION_KEYS includes 'howToPlayBuildercards'
//
// Wave 56A — BuilderCenterCard click-to-play modal (svvgLNWGlEI) removed in
// wave 69 per Bryan: 'remove watch builder cards intro from builder center
// card, thats not what I meant and carlos blocks us from embedding his video'.

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import FeaturedVideoCard from "../featured-video-card";

function withLocale(ui: React.ReactElement) {
	return render(<LocaleProvider locale="us">{ui}</LocaleProvider>);
}

// IntersectionObserver stub required by LazyEmbed (used inside FeaturedVideoCard)
beforeEach(() => {
	class IOMock {
		disconnect = vi.fn();
		observe() {}
	}
	globalThis.IntersectionObserver =
		IOMock as unknown as typeof IntersectionObserver;
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// B — FeaturedVideoCard palette prop
// ---------------------------------------------------------------------------

describe("Wave 56B — FeaturedVideoCard palette prop", () => {
	const BASE = {
		videoId: "Pn6w8-abgis",
		title: "How to play AWS BuilderCards (2023)",
		author: "AWS for Games",
		authorUrl: "https://www.youtube.com/@AWSGameTech",
	};

	it("defaults to palette=lavender when no palette prop provided", () => {
		withLocale(
			<FeaturedVideoCard
				videoId="0PedFnnH_Ic"
				title="Women in Tech"
				author="Shubham gour"
				authorUrl="https://www.youtube.com/@Shubhamgourtech"
			/>,
		);
		const shell = document.querySelector("[data-feed-card-palette]");
		expect(shell?.getAttribute("data-feed-card-palette")).toBe("lavender");
	});

	it("renders with palette=gold when prop provided", () => {
		withLocale(<FeaturedVideoCard {...BASE} palette="gold" />);
		const shell = document.querySelector("[data-feed-card-palette]");
		expect(shell?.getAttribute("data-feed-card-palette")).toBe("gold");
	});

	it("renders title for how-to-play card", () => {
		withLocale(<FeaturedVideoCard {...BASE} palette="gold" />);
		expect(
			screen.getByText("How to play AWS BuilderCards (2023)"),
		).toBeInTheDocument();
	});

	it("renders author link for AWS for Games", () => {
		withLocale(<FeaturedVideoCard {...BASE} palette="gold" />);
		expect(screen.getByText("AWS for Games")).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// C — SECTION_KEYS includes howToPlayBuildercards
// ---------------------------------------------------------------------------

describe("Wave 56C — SECTION_KEYS includes howToPlayBuildercards", () => {
	it("SECTION_KEYS array contains 'howToPlayBuildercards' and Pn6w8-abgis videoId", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const src = readFileSync(resolve("src/pages/feed/app.tsx"), "utf-8");
		expect(src).toContain('"howToPlayBuildercards"');
		expect(src).toContain("Pn6w8-abgis");
	});
});
