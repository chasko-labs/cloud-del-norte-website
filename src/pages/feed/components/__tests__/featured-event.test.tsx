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
	it("renders the FEATURED badge (rizz copy: DON'T MISS)", () => {
		renderWithLocale("us");
		expect(screen.getByText("DON'T MISS")).toBeInTheDocument();
	});

	it("renders the v2 event title with link to auth.clouddelnorte.org signup with rsvp return_to", () => {
		renderWithLocale("us");
		const link = screen.getByText("Community Happy Hour & Networking Night");
		const expected = `https://auth.clouddelnorte.org/signup/index.html?return_to=${encodeURIComponent("/rsvp/?event=happy-hour-2026-06-03")}`;
		expect(link.closest("a")).toHaveAttribute("href", expected);
	});

	it("renders the date in en-US format", () => {
		renderWithLocale("us");
		expect(screen.getByText(/June 3, 2026/)).toBeInTheDocument();
	});

	it("renders the date in es-MX format", () => {
		renderWithLocale("mx");
		expect(screen.getAllByText(/junio/i).length).toBeGreaterThan(0);
	});

	it("renders the date inside the date-plate VFX wrapper", () => {
		const { container } = renderWithLocale("us");
		const plate = container.querySelector(".feed-featured-event__date-plate");
		expect(plate).not.toBeNull();
		expect(plate?.textContent).toMatch(/June 3, 2026/);
	});

	it("renders the Meetup RSVP button with target=_blank (violet variant — no red)", () => {
		renderWithLocale("us");
		const btn = screen.getByRole("link", { name: /RSVP on Meetup/i });
		expect(btn).toHaveAttribute("target", "_blank");
		expect(btn.className).toContain("cdn-brand-btn--meetup-violet");
		expect(btn.className).not.toMatch(/cdn-brand-btn--meetup\b(?!-)/);
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

	it("renders the shortened primary speakeasy RSVP button label", () => {
		renderWithLocale("us");
		const primary = screen.getByRole("link", {
			name: /RSVP on CloudDelNorte\.org/i,
		});
		const expected = `https://auth.clouddelnorte.org/signup/index.html?return_to=${encodeURIComponent("/rsvp/?event=happy-hour-2026-06-03")}`;
		expect(primary).toHaveAttribute("href", expected);
	});

	it("renders the spots remaining counter (48 of 50 default baseline)", () => {
		localStorage.clear();
		renderWithLocale("us");
		expect(screen.getByText(/48 of 50 spots remaining/i)).toBeInTheDocument();
	});

	it("inlines the AsciiSmirk SVG inside the description (after the 'game.' hook)", () => {
		const { container } = renderWithLocale("us");
		const desc = container.querySelector(".feed-featured-event__description");
		expect(desc).not.toBeNull();
		const smirk = desc?.querySelector(".cdn-ascii-smirk");
		expect(smirk).not.toBeNull();
		const smirkSvg = smirk?.querySelector('svg[aria-label="smirk"]');
		expect(smirkSvg).not.toBeNull();
	});

	it("description begins with the new 'Hop the trolley' copy in en-US", () => {
		renderWithLocale("us");
		expect(screen.getByText(/Hop the trolley/i)).toBeInTheDocument();
	});

	it("description begins with the new 'Cáele en el trolley' copy in es-MX", () => {
		renderWithLocale("mx");
		expect(screen.getByText(/Cáele en el trolley/i)).toBeInTheDocument();
	});
});
