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

	it("renders the event title with link to internal RSVP page", () => {
		renderWithLocale("us");
		const link = screen.getByText(
			"AWS Cloud del Norte UG — Community Happy Hour & Networking Night",
		);
		expect(link.closest("a")).toHaveAttribute(
			"href",
			"/rsvp/index.html?event=happy-hour-2026-06-03",
		);
	});

	it("renders the date in en-US format", () => {
		renderWithLocale("us");
		expect(screen.getByText(/June 3, 2026/)).toBeInTheDocument();
	});

	it("renders the date in es-MX format", () => {
		renderWithLocale("mx");
		expect(screen.getAllByText(/junio/i).length).toBeGreaterThan(0);
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
		expect(img).toHaveAttribute("src", "/events/featured-2026-06-03.webp");
	});

	it("renders the in-person location label", () => {
		renderWithLocale("us");
		expect(
			screen.getByText(/in person: Downtown El Paso, Texas/i),
		).toBeInTheDocument();
	});

	it("renders the primary speakeasy RSVP button linking to /rsvp", () => {
		renderWithLocale("us");
		const primary = screen.getByRole("link", {
			name: /RSVP & sign up for CloudDelNorte\.org speakeasy access/i,
		});
		expect(primary).toHaveAttribute(
			"href",
			"/rsvp/index.html?event=happy-hour-2026-06-03",
		);
	});

	it("renders the spots remaining counter (48 of 50 default baseline)", () => {
		localStorage.clear();
		renderWithLocale("us");
		expect(screen.getByText(/48 of 50 spots remaining/i)).toBeInTheDocument();
	});
});
