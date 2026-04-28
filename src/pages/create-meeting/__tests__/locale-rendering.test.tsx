// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../contexts/locale-context";

type AnyProps = Record<string, any>;

// Mock Cloudscape components
vi.mock("@cloudscape-design/components/content-layout", () => ({
	default: ({ children, header }: AnyProps) =>
		React.createElement(
			"div",
			{ "data-testid": "content-layout" },
			header,
			children,
		),
}));
vi.mock("@cloudscape-design/components/header", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("h1", null, children),
}));
vi.mock("@cloudscape-design/components/button", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("button", null, children),
}));
vi.mock("@cloudscape-design/components/form", () => ({
	default: ({ children, actions }: AnyProps) =>
		React.createElement("div", { "data-testid": "form" }, actions, children),
}));
vi.mock("@cloudscape-design/components/space-between", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/components/help-panel", () => ({
	default: ({ header }: AnyProps) =>
		React.createElement("aside", { "data-testid": "help-panel" }, header),
}));

// Mock Shell and navigation — render breadcrumbs so we can assert breadcrumb text
vi.mock("../../../layouts/shell", () => ({
	default: ({ children, breadcrumbs }: AnyProps) =>
		React.createElement(
			LocaleProvider,
			{ locale: "us" } as any,
			React.createElement(
				"div",
				{ "data-testid": "shell" },
				breadcrumbs,
				children,
			),
		),
}));
vi.mock("../../../components/navigation", () => ({
	default: () => React.createElement("nav", { "data-testid": "navigation" }),
}));
vi.mock("../../../components/breadcrumbs", () => ({
	default: ({ active }: AnyProps) =>
		React.createElement(
			"nav",
			{ "aria-label": "breadcrumbs" },
			React.createElement("span", null, active?.text),
		),
}));

// Mock form child components
vi.mock("../components/marketing", () => ({
	default: () => React.createElement("div", { "data-testid": "marketing" }),
}));
vi.mock("../components/shape", () => ({
	default: () => React.createElement("div", { "data-testid": "shape" }),
}));

// RequireAuth is exercised in its own unit tests; pass-through here so locale assertions can run.
vi.mock("../../../components/require-auth", () => ({
	RequireAuth: ({ children }: AnyProps) =>
		React.createElement(React.Fragment, null, children),
}));

// Mock validation — avoids useRef/useState complexity in isolated tests
vi.mock("../validation/basic-validation", () => ({
	useBasicValidation: () => ({
		isFormSubmitted: false,
		setIsFormSubmitted: vi.fn(),
		addErrorField: vi.fn(),
		focusFirstErrorField: vi.fn(),
	}),
	BasicValidationContext: {
		Provider: ({ children }: AnyProps) =>
			React.createElement("div", null, children),
	},
}));

// Mock useTranslation with a mutable return value
const mockTranslation = {
	locale: "us" as "us" | "mx",
	t: (key: string) => key,
};

vi.mock("../../../hooks/useTranslation", () => ({
	useTranslation: () => mockTranslation,
}));

import App from "../app";

describe("Create Meeting page locale rendering", () => {
	beforeEach(() => {
		mockTranslation.locale = "us";
		mockTranslation.t = (key: string) => key;
	});

	it("renders without crashing", () => {
		render(<App />);
		expect(screen.getByTestId("shell")).toBeTruthy();
	});

	it("renders English strings when locale is us", () => {
		mockTranslation.locale = "us";
		mockTranslation.t = (key: string) => {
			const englishMap: Record<string, string> = {
				"createMeeting.breadcrumb": "Create meeting",
				"createMeeting.header": "Create meeting",
				"createMeeting.description":
					"Create a new meeting by specifying details, event link, and speakers.",
				"createMeeting.submit": "Create meeting",
				"common.cancel": "Cancel",
			};
			return englishMap[key] ?? key;
		};

		render(<App />);

		expect(screen.getAllByText("Create meeting").length).toBeGreaterThan(0);
		expect(screen.getByText("Cancel")).toBeTruthy();
	});

	it("renders Spanish strings when locale is mx", () => {
		mockTranslation.locale = "mx";
		mockTranslation.t = (key: string) => {
			const spanishMap: Record<string, string> = {
				"createMeeting.breadcrumb": "Crear junta",
				"createMeeting.header": "Crear junta",
				"createMeeting.description":
					"Crea una nueva junta especificando detalles, link del evento, y speakers.",
				"createMeeting.submit": "Crear junta",
				"common.cancel": "Cancelar",
			};
			return spanishMap[key] ?? key;
		};

		render(<App />);

		expect(screen.getAllByText("Crear junta").length).toBeGreaterThan(0);
		expect(screen.getByText("Cancelar")).toBeTruthy();
	});

	it("uses translation key for breadcrumb text", () => {
		const calledKeys: string[] = [];
		mockTranslation.t = (key: string) => {
			calledKeys.push(key);
			return key;
		};

		render(<App />);

		expect(calledKeys).toContain("createMeeting.breadcrumb");
	});
});
