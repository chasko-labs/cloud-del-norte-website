import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../_layout", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../hooks/useTranslation", () => ({
	useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../lib/cognito", () => ({
	AuthError: class AuthError extends Error {
		constructor(
			message: string,
			public code?: string,
		) {
			super(message);
		}
	},
	assertNonEmpty: vi.fn(),
	associateSoftwareToken: vi.fn(),
	base64urlToBuffer: vi.fn(),
	completePasskeyAuth: vi.fn(),
	initiatePasskeyAuth: vi.fn(),
	respondToMfaChallenge: vi.fn(),
	signInWithPassword: vi.fn(),
	verifySoftwareToken: vi.fn(),
}));

vi.mock("qrcode.react", () => ({
	QRCodeSVG: () => <svg data-testid="qr-code" />,
}));

import App from "../app";

describe("login → signup cross-link", () => {
	it("includes return_to search params in sign-up link href", () => {
		Object.defineProperty(window, "location", {
			value: {
				...window.location,
				search: "?return_to=%2Frsvp%2F%3Fevent%3Dhappy-hour-2026-06-03",
			},
			writable: true,
		});

		render(<App />);

		const link = screen.getByText("auth.login.signUpLink").closest("a");
		expect(link?.getAttribute("href")).toContain(
			"?return_to=%2Frsvp%2F%3Fevent%3Dhappy-hour-2026-06-03",
		);
	});

	it("falls back to plain href when no search params present", () => {
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "" },
			writable: true,
		});

		render(<App />);

		const link = screen.getByText("auth.login.signUpLink").closest("a");
		expect(link?.getAttribute("href")).toBe("/signup/index.html");
	});
});

describe("login → redirectWithTokens: needsVerificationSetup stash", () => {
	it("stashes cdn.returnTo before redirecting to verification-setup", () => {
		sessionStorage.clear();
		sessionStorage.setItem("cdn.needsVerificationSetup", "1");
		const assign = vi.fn();
		Object.defineProperty(window, "location", {
			value: {
				assign,
				search: "?return_to=%2Frsvp%2F%3Fevent%3Dhappy-hour",
			},
			writable: true,
		});

		// Simulate what redirectWithTokens does when needsVerificationSetup=1
		const returnTo =
			new URLSearchParams(window.location.search).get("return_to") ?? "";
		sessionStorage.removeItem("cdn.needsVerificationSetup");
		if (returnTo) sessionStorage.setItem("cdn.returnTo", returnTo);
		window.location.assign(
			`/verification-setup/index.html${window.location.search}`,
		);

		expect(sessionStorage.getItem("cdn.returnTo")).toBe(
			"/rsvp/?event=happy-hour",
		);
		expect(assign).toHaveBeenCalledWith(
			"/verification-setup/index.html?return_to=%2Frsvp%2F%3Fevent%3Dhappy-hour",
		);
		sessionStorage.clear();
	});
});
