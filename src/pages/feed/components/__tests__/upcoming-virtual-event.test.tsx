// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import UpcomingVirtualEvent from "../upcoming-virtual-event";

function renderWithLocale(locale: "us" | "mx") {
	return render(
		<LocaleProvider locale={locale}>
			<UpcomingVirtualEvent />
		</LocaleProvider>,
	);
}

describe("UpcomingVirtualEvent", () => {
	it("renders the UPCOMING badge", () => {
		renderWithLocale("us");
		expect(screen.getByText("UPCOMING")).toBeInTheDocument();
	});

	it("renders the event title with link to RSVP URL", () => {
		renderWithLocale("us");
		const link = screen.getByText(
			"[On-Line] AWS Global Community Gatherings #19",
		);
		expect(link.closest("a")).toHaveAttribute(
			"href",
			"https://www.meetup.com/awsglobalcommunitygatherings/events/314332142/",
		);
	});

	it("renders the date in en-US format", () => {
		renderWithLocale("us");
		expect(screen.getByText(/May 22/)).toBeInTheDocument();
	});

	it("renders the date in es-MX format", () => {
		renderWithLocale("mx");
		expect(screen.getByText(/mayo/i)).toBeInTheDocument();
	});

	it("renders the RSVP button with target=_blank", () => {
		renderWithLocale("us");
		const btn = screen.getByRole("link", { name: /RSVP on Meetup/i });
		expect(btn).toHaveAttribute("target", "_blank");
	});

	it("renders both light and dark image variants with proper alt text and lazy loading", () => {
		renderWithLocale("us");
		const imgs = screen.getAllByAltText(
			"AWS Global Community Gatherings virtual event banner",
		);
		expect(imgs).toHaveLength(2);
		for (const img of imgs) {
			expect(img).toHaveAttribute("loading", "lazy");
		}
		expect(imgs[0]).toHaveAttribute(
			"src",
			"/events/global-community-gatherings-light.webp",
		);
		expect(imgs[1]).toHaveAttribute(
			"src",
			"/events/global-community-gatherings-dark.webp",
		);
		expect(imgs[0].className).toContain(
			"feed-upcoming-virtual-event__image--light",
		);
		expect(imgs[1].className).toContain(
			"feed-upcoming-virtual-event__image--dark",
		);
	});
});
