// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import UpcomingVirtualEvent, {
	UpcomingVirtualEventErrorBoundary,
} from "../upcoming-virtual-event";

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

	it("renders the RSVP button with target=_blank and the violet (no-red) variant", () => {
		renderWithLocale("us");
		const btn = screen.getByRole("link", { name: /RSVP on Meetup/i });
		expect(btn).toHaveAttribute("target", "_blank");
		expect(btn).toHaveAttribute(
			"href",
			"https://www.meetup.com/awsglobalcommunitygatherings/events/314332142/",
		);
		// Wave 29a — must NOT use the red variant on this card.
		expect(btn.className).toContain("cdn-brand-btn--meetup-violet");
		expect(btn.className).not.toMatch(/cdn-brand-btn--meetup(?!-violet)/);
	});

	it("renders the brand mark (not literal 'UG' text) with the AWS UG aria-label", () => {
		const { container } = renderWithLocale("us");
		// New class name reflects the brand semantic.
		const mark = container.querySelector(
			".feed-upcoming-virtual-event__brand-mark",
		);
		expect(mark).not.toBeNull();
		// Brand logo image is the mark content.
		const img = mark?.querySelector("img");
		expect(img).not.toBeNull();
		expect(img?.getAttribute("src")).toBe("/brand/logo.svg");
		// Old literal 'UG' span must be gone.
		expect(mark?.textContent ?? "").not.toMatch(/\bUG\b/);
		// Accessible label (AWS User Group mark) is preserved on the wrapper.
		expect(mark?.getAttribute("aria-label")).toBe("AWS User Group mark");
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

	// ---------- Wave 33c — clickable image RSVP link ----------

	it("wave 33c — wraps both light + dark image variants in anchors pointing at the meetup RSVP URL with target=_blank, rel='noreferrer', and a shared aria-label locale key", () => {
		const { container } = renderWithLocale("us");
		const links = container.querySelectorAll(
			".feed-upcoming-virtual-event__image-link",
		);
		// Two image variants → two anchors (light img wrapper + bulbs-wrapper
		// for the dark variant + EventBulbsOverlay).
		expect(links.length).toBe(2);
		const expectedHref =
			"https://www.meetup.com/awsglobalcommunitygatherings/events/314332142/";
		const expectedAriaLabel =
			"RSVP for AWS Global Community Gatherings on Meetup";
		links.forEach((link) => {
			expect(link.getAttribute("href")).toBe(expectedHref);
			expect(link.getAttribute("target")).toBe("_blank");
			// rel must include noreferrer so the external Meetup nav can't
			// see document.referrer back into the SPA.
			expect(link.getAttribute("rel") ?? "").toContain("noreferrer");
			// Both anchors share the same aria-label from the new locale key.
			expect(link.getAttribute("aria-label")).toBe(expectedAriaLabel);
		});
		// First anchor wraps the light variant standalone <img>.
		expect(
			links[0].querySelector(".feed-upcoming-virtual-event__image--light"),
		).not.toBeNull();
		// Second anchor wraps the bulbs-wrapper (dark img + bulbs overlay).
		expect(
			links[1].querySelector(".feed-upcoming-virtual-event__bulbs-wrapper"),
		).not.toBeNull();
		expect(
			links[1].querySelector(".feed-upcoming-virtual-event__image--dark"),
		).not.toBeNull();
	});

	// ---------- Wave 33b — starfield-twinkle marquee header ----------

	it("wave 33b — renders the marquee header with role=heading aria-level=2", () => {
		const { container } = renderWithLocale("us");
		const marquee = container.querySelector(
			".feed-upcoming-virtual-event__marquee",
		);
		expect(marquee).not.toBeNull();
		expect(marquee?.getAttribute("role")).toBe("heading");
		expect(marquee?.getAttribute("aria-level")).toBe("2");
	});

	it("wave 33b — marquee text contains the localized header string", () => {
		const { container } = renderWithLocale("us");
		const marqueeText = container.querySelector(
			".feed-upcoming-virtual-event__marquee-text",
		);
		expect(marqueeText).not.toBeNull();
		expect(marqueeText?.textContent).toMatch(
			/Virtual AWS Community Events/i,
		);
	});

	it("wave 33b — marquee renders 14 twinkle stars inside an aria-hidden container, each with a --star-index custom property", () => {
		const { container } = renderWithLocale("us");
		const wrapper = container.querySelector(
			".feed-upcoming-virtual-event__twinkle-wrapper",
		);
		expect(wrapper).not.toBeNull();
		expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
		const stars = wrapper?.querySelectorAll(
			".feed-upcoming-virtual-event__twinkle-star",
		);
		expect(stars?.length).toBe(14);
		stars?.forEach((star, i) => {
			// jsdom serializes inline custom properties on the style attribute.
			const style = star.getAttribute("style") ?? "";
			expect(style).toMatch(new RegExp(`--star-index:\\s*${i}`));
		});
	});

	it("wave 33b — renders the date inside the violet date-plate VFX backplate wrapper", () => {
		const { container } = renderWithLocale("us");
		const plate = container.querySelector(
			".feed-upcoming-virtual-event__date-plate",
		);
		expect(plate).not.toBeNull();
		expect(plate?.textContent).toMatch(/May 22/);
	});

	it("wave 33b — title link sits inside .feed-upcoming-virtual-event__title for the gradient/scrolling-tape treatment", () => {
		const { container } = renderWithLocale("us");
		const title = container.querySelector(
			".feed-upcoming-virtual-event__title",
		);
		expect(title).not.toBeNull();
		const link = title?.querySelector("a");
		expect(link).not.toBeNull();
		expect(link?.getAttribute("href")).toBe(
			"https://www.meetup.com/awsglobalcommunitygatherings/events/314332142/",
		);
	});
});

// ---------- Wave 33b — error boundary fallback ----------

describe("UpcomingVirtualEventErrorBoundary", () => {
	it("renders the children when no error is thrown", () => {
		render(
			<UpcomingVirtualEventErrorBoundary
				fallbackHeader="header"
				fallbackMessage="boom"
			>
				<div>healthy</div>
			</UpcomingVirtualEventErrorBoundary>,
		);
		expect(screen.getByText("healthy")).toBeInTheDocument();
	});

	it("renders the localized fallback header + message when a child throws at render time", () => {
		// Suppress the React error-boundary console.error noise inside this
		// test so the test runner output stays readable. The boundary itself
		// still calls console.error (wired through the spy below) — that's
		// the developer signal we contract for in componentDidCatch.
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => {
			/* swallowed for test output cleanliness */
		});

		function Boom(): never {
			throw new Error("boom");
		}

		render(
			<UpcomingVirtualEventErrorBoundary
				fallbackHeader="Upcoming virtual AWS community event"
				fallbackMessage="Event details temporarily unavailable. Please refresh the page."
			>
				<Boom />
			</UpcomingVirtualEventErrorBoundary>,
		);

		// Fallback header still announces the section in user language.
		expect(
			screen.getByText("Upcoming virtual AWS community event"),
		).toBeInTheDocument();
		// Fallback message renders so the slot doesn't go silently blank.
		expect(
			screen.getByText(
				"Event details temporarily unavailable. Please refresh the page.",
			),
		).toBeInTheDocument();
		// componentDidCatch logged the error (developer signal).
		expect(errSpy).toHaveBeenCalled();

		errSpy.mockRestore();
	});
});
