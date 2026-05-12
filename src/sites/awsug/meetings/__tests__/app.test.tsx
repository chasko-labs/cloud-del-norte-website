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
	isMember: (auth: { groups: string[] }) => auth.groups.includes("members"),
	isModerator: (auth: { groups: string[] }) =>
		auth.groups.includes("moderators"),
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

vi.mock("../../../../pages/meetings/components/jitsi-embed", () => ({
	default: () => React.createElement("div", { "data-testid": "jitsi-embed" }),
}));

import { requireAuth } from "../../_shared/auth";
import App from "../app";

const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

describe("meetings/app.tsx — create meeting button visibility", () => {
	beforeEach(() => {
		Object.defineProperty(window, "location", {
			value: { pathname: "/meetings/index.html", assign: vi.fn() },
			writable: true,
		});
	});

	it("moderator sees create meeting button", async () => {
		mockRequireAuth.mockReturnValue({
			email: "mod@example.com",
			sub: "sub-mod",
			groups: ["members", "moderators"],
			idToken: "tok",
		});

		render(<App />);

		await waitFor(() =>
			expect(
				screen.getByRole("link", { name: /create meeting/i }),
			).toBeInTheDocument(),
		);
	});

	it("member does not see create meeting button", async () => {
		mockRequireAuth.mockReturnValue({
			email: "member@example.com",
			sub: "sub-mem",
			groups: ["members"],
			idToken: "tok",
		});

		render(<App />);

		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: /join call/i }),
			).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("link", { name: /create meeting/i }),
		).not.toBeInTheDocument();
	});

	it("pending user sees pending approval message", async () => {
		mockRequireAuth.mockReturnValue({
			email: "pending@example.com",
			sub: "sub-pend",
			groups: [],
			idToken: "tok",
		});

		render(<App />);

		await waitFor(() =>
			expect(
				screen.getByText("awsug.meetings.pendingApproval"),
			).toBeInTheDocument(),
		);
	});
});
