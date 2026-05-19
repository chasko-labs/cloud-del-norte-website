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

	it("renders both the light and dark image variants with proper alt text and lazy loading", () => {
		renderWithLocale("us");
		const imgs = screen.getAllByAltText(
			"AWS Cloud del Norte UG community event photo",
		);
		expect(imgs).toHaveLength(2);
		for (const img of imgs) {
			expect(img).toHaveAttribute("loading", "lazy");
		}
		const lightImg = imgs.find((i) =>
			i.className.includes("feed-featured-event__image--light"),
		);
		const darkImg = imgs.find((i) =>
			i.className.includes("feed-featured-event__image--dark"),
		);
		expect(lightImg).toBeDefined();
		expect(darkImg).toBeDefined();
		expect(lightImg).toHaveAttribute("src", "/events/featured-2026-06-03.webp");
		expect(darkImg).toHaveAttribute(
			"src",
			"/events/featured-2026-06-03-dark.webp",
		);
	});

	it("renders the in-person location label", () => {
		renderWithLocale("us");
		expect(
			screen.getByText(/in person: Downtown El Paso, Texas/i),
		).toBeInTheDocument();
	});

	it("renders the wave 31a responsive grid layout wrapper containing all card children", () => {
		const { container } = renderWithLocale("us");
		const layout = container.querySelector(".feed-featured-event__layout");
		expect(layout).not.toBeNull();
		// Wave 32a — badge slot was removed; 8 logical children remain inside
		// the grid layout (image-area, title, date, in-person, location,
		// description, spots, buttons). DOM order is the logical reading
		// order — preserved across the SpaceBetween → grid migration.
		expect(
			layout?.querySelector(".feed-featured-event__image-area"),
		).not.toBeNull();
		expect(layout?.querySelector(".feed-featured-event__title")).not.toBeNull();
		expect(layout?.querySelector(".feed-featured-event__date")).not.toBeNull();
		expect(
			layout?.querySelector(".feed-featured-event__in-person-pill"),
		).not.toBeNull();
		expect(
			layout?.querySelector(".feed-featured-event__location-text"),
		).not.toBeNull();
		expect(
			layout?.querySelector(".feed-featured-event__description"),
		).not.toBeNull();
		expect(layout?.querySelector(".feed-featured-event__spots")).not.toBeNull();
		expect(layout?.querySelector(".cdn-brand-btn-stack")).not.toBeNull();
		// Wave 32a — badge was removed entirely.
		expect(layout?.querySelector(".feed-featured-event__badge")).toBeNull();
	});

	it("wraps both light + dark image variants inside the __image-area grid cell wrapper (single grid slot for the pair)", () => {
		const { container } = renderWithLocale("us");
		const imageArea = container.querySelector(
			".feed-featured-event__image-area",
		);
		expect(imageArea).not.toBeNull();
		const lightImg = imageArea?.querySelector(
			".feed-featured-event__image--light",
		);
		const darkImg = imageArea?.querySelector(
			".feed-featured-event__image--dark",
		);
		expect(lightImg).not.toBeNull();
		expect(darkImg).not.toBeNull();
	});

	it("preserves DOM reading order: image → title → date → in-person → location → description → spots → buttons (a11y / screen-reader contract; wave 32a dropped badge slot)", () => {
		const { container } = renderWithLocale("us");
		const layout = container.querySelector(".feed-featured-event__layout");
		expect(layout).not.toBeNull();
		const expected = [
			"feed-featured-event__image-area",
			"feed-featured-event__title",
			"feed-featured-event__date",
			"feed-featured-event__in-person-pill",
			"feed-featured-event__location-text",
			"feed-featured-event__description",
			"feed-featured-event__spots",
			"cdn-brand-btn-stack",
		];
		const actual = Array.from(layout?.children ?? [])
			.map((el) => Array.from(el.classList).find((c) => expected.includes(c)))
			.filter((c): c is string => Boolean(c));
		expect(actual).toEqual(expected);
	});

	it("renders the shortened primary speakeasy RSVP button label", () => {
		renderWithLocale("us");
		const primary = screen.getByRole("link", {
			name: /RSVP on CloudDelNorte\.org/i,
		});
		const expected = `https://auth.clouddelnorte.org/signup/index.html?return_to=${encodeURIComponent("/rsvp/?event=happy-hour-2026-06-03")}`;
		expect(primary).toHaveAttribute("href", expected);
	});

	it("renders the limited-space CTA", () => {
		localStorage.clear();
		renderWithLocale("us");
		expect(screen.getByText(/Limited space — RSVP now/i)).toBeInTheDocument();
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

	// ---------- Wave 32a — theater marquee header ----------

	it("wave 32a — DON'T MISS badge is gone from the card body", () => {
		const { container } = renderWithLocale("us");
		expect(screen.queryByText("DON'T MISS")).not.toBeInTheDocument();
		expect(container.querySelector(".feed-featured-event__badge")).toBeNull();
	});

	it("wave 32a — renders the theater marquee header with role=heading aria-level=2", () => {
		const { container } = renderWithLocale("us");
		const marquee = container.querySelector(".feed-featured-event__marquee");
		expect(marquee).not.toBeNull();
		expect(marquee?.getAttribute("role")).toBe("heading");
		expect(marquee?.getAttribute("aria-level")).toBe("2");
	});

	it("wave 32a — marquee text contains the localized FEATURED EVENT header string", () => {
		const { container } = renderWithLocale("us");
		const marqueeText = container.querySelector(
			".feed-featured-event__marquee-text",
		);
		expect(marqueeText).not.toBeNull();
		expect(marqueeText?.textContent).toMatch(/Featured event/i);
	});

	it("wave 32a — marquee renders 16 chasing bulb spans inside an aria-hidden container", () => {
		const { container } = renderWithLocale("us");
		const bulbs = container.querySelector(
			".feed-featured-event__marquee-bulbs",
		);
		expect(bulbs).not.toBeNull();
		expect(bulbs?.getAttribute("aria-hidden")).toBe("true");
		const dots = bulbs?.querySelectorAll(".feed-featured-event__marquee-bulb");
		expect(dots?.length).toBe(16);
	});

	it("wave 32a — each bulb carries an inline --bulb-index custom property for the chase stagger", () => {
		const { container } = renderWithLocale("us");
		const dots = container.querySelectorAll(
			".feed-featured-event__marquee-bulb",
		);
		dots.forEach((dot, i) => {
			// jsdom serializes inline custom properties on the style attribute.
			const style = dot.getAttribute("style") ?? "";
			expect(style).toMatch(new RegExp(`--bulb-index:\\s*${i}`));
		});
	});
});
