// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen } from "@testing-library/react";
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
	getAuthState: vi.fn(),
	isModerator: (auth: { groups: string[] }) =>
		auth.groups.includes("moderators"),
}));

vi.mock("../../_shared/use-group-membership", () => ({
	useGroupMembership: vi.fn(),
}));

vi.mock("../../../../components/fiona-frame", () => ({
	default: () => React.createElement("div", { "data-testid": "fiona-frame" }),
}));

vi.mock("../../../../components/speakeasy-sign", () => ({
	default: () =>
		React.createElement("div", { "data-testid": "speakeasy-sign" }),
}));

import { getAuthState } from "../../_shared/auth";
import AwsugNavigation from "../navigation";

const mockGetAuthState = getAuthState as ReturnType<typeof vi.fn>;

describe("AwsugNavigation — admin link visibility", () => {
	beforeEach(() => {
		Object.defineProperty(window, "location", {
			value: { pathname: "/meetings/index.html" },
			writable: true,
		});
	});

	it("moderator sees admin link", () => {
		mockGetAuthState.mockReturnValue({
			email: "mod@example.com",
			sub: "sub-mod",
			groups: ["members", "moderators"],
			idToken: "tok",
		});

		render(<AwsugNavigation />);
		expect(screen.getByText("admin")).toBeInTheDocument();
	});

	it("member does not see admin link", () => {
		mockGetAuthState.mockReturnValue({
			email: "member@example.com",
			sub: "sub-mem",
			groups: ["members"],
			idToken: "tok",
		});

		render(<AwsugNavigation />);
		expect(screen.queryByText("admin")).not.toBeInTheDocument();
	});

	it("pending user (no groups) does not see admin link", () => {
		mockGetAuthState.mockReturnValue({
			email: "pending@example.com",
			sub: "sub-pend",
			groups: [],
			idToken: "tok",
		});

		render(<AwsugNavigation />);
		expect(screen.queryByText("admin")).not.toBeInTheDocument();
	});

	it("unauthenticated (null auth) does not see admin link", () => {
		mockGetAuthState.mockReturnValue(null);

		render(<AwsugNavigation />);
		expect(screen.queryByText("admin")).not.toBeInTheDocument();
	});
});
