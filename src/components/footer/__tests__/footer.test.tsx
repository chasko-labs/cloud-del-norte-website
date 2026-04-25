import { render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

// --- Cloudscape component mocks (avoid jsdom hangs) ---

vi.mock("@cloudscape-design/components/box", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", { "data-testid": "box" }, children),
}));
vi.mock("@cloudscape-design/components/space-between", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/components/link", () => ({
	default: ({ children, href, external }: AnyProps) =>
		React.createElement(
			"a",
			{ href, target: external ? "_blank" : undefined },
			children,
		),
}));
vi.mock("@cloudscape-design/components/badge", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("span", { "data-testid": "badge" }, children),
}));
vi.mock("@cloudscape-design/components/header", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("h2", null, children),
}));

// --- Mock LeaderCard to isolate Footer tests ---

vi.mock("../leader-card", () => ({
	default: ({ leader }: AnyProps) =>
		React.createElement(
			"div",
			{ "data-testid": `leader-card-${leader.id}` },
			leader.name,
		),
}));

import { LocaleProvider } from "../../../contexts/locale-context";
import Footer from "../index";

// Helper to wrap Footer in LocaleProvider
const renderFooter = () => {
	return render(
		<LocaleProvider locale="us">
			<Footer />
		</LocaleProvider>,
	);
};

describe("Footer component", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it("renders without crashing", () => {
		expect(() => renderFooter()).not.toThrow();
	});

	it('has role="contentinfo" on the footer element', () => {
		renderFooter();
		expect(screen.getByRole("contentinfo")).toBeTruthy();
	});

	it('has id="site-footer"', () => {
		const { container } = renderFooter();
		expect(container.querySelector("#site-footer")).toBeTruthy();
	});

	it("renders all 6 leader cards", () => {
		renderFooter();
		expect(screen.getByTestId("leader-card-bryan-chasko")).toBeTruthy();
		expect(screen.getByTestId("leader-card-jacob-wright")).toBeTruthy();
		expect(screen.getByTestId("leader-card-andres-moreno")).toBeTruthy();
		expect(screen.getByTestId("leader-card-wayne-savage")).toBeTruthy();
		expect(screen.getByTestId("leader-card-open-slot-en")).toBeTruthy();
		expect(screen.getByTestId("leader-card-open-slot-es")).toBeTruthy();
	});

	it("renders leader names correctly via mocked LeaderCard", () => {
		renderFooter();
		expect(screen.getByText("Bryan Chasko")).toBeTruthy();
		expect(screen.getByText("Jacob Wright")).toBeTruthy();
		expect(screen.getByText("Andres Moreno")).toBeTruthy();
		expect(screen.getByText("Wayne Savage")).toBeTruthy();
		expect(screen.getByText("This Could Be You")).toBeTruthy();
		expect(screen.getByText("Esto Podrías Ser Tú")).toBeTruthy();
	});

	it('renders community description with "Go Build" text', () => {
		renderFooter();
		const footer = screen.getByRole("contentinfo");
		expect(footer.textContent).toContain(
			"AWS User Group Cloud Del Norte is part of",
		);
		expect(footer.textContent).toContain("Go Build");
	});

	it('renders "Global AWS User Group Community" as a link', () => {
		renderFooter();
		const link = screen.getByText("Global AWS User Group Community");
		expect(link).toBeTruthy();
		expect(link.tagName).toBe("A");
		expect(link.getAttribute("href")).toContain(
			"meetup.com/pro/global-aws-user-group-community",
		);
	});

	it("no React warnings or errors on render", () => {
		renderFooter();
		const errorCalls = consoleErrorSpy.mock.calls.filter(
			(args: unknown[]) =>
				typeof args[0] === "string" &&
				(args[0].includes("Warning:") || args[0].includes("Error:")),
		);
		expect(errorCalls).toHaveLength(0);
	});
});
