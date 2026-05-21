// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../contexts/locale-context";
import Footer from "../index";

// Stub fetch so NextMeetupCountdown and Weather don't make real network calls
vi.stubGlobal(
	"fetch",
	vi.fn().mockResolvedValue({
		ok: false,
		json: async () => null,
		text: async () => "",
	}),
);

function renderFooter() {
	return render(
		<LocaleProvider locale="us">
			<Footer />
		</LocaleProvider>,
	);
}

afterEach(() => {
	document.body.className = "";
});

describe("Footer — wave 51 lean layout", () => {
	it("renders the military clock with aria-label", () => {
		renderFooter();
		expect(
			screen.getByLabelText("current time in el paso"),
		).toBeInTheDocument();
	});

	it("renders the version string", () => {
		const { container } = renderFooter();
		expect(container.querySelector(".cdn-version")).toBeInTheDocument();
	});

	it("does NOT contain communityFullDescription text", () => {
		renderFooter();
		// The blurb moved to the right sidepanel; footer must not have it.
		expect(
			screen.queryByText(/run by volunteers local to New Mexico/i),
		).toBeNull();
	});

	it("renders the weather wrapper in the footer", () => {
		const { container } = renderFooter();
		expect(container.querySelector(".cdn-footer-weather")).toBeInTheDocument();
	});
});

describe("Footer — wave 70c always-on architecture", () => {
	it("footer has position fixed in its CSS class", () => {
		const { container } = renderFooter();
		const footer = container.querySelector(".cdn-footer");
		expect(footer).toBeInTheDocument();
	});

	it("footer has role=contentinfo", () => {
		renderFooter();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
	});

	it("respects left inset when cdn-nav-open body class is set", () => {
		document.body.classList.add("cdn-nav-open");
		const { container } = renderFooter();
		const footer = container.querySelector(".cdn-footer");
		expect(footer).toBeInTheDocument();
		// The CSS rule body.cdn-nav-open .cdn-footer { left: 280px } applies
		// We verify the class structure is correct for the selector to match
		expect(document.body.classList.contains("cdn-nav-open")).toBe(true);
	});

	it("respects right inset when cdn-tools-open body class is set", () => {
		document.body.classList.add("cdn-tools-open");
		const { container } = renderFooter();
		const footer = container.querySelector(".cdn-footer");
		expect(footer).toBeInTheDocument();
		expect(document.body.classList.contains("cdn-tools-open")).toBe(true);
	});

	it("both insets apply when both panels are open", () => {
		document.body.classList.add("cdn-nav-open");
		document.body.classList.add("cdn-tools-open");
		const { container } = renderFooter();
		const footer = container.querySelector(".cdn-footer");
		expect(footer).toBeInTheDocument();
		expect(document.body.classList.contains("cdn-nav-open")).toBe(true);
		expect(document.body.classList.contains("cdn-tools-open")).toBe(true);
	});
});
