// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import FeaturedEvent from "../featured-event";

function renderWithLocale(locale: "us" | "mx") {
	return render(
		<LocaleProvider locale={locale}>
			<FeaturedEvent />
		</LocaleProvider>,
	);
}

describe("FeaturedEvent", () => {
	it("renders the FEATURED badge", () => {
		renderWithLocale("us");
		expect(screen.getByText("FEATURED")).toBeInTheDocument();
	});

	it("renders the event title with link to RSVP URL", () => {
		renderWithLocale("us");
		const link = screen.getByText(
			"AWS Cloud del Norte UG — Community Happy Hour & Networking Night",
		);
		expect(link.closest("a")).toHaveAttribute(
			"href",
			"https://www.meetup.com/awsugclouddelnorte/events/314839263/rsvp/",
		);
	});

	it("renders the date in en-US format", () => {
		renderWithLocale("us");
		expect(screen.getByText(/June 3, 2026/)).toBeInTheDocument();
	});

	it("renders the date in es-MX format", () => {
		renderWithLocale("mx");
		expect(screen.getByText(/junio/i)).toBeInTheDocument();
	});

	it("renders the RSVP button with target=_blank", () => {
		renderWithLocale("us");
		const btn = screen.getByRole("link", { name: /RSVP on Meetup/i });
		expect(btn).toHaveAttribute("target", "_blank");
	});

	it("renders the image with proper alt text and lazy loading", () => {
		renderWithLocale("us");
		const img = screen.getByAltText(
			"AWS Cloud del Norte UG community event photo",
		);
		expect(img).toHaveAttribute("loading", "lazy");
		expect(img).toHaveAttribute(
			"src",
			"https://secure.meetupstatic.com/photos/event/c/8/5/3/600_534291283.jpeg",
		);
	});
});
