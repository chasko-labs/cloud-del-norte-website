// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 24e — YouTubeShortsCarousel tests.
// Covers:
//  - renders > 0 thumbnails when shorts data is present
//  - renders empty-state when shorts data is empty
//  - clicking a thumbnail invokes the open-modal path

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import YouTubeShortsCarousel, {
	type YouTubeShort,
} from "../youtube-shorts-carousel";

const SAMPLE_SHORTS: YouTubeShort[] = [
	{
		videoId: "p3JmCEFW7vc",
		title: "Mescalero Apache Tribe — Native Cowboys (Peter Santenello)",
		thumbnailUrl: "https://i.ytimg.com/vi/p3JmCEFW7vc/hqdefault.jpg",
		publishedAt: "2022-07-19",
	},
	{
		videoId: "abc12345678",
		title: "Mescalero rodeo highlight",
		thumbnailUrl: "https://i.ytimg.com/vi/abc12345678/hqdefault.jpg",
		publishedAt: "2024-09-01",
	},
];

function renderWith(shorts: YouTubeShort[]) {
	return render(
		<LocaleProvider locale="us">
			<YouTubeShortsCarousel shorts={shorts} />
		</LocaleProvider>,
	);
}

describe("YouTubeShortsCarousel", () => {
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
});
