import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePageVisibility } from "../usePageVisibility";

describe("usePageVisibility", () => {
	let originalHidden: PropertyDescriptor | undefined;

	beforeEach(() => {
		originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");
	});

	afterEach(() => {
		if (originalHidden) {
			Object.defineProperty(document, "hidden", originalHidden);
		} else {
			// biome-ignore lint/performance/noDelete: restore property in tests
			delete (document as { hidden?: boolean }).hidden;
		}
	});

	function setHidden(value: boolean) {
		Object.defineProperty(document, "hidden", {
			configurable: true,
			get: () => value,
		});
	}

	it("initial value is true when document.hidden is false", () => {
		setHidden(false);
		const { result } = renderHook(() => usePageVisibility());
		expect(result.current).toBe(true);
	});

	it("initial value is false when document.hidden is true", () => {
		setHidden(true);
		const { result } = renderHook(() => usePageVisibility());
		expect(result.current).toBe(false);
	});

	it("updates to false when visibilitychange fires with document.hidden=true", () => {
		setHidden(false);
		const { result } = renderHook(() => usePageVisibility());
		expect(result.current).toBe(true);

		act(() => {
			setHidden(true);
			document.dispatchEvent(new Event("visibilitychange"));
		});

		expect(result.current).toBe(false);
	});

	it("updates back to true when page becomes visible again", () => {
		setHidden(true);
		const { result } = renderHook(() => usePageVisibility());
		expect(result.current).toBe(false);

		act(() => {
			setHidden(false);
			document.dispatchEvent(new Event("visibilitychange"));
		});

		expect(result.current).toBe(true);
	});

	it("cleans up listener on unmount", () => {
		const spy = vi.spyOn(document, "removeEventListener");
		setHidden(false);
		const { unmount } = renderHook(() => usePageVisibility());
		unmount();
		expect(spy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
		spy.mockRestore();
	});
});
