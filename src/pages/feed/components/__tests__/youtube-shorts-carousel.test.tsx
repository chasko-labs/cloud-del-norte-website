// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 24e — YouTubeShortsCarousel tests.
// Wave 28b — added sort-selector coverage:
//  - newest-first is the default order
//  - clicking "Oldest first" reverses the rendered order
//  - sort selection round-trips through localStorage

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import YouTubeShortsCarousel, {
	SHORTS_SORT_STORAGE_KEY,
	type YouTubeShort,
} from "../youtube-shorts-carousel";

// Source order matches the YouTube RSS feed shape: newest first.
const SAMPLE_SHORTS: YouTubeShort[] = [
	{
		videoId: "newest1",
		title: "MMIP movement update",
		thumbnailUrl: "https://i.ytimg.com/vi/newest1/hqdefault.jpg",
		publishedAt: "2026-05-16",
	},
	{
		videoId: "middle1",
		title: "Oak Flat — the fight continues",
		thumbnailUrl: "https://i.ytimg.com/vi/middle1/hqdefault.jpg",
		publishedAt: "2026-03-14",
	},
	{
		videoId: "oldest1",
		title: "This Land Is Our Mother — Lozen at Oak Flat",
		thumbnailUrl: "https://i.ytimg.com/vi/oldest1/hqdefault.jpg",
		publishedAt: "2025-09-06",
	},
];

function renderWith(shorts: YouTubeShort[]) {
	return render(
		<LocaleProvider locale="us">
			<YouTubeShortsCarousel shorts={shorts} />
		</LocaleProvider>,
	);
}

function thumbTitles(): string[] {
	return screen.getAllByTestId("shorts-thumb").map((btn) => {
		const titleSpan = btn.querySelector(".feed-shorts-carousel__title");
		return titleSpan?.textContent?.trim() ?? "";
	});
}

describe("YouTubeShortsCarousel", () => {
	beforeEach(() => {
		try {
			window.localStorage.removeItem(SHORTS_SORT_STORAGE_KEY);
		} catch {
			// jsdom always provides localStorage; defensive only
		}
	});

	afterEach(() => {
		try {
			window.localStorage.removeItem(SHORTS_SORT_STORAGE_KEY);
		} catch {
			// noop
		}
	});

	it("renders one button per short when data is present", () => {
		renderWith(SAMPLE_SHORTS);
		const thumbs = screen.getAllByTestId("shorts-thumb");
		expect(thumbs).toHaveLength(SAMPLE_SHORTS.length);
		expect(thumbs[0]).toHaveAttribute(
			"aria-label",
			expect.stringContaining(SAMPLE_SHORTS[0].title),
		);
	});

	it("renders the empty-state when no shorts are present", () => {
		renderWith([]);
		expect(screen.getByTestId("shorts-empty-state")).toBeInTheDocument();
		expect(screen.queryAllByTestId("shorts-thumb")).toHaveLength(0);
	});

	it("opens the modal embed when a thumbnail is clicked", () => {
		renderWith(SAMPLE_SHORTS);
		const thumbs = screen.getAllByTestId("shorts-thumb");
		fireEvent.click(thumbs[0]);
		// Cloudscape Modal renders an iframe with the clicked short's title.
		const iframe = screen.getByTitle(SAMPLE_SHORTS[0].title);
		expect(iframe).toHaveAttribute(
			"src",
			`https://www.youtube.com/embed/${SAMPLE_SHORTS[0].videoId}`,
		);
	});

	// --- wave 28b sort selector --------------------------------------

	it("defaults to newest-first order matching the source data", () => {
		renderWith(SAMPLE_SHORTS);
		const titles = thumbTitles();
		expect(titles).toEqual(SAMPLE_SHORTS.map((s) => s.title));
	});

	it("reverses the rendered order when oldest-first is selected", () => {
		renderWith(SAMPLE_SHORTS);
		// Cloudscape SegmentedControl renders each option as a button labelled
		// by its text. Click the "Oldest first" button.
		const oldestButton = screen.getByRole("button", { name: /oldest first/i });
		fireEvent.click(oldestButton);

		const titles = thumbTitles();
		expect(titles).toEqual(
			SAMPLE_SHORTS.slice()
				.reverse()
				.map((s) => s.title),
		);
		// Live-region announcement reflects the change.
		expect(screen.getByTestId("shorts-sort-live-region")).toHaveTextContent(
			/sorted oldest first/i,
		);
	});

	it("persists the selected sort order in localStorage and restores it on remount", () => {
		const { unmount } = renderWith(SAMPLE_SHORTS);
		fireEvent.click(screen.getByRole("button", { name: /oldest first/i }));
		expect(window.localStorage.getItem(SHORTS_SORT_STORAGE_KEY)).toBe("oldest");

		unmount();

		// Remount fresh and expect oldest-first ordering without re-clicking.
		renderWith(SAMPLE_SHORTS);
		const titles = thumbTitles();
		expect(titles).toEqual(
			SAMPLE_SHORTS.slice()
				.reverse()
				.map((s) => s.title),
		);
	});
});
