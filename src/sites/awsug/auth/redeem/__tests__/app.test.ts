import { describe, beforeEach, afterEach, expect, it } from "vitest";
import { clearReturnTo, getReturnTo, stashReturnTo } from "../../../../auth/_shared/return-to";

/**
 * redeem/app.tsx — dual-source return_to (fragment first, sessionStorage fallback)
 */
describe("redeem — dual-source return_to", () => {
	beforeEach(() => {
		sessionStorage.clear();
		Object.defineProperty(window, "location", {
			value: { search: "", hash: "" },
			writable: true,
		});
	});
	afterEach(() => {
		sessionStorage.clear();
	});

	it("uses fragment return_to when present and non-empty", () => {
		const fragment = "id_token=a&access_token=b&refresh_token=c&return_to=%2Frsvp%2F";
		const params = new URLSearchParams(fragment);
		const returnTo = params.get("return_to") || getReturnTo();
		clearReturnTo();
		expect(returnTo).toBe("/rsvp/");
	});

	it("falls back to sessionStorage cdn.returnTo when fragment return_to is empty", () => {
		stashReturnTo("/rsvp/?event=happy-hour");
		const fragment = "id_token=a&access_token=b&refresh_token=c&return_to=";
		const params = new URLSearchParams(fragment);
		const returnTo = params.get("return_to") || getReturnTo();
		expect(returnTo).toBe("/rsvp/?event=happy-hour");
	});

	it("clears sessionStorage cdn.returnTo after consuming it", () => {
		stashReturnTo("/rsvp/?event=happy-hour");
		const fragment = "id_token=a&access_token=b&refresh_token=c&return_to=";
		const params = new URLSearchParams(fragment);
		params.get("return_to") || getReturnTo();
		clearReturnTo();
		expect(sessionStorage.getItem("cdn.returnTo")).toBeNull();
	});

	it("falls back to /index.html when both sources are empty", () => {
		const fragment = "id_token=a&access_token=b&refresh_token=c&return_to=";
		const params = new URLSearchParams(fragment);
		const returnTo = params.get("return_to") || getReturnTo();
		const dest = returnTo && returnTo.startsWith("/") ? returnTo : "/index.html";
		expect(dest).toBe("/index.html");
	});
});
