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
	isBanned: (auth: { groups: string[] }) => auth.groups.includes("banned"),
}));

vi.mock("../../_layout", () => ({
	default: ({
		children,
		toolsHide,
		navigationOpen,
	}: {
		children: React.ReactNode;
		toolsHide?: boolean;
		navigationOpen?: boolean;
	}) =>
		React.createElement(
			"div",
			{
				"data-testid": "awsug-layout",
				"data-tools-hide": toolsHide ? "true" : undefined,
				"data-nav-open":
					navigationOpen !== undefined ? String(navigationOpen) : undefined,
			},
			children,
		),
}));

vi.mock("../../../../hooks/useTranslation", () => ({
	useTranslation: () => ({
		t: (k: string) => k,
	}),
}));

vi.mock("../../../../pages/meetings/components/jitsi-embed", () => ({
	default: ({
		roomName,
		onClose,
	}: { roomName?: string; onClose?: () => void }) =>
		React.createElement("div", {
			"data-testid": "jitsi-embed",
			"data-room": roomName,
			"data-onclose": onClose ? "present" : undefined,
		}),
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

	describe("create meeting button visibility", () => {
		it("moderator sees embed auto-mounted", async () => {
			mockRequireAuth.mockReturnValue({
				email: "mod@example.com",
				sub: "sub-mod",
				groups: ["members", "moderators"],
				idToken: "tok",
			});

			render(<App />);

			await waitFor(() =>
				expect(screen.getByTestId("jitsi-embed")).toBeInTheDocument(),
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
				expect(screen.getByTestId("jitsi-embed")).toBeInTheDocument(),
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

	describe("auto-join behaviour", () => {
		it("auto-mounts the jitsi embed without a click for a permitted member", async () => {
			mockRequireAuth.mockReturnValue({
				email: "member@example.com",
				sub: "sub-mem",
				groups: ["members"],
				idToken: "tok",
			});

			render(<App />);

			// Embed mounts immediately — no button click needed
			await waitFor(() =>
				expect(screen.getByTestId("jitsi-embed")).toBeInTheDocument(),
			);
			// Room name is the deterministic shared value
			expect(screen.getByTestId("jitsi-embed").getAttribute("data-room")).toBe(
				"cloud-del-norte-awsug",
			);
		});

		it("does not auto-join for a pending user", async () => {
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
			expect(screen.queryByTestId("jitsi-embed")).not.toBeInTheDocument();
		});

		it("does not auto-join for a banned user", async () => {
			mockRequireAuth.mockReturnValue({
				email: "banned@example.com",
				sub: "sub-ban",
				groups: ["banned"],
				idToken: "tok",
			});

			render(<App />);

			await waitFor(() =>
				expect(
					screen.getByText("awsug.meetings.bannedMessage"),
				).toBeInTheDocument(),
			);
			expect(screen.queryByTestId("jitsi-embed")).not.toBeInTheDocument();
		});

		it("shows leave-call button when in call", async () => {
			mockRequireAuth.mockReturnValue({
				email: "member@example.com",
				sub: "sub-mem",
				groups: ["members"],
				idToken: "tok",
			});

			render(<App />);

			await waitFor(() =>
				expect(screen.getByTestId("jitsi-embed")).toBeInTheDocument(),
			);
			expect(
				screen.getByRole("button", { name: /awsug\.meetings\.leaveCall/i }),
			).toBeInTheDocument();
		});

		it("leave-call unmounts embed and shows manual fallback", async () => {
			mockRequireAuth.mockReturnValue({
				email: "member@example.com",
				sub: "sub-mem",
				groups: ["members"],
				idToken: "tok",
			});

			render(<App />);

			await waitFor(() =>
				expect(screen.getByTestId("jitsi-embed")).toBeInTheDocument(),
			);

			fireEvent.click(
				screen.getByRole("button", { name: /awsug\.meetings\.leaveCall/i }),
			);

			await waitFor(() =>
				expect(screen.queryByTestId("jitsi-embed")).not.toBeInTheDocument(),
			);
			// Manual button should appear as fallback
			expect(
				screen.getByRole("button", {
					name: /awsug\.meetings\.openCallRoom/i,
				}),
			).toBeInTheDocument();
		});
	});

	describe("tickets widget removed", () => {
		it("does not render the tickets widget on the meetings page", async () => {
			mockRequireAuth.mockReturnValue({
				email: "member@example.com",
				sub: "sub-mem",
				groups: ["members"],
				idToken: "tok",
			});

			render(<App />);

			await waitFor(() =>
				expect(screen.getByTestId("jitsi-embed")).toBeInTheDocument(),
			);
			// MyTickets component should NOT be present
			expect(screen.queryByText(/your tickets/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/myTicketsHeader/i)).not.toBeInTheDocument();
		});
	});

	describe("immersive layout", () => {
		it("hides tools panel and collapses nav when in call", async () => {
			mockRequireAuth.mockReturnValue({
				email: "member@example.com",
				sub: "sub-mem",
				groups: ["members"],
				idToken: "tok",
			});

			render(<App />);

			await waitFor(() =>
				expect(screen.getByTestId("jitsi-embed")).toBeInTheDocument(),
			);

			const layout = screen.getByTestId("awsug-layout");
			expect(layout.getAttribute("data-tools-hide")).toBe("true");
			expect(layout.getAttribute("data-nav-open")).toBe("false");
		});

		it("restores chrome when user leaves the call", async () => {
			mockRequireAuth.mockReturnValue({
				email: "member@example.com",
				sub: "sub-mem",
				groups: ["members"],
				idToken: "tok",
			});

			render(<App />);

			await waitFor(() =>
				expect(screen.getByTestId("jitsi-embed")).toBeInTheDocument(),
			);

			fireEvent.click(
				screen.getByRole("button", { name: /awsug\.meetings\.leaveCall/i }),
			);

			await waitFor(() => {
				const layout = screen.getByTestId("awsug-layout");
				expect(layout.getAttribute("data-tools-hide")).toBeNull();
				expect(layout.getAttribute("data-nav-open")).toBe("true");
			});
		});
	});

	describe("error handling and fallback", () => {
		it("wires the onClose handler to the jitsi embed for failure detection", async () => {
			mockRequireAuth.mockReturnValue({
				email: "member@example.com",
				sub: "sub-mem",
				groups: ["members"],
				idToken: "tok",
			});

			render(<App />);

			await waitFor(() =>
				expect(screen.getByTestId("jitsi-embed")).toBeInTheDocument(),
			);

			// The embed is mounted with onClose wired for failure detection
			expect(
				screen.getByTestId("jitsi-embed").getAttribute("data-onclose"),
			).toBe("present");
		});
	});
});
