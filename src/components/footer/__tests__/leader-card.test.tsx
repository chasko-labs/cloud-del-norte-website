import { render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

// --- Cloudscape component mocks ---

vi.mock("@cloudscape-design/components/box", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", { "data-testid": "box" }, children),
}));
vi.mock("@cloudscape-design/components/space-between", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/components/link", () => ({
	default: ({ children, href, external, ariaLabel }: AnyProps) =>
		React.createElement(
			"a",
			{
				href,
				target: external ? "_blank" : undefined,
				"aria-label": ariaLabel,
			},
			children,
		),
}));
vi.mock("@cloudscape-design/components/badge", () => ({
	default: ({ children, color }: AnyProps) =>
		React.createElement(
			"span",
			{ "data-testid": "badge", "data-color": color },
			children,
		),
}));

import { LocaleProvider } from "../../../contexts/locale-context";
import type { Leader } from "../leader-card";
import LeaderCard from "../leader-card";

// Helper to wrap LeaderCard in LocaleProvider (required for useTranslation)
const renderLeaderCard = (leader: Leader) =>
	render(
		<LocaleProvider locale="us">
			<LeaderCard leader={leader} />
		</LocaleProvider>,
	);

// --- Test data ---

const leaderWithAllSocials = {
	id: "bryan-chasko",
	name: "Bryan Chasko",
	role: "Founder & Organizer",
	bio: "Building community in the cloud.",
	organization: null,
	social: {
		github: "BryanChasko",
		linkedin: "bryanchasko",
		twitter: "BryanChasko",
		website: null,
		meetup: "https://www.meetup.com/awsugclouddelnorte/",
	},
	placeholder: false,
	retired: false,
};

const leaderMinimalSocials = {
	id: "jacob-wright",
	name: "Jacob Wright",
	role: "Founder & Doña Ana County Lead",
	bio: "",
	organization: null,
	social: {
		github: null,
		linkedin: "jrwright121",
		twitter: null,
		website: null,
		meetup: null,
	},
	placeholder: false,
	retired: false,
};

const leaderAllSocialsPopulated = {
	id: "andres-moreno",
	name: "Andres Moreno",
	role: "Co-organizer",
	bio: "",
	organization: null,
	social: {
		github: "andmoredev",
		linkedin: null,
		twitter: "andmoredev",
		website: "https://andmore.dev",
		meetup: null,
	},
	placeholder: false,
	retired: false,
};

const leaderWithOrganization = {
	id: "org-leader",
	name: "Org Leader",
	role: "Founder",
	bio: "",
	organization: "Test Research Park",
	social: {
		github: null,
		linkedin: null,
		twitter: null,
		website: null,
		meetup: null,
	},
	placeholder: false,
	retired: false,
};

const retiredLeader = {
	id: "retired-leader",
	name: "Retired Leader",
	role: "Founder, Retired Organizer",
	bio: "",
	organization: "Test University",
	social: {
		github: null,
		linkedin: null,
		twitter: null,
		website: null,
		meetup: null,
	},
	placeholder: false,
	retired: true,
};

const placeholderLeader = {
	id: "open-slot-en",
	name: "This Could Be You",
	role: "Future Leader",
	bio: "",
	organization: null,
	social: {
		github: null,
		linkedin: null,
		twitter: null,
		website: null,
		meetup: "https://www.meetup.com/awsugclouddelnorte/",
	},
	placeholder: true,
	retired: false,
};

describe("LeaderCard component", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it("renders leader name", () => {
		renderLeaderCard(leaderWithAllSocials);
		expect(screen.getByText("Bryan Chasko")).toBeTruthy();
	});

	it("renders leader role as a Badge", () => {
		renderLeaderCard(leaderWithAllSocials);
		expect(screen.getByText("Founder & Organizer")).toBeTruthy();
		// Role should appear inside a Badge (mocked as <span data-testid="badge">)
		const badges = screen.getAllByTestId("badge");
		const roleBadge = badges.find(
			(el) => el.textContent === "Founder & Organizer",
		);
		expect(roleBadge).toBeTruthy();
	});

	it("renders GitHub social link when provided", () => {
		renderLeaderCard(leaderWithAllSocials);
		const links = screen.getAllByRole("link");
		const githubLink = links.find((el) =>
			el.getAttribute("href")?.includes("github.com"),
		);
		expect(githubLink).toBeTruthy();
	});

	it("renders LinkedIn social link when provided", () => {
		renderLeaderCard(leaderMinimalSocials);
		const links = screen.getAllByRole("link");
		const linkedinLink = links.find((el) =>
			el.getAttribute("href")?.includes("linkedin.com"),
		);
		expect(linkedinLink).toBeTruthy();
	});

	it("renders Twitter/X social link when provided", () => {
		renderLeaderCard(leaderAllSocialsPopulated);
		const links = screen.getAllByRole("link");
		const twitterLink = links.find((el) => {
			const href = el.getAttribute("href") || "";
			return href.includes("twitter.com") || href.includes("x.com");
		});
		expect(twitterLink).toBeTruthy();
	});

	it("renders website social link when provided", () => {
		renderLeaderCard(leaderAllSocialsPopulated);
		const links = screen.getAllByRole("link");
		const websiteLink = links.find((el) =>
			el.getAttribute("href")?.includes("andmore.dev"),
		);
		expect(websiteLink).toBeTruthy();
	});

	it("renders meetup social link when provided", () => {
		renderLeaderCard(leaderWithAllSocials);
		const links = screen.getAllByRole("link");
		const meetupLink = links.find((el) =>
			el.getAttribute("href")?.includes("meetup.com"),
		);
		expect(meetupLink).toBeTruthy();
	});

	it("skips social links that are null", () => {
		renderLeaderCard(leaderMinimalSocials);
		const links = screen.getAllByRole("link");
		// Jacob only has LinkedIn — no GitHub, Twitter, website, or meetup links
		const githubLink = links.find((el) =>
			el.getAttribute("href")?.includes("github.com"),
		);
		const twitterLink = links.find((el) => {
			const href = el.getAttribute("href") || "";
			return href.includes("twitter.com") || href.includes("x.com");
		});
		const websiteLink = links.find((el) =>
			el.getAttribute("href")?.includes("andmore.dev"),
		);
		expect(githubLink).toBeUndefined();
		expect(twitterLink).toBeUndefined();
		expect(websiteLink).toBeUndefined();
	});

	it("renders placeholder variant differently", () => {
		const { container } = renderLeaderCard(placeholderLeader);
		// Placeholder cards should have distinguishable markup (e.g., a CSS class or data attribute)
		const card = container.firstElementChild;
		expect(card).toBeTruthy();
		// Check for placeholder indicator — class name, data attribute, or different styling
		const hasPlaceholderIndicator =
			card?.classList.toString().includes("placeholder") ||
			card?.getAttribute("data-placeholder") === "true" ||
			card?.querySelector("[data-placeholder]") !== null;
		expect(hasPlaceholderIndicator).toBe(true);
	});

	it("has accessible link text for social links", () => {
		renderLeaderCard(leaderWithAllSocials);
		const links = screen.getAllByRole("link");
		// Every social link should have text content or aria-label for accessibility
		links.forEach((link) => {
			const hasAccessibleName =
				(link.textContent && link.textContent.trim().length > 0) ||
				link.getAttribute("aria-label");
			expect(hasAccessibleName).toBeTruthy();
		});
	});

	it("handles empty bio gracefully", () => {
		// All test leaders have empty bios — rendering should not crash or show "undefined"
		const { container } = renderLeaderCard(leaderMinimalSocials);
		expect(container.textContent).not.toContain("undefined");
		expect(container.textContent).not.toContain("null");
	});

	it("displays organization when provided", () => {
		renderLeaderCard(leaderWithOrganization);
		expect(screen.getByText("Test Research Park")).toBeTruthy();
	});

	it("does not display organization when null", () => {
		const { container } = renderLeaderCard(leaderWithAllSocials);
		// Organization is null — should not render any organization text
		const boxes = container.querySelectorAll('[data-testid="box"]');
		const orgBox = Array.from(boxes).find(
			(el) =>
				el.textContent?.includes("Research Park") ||
				el.textContent?.includes("University"),
		);
		expect(orgBox).toBeUndefined();
	});

	it("retired leader card has cdn-footer-retired class", () => {
		const { container } = renderLeaderCard(retiredLeader);
		const card = container.firstElementChild;
		expect(card?.classList.contains("cdn-footer-retired")).toBe(true);
	});

	it('retired leader Badge uses "grey" color', () => {
		renderLeaderCard(retiredLeader);
		const badge = screen.getByTestId("badge");
		expect(badge.getAttribute("data-color")).toBe("grey");
	});

	it('non-retired leader Badge uses "green" color', () => {
		renderLeaderCard(leaderWithAllSocials);
		const badge = screen.getByTestId("badge");
		expect(badge.getAttribute("data-color")).toBe("green");
	});

	it("no React warnings or errors on render", () => {
		renderLeaderCard(leaderWithAllSocials);
		const errorCalls = consoleErrorSpy.mock.calls.filter(
			(args: unknown[]) =>
				typeof args[0] === "string" &&
				(args[0].includes("Warning:") || args[0].includes("Error:")),
		);
		expect(errorCalls).toHaveLength(0);
	});

	it("placeholder CTA renders translated joinUs text in en-US locale", () => {
		renderLeaderCard(placeholderLeader);
		const links = screen.getAllByRole("link");
		const meetupLink = links.find((el) =>
			el.getAttribute("href")?.includes("meetup.com"),
		);
		expect(meetupLink).toBeTruthy();
		expect(meetupLink?.textContent).toBe("Join us on Meetup →");
	});
});
