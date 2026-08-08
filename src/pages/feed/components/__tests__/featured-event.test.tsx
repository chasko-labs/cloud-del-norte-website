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

describe("FeaturedEvent — quantum event", () => {
	it("renders the quantum event title linking to the Meetup RSVP URL", () => {
		renderWithLocale("us");
		const link = screen.getByText(
			/Getting Started with Quantum Superpositions/,
		);
		expect(link.closest("a")).toHaveAttribute(
			"href",
			"https://www.meetup.com/awsugclouddelnorte/",
		);
	});

	it("renders the date in en-US format (August 30, 2026)", () => {
		renderWithLocale("us");
		expect(screen.getByText(/August 30, 2026/)).toBeInTheDocument();
	});

	it("renders the date in es-MX format (agosto)", () => {
		renderWithLocale("mx");
		expect(screen.getAllByText(/agosto/i).length).toBeGreaterThan(0);
	});

	it("renders the RSVP button", () => {
		renderWithLocale("us");
		const btn = screen.getByRole("link", { name: /RSVP/i });
		expect(btn).toHaveAttribute(
			"href",
			"https://www.meetup.com/awsugclouddelnorte/",
		);
	});

	it("renders the quantum event description in en-US", () => {
		renderWithLocale("us");
		expect(screen.getByText(/Amazon Braket workshop/i)).toBeInTheDocument();
	});

	it("renders the quantum event description in es-MX", () => {
		renderWithLocale("mx");
		expect(
			screen.getByText(/Taller práctico de Amazon Braket/i),
		).toBeInTheDocument();
	});

	it("renders the es-MX title", () => {
		renderWithLocale("mx");
		expect(
			screen.getByText(/Introducción a Superposiciones Cuánticas/),
		).toBeInTheDocument();
	});

	it("renders the secondary link to AWS Braket Learning Plan", () => {
		renderWithLocale("us");
		const link = screen.getByText(/AWS Braket Learning Plan & Digital Badge/i);
		expect(link.closest("a")).toHaveAttribute(
			"href",
			"https://aws.amazon.com/blogs/quantum-computing/introducing-the-amazon-braket-learning-plan-and-digital-badge/",
		);
	});

	it("renders the online event location", () => {
		renderWithLocale("us");
		expect(screen.getByText(/Online event/i)).toBeInTheDocument();
	});

	it("renders the date-plate VFX wrapper", () => {
		const { container } = renderWithLocale("us");
		const plate = container.querySelector(".feed-featured-event__date-plate");
		expect(plate).not.toBeNull();
		expect(plate?.textContent).toMatch(/August 30, 2026/);
	});

	it("renders the layout wrapper with expected children", () => {
		const { container } = renderWithLocale("us");
		const layout = container.querySelector(".feed-featured-event__layout");
		expect(layout).not.toBeNull();
		expect(layout?.querySelector(".feed-featured-event__title")).not.toBeNull();
		expect(layout?.querySelector(".feed-featured-event__date")).not.toBeNull();
		expect(
			layout?.querySelector(".feed-featured-event__description"),
		).not.toBeNull();
		expect(layout?.querySelector(".cdn-brand-btn-stack")).not.toBeNull();
	});

	it("renders the header as h2", () => {
		renderWithLocale("us");
		const header = screen.getByRole("heading", { level: 2 });
		expect(header).toHaveTextContent(/Featured event/i);
	});
});
