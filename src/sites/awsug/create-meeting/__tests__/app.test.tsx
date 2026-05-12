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

describe("create-meeting/app.tsx — moderator gate", () => {
	beforeEach(() => {
		Object.defineProperty(window, "location", {
			value: { pathname: "/create-meeting/index.html", assign: vi.fn() },
			writable: true,
		});
	});

	it("non-moderator member sees pending-approval message, not form", async () => {
		mockRequireAuth.mockReturnValue({
			email: "member@example.com",
			sub: "sub-mem",
			groups: ["members"],
			idToken: "tok",
		});

		render(<App />);

		await waitFor(() =>
			expect(
				screen.getByText("awsug.meetings.createPendingApproval"),
			).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("button", { name: /create meeting/i }),
		).not.toBeInTheDocument();
	});

	it("moderator sees create meeting form", async () => {
		mockRequireAuth.mockReturnValue({
			email: "mod@example.com",
			sub: "sub-mod",
			groups: ["members", "moderators"],
			idToken: "tok",
		});

		render(<App />);

		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: /create meeting/i }),
			).toBeInTheDocument(),
		);
		expect(
			screen.queryByText("awsug.meetings.createPendingApproval"),
		).not.toBeInTheDocument();
	});
});
