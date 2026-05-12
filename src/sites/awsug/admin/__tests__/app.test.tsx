// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver =
	ResizeObserverMock as unknown as typeof ResizeObserver;

vi.mock("../../_shared/auth", () => ({
	requireAuth: vi.fn(),
	isModerator: (auth: { groups: string[] }) =>
		auth.groups.includes("moderators"),
}));

vi.mock("../../_shared/api", () => ({
	listUsers: vi.fn().mockResolvedValue([]),
	approveUser: vi.fn(),
	banUser: vi.fn(),
	unbanUser: vi.fn(),
}));

vi.mock("../../_layout", () => ({
	default: ({ children }: { children: React.ReactNode }) =>
		React.createElement("div", { "data-testid": "awsug-layout" }, children),
}));

vi.mock("../../../../hooks/useTranslation", () => ({
	useTranslation: () => ({
		t: (k: string) => k,
	}),
}));

import { requireAuth } from "../../_shared/auth";
import App from "../app";

const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

describe("admin/app.tsx — access control", () => {
	beforeEach(() => {
		Object.defineProperty(window, "location", {
			value: { pathname: "/admin/index.html", assign: vi.fn() },
			writable: true,
		});
	});

	it("non-moderator sees denial card, not admin panel", async () => {
		mockRequireAuth.mockReturnValue({
			email: "member@example.com",
			sub: "sub-mem",
			groups: ["members"],
			idToken: "tok",
		});

		render(<App />);

		await waitFor(() =>
			expect(
				screen.getByText("awsug.admin.moderatorAccessRequired"),
			).toBeInTheDocument(),
		);
		// Admin panel tabs must not be present
		expect(
			screen.queryByText("awsug.admin.filterPending"),
		).not.toBeInTheDocument();
	});

	it("denial card includes link back to meetings", async () => {
		mockRequireAuth.mockReturnValue({
			email: "member@example.com",
			sub: "sub-mem",
			groups: ["members"],
			idToken: "tok",
		});

		render(<App />);

		await waitFor(() =>
			expect(
				screen.getByRole("link", { name: /go to meetings/i }),
			).toHaveAttribute("href", "/meetings/index.html"),
		);
	});

	it("moderator sees admin panel tabs", async () => {
		mockRequireAuth.mockReturnValue({
			email: "mod@example.com",
			sub: "sub-mod",
			groups: ["members", "moderators"],
			idToken: "tok",
		});

		render(<App />);

		await waitFor(() =>
			expect(
				screen.getAllByText("awsug.admin.filterPending").length,
			).toBeGreaterThan(0),
		);
		expect(
			screen.queryByText("awsug.admin.moderatorAccessRequired"),
		).not.toBeInTheDocument();
	});
});
