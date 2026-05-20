// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 56 tests:
//   A — BuilderCenterCard click-to-play modal (svvgLNWGlEI)
//   B — FeaturedVideoCard palette prop
//   C — feed/app.tsx SECTION_KEYS includes 'howToPlayBuildercards'

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import BuilderCenterCard from "../builder-center-card";
import FeaturedVideoCard from "../featured-video-card";

function withLocale(ui: React.ReactElement) {
	return render(<LocaleProvider locale="us">{ui}</LocaleProvider>);
}

// IntersectionObserver stub required by LazyEmbed
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
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// A — BuilderCenterCard modal
// ---------------------------------------------------------------------------

describe("Wave 56A — BuilderCenterCard click-to-play modal", () => {
	it("renders 'Watch BuilderCards intro' button", () => {
		withLocale(<BuilderCenterCard />);
		expect(
			screen.getByTestId("builder-center-watch-intro"),
		).toBeInTheDocument();
	});

	it("modal is not visible before button click", () => {
		withLocale(<BuilderCenterCard />);
		// Cloudscape Modal always renders in DOM but adds awsui_hidden_* class
		// when visible=false. Check the dialog exists but is visually hidden.
		const dialog = document.querySelector("[role='dialog']") as HTMLElement;
		expect(dialog).not.toBeNull();
		// hidden class contains "hidden"
		expect(dialog.className).toMatch(/hidden/);
	});

	it("clicking Watch intro button opens the modal", async () => {
		withLocale(<BuilderCenterCard />);
		const btn = screen.getByTestId("builder-center-watch-intro");
		fireEvent.click(btn);
		await waitFor(() => {
			expect(
				screen.getByText("Building AWS Architectures with BuilderCards"),
			).toBeInTheDocument();
		});
	});

	it("open modal contains iframe with svvgLNWGlEI src after IntersectionObserver fires", async () => {
		const { act } = await import("react");
		withLocale(<BuilderCenterCard />);
		const btn = screen.getByTestId("builder-center-watch-intro");
		fireEvent.click(btn);
		await waitFor(() => {
			expect(
				screen.getByText("Building AWS Architectures with BuilderCards"),
			).toBeInTheDocument();
		});
		// trigger IntersectionObserver so LazyEmbed renders the iframe
		await act(async () => {
			lastIOCb?.([{ isIntersecting: true } as IntersectionObserverEntry]);
		});
		const iframe = screen.getByTitle(
			"Building AWS Architectures with BuilderCards",
		);
		expect(iframe.getAttribute("src")).toContain("svvgLNWGlEI");
	});

	it("modal contains author attribution link to Ajolotes en la Nube", async () => {
		withLocale(<BuilderCenterCard />);
		fireEvent.click(screen.getByTestId("builder-center-watch-intro"));
		await waitFor(() => {
			expect(screen.getByText("Ajolotes en la Nube")).toBeInTheDocument();
		});
	});

	it("dismissing modal re-hides the dialog", async () => {
		withLocale(<BuilderCenterCard />);
		fireEvent.click(screen.getByTestId("builder-center-watch-intro"));
		await waitFor(() => {
			// Modal should be visible — no hidden class
			const dialog = document.querySelector("[role='dialog']") as HTMLElement;
			expect(dialog.className).not.toMatch(/hidden/);
		});
		const closeBtn = document.querySelector(
			'[class*="dismiss-control"]',
		) as HTMLElement;
		expect(closeBtn).not.toBeNull();
		fireEvent.click(closeBtn);
		await waitFor(() => {
			const dialog = document.querySelector("[role='dialog']") as HTMLElement;
			expect(dialog.className).toMatch(/hidden/);
		});
	});
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
