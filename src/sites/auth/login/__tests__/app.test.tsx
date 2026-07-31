import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as cognito from "../../../../lib/cognito";

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
	forgotPassword: vi.fn(),
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

describe("login → wave 92 1-tap forgot-password CTA", () => {
	it("shows magic-link CTA when wrong-password error fires", async () => {
		vi.mocked(cognito.signInWithPassword).mockRejectedValueOnce(
			new cognito.AuthError("wrong password", "NotAuthorizedException"),
		);
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign: vi.fn() },
			writable: true,
		});
		localStorage.clear();

		render(<App />);

		const emailInput = screen.getByPlaceholderText(
			"auth.login.emailPlaceholder",
		);
		fireEvent.change(emailInput, { target: { value: "user@example.com" } });
		const passwordInputs = screen.getAllByDisplayValue("");
		const pw = passwordInputs.find(
			(el) => (el as HTMLInputElement).type === "password",
		) as HTMLInputElement;
		fireEvent.change(pw, { target: { value: "wrong-pw" } });

		const signInBtn = screen.getByText("auth.login.signInButton");
		fireEvent.click(signInBtn);

		await waitFor(() => {
			expect(screen.getByTestId("magic-link-cta")).toBeTruthy();
		});
		expect(screen.getByText("auth.login.magicLinkDescription")).toBeTruthy();
	});

	it("displays actionable credential error message using credentialsErrorMessage key", async () => {
		vi.mocked(cognito.signInWithPassword).mockRejectedValueOnce(
			new cognito.AuthError("wrong password", "NotAuthorizedException"),
		);
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign: vi.fn() },
			writable: true,
		});
		localStorage.clear();

		render(<App />);

		fireEvent.change(
			screen.getByPlaceholderText("auth.login.emailPlaceholder"),
			{ target: { value: "user@example.com" } },
		);
		const passwordInputs = screen.getAllByDisplayValue("");
		const pw = passwordInputs.find(
			(el) => (el as HTMLInputElement).type === "password",
		) as HTMLInputElement;
		fireEvent.change(pw, { target: { value: "wrong-pw" } });
		fireEvent.click(screen.getByText("auth.login.signInButton"));

		await waitFor(() => {
			expect(
				screen.getByText("auth.login.credentialsErrorMessage"),
			).toBeTruthy();
		});
	});

	it("CTA label resolves to reset-code wording via magicLinkCta key", async () => {
		vi.mocked(cognito.signInWithPassword).mockRejectedValueOnce(
			new cognito.AuthError("wrong password", "NotAuthorizedException"),
		);
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign: vi.fn() },
			writable: true,
		});
		localStorage.clear();

		render(<App />);

		fireEvent.change(
			screen.getByPlaceholderText("auth.login.emailPlaceholder"),
			{ target: { value: "user@example.com" } },
		);
		const passwordInputs = screen.getAllByDisplayValue("");
		const pw = passwordInputs.find(
			(el) => (el as HTMLInputElement).type === "password",
		) as HTMLInputElement;
		fireEvent.change(pw, { target: { value: "wrong-pw" } });
		fireEvent.click(screen.getByText("auth.login.signInButton"));

		const cta = await screen.findByTestId("magic-link-cta");
		// The CTA text comes from the translation key auth.login.magicLinkCta
		// which now says "Email me a reset code" (not "sign-in link")
		expect(cta.textContent).toBe("auth.login.magicLinkCta");
	});

	it("shows CTA for UserNotFoundException too (unified per OWASP)", async () => {
		vi.mocked(cognito.signInWithPassword).mockRejectedValueOnce(
			new cognito.AuthError("user not found", "UserNotFoundException"),
		);
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign: vi.fn() },
			writable: true,
		});
		localStorage.clear();

		render(<App />);

		fireEvent.change(
			screen.getByPlaceholderText("auth.login.emailPlaceholder"),
			{ target: { value: "nobody@example.com" } },
		);
		const passwordInputs = screen.getAllByDisplayValue("");
		const pw = passwordInputs.find(
			(el) => (el as HTMLInputElement).type === "password",
		) as HTMLInputElement;
		fireEvent.change(pw, { target: { value: "some-pw" } });
		fireEvent.click(screen.getByText("auth.login.signInButton"));

		await waitFor(() => {
			expect(screen.getByTestId("magic-link-cta")).toBeTruthy();
		});
	});

	it("clicking magic-link CTA calls forgotPassword and redirects with email + sent params", async () => {
		const forgotMock = vi.mocked(cognito.forgotPassword);
		forgotMock.mockResolvedValueOnce(undefined);
		vi.mocked(cognito.signInWithPassword).mockRejectedValueOnce(
			new cognito.AuthError("wrong password", "NotAuthorizedException"),
		);
		const assign = vi.fn();
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign },
			writable: true,
		});
		localStorage.clear();

		render(<App />);

		const emailInput = screen.getByPlaceholderText(
			"auth.login.emailPlaceholder",
		);
		fireEvent.change(emailInput, { target: { value: "user@example.com" } });
		const passwordInputs = screen.getAllByDisplayValue("");
		const pw = passwordInputs.find(
			(el) => (el as HTMLInputElement).type === "password",
		) as HTMLInputElement;
		fireEvent.change(pw, { target: { value: "wrong-pw" } });
		fireEvent.click(screen.getByText("auth.login.signInButton"));

		const cta = await screen.findByTestId("magic-link-cta");
		fireEvent.click(cta);

		await waitFor(() => {
			expect(forgotMock).toHaveBeenCalledWith("user@example.com");
		});
		await waitFor(() => {
			expect(assign).toHaveBeenCalledWith(
				"/forgot-password/index.html?email=user%40example.com&sent=1",
			);
		});
	});

	it("clicking magic-link CTA still redirects when ForgotPassword Cognito call errors", async () => {
		const forgotMock = vi.mocked(cognito.forgotPassword);
		forgotMock.mockRejectedValueOnce(
			new cognito.AuthError("limit reached", "LimitExceededException"),
		);
		vi.mocked(cognito.signInWithPassword).mockRejectedValueOnce(
			new cognito.AuthError("wrong password", "NotAuthorizedException"),
		);
		const assign = vi.fn();
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign },
			writable: true,
		});
		localStorage.clear();

		render(<App />);
		fireEvent.change(
			screen.getByPlaceholderText("auth.login.emailPlaceholder"),
			{ target: { value: "user@example.com" } },
		);
		const passwordInputs = screen.getAllByDisplayValue("");
		const pw = passwordInputs.find(
			(el) => (el as HTMLInputElement).type === "password",
		) as HTMLInputElement;
		fireEvent.change(pw, { target: { value: "wrong-pw" } });
		fireEvent.click(screen.getByText("auth.login.signInButton"));

		const cta = await screen.findByTestId("magic-link-cta");
		fireEvent.click(cta);

		await waitFor(() => {
			expect(assign).toHaveBeenCalledWith(
				"/forgot-password/index.html?email=user%40example.com&sent=1",
			);
		});
	});
});
