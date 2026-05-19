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

	it("renders the canonical Simple Icons Meetup mark via inline SVG <title>", () => {
		const { container } = render(
			<MeetupRsvpButton href="#" label="RSVP on Meetup" />,
		);
		expect(container.querySelector("svg title")?.textContent).toBe("Meetup");
	});

	it("Meetup mark path is filled white in both variants for visual consistency", () => {
		const { container: redContainer } = render(
			<MeetupRsvpButton href="#" label="RSVP on Meetup" />,
		);
		const redPath = redContainer.querySelector(".cdn-brand-btn__mark path");
		expect(redPath?.getAttribute("fill")).toBe("#FFFFFF");

		const { container: violetContainer } = render(
			<MeetupRsvpButton href="#" label="RSVP on Meetup" variant="violet" />,
		);
		const violetPath = violetContainer.querySelector(
			".cdn-brand-btn__mark path",
		);
		expect(violetPath?.getAttribute("fill")).toBe("#FFFFFF");
	});

	it("applies the meetup variant class for brand styling (default red)", () => {
		const { container } = render(
			<MeetupRsvpButton href="#" label="RSVP on Meetup" />,
		);
		const link = container.querySelector("a");
		expect(link?.className).toContain("cdn-brand-btn--meetup");
		expect(link?.className).not.toContain("cdn-brand-btn--meetup-violet");
	});

	it("applies the meetup-violet variant class when variant='violet'", () => {
		const { container } = render(
			<MeetupRsvpButton href="#" label="RSVP on Meetup" variant="violet" />,
		);
		const link = container.querySelector("a");
		expect(link?.className).toContain("cdn-brand-btn--meetup-violet");
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

	it("renders the brand logo as an <img> with 'Cloud Del Norte' alt", () => {
		const { container } = render(
			<SpeakeasyRsvpButton href="#" label="RSVP for Speakeasy" />,
		);
		const img = container.querySelector("img.cdn-brand-btn__mark");
		expect(img).not.toBeNull();
		expect(img?.getAttribute("src")).toBe("/brand/logo.svg");
		expect(img?.getAttribute("alt")).toBe("Cloud Del Norte");
	});

	it("applies the speakeasy variant class for brand styling", () => {
		const { container } = render(
			<SpeakeasyRsvpButton href="#" label="RSVP for Speakeasy" />,
		);
		const link = container.querySelector("a");
		expect(link?.className).toContain("cdn-brand-btn--speakeasy");
	});
});
