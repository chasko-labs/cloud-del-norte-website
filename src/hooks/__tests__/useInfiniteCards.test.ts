// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInfiniteCards } from "../useInfiniteCards";

const CARDS = ["a", "b", "c", "d", "e", "f", "g", "h"];

function mockMatchMedia(mobileMatch: boolean) {
	const listeners: Array<(e: { matches: boolean }) => void> = [];
	const mq = {
		matches: mobileMatch,
		addEventListener: vi.fn(
			(_: string, fn: (e: { matches: boolean }) => void) => {
				listeners.push(fn);
			},
		),
		removeEventListener: vi.fn(),
	};
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockReturnValue(mq),
	});
	Object.defineProperty(window, "innerWidth", {
		writable: true,
		value: mobileMatch ? 375 : 1024,
	});
	return { mq, listeners };
}

beforeEach(() => {
	vi.restoreAllMocks();
});

describe("useInfiniteCards — mobile (375px)", () => {
	it("initial visibleCount is 2", () => {
		mockMatchMedia(true);
		const { result } = renderHook(() => useInfiniteCards(CARDS));
		expect(result.current.visibleCount).toBe(2);
		expect(result.current.visibleCards).toHaveLength(2);
		expect(result.current.hasMore).toBe(true);
	});

	it("incrementVisible adds 2", () => {
		mockMatchMedia(true);
		const { result } = renderHook(() => useInfiniteCards(CARDS));
		act(() => result.current.incrementVisible());
		expect(result.current.visibleCount).toBe(4);
	});

	it("does not exceed cards.length", () => {
		mockMatchMedia(true);
		const { result } = renderHook(() => useInfiniteCards(CARDS));
		for (let i = 0; i < 10; i++) act(() => result.current.incrementVisible());
		expect(result.current.visibleCount).toBe(CARDS.length);
		expect(result.current.hasMore).toBe(false);
	});
});

describe("useInfiniteCards — desktop (1024px)", () => {
	it("initial visibleCount is 4", () => {
		mockMatchMedia(false);
		const { result } = renderHook(() => useInfiniteCards(CARDS));
		expect(result.current.visibleCount).toBe(4);
		expect(result.current.visibleCards).toHaveLength(4);
		expect(result.current.hasMore).toBe(true);
	});

	it("incrementVisible adds 4", () => {
		mockMatchMedia(false);
		const { result } = renderHook(() => useInfiniteCards(CARDS));
		act(() => result.current.incrementVisible());
		expect(result.current.visibleCount).toBe(8);
		expect(result.current.hasMore).toBe(false);
	});
});

describe("useInfiniteCards — short list (2 cards, desktop)", () => {
	it("hasMore is false from the start when cards <= initial batch", () => {
		mockMatchMedia(false);
		const { result } = renderHook(() => useInfiniteCards(["x", "y"]));
		expect(result.current.hasMore).toBe(false);
	});
});
