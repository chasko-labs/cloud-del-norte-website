import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearReturnTo, getReturnTo, stashReturnTo } from "../return-to";

function setSearch(search: string) {
	Object.defineProperty(window, "location", {
		value: { ...window.location, search },
		writable: true,
	});
}

describe("return-to helper", () => {
	beforeEach(() => {
		sessionStorage.clear();
		setSearch("");
	});
	afterEach(() => {
		sessionStorage.clear();
		setSearch("");
	});

	describe("getReturnTo", () => {
		it("returns empty string when nothing is set", () => {
			expect(getReturnTo()).toBe("");
		});

		it("reads return_to from search params", () => {
			setSearch("?return_to=%2Frsvp%2F%3Fevent%3Dhappy-hour");
			expect(getReturnTo()).toBe("/rsvp/?event=happy-hour");
		});

		it("reads from sessionStorage when search param is absent", () => {
			stashReturnTo("/rsvp/?event=happy-hour");
			expect(getReturnTo()).toBe("/rsvp/?event=happy-hour");
		});

		it("prefers search param over sessionStorage", () => {
			stashReturnTo("/from-storage");
			setSearch("?return_to=%2Ffrom-search");
			expect(getReturnTo()).toBe("/from-search");
		});
	});

	describe("stashReturnTo + clearReturnTo", () => {
		it("round-trips through sessionStorage", () => {
			stashReturnTo("/rsvp/?event=test");
			expect(sessionStorage.getItem("cdn.returnTo")).toBe("/rsvp/?event=test");
		});

		it("clearReturnTo removes the stashed value", () => {
			stashReturnTo("/rsvp/?event=test");
			clearReturnTo();
			expect(sessionStorage.getItem("cdn.returnTo")).toBeNull();
		});

		it("stashReturnTo does not write empty strings", () => {
			stashReturnTo("");
			expect(sessionStorage.getItem("cdn.returnTo")).toBeNull();
		});
	});
});
