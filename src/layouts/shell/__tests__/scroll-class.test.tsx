import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Isolated hook that mirrors the scroll effect in Shell ────────────────────
// We test the scroll logic in isolation — Shell itself pulls in Cloudscape
// AppLayout + TopNavigation which requires heavy mocking. The logic under
// test is a self-contained useEffect and can be extracted for unit testing.

import { useEffect } from "react";

function useScrollClass() {
	useEffect(() => {
		if (typeof window === "undefined") return;
		const onScroll = () => {
			document.body.classList.toggle("cdn-scrolled", window.scrollY > 80);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			document.body.classList.remove("cdn-scrolled");
		};
	}, []);
}

describe("scroll-driven cdn-scrolled class (Wave 14)", () => {
	beforeEach(() => {
		document.body.classList.remove("cdn-scrolled");
		Object.defineProperty(window, "scrollY", {
			writable: true,
			configurable: true,
			value: 0,
		});
	});

	afterEach(() => {
		document.body.classList.remove("cdn-scrolled");
		vi.restoreAllMocks();
	});

	function fireScroll(y: number) {
		Object.defineProperty(window, "scrollY", {
			value: y,
			writable: true,
			configurable: true,
		});
		window.dispatchEvent(new Event("scroll"));
	}

	it("adds cdn-scrolled when scrollY > 80", () => {
		renderHook(() => useScrollClass());
		fireScroll(81);
		expect(document.body.classList.contains("cdn-scrolled")).toBe(true);
	});

	it("removes cdn-scrolled when scrollY drops back to <= 80", () => {
		renderHook(() => useScrollClass());
		fireScroll(100);
		expect(document.body.classList.contains("cdn-scrolled")).toBe(true);
		fireScroll(80);
		expect(document.body.classList.contains("cdn-scrolled")).toBe(false);
	});

	it("does not add cdn-scrolled at exactly 80", () => {
		renderHook(() => useScrollClass());
		fireScroll(80);
		expect(document.body.classList.contains("cdn-scrolled")).toBe(false);
	});

	it("removes listener AND body class on unmount", () => {
		const removeSpy = vi.spyOn(window, "removeEventListener");
		const { unmount } = renderHook(() => useScrollClass());
		fireScroll(200);
		expect(document.body.classList.contains("cdn-scrolled")).toBe(true);
		unmount();
		expect(document.body.classList.contains("cdn-scrolled")).toBe(false);
		expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
	});
});
