import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFeedbackDraft } from "../useFeedbackDraft";

const KEY = "cdn-feedback-draft-bug";

describe("useFeedbackDraft", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		localStorage.clear();
	});

	it("setDraftField updates state immediately", () => {
		const { result } = renderHook(() => useFeedbackDraft("bug"));

		act(() => {
			result.current.setDraftField("summary", "hello world fix");
		});

		expect(result.current.draft.summary).toBe("hello world fix");
	});

	it("setDraftField triggers debounced localStorage write after 500ms", () => {
		const { result } = renderHook(() => useFeedbackDraft("bug"));

		act(() => {
			result.current.setDraftField("summary", "debounce test summary");
		});

		// Not written yet
		expect(localStorage.getItem(KEY)).toBeNull();

		// Fire the debounce timer
		act(() => {
			vi.advanceTimersByTime(500);
		});

		const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as {
			summary: string;
		};
		expect(stored.summary).toBe("debounce test summary");
	});

	it("clearDraft removes localStorage key and resets state", () => {
		localStorage.setItem(
			KEY,
			JSON.stringify({
				type: "bug",
				summary: "old",
				details: "d",
				contactEmail: "",
			}),
		);

		const { result } = renderHook(() => useFeedbackDraft("bug"));

		// Confirm draft was restored from storage
		expect(result.current.draft.summary).toBe("old");

		act(() => {
			result.current.clearDraft();
		});

		expect(localStorage.getItem(KEY)).toBeNull();
		expect(result.current.draft.summary).toBe("");
		expect(result.current.draft.details).toBe("");
	});

	it("hasPersistedDraft is true when localStorage has data on mount", () => {
		localStorage.setItem(
			KEY,
			JSON.stringify({
				type: "bug",
				summary: "saved",
				details: "x",
				contactEmail: "",
			}),
		);

		const { result } = renderHook(() => useFeedbackDraft("bug"));

		expect(result.current.hasPersistedDraft).toBe(true);
	});

	it("hasPersistedDraft is false when localStorage is empty on mount", () => {
		const { result } = renderHook(() => useFeedbackDraft("bug"));
		expect(result.current.hasPersistedDraft).toBe(false);
	});
});
