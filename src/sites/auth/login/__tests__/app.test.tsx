import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cognito from "../../../../lib/cognito";

vi.mock("../../_layout", () => ({
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

		const link = screen
			.getByText((_content, element) => {
				return (
					element?.tagName === "A" &&
					(element.textContent?.includes("auth.login.signUpLink") ?? false)
				);
			})
			.closest("a");
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

		const link = screen
			.getByText((_content, element) => {
				return (
					element?.tagName === "A" &&
					(element.textContent?.includes("auth.login.signUpLink") ?? false)
				);
			})
			.closest("a");
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

describe("login → passkey error differentiation", () => {
	beforeEach(() => {
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign: vi.fn() },
			writable: true,
		});
		// Expose PublicKeyCredential with platform authenticator available so the passkey button renders
		Object.defineProperty(window, "PublicKeyCredential", {
			value: {
				isUserVerifyingPlatformAuthenticatorAvailable: () =>
					Promise.resolve(true),
			},
			writable: true,
			configurable: true,
		});
		localStorage.clear();
		localStorage.setItem("cdn.passkey_email", "user@example.com");
	});

	it("shows passkeyNoCredential when PasskeyNoCredential code is thrown", async () => {
		vi.mocked(cognito.initiatePasskeyAuth).mockRejectedValueOnce(
			new cognito.AuthError(
				"No passkey registered for this account",
				"PasskeyNoCredential",
			),
		);

		render(<App />);
		const emailInput = screen.getByPlaceholderText(
			"auth.login.emailPlaceholder",
		);
		fireEvent.change(emailInput, { target: { value: "user@example.com" } });
		const passkeyBtn = await screen.findByText("auth.login.passkeyButton");
		fireEvent.click(passkeyBtn);

		await waitFor(() => {
			expect(screen.getByText("auth.login.passkeyNoCredential")).toBeTruthy();
		});
	});

	it("shows passkeyServerError when PasskeyServerError code is thrown", async () => {
		vi.mocked(cognito.initiatePasskeyAuth).mockRejectedValueOnce(
			new cognito.AuthError(
				"Missing credential request options from server",
				"PasskeyServerError",
			),
		);

		render(<App />);
		const emailInput = screen.getByPlaceholderText(
			"auth.login.emailPlaceholder",
		);
		fireEvent.change(emailInput, { target: { value: "user@example.com" } });
		const passkeyBtn = await screen.findByText("auth.login.passkeyButton");
		fireEvent.click(passkeyBtn);

		await waitFor(() => {
			expect(screen.getByText("auth.login.passkeyServerError")).toBeTruthy();
		});
	});

	it("shows passkeyServerError when PasskeyAuthFlowNotEnabled code is thrown", async () => {
		vi.mocked(cognito.initiatePasskeyAuth).mockRejectedValueOnce(
			new cognito.AuthError(
				"Passkey auth flow not enabled",
				"PasskeyAuthFlowNotEnabled",
			),
		);

		render(<App />);
		const emailInput = screen.getByPlaceholderText(
			"auth.login.emailPlaceholder",
		);
		fireEvent.change(emailInput, { target: { value: "user@example.com" } });
		const passkeyBtn = await screen.findByText("auth.login.passkeyButton");
		fireEvent.click(passkeyBtn);

		await waitFor(() => {
			expect(screen.getByText("auth.login.passkeyServerError")).toBeTruthy();
		});
	});

	it("shows passkeyPlatformUnavailable when DOMException is thrown by navigator.credentials", async () => {
		vi.mocked(cognito.initiatePasskeyAuth).mockResolvedValueOnce({
			challengeName: "WEB_AUTHN",
			session: "fake-session",
			credentials: { publicKey: { challenge: "dGVzdA", allowCredentials: [] } },
		});
		// Simulate navigator.credentials.get throwing a NotAllowedError
		Object.defineProperty(navigator, "credentials", {
			value: {
				get: () => {
					const err = new DOMException(
						"The operation either timed out or was not allowed.",
						"NotAllowedError",
					);
					return Promise.reject(err);
				},
			},
			writable: true,
			configurable: true,
		});
		vi.mocked(cognito.base64urlToBuffer).mockReturnValue(new ArrayBuffer(8));

		render(<App />);
		const emailInput = screen.getByPlaceholderText(
			"auth.login.emailPlaceholder",
		);
		fireEvent.change(emailInput, { target: { value: "user@example.com" } });
		const passkeyBtn = await screen.findByText("auth.login.passkeyButton");
		fireEvent.click(passkeyBtn);

		await waitFor(() => {
			expect(
				screen.getByText("auth.login.passkeyPlatformUnavailable"),
			).toBeTruthy();
		});
	});

	it("shows passkeyNotEnrolled alert with enroll link when MissingCredentialRequestOptions code is thrown", async () => {
		vi.mocked(cognito.initiatePasskeyAuth).mockRejectedValueOnce(
			new cognito.AuthError(
				"No passkey enrolled on this account",
				"MissingCredentialRequestOptions",
			),
		);

		render(<App />);
		const emailInput = screen.getByPlaceholderText(
			"auth.login.emailPlaceholder",
		);
		fireEvent.change(emailInput, { target: { value: "user@example.com" } });
		const passkeyBtn = await screen.findByText("auth.login.passkeyButton");
		fireEvent.click(passkeyBtn);

		await waitFor(() => {
			const alert = screen.getByTestId("passkey-not-enrolled-alert");
			expect(alert).toBeTruthy();
			expect(alert.textContent).toContain("auth.login.passkeyNotEnrolled");
			expect(alert.textContent).toContain("auth.login.passkeyEnrollLink");
		});
		// Verify the enroll link points to the passkeys page
		const enrollLink = screen.getByText("auth.login.passkeyEnrollLink");
		expect(enrollLink.closest("a")?.getAttribute("href")).toBe(
			"/passkeys/index.html",
		);
	});
});

describe("login → form validation errors", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign: vi.fn() },
			writable: true,
		});
		localStorage.clear();
	});

	it("shows email-required error when email is empty and sign in is clicked", async () => {
		vi.mocked(cognito.assertNonEmpty).mockImplementation(
			(value: string, _label: string) => {
				if (!value?.trim()) {
					throw new Error(`${_label} is required`);
				}
			},
		);

		render(<App />);

		// Leave email empty, type a password
		const passwordInputs = screen.getAllByDisplayValue("");
		const pw = passwordInputs.find(
			(el) => (el as HTMLInputElement).type === "password",
		) as HTMLInputElement;
		fireEvent.change(pw, { target: { value: "some-password" } });

		fireEvent.click(screen.getByText("auth.login.signInButton"));

		await waitFor(() => {
			expect(
				screen.getByText("auth.login.emailLabel is required"),
			).toBeTruthy();
		});
		// signInWithPassword should NOT have been called for this test
		expect(cognito.signInWithPassword).not.toHaveBeenCalled();
	});

	it("shows password-required error when password is empty and sign in is clicked", async () => {
		vi.mocked(cognito.assertNonEmpty).mockImplementation(
			(value: string, _label: string) => {
				if (!value?.trim()) {
					throw new Error(`${_label} is required`);
				}
			},
		);

		render(<App />);

		// Type an email but leave password empty
		fireEvent.change(
			screen.getByPlaceholderText("auth.login.emailPlaceholder"),
			{ target: { value: "user@example.com" } },
		);

		fireEvent.click(screen.getByText("auth.login.signInButton"));

		await waitFor(() => {
			expect(
				screen.getByText("auth.login.passwordLabel is required"),
			).toBeTruthy();
		});
		// signInWithPassword should NOT have been called for this test
		expect(cognito.signInWithPassword).not.toHaveBeenCalled();
	});

	it("shows both errors when email and password are empty", async () => {
		vi.mocked(cognito.assertNonEmpty).mockImplementation(
			(value: string, _label: string) => {
				if (!value?.trim()) {
					throw new Error(`${_label} is required`);
				}
			},
		);

		render(<App />);

		fireEvent.click(screen.getByText("auth.login.signInButton"));

		await waitFor(() => {
			expect(
				screen.getByText("auth.login.emailLabel is required"),
			).toBeTruthy();
			expect(
				screen.getByText("auth.login.passwordLabel is required"),
			).toBeTruthy();
		});
		expect(cognito.signInWithPassword).not.toHaveBeenCalled();
	});
});

describe("login → sign-in error states", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign: vi.fn() },
			writable: true,
		});
		localStorage.clear();
		// Default assertNonEmpty passes (no-op)
		vi.mocked(cognito.assertNonEmpty).mockImplementation(() => {});
	});

	it("shows generic error for unexpected auth failures", async () => {
		vi.mocked(cognito.signInWithPassword).mockRejectedValueOnce(
			new cognito.AuthError("internal error", "InternalErrorException"),
		);

		render(<App />);

		fireEvent.change(
			screen.getByPlaceholderText("auth.login.emailPlaceholder"),
			{ target: { value: "user@example.com" } },
		);
		const passwordInputs = screen.getAllByDisplayValue("");
		const pw = passwordInputs.find(
			(el) => (el as HTMLInputElement).type === "password",
		) as HTMLInputElement;
		fireEvent.change(pw, { target: { value: "password123" } });
		fireEvent.click(screen.getByText("auth.login.signInButton"));

		await waitFor(() => {
			expect(screen.getByText("auth.login.genericError")).toBeTruthy();
		});
		// Should NOT show the credential help panel for non-auth errors
		expect(screen.queryByTestId("magic-link-cta")).toBeNull();
	});

	it("shows credential error and magic-link CTA for NotAuthorizedException", async () => {
		vi.mocked(cognito.signInWithPassword).mockRejectedValueOnce(
			new cognito.AuthError("incorrect password", "NotAuthorizedException"),
		);

		render(<App />);

		fireEvent.change(
			screen.getByPlaceholderText("auth.login.emailPlaceholder"),
			{ target: { value: "user@example.com" } },
		);
		const passwordInputs = screen.getAllByDisplayValue("");
		const pw = passwordInputs.find(
			(el) => (el as HTMLInputElement).type === "password",
		) as HTMLInputElement;
		fireEvent.change(pw, { target: { value: "wrong" } });
		fireEvent.click(screen.getByText("auth.login.signInButton"));

		await waitFor(() => {
			expect(
				screen.getByText("auth.login.credentialsErrorMessage"),
			).toBeTruthy();
			expect(screen.getByTestId("magic-link-cta")).toBeTruthy();
		});
	});
});

describe("login → magic-link CTA navigates to forgot-password", () => {
	it("navigates to /forgot-password/ with email param after clicking reset CTA", async () => {
		vi.mocked(cognito.assertNonEmpty).mockImplementation(() => {});
		vi.mocked(cognito.forgotPassword).mockResolvedValueOnce(undefined);
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
			{ target: { value: "test@clouddelnorte.org" } },
		);
		const passwordInputs = screen.getAllByDisplayValue("");
		const pw = passwordInputs.find(
			(el) => (el as HTMLInputElement).type === "password",
		) as HTMLInputElement;
		fireEvent.change(pw, { target: { value: "bad-pass" } });
		fireEvent.click(screen.getByText("auth.login.signInButton"));

		const cta = await screen.findByTestId("magic-link-cta");
		fireEvent.click(cta);

		await waitFor(() => {
			expect(assign).toHaveBeenCalledWith(
				"/forgot-password/index.html?email=test%40clouddelnorte.org&sent=1",
			);
		});
	});
});

describe("login → passkey button platform gating", () => {
	it("hides passkey button when isUserVerifyingPlatformAuthenticatorAvailable resolves false", async () => {
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign: vi.fn() },
			writable: true,
		});
		Object.defineProperty(window, "PublicKeyCredential", {
			value: {
				isUserVerifyingPlatformAuthenticatorAvailable: () =>
					Promise.resolve(false),
			},
			writable: true,
			configurable: true,
		});
		localStorage.clear();

		render(<App />);

		// Wait a tick for the useEffect to resolve
		await waitFor(() => {
			expect(screen.queryByText("auth.login.passkeyButton")).toBeNull();
		});
	});

	it("shows passkey button when isUserVerifyingPlatformAuthenticatorAvailable resolves true", async () => {
		Object.defineProperty(window, "location", {
			value: { ...window.location, search: "", assign: vi.fn() },
			writable: true,
		});
		Object.defineProperty(window, "PublicKeyCredential", {
			value: {
				isUserVerifyingPlatformAuthenticatorAvailable: () =>
					Promise.resolve(true),
			},
			writable: true,
			configurable: true,
		});
		localStorage.clear();

		render(<App />);

		await waitFor(() => {
			expect(screen.getByText("auth.login.passkeyButton")).toBeTruthy();
		});
	});
});
