// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("meetings/app.tsx", () => {
	beforeEach(() => {
		Object.defineProperty(window, "location", {
			value: { pathname: "/meetings/index.html", assign: vi.fn() },
			writable: true,
		});
	});

	it("moderator sees open call room and create meeting buttons", async () => {
		mockRequireAuth.mockReturnValue({
			email: "mod@example.com",
			sub: "sub-mod",
			groups: ["members", "moderators"],
			idToken: "tok",
		});

		render(<App />);

		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "awsug.meetings.openCallRoom" }),
			).toBeInTheDocument(),
		);
		expect(
			screen.getByRole("link", { name: "awsug.meetings.createMeeting" }),
		).toBeInTheDocument();
	});

	it("member sees open call room but not create meeting", async () => {
		mockRequireAuth.mockReturnValue({
			email: "member@example.com",
			sub: "sub-mem",
			groups: ["members"],
			idToken: "tok",
		});

		render(<App />);

		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "awsug.meetings.openCallRoom" }),
			).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("link", { name: "awsug.meetings.createMeeting" }),
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

	it("clicking open call room renders JitsiEmbed inline", async () => {
		mockRequireAuth.mockReturnValue({
			email: "mod@example.com",
			sub: "sub-mod",
			groups: ["members", "moderators"],
			idToken: "tok",
		});

		render(<App />);

		const btn = await screen.findByRole("button", {
			name: "awsug.meetings.openCallRoom",
		});
		fireEvent.click(btn);

		await waitFor(() =>
			expect(screen.getByTestId("jitsi-embed")).toBeInTheDocument(),
		);
	});
});
