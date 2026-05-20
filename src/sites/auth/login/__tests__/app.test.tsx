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
