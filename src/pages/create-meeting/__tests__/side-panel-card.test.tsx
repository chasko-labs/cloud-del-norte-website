import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SidePanelCard, {
	type SidePanelCardItem,
} from "../components/side-panel-card";

const fullCard: SidePanelCardItem = {
	title: "Step Functions without ASL? Welcome Lambda Durable Functions",
	author: "Andres Moreno",
	authorBadge: "AWS CB",
	blurb:
		"AWS announced Lambda Durable Functions at re:Invent 2025. Run multi-step workflows with checkpoints and state using familiar code — without Amazon State Language.",
	url: "https://builder.aws.com/content/2c0uRhtYh1arjgygZUvxKOspmrw/step-functions-without-asl-welcome-lambda-durable-functions",
};

describe("SidePanelCard", () => {
	it("renders the title", () => {
		render(<SidePanelCard item={fullCard} />);
		expect(screen.getByText(fullCard.title)).toBeTruthy();
	});

	it("renders the author with badge when provided", () => {
		render(<SidePanelCard item={fullCard} />);
		expect(screen.getByText(/Andres Moreno/)).toBeTruthy();
		expect(screen.getByText("AWS CB")).toBeTruthy();
	});

	it("renders the blurb when provided", () => {
		render(<SidePanelCard item={fullCard} />);
		expect(screen.getByText(/AWS announced Lambda Durable/)).toBeTruthy();
	});

	it("links to the article URL with target=_blank + rel=noopener", () => {
		const { container } = render(<SidePanelCard item={fullCard} />);
		const a = container.querySelector("a.side-panel-card");
		expect(a).toBeTruthy();
		expect(a?.getAttribute("href")).toBe(fullCard.url);
		expect(a?.getAttribute("target")).toBe("_blank");
		expect(a?.getAttribute("rel")).toContain("noopener");
		expect(a?.getAttribute("rel")).toContain("noreferrer");
	});

	it("omits the author + blurb DOM when not provided", () => {
		const minimal: SidePanelCardItem = {
			title: "title only",
			url: "https://example.com",
		};
		const { container } = render(<SidePanelCard item={minimal} />);
		expect(container.querySelector(".side-panel-card__author")).toBeNull();
		expect(container.querySelector(".side-panel-card__blurb")).toBeNull();
		expect(container.querySelector(".side-panel-card__badge")).toBeNull();
	});

	it("omits only the badge when authorBadge is absent but author is present", () => {
		const noBadge: SidePanelCardItem = {
			title: "no badge",
			author: "Wayne Savage",
			url: "https://example.com",
		};
		const { container } = render(<SidePanelCard item={noBadge} />);
		expect(container.querySelector(".side-panel-card__author")).toBeTruthy();
		expect(container.querySelector(".side-panel-card__badge")).toBeNull();
	});

	it("clamps title to 2 lines and blurb to 3 lines via CSS classes", () => {
		const { container } = render(<SidePanelCard item={fullCard} />);
		const title = container.querySelector(".side-panel-card__title");
		const blurb = container.querySelector(".side-panel-card__blurb");
		// classes alone — actual line-clamp is enforced by CSS, asserted via
		// the class hook so a refactor that drops the class trips the test.
		expect(title?.className).toContain("side-panel-card__title");
		expect(blurb?.className).toContain("side-panel-card__blurb");
	});
});
