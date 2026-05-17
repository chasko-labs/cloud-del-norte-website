// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeaturedVideoCard from "../featured-video-card";

// ── IntersectionObserver mock ─────────────────────────────────────────────────
type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let lastCallback: IOCallback | null = null;

beforeEach(() => {
	lastCallback = null;
	class IntersectionObserverMock {
		disconnect = vi.fn();
		constructor(cb: IOCallback) {
			lastCallback = cb;
		}
		observe() {}
	}
	globalThis.IntersectionObserver =
		IntersectionObserverMock as unknown as typeof IntersectionObserver;
});

afterEach(() => {
	vi.restoreAllMocks();
});

const PROPS = {
	videoId: "0PedFnnH_Ic",
	title:
		"How a Former Journalist Became an AWS Community Builder | Women in Tech Story",
	author: "Shubham gour",
	authorUrl: "https://www.youtube.com/@Shubhamgourtech",
	thumbnailUrl: "https://i.ytimg.com/vi/0PedFnnH_Ic/hqdefault.jpg",
};

describe("FeaturedVideoCard", () => {
	it("renders thumbnail with correct src", () => {
		render(<FeaturedVideoCard {...PROPS} />);
		const img = screen.getByTestId("featured-video-thumbnail");
		expect(img).toHaveAttribute("src", PROPS.thumbnailUrl);
	});

	it("renders title and author", () => {
		render(<FeaturedVideoCard {...PROPS} />);
		expect(screen.getByText(PROPS.title)).toBeInTheDocument();
		expect(screen.getByText(PROPS.author)).toBeInTheDocument();
	});

	it("does not render iframe before IntersectionObserver fires", () => {
		render(<FeaturedVideoCard {...PROPS} />);
		expect(screen.queryByTitle(PROPS.title)).toBeNull();
	});

	it("renders iframe with correct src after IntersectionObserver fires", async () => {
		const { act } = await import("react");
		render(<FeaturedVideoCard {...PROPS} />);
		await act(async () => {
			lastCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
		});
		const iframe = screen.getByTitle(PROPS.title);
		expect(iframe).toHaveAttribute(
			"src",
			`https://www.youtube.com/embed/${PROPS.videoId}`,
		);
	});
});
