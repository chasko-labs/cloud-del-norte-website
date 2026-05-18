// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 22 — auto-advance on persistent stream failure.
 * Tests that the useEffect calling onSkipStation(1) after 2s grace fires
 * correctly when streamHealth becomes 'failed', and is cleanup-safe on unmount
 * and on health recovery.
 *
 * We test the behaviour directly (timer fires, cleanup clears) rather than
 * rendering the full PersistentPlayerBar (which requires extensive audio/media
 * mocking). The logic under test is the useEffect:
 *
 *   useEffect(() => {
 *     if (streamHealth !== 'failed') return;
 *     const timer = window.setTimeout(() => onSkipStation(1), 2000);
 *     return () => window.clearTimeout(timer);
 *   }, [streamHealth, onSkipStation]);
 */

import { renderHook } from "@testing-library/react";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	type Mock,
} from "vitest";
import { useEffect } from "react";

// Replicate the exact auto-advance hook shape from persistent-player/index.tsx
function useAutoAdvanceOnFailed(
	streamHealth: "ok" | "retrying" | "failed",
	onSkipStation: (direction: 1 | -1) => void,
) {
	useEffect(() => {
		if (streamHealth !== "failed") return;
		const timer = window.setTimeout(() => onSkipStation(1), 2000);
		return () => window.clearTimeout(timer);
	}, [streamHealth, onSkipStation]);
}

describe("auto-advance on stream failure", () => {
	let onSkipStation: Mock;

	beforeEach(() => {
		vi.useFakeTimers();
		onSkipStation = vi.fn();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("does NOT call onSkipStation when health is ok", () => {
		renderHook(() => useAutoAdvanceOnFailed("ok", onSkipStation));
		vi.advanceTimersByTime(3000);
		expect(onSkipStation).not.toHaveBeenCalled();
	});

	it("does NOT call onSkipStation when health is retrying", () => {
		renderHook(() => useAutoAdvanceOnFailed("retrying", onSkipStation));
		vi.advanceTimersByTime(3000);
		expect(onSkipStation).not.toHaveBeenCalled();
	});

	it("calls onSkipStation(1) after 2000ms when health is failed", () => {
		renderHook(() => useAutoAdvanceOnFailed("failed", onSkipStation));
		vi.advanceTimersByTime(1999);
		expect(onSkipStation).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(onSkipStation).toHaveBeenCalledTimes(1);
		expect(onSkipStation).toHaveBeenCalledWith(1);
	});

	it("clears timer on unmount (cleanup-safe)", () => {
		const { unmount } = renderHook(() =>
			useAutoAdvanceOnFailed("failed", onSkipStation),
		);
		vi.advanceTimersByTime(1000);
		unmount();
		vi.advanceTimersByTime(2000);
		// timer was cleared on unmount — skip must not fire
		expect(onSkipStation).not.toHaveBeenCalled();
	});

	it("clears timer when health recovers before 2s grace expires", () => {
		let health: "ok" | "retrying" | "failed" = "failed";
		const { rerender } = renderHook(() =>
			useAutoAdvanceOnFailed(health, onSkipStation),
		);
		vi.advanceTimersByTime(1000);
		// health recovers — effect cleanup clears the timer
		health = "ok";
		rerender();
		vi.advanceTimersByTime(2000);
		expect(onSkipStation).not.toHaveBeenCalled();
	});

	it("fires again if health transitions failed → ok → failed", () => {
		let health: "ok" | "retrying" | "failed" = "failed";
		const { rerender } = renderHook(() =>
			useAutoAdvanceOnFailed(health, onSkipStation),
		);
		vi.advanceTimersByTime(2000);
		expect(onSkipStation).toHaveBeenCalledTimes(1);

		health = "ok";
		rerender();
		health = "failed";
		rerender();
		vi.advanceTimersByTime(2000);
		expect(onSkipStation).toHaveBeenCalledTimes(2);
	});
});
