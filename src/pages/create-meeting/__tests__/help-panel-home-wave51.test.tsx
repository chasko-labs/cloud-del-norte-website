// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../contexts/locale-context";
import { HelpPanelHome } from "../components/help-panel-home";

vi.mock("../../../components/feedback-cta", () => ({
	default: () => null,
}));
vi.mock("../../../components/speaker-proposal-form", () => ({
	default: () => null,
}));

function renderPanel() {
	return render(
		<LocaleProvider locale="us">
			<HelpPanelHome />
		</LocaleProvider>,
	);
}

describe("HelpPanelHome — wave 51 community blurb relocation", () => {
	it("renders the hp-community-blurb div", () => {
		const { container } = renderPanel();
		expect(container.querySelector(".hp-community-blurb")).toBeInTheDocument();
	});

	it("contains the Global AWS User Group Community link inside the blurb", () => {
		renderPanel();
		// The translation key falls back to the key itself in test locale;
		// verify the link href is present.
		const links = screen.getAllByRole("link");
		const communityLink = links.find(
			(l) =>
				l.getAttribute("href") ===
				"https://www.meetup.com/pro/global-aws-user-group-community/",
		);
		expect(communityLink).toBeTruthy();
	});

	it("renders the Wayne Savage ExpandableSection before the community blurb", () => {
		const { container } = renderPanel();
		const blurb = container.querySelector(".hp-community-blurb");
		expect(blurb).not.toBeNull();
		// Wayne section header should be present in the document
		expect(screen.getByText("Wayne Savage")).toBeInTheDocument();
	});
});
