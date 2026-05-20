// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
