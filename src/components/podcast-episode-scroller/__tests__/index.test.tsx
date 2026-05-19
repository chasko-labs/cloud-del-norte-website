// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 24c — PodcastEpisodeScroller component tests.
 *
 * Verifies:
 *   1. render gates (hidden when isPodcast=false, visible when true)
 *   2. sort toggle reorders the visible list (newest ↔ oldest) and persists
 *      the choice to localStorage
 *   3. clicking an episode's play button triggers onEpisodeSelect(url, title)
 *   4. load-more pagination expands the list past PAGE_SIZE
 *   5. transcript link only renders for episodes whose feed shipped a
 *      <podcast:transcript> URL
 *   6. empty-state copy renders when the active podcast has no episodes
 *
 * Cloudscape Container/Header/Button/SegmentedControl are mocked to plain
 * DOM so the test stays focused on scroller behaviour without pulling the
 * full Cloudscape rendering stack into jsdom.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AnyProps = Record<string, unknown> & {
	children?: React.ReactNode;
	header?: React.ReactNode;
};

vi.mock("@cloudscape-design/components/container", () => ({
	default: ({ children, header }: AnyProps) =>
		React.createElement(
			"section",
			{ "data-testid": "container" },
			header,
			children,
		),
}));

vi.mock("@cloudscape-design/components/header", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("h3", { "data-testid": "scroller-header" }, children),
}));

vi.mock("@cloudscape-design/components/button", () => ({
	default: ({ children, onClick }: AnyProps) =>
		React.createElement(
			"button",
			{
				type: "button",
				"data-testid": "load-more-button",
				onClick: onClick as React.MouseEventHandler,
			},
			children,
		),
}));

vi.mock("@cloudscape-design/components/segmented-control", () => ({
	default: ({
		selectedId,
		onChange,
		options,
	}: {
		selectedId: string;
		onChange: (e: { detail: { selectedId: string } }) => void;
		options: { id: string; text: string }[];
	}) =>
		React.createElement(
			"div",
			{ "data-testid": "sort-segmented-control" },
			...options.map((opt) =>
				React.createElement(
					"button",
					{
						key: opt.id,
						type: "button",
						"data-testid": `sort-option-${opt.id}`,
						"data-selected": selectedId === opt.id ? "true" : "false",
						onClick: () => onChange({ detail: { selectedId: opt.id } }),
					},
					opt.text,
				),
			),
		),
}));

// Locale provider — supplies the t() / locale used by the component.
import { LocaleProvider } from "../../../contexts/locale-context";
import { PodcastEpisodeScroller } from "../index";

function withLocale(node: React.ReactNode) {
	return React.createElement(LocaleProvider, { locale: "us" }, node);
}

const FIXED_NEWEST = "2026-05-15T00:00:00.000Z";
const FIXED_MIDDLE = "2026-04-01T00:00:00.000Z";
const FIXED_OLDEST = "2026-01-10T00:00:00.000Z";

function makeFixture() {
	const episodes = [
		{
			guid: "ep-newest",
			title: "Newest episode",
			pubDate: FIXED_NEWEST,
			duration: 1800,
			enclosureUrl: "https://example.com/ep-newest.mp3",
			transcriptUrl: "https://example.com/ep-newest.html",
		},
		{
			guid: "ep-middle",
			title: "Middle episode",
			pubDate: FIXED_MIDDLE,
			duration: 2400,
			enclosureUrl: "https://example.com/ep-middle.mp3",
		},
		{
			guid: "ep-oldest",
			title: "Oldest episode",
			pubDate: FIXED_OLDEST,
			duration: 3600,
			enclosureUrl: "https://example.com/ep-oldest.mp3",
		},
	];
	return {
		talk_python: {
			title: "Newest episode",
			subtitle: null,
			display: "Newest episode",
			episodes,
		},
	};
}

function makeManyEpisodes(count: number) {
	const episodes = Array.from({ length: count }, (_, i) => {
		// each step ~1 day apart so sort order is deterministic
		const ts = Date.UTC(2026, 0, 1 + i);
		return {
			guid: `ep-${i}`,
			title: `Episode ${i}`,
			pubDate: new Date(ts).toISOString(),
			duration: 600 + i,
			enclosureUrl: `https://example.com/ep-${i}.mp3`,
		};
	});
	return {
		talk_python: {
			title: "Talk Python",
			subtitle: null,
			display: "Talk Python",
			episodes,
		},
	};
}

function mockFetchOnce(payload: unknown) {
	globalThis.fetch = vi.fn(async () =>
		Promise.resolve(
			new Response(JSON.stringify(payload), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		),
	) as unknown as typeof fetch;
}

describe("PodcastEpisodeScroller (wave 24c)", () => {
	beforeEach(() => {
		try {
			localStorage.clear();
		} catch {
			// ignore — jsdom should always have localStorage
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders nothing when isPodcast=false", () => {
		const onSelect = vi.fn();
		const { container } = render(
			withLocale(
				React.createElement(PodcastEpisodeScroller, {
					isPodcast: false,
					currentStreamKey: "krux",
					currentEpisodeUrl: "",
					onEpisodeSelect: onSelect,
				}),
			),
		);
		expect(container.querySelector("[data-testid='container']")).toBeNull();
	});

	it("renders header + episode rows when isPodcast=true and data has episodes", async () => {
		mockFetchOnce(makeFixture());
		const onSelect = vi.fn();
		render(
			withLocale(
				React.createElement(PodcastEpisodeScroller, {
					isPodcast: true,
					currentStreamKey: "talk_python",
					currentEpisodeUrl: "",
					onEpisodeSelect: onSelect,
				}),
			),
		);
		await waitFor(() => {
			expect(screen.getByText("Newest episode")).toBeInTheDocument();
		});
		expect(screen.getByText("Middle episode")).toBeInTheDocument();
		expect(screen.getByText("Oldest episode")).toBeInTheDocument();
		// header includes the suffix copy
		expect(screen.getByTestId("scroller-header").textContent).toMatch(
			/episodes/,
		);
	});

	it("default sort is newest first; toggling to oldest reorders the list and persists to localStorage", async () => {
		mockFetchOnce(makeFixture());
		const onSelect = vi.fn();
		const { container } = render(
			withLocale(
				React.createElement(PodcastEpisodeScroller, {
					isPodcast: true,
					currentStreamKey: "talk_python",
					currentEpisodeUrl: "",
					onEpisodeSelect: onSelect,
				}),
			),
		);

		await waitFor(() => {
			expect(screen.getByText("Newest episode")).toBeInTheDocument();
		});

		const titlesNewest = Array.from(
			container.querySelectorAll(".cdn-podcast-scroller__title"),
		).map((el) => el.textContent);
		expect(titlesNewest).toEqual([
			"Newest episode",
			"Middle episode",
			"Oldest episode",
		]);

		fireEvent.click(screen.getByTestId("sort-option-oldest"));

		await waitFor(() => {
			const titlesOldest = Array.from(
				container.querySelectorAll(".cdn-podcast-scroller__title"),
			).map((el) => el.textContent);
			expect(titlesOldest).toEqual([
				"Oldest episode",
				"Middle episode",
				"Newest episode",
			]);
		});

		expect(localStorage.getItem("cdn:podcast-scroller:sort:v1")).toBe("oldest");
	});

	it("clicking a play button fires onEpisodeSelect with the enclosure URL + title", async () => {
		mockFetchOnce(makeFixture());
		const onSelect = vi.fn();
		render(
			withLocale(
				React.createElement(PodcastEpisodeScroller, {
					isPodcast: true,
					currentStreamKey: "talk_python",
					currentEpisodeUrl: "",
					onEpisodeSelect: onSelect,
				}),
			),
		);
		await waitFor(() => {
			expect(screen.getByText("Newest episode")).toBeInTheDocument();
		});
		const playBtn = screen.getByLabelText("Play Middle episode");
		fireEvent.click(playBtn);
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith(
			"https://example.com/ep-middle.mp3",
			"Middle episode",
		);
	});

	it("transcript link renders only for episodes whose feed shipped a <podcast:transcript> URL", async () => {
		mockFetchOnce(makeFixture());
		render(
			withLocale(
				React.createElement(PodcastEpisodeScroller, {
					isPodcast: true,
					currentStreamKey: "talk_python",
					currentEpisodeUrl: "",
					onEpisodeSelect: vi.fn(),
				}),
			),
		);
		await waitFor(() => {
			expect(screen.getByText("Newest episode")).toBeInTheDocument();
		});
		// Newest has transcriptUrl — link present
		const transcriptLinks = screen.getAllByText("transcript");
		expect(transcriptLinks).toHaveLength(1);
		expect(transcriptLinks[0]).toHaveAttribute(
			"href",
			"https://example.com/ep-newest.html",
		);
		expect(transcriptLinks[0]).toHaveAttribute("target", "_blank");
		expect(transcriptLinks[0]).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("load-more button appears when episodes exceed PAGE_SIZE; click expands the list", async () => {
		mockFetchOnce(makeManyEpisodes(75));
		render(
			withLocale(
				React.createElement(PodcastEpisodeScroller, {
					isPodcast: true,
					currentStreamKey: "talk_python",
					currentEpisodeUrl: "",
					onEpisodeSelect: vi.fn(),
				}),
			),
		);
		await waitFor(() => {
			// PAGE_SIZE=50; with 75 episodes, expect 50 visible rows + load-more
			const rows = document.querySelectorAll(".cdn-podcast-scroller__row");
			expect(rows.length).toBe(50);
		});
		const loadMore = screen.getByTestId("load-more-button");
		fireEvent.click(loadMore);
		await waitFor(() => {
			const rows = document.querySelectorAll(".cdn-podcast-scroller__row");
			expect(rows.length).toBe(75);
		});
		// no more pages — button should be gone
		expect(screen.queryByTestId("load-more-button")).toBeNull();
	});

	it("renders empty-state copy when the active podcast has no episodes", async () => {
		mockFetchOnce({
			talk_python: {
				title: null,
				subtitle: null,
				display: null,
				episodes: [],
			},
		});
		render(
			withLocale(
				React.createElement(PodcastEpisodeScroller, {
					isPodcast: true,
					currentStreamKey: "talk_python",
					currentEpisodeUrl: "",
					onEpisodeSelect: vi.fn(),
				}),
			),
		);
		await waitFor(() => {
			expect(screen.getByText("No episodes available yet")).toBeInTheDocument();
		});
	});
});
