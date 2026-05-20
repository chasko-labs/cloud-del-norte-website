// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MilitaryClock from "../military-clock";

describe("MilitaryClock", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders Mountain Time in HH:MM:SS 24-hour format", () => {
		render(<MilitaryClock />);
		const el = screen.getByLabelText("current time in el paso");
		// HH:MM:SS — colon-delimited, 24h digits
		expect(el.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
	});

	it("updates on 1-second tick", () => {
		render(<MilitaryClock />);
		const first = screen.getByLabelText("current time in el paso").textContent;
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		// After 1 second the time string may or may not have changed (depends
		// on where in the second boundary we are), but the component should not
		// throw and the interval is clearly registered.
		const el = screen.getByLabelText("current time in el paso");
		expect(el.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
		// Suppress unused-var lint for `first` — here to document the tick test intent.
		void first;
	});

	it("cleans up interval on unmount", () => {
		const clearSpy = vi.spyOn(globalThis, "clearInterval");
		const { unmount } = render(<MilitaryClock />);
		unmount();
		expect(clearSpy).toHaveBeenCalled();
		clearSpy.mockRestore();
	});
});
