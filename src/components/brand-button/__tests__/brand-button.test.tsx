// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MeetupRsvpButton from "../meetup-rsvp";
import SpeakeasyRsvpButton from "../speakeasy-rsvp";

describe("MeetupRsvpButton", () => {
	it("renders an <a> with target=_blank and rel=noreferrer", () => {
		render(
			<MeetupRsvpButton
				href="https://www.meetup.com/example/"
				label="RSVP on Meetup"
			/>,
		);
		const a = screen.getByRole("link", { name: /RSVP on Meetup/i });
		expect(a).toHaveAttribute("href", "https://www.meetup.com/example/");
		expect(a).toHaveAttribute("target", "_blank");
		expect(a).toHaveAttribute("rel", "noreferrer");
	});

	it("renders the inline Meetup mark SVG (white M on red circle)", () => {
		const { container } = render(
			<MeetupRsvpButton href="#" label="RSVP on Meetup" />,
		);
		expect(container.querySelector("svg title")?.textContent).toBe("Meetup");
	});

	it("applies the meetup variant class for brand styling", () => {
		const { container } = render(
			<MeetupRsvpButton href="#" label="RSVP on Meetup" />,
		);
		const link = container.querySelector("a");
		expect(link?.className).toContain("cdn-brand-btn--meetup");
	});

	it("aria-label includes 'opens in new tab' for screen reader context", () => {
		render(<MeetupRsvpButton href="#" label="RSVP on Meetup" />);
		const a = screen.getByRole("link");
		expect(a.getAttribute("aria-label")).toMatch(/opens in new tab/i);
	});
});

describe("SpeakeasyRsvpButton", () => {
	it("renders an <a> with the supplied internal href (no target=_blank)", () => {
		render(
			<SpeakeasyRsvpButton
				href="/rsvp/index.html"
				label="RSVP for Speakeasy"
			/>,
		);
		const a = screen.getByRole("link", { name: /RSVP for Speakeasy/i });
		expect(a).toHaveAttribute("href", "/rsvp/index.html");
		expect(a).not.toHaveAttribute("target");
	});

	it("renders the brand star mark SVG", () => {
		const { container } = render(
			<SpeakeasyRsvpButton href="#" label="RSVP for Speakeasy" />,
		);
		expect(container.querySelector("svg title")?.textContent).toBe(
			"Cloud Del Norte",
		);
	});

	it("applies the speakeasy variant class for brand styling", () => {
		const { container } = render(
			<SpeakeasyRsvpButton href="#" label="RSVP for Speakeasy" />,
		);
		const link = container.querySelector("a");
		expect(link?.className).toContain("cdn-brand-btn--speakeasy");
	});
});
