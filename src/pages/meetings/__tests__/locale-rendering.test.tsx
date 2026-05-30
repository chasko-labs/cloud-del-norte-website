import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../contexts/locale-context";

type MockProps = { [key: string]: React.ReactNode };

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver =
	ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock Cloudscape components
vi.mock("@cloudscape-design/components/table", () => ({
	default: ({
		header,
		items,
		columnDefinitions,
	}: {
		header?: React.ReactNode;
		items?: Record<string, unknown>[];
		columnDefinitions?: {
			id?: string;
			cell?: (item: unknown) => React.ReactNode;
		}[];
	}) =>
		React.createElement(
			"div",
			{ "data-testid": "table" },
			header,
			(items ?? []).map((_: unknown, i: number) =>
				React.createElement(
					"div",
					{ key: i, "data-testid": "table-row" },
					(columnDefinitions ?? []).map((col) =>
						React.createElement(
							"div",
							{ key: col.id, "data-testid": `cell-${col.id}` },
							col.cell?.((items ?? [])[i]),
						),
					),
				),
			),
		),
}));
vi.mock("@cloudscape-design/components/header", () => ({
	default: ({ children, actions }: MockProps) =>
		React.createElement(
			"div",
			null,
			React.createElement("h1", null, children),
			actions,
		),
}));
vi.mock("@cloudscape-design/components/button", () => ({
	default: ({
		children,
		onClick,
	}: {
		children?: React.ReactNode;
		onClick?: () => void;
	}) => React.createElement("button", { type: "button", onClick }, children),
}));
vi.mock("@cloudscape-design/components/space-between", () => ({
	default: ({ children }: MockProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/components/pagination", () => ({
	default: () => React.createElement("div", { "data-testid": "pagination" }),
}));
vi.mock("@cloudscape-design/components/modal", () => ({
	default: ({
		children,
		visible,
	}: {
		children?: React.ReactNode;
		visible?: boolean;
	}) =>
		visible
			? React.createElement("div", { "data-testid": "modal" }, children)
			: null,
}));
vi.mock("../components/jitsi-embed", () => ({
	default: () =>
		React.createElement("div", { "data-testid": "jitsi-embed-stub" }),
}));
vi.mock("@cloudscape-design/components/text-filter", () => ({
	default: ({ filteringPlaceholder }: { filteringPlaceholder?: string }) =>
		React.createElement("input", { placeholder: filteringPlaceholder }),
}));
vi.mock("@cloudscape-design/components/collection-preferences", () => ({
	default: () =>
		React.createElement("div", { "data-testid": "collection-preferences" }),
}));
vi.mock("@cloudscape-design/components/box", () => ({
	default: ({ children }: MockProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/collection-hooks", () => ({
	useCollection: (_items: unknown[], _opts: Record<string, unknown>) => ({
		items: [],
		filterProps: { filteringText: "", onChange: vi.fn() },
		actions: { setFiltering: vi.fn() },
		filteredItemsCount: 0,
		paginationProps: { currentPageIndex: 1, pagesCount: 1, onChange: vi.fn() },
		collectionProps: {
			selectedItems: [],
			onSelectionChange: vi.fn(),
			sortingColumn: null,
			sortingDescending: false,
			onSortingChange: vi.fn(),
		},
	}),
}));

// Mock Shell — render breadcrumbs and children so breadcrumb text is testable
vi.mock("../../../layouts/shell", () => ({
	default: ({
		children,
		breadcrumbs,
	}: {
		children: React.ReactNode;
		breadcrumbs?: React.ReactNode;
	}) =>
		React.createElement(
			LocaleProvider,
			{ locale: "us" },
			React.createElement(
				"div",
				{ "data-testid": "shell" },
				breadcrumbs,
				children,
			),
		),
}));

// Mock Breadcrumbs — render active.text so locale-dependent text is visible
vi.mock("../../../components/breadcrumbs", () => ({
	default: ({ active }: { active?: { text?: string } }) =>
		React.createElement(
			"nav",
			{ "aria-label": "breadcrumbs" },
			React.createElement(
				"span",
				{ "data-testid": "breadcrumb-active" },
				active?.text,
			),
		),
}));

vi.mock("../../../components/navigation", () => ({
	default: () => React.createElement("nav", { "data-testid": "navigation" }),
}));

vi.mock("../../create-meeting/components/help-panel-home", () => ({
	HelpPanelHome: () =>
		React.createElement("div", { "data-testid": "help-panel" }),
}));

// RequireAuth is exercised in its own unit tests; pass-through here so locale assertions can run.
vi.mock("../../../components/require-auth", () => ({
	RequireAuth: ({ children }: MockProps) =>
		React.createElement(React.Fragment, null, children),
}));

// Mock useTranslation with a mutable return value
const mockTranslation = {
	locale: "us" as "us" | "mx",
	t: (key: string) => key,
};

vi.mock("../../../hooks/useTranslation", () => ({
	useTranslation: () => mockTranslation,
}));

vi.mock("../../../hooks/useAuth", () => ({
	useAuth: () => ({
		isAuthenticated: true,
		idToken: "tok",
		email: "a@b.co",
		name: "alice",
		groups: [],
		isModerator: false,
		signOut: () => {},
	}),
}));

import App from "../app";

describe("Meetings page locale rendering", () => {
	beforeEach(() => {
		mockTranslation.locale = "us";
		mockTranslation.t = (key: string) => key;
	});

	it("renders Spanish breadcrumb when locale is mx", () => {
		mockTranslation.locale = "mx";
		mockTranslation.t = (key: string) => {
			const spanishMap: Record<string, string> = {
				"meetings.breadcrumb": "Juntas",
			};
			return spanishMap[key] ?? key;
		};

		render(<App />);

		expect(screen.getByTestId("breadcrumb-active").textContent).toBe("Juntas");
	});

	it("renders English breadcrumb when locale is us", () => {
		mockTranslation.locale = "us";
		mockTranslation.t = (key: string) => {
			const englishMap: Record<string, string> = {
				"meetings.breadcrumb": "Meetings",
			};
			return englishMap[key] ?? key;
		};

		render(<App />);

		expect(screen.getByTestId("breadcrumb-active").textContent).toBe(
			"Meetings",
		);
	});

	it("renders without crashing", () => {
		expect(() => render(<App />)).not.toThrow();
	});
});
