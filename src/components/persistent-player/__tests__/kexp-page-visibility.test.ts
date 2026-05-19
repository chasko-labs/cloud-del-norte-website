// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 40a — KEXP polling pause via Page Visibility API.
 *
 * Wave 26c shipped the api.kexp.org now-playing poll on a 30s interval inside
 * PersistentPlayerBar, gated to fire only when stationKey === "kexp" AND audio
 * is playing. The poll kept firing when the user backgrounded the tab —
 * burning quota and battery for a UI nobody could see.
 *
 * Wave 40a extends the gating envelope to also pause when
 * document.visibilityState === "hidden". On return to "visible" the poll
 * resumes with an immediate fetch + restart of the 30s cadence so the album
 * art catches up to whatever spun during the hidden window.
 *
 * We replicate the polling-effect shape from persistent-player/index.tsx
 * inside a small test hook so we can drive vi.useFakeTimers + the
 * visibilitychange event without standing up the full audio + media-session
 * machinery the real component requires. The auto-advance.test.ts pattern in
 * this directory takes the same approach.
 */

import { renderHook } from "@testing-library/react";
import { useEffect } from "react";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";

const POLL_MS = 30_000;

/**
 * Mirrors the Wave 40a KEXP poll effect from persistent-player/index.tsx.
 * The only deltas vs. the production hook:
 *   - fetchImpl is injected so the test can count calls without monkey-patching
 *   - the trackplay-row decode + state transitions are stripped (the
 *     visibility lifecycle is what we need to exercise)
 * The interval/visibility/cleanup machinery is byte-identical.
 */
function useKexpPollEffect(
	stationKey: string,
	playing: boolean,
	fetchImpl: () => Promise<unknown>,
) {
	useEffect(() => {
		if (stationKey !== "kexp" || !playing) return;
		let cancelled = false;
		let intervalId: number | null = null;
		const poll = async () => {
			await fetchImpl();
			if (cancelled) return;
		};
		const startPolling = () => {
			if (intervalId !== null) return;
			poll();
			intervalId = window.setInterval(poll, POLL_MS);
		};
		const stopPolling = () => {
			if (intervalId !== null) {
				window.clearInterval(intervalId);
				intervalId = null;
			}
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				stopPolling();
			} else {
				startPolling();
			}
		};
		if (document.visibilityState !== "hidden") {
			startPolling();
		}
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			cancelled = true;
			stopPolling();
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [stationKey, playing, fetchImpl]);
}

function setVisibility(state: "visible" | "hidden") {
	Object.defineProperty(document, "visibilityState", {
		value: state,
		configurable: true,
	});
	document.dispatchEvent(new Event("visibilitychange"));
}

describe("KEXP poll Page Visibility integration (Wave 40a)", () => {
	let fetchMock: Mock;

	beforeEach(() => {
		vi.useFakeTimers();
		fetchMock = vi.fn().mockResolvedValue(null);
		// default to visible at the start of every test so prior tests
		// leaving the document in `hidden` cannot leak across cases
		Object.defineProperty(document, "visibilityState", {
			value: "visible",
			configurable: true,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		// reset visibility back to "visible" so unrelated tests start clean
		Object.defineProperty(document, "visibilityState", {
			value: "visible",
			configurable: true,
		});
	});

	it("does not fetch or arm the interval when the tab is hidden on mount", () => {
		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});
		renderHook(() => useKexpPollEffect("kexp", true, fetchMock));
		// Even after a full minute (two 30s ticks), no fetch should fire
		// because the interval was never armed and no immediate fetch ran.
		vi.advanceTimersByTime(60_000);
		expect(fetchMock).toHaveBeenCalledTimes(0);
	});

	it("pauses the poll when the tab transitions to hidden mid-cycle", async () => {
		renderHook(() => useKexpPollEffect("kexp", true, fetchMock));
		// initial fetch is a microtask — flush it
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		// drive one full 30s tick — second fetch fires
		await vi.advanceTimersByTimeAsync(POLL_MS);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		// tab is backgrounded — interval is cleared and no further fetches fire
		setVisibility("hidden");
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("kicks an immediate fetch and restarts the interval when the tab returns to visible", async () => {
		renderHook(() => useKexpPollEffect("kexp", true, fetchMock));
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(1); // mount fetch

		// background the tab — poll quiesces
		setVisibility("hidden");
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		// foreground the tab — resume should fire an immediate fetch ahead
		// of the next interval tick
		setVisibility("visible");
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		// 30s after resume the interval ticks again
		await vi.advanceTimersByTimeAsync(POLL_MS);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});
