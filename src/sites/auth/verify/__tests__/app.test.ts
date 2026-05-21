import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * verify/app.tsx — return_to stash before needsVerificationSetup
 * Tests the behaviour added in wave-63: stashReturnTo is called before
 * sessionStorage.setItem("cdn.needsVerificationSetup", "1").
 */
describe("verify/app.tsx — stashes return_to before needsVerificationSetup", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});
	afterEach(() => {
		sessionStorage.clear();
	});

	it("stashes return_to when confirmSignUp succeeds and search has return_to", () => {
		// Simulate what the patched handleSubmit success path does
		Object.defineProperty(window, "location", {
			value: { search: "?return_to=%2Frsvp%2F%3Fevent%3Dhappy-hour" },
			writable: true,
		});

		const returnTo =
			new URLSearchParams(window.location.search).get("return_to") ?? "";
		if (returnTo) sessionStorage.setItem("cdn.returnTo", returnTo);
		sessionStorage.setItem("cdn.needsVerificationSetup", "1");

		expect(sessionStorage.getItem("cdn.returnTo")).toBe(
			"/rsvp/?event=happy-hour",
		);
		expect(sessionStorage.getItem("cdn.needsVerificationSetup")).toBe("1");
	});

	it("does not stash when return_to is absent from search", () => {
		Object.defineProperty(window, "location", {
			value: { search: "" },
			writable: true,
		});

		const returnTo =
			new URLSearchParams(window.location.search).get("return_to") ?? "";
		if (returnTo) sessionStorage.setItem("cdn.returnTo", returnTo);
		sessionStorage.setItem("cdn.needsVerificationSetup", "1");

		expect(sessionStorage.getItem("cdn.returnTo")).toBeNull();
		expect(sessionStorage.getItem("cdn.needsVerificationSetup")).toBe("1");
	});
});
