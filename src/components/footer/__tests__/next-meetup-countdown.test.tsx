// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NextMeetupCountdown from "../next-meetup-countdown";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function stubFetch(dtstart: string | null) {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: dtstart !== null,
			json: async () => (dtstart !== null ? { dtstart } : null),
		}),
	);
}

describe("NextMeetupCountdown", () => {
	it("renders 'next meetup in Xd Yh Zm' for a future meetup", async () => {
		const future = new Date(
			Date.now() + 6 * 86_400_000 + 14 * 3_600_000 + 23 * 60_000,
		).toISOString();
		stubFetch(future);
		render(<NextMeetupCountdown />);
		await waitFor(() => {
			expect(screen.getByText(/next meetup in/i)).toBeInTheDocument();
		});
		expect(screen.getByText(/\d+d/)).toBeInTheDocument();
	});

	it("shows '— STARTING SOON —' when under 5 minutes", async () => {
		const nearFuture = new Date(Date.now() + 2 * 60_000).toISOString();
		stubFetch(nearFuture);
		render(<NextMeetupCountdown />);
		await waitFor(() => {
			expect(screen.getByText("— STARTING SOON —")).toBeInTheDocument();
		});
	});

	it("renders nothing when meetup is in the past", async () => {
		const past = new Date(Date.now() - 60_000).toISOString();
		stubFetch(past);
		const { container } = render(<NextMeetupCountdown />);
		await waitFor(() => {
			expect(container.firstChild).toBeNull();
		});
	});

	it("renders nothing when JSON is missing", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, json: async () => null }),
		);
		const { container } = render(<NextMeetupCountdown />);
		// Give the fetch promise a tick to settle
		await new Promise((r) => setTimeout(r, 10));
		expect(container.firstChild).toBeNull();
	});
});
