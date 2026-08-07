import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cognito from "../../../../lib/cognito";
import { ENABLE_TOTP_SETUP } from "../../../../lib/feature-flags";

vi.mock("../../../../lib/cognito", () => ({
	getAccessToken: vi.fn().mockReturnValue("fake-token"),
	setUserAttribute: vi.fn(),
	associateSoftwareTokenWithAccessToken: vi.fn(),
	verifySoftwareTokenWithAccessToken: vi.fn(),
	AuthError: class AuthError extends Error {
		constructor(
			message: string,
			public code?: string,
		) {
			super(message);
			this.name = "AuthError";
		}
	},
}));

// auth-context (used by Shell) imports these from lib/auth
vi.mock("../../../../lib/auth", () => ({
	getIdToken: vi.fn().mockReturnValue(null),
	decodeToken: vi.fn().mockReturnValue({ email: "test@example.com" }),
	signOut: vi.fn(),
	refreshTokens: vi.fn(),
	beginLogin: vi.fn(),
}));

vi.mock("qrcode.react", () => ({
	QRCodeSVG: () => <svg data-testid="qr-code" />,
}));

// Import after mocks are declared at module level
import App from "../index";

function setAuthSession() {
	sessionStorage.setItem(
		"cdn.idToken",
		"h.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.s",
	);
	sessionStorage.setItem("cdn.accessToken", "fake-access");
	sessionStorage.setItem("cdn.refreshToken", "fake-refresh");
}

describe("verification-setup page", () => {
	beforeEach(() => {
		sessionStorage.clear();
		Object.defineProperty(window, "location", {
			value: {
				assign: vi.fn(),
				href: "https://auth.clouddelnorte.org/verification-setup/",
				search: "",
			},
			writable: true,
		});
		vi.mocked(cognito.getAccessToken).mockReturnValue("fake-token");
		vi.mocked(cognito.setUserAttribute).mockResolvedValue(undefined as never);
		vi.mocked(cognito.associateSoftwareTokenWithAccessToken).mockResolvedValue(
			undefined as never,
		);
	});

	it("redirects to login and sets session flag when no access token", () => {
		vi.mocked(cognito.getAccessToken).mockReturnValue(null);

		render(<App />);

		expect(window.location.assign).toHaveBeenCalledWith("/login/index.html");
		expect(sessionStorage.getItem("cdn.needsVerificationSetup")).toBe("1");
	});

	it("renders method options when authenticated (TOTP hidden by default)", async () => {
		setAuthSession();
		render(<App />);

		await waitFor(() => {
			expect(screen.getByText(/passkey \(biometric/i)).toBeInTheDocument();
		});
		expect(screen.getAllByText(/skip for now/i).length).toBeGreaterThanOrEqual(
			1,
		);
		// TOTP should NOT be visible when flag is off
		if (!ENABLE_TOTP_SETUP) {
			expect(
				screen.queryByText(/authenticator app \(TOTP\)/i),
			).not.toBeInTheDocument();
		}
	});

	it("passkey selection + continue navigates to passkeys page", async () => {
		setAuthSession();

		render(<App />);

		await waitFor(() => screen.getByText(/passkey \(biometric/i));
		const radios = screen.getAllByRole("radio");
		// passkey is the first option when TOTP is hidden
		fireEvent.click(radios[ENABLE_TOTP_SETUP ? 1 : 0]);
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));

		await waitFor(() => {
			expect(window.location.assign).toHaveBeenCalledWith(
				"/passkeys/index.html",
			);
		});
	});

	it("skip selection calls setUserAttribute and redirects to feed", async () => {
		setAuthSession();

		render(<App />);

		await waitFor(() => screen.getAllByText(/skip for now/i));
		const radios = screen.getAllByRole("radio");
		// skip is the second option when TOTP is hidden
		fireEvent.click(radios[ENABLE_TOTP_SETUP ? 2 : 1]);
		fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));

		await waitFor(() => {
			expect(cognito.setUserAttribute).toHaveBeenCalledWith(
				"custom:verificationSkipped",
				"1",
			);
			expect(window.location.assign).toHaveBeenCalledWith(
				expect.stringContaining("awsug.clouddelnorte.org/auth/redeem"),
			);
		});
	});

	it.skipIf(!ENABLE_TOTP_SETUP)(
		"TOTP selection + continue shows QR code step",
		async () => {
			vi.mocked(
				cognito.associateSoftwareTokenWithAccessToken,
			).mockResolvedValue({
				secretCode: "JBSWY3DPEHPK3PXP",
			} as never);
			setAuthSession();
			render(<App />);

			await waitFor(() => screen.getByText(/authenticator app \(TOTP\)/i));
			// TOTP is default — click Continue
			fireEvent.click(screen.getByRole("button", { name: /continue/i }));

			await waitFor(() => {
				expect(screen.getByTestId("qr-code")).toBeInTheDocument();
			});
		},
	);

	it.skipIf(!ENABLE_TOTP_SETUP)(
		"verifySoftwareTokenWithAccessToken success redirects to feed",
		async () => {
			vi.mocked(
				cognito.associateSoftwareTokenWithAccessToken,
			).mockResolvedValue({
				secretCode: "JBSWY3DPEHPK3PXP",
			} as never);
			vi.mocked(cognito.verifySoftwareTokenWithAccessToken).mockResolvedValue(
				undefined as never,
			);
			setAuthSession();
			render(<App />);

			// navigate to QR step
			await waitFor(() => screen.getByText(/authenticator app \(TOTP\)/i));
			fireEvent.click(screen.getByRole("button", { name: /continue/i }));
			await waitFor(() => screen.getByTestId("qr-code"));

			// enter 6-digit code and submit
			const input = screen.getByRole("textbox");
			fireEvent.change(input, { target: { value: "123456" } });
			fireEvent.click(
				screen.getByRole("button", { name: /verify & continue/i }),
			);

			await waitFor(() => {
				expect(cognito.verifySoftwareTokenWithAccessToken).toHaveBeenCalledWith(
					"123456",
				);
				expect(window.location.assign).toHaveBeenCalledWith(
					expect.stringContaining("awsug.clouddelnorte.org/auth/redeem"),
				);
			});
		},
	);

	it.skipIf(!ENABLE_TOTP_SETUP)(
		"verifySoftwareTokenWithAccessToken failure shows inline error, stays on totp step",
		async () => {
			vi.mocked(
				cognito.associateSoftwareTokenWithAccessToken,
			).mockResolvedValue({
				secretCode: "JBSWY3DPEHPK3PXP",
			} as never);
			vi.mocked(cognito.verifySoftwareTokenWithAccessToken).mockRejectedValue(
				new cognito.AuthError("Code mismatch"),
			);
			setAuthSession();
			render(<App />);

			// navigate to QR step
			await waitFor(() => screen.getByText(/authenticator app \(TOTP\)/i));
			fireEvent.click(screen.getByRole("button", { name: /continue/i }));
			await waitFor(() => screen.getByTestId("qr-code"));

			// enter 6-digit code and submit
			const input = screen.getByRole("textbox");
			fireEvent.change(input, { target: { value: "999999" } });

			const verifyBtn = screen.getByRole("button", {
				name: /verify & continue/i,
			});
			fireEvent.click(verifyBtn);

			await waitFor(() =>
				expect(cognito.verifySoftwareTokenWithAccessToken).toHaveBeenCalled(),
			);
			// error shown — stays on totp step
			await waitFor(() =>
				expect(
					screen.getAllByText(/code mismatch|something went wrong/i).length,
				).toBeGreaterThan(0),
			);
			expect(
				screen.getByRole("button", { name: /verify & continue/i }),
			).toBeInTheDocument();
		},
	);

	it("redirectToFeed includes return_to from sessionStorage when search is empty", async () => {
		setAuthSession();
		sessionStorage.setItem("cdn.returnTo", "/rsvp/?event=happy-hour");

		render(<App />);

		await waitFor(() => screen.getAllByText(/skip for now/i));
		const radios = screen.getAllByRole("radio");
		fireEvent.click(radios[ENABLE_TOTP_SETUP ? 2 : 1]); // skip
		fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));

		await waitFor(() => {
			const url = (
				window.location.assign as ReturnType<typeof vi.fn>
			).mock.calls.at(-1)?.[0] as string;
			expect(url).toContain(
				`return_to=${encodeURIComponent("/rsvp/?event=happy-hour")}`,
			);
			// sessionStorage entry should be cleared after consumption
			expect(sessionStorage.getItem("cdn.returnTo")).toBeNull();
		});
	});

	it("redirectToFeed includes return_to from search when present", async () => {
		setAuthSession();
		Object.defineProperty(window, "location", {
			value: {
				assign: vi.fn(),
				href: "https://auth.clouddelnorte.org/verification-setup/",
				search: "?return_to=%2Frsvp%2F%3Fevent%3Dhappy-hour",
			},
			writable: true,
		});

		render(<App />);

		await waitFor(() => screen.getAllByText(/skip for now/i));
		const radios = screen.getAllByRole("radio");
		fireEvent.click(radios[ENABLE_TOTP_SETUP ? 2 : 1]); // skip
		fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));

		await waitFor(() => {
			const url = (
				window.location.assign as ReturnType<typeof vi.fn>
			).mock.calls.at(-1)?.[0] as string;
			expect(url).toContain(
				`return_to=${encodeURIComponent("/rsvp/?event=happy-hour")}`,
			);
		});
	});

	it("redirectToFeed sends empty return_to when nothing is stashed", async () => {
		setAuthSession();

		render(<App />);

		await waitFor(() => screen.getAllByText(/skip for now/i));
		const radios = screen.getAllByRole("radio");
		fireEvent.click(radios[ENABLE_TOTP_SETUP ? 2 : 1]); // skip
		fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));

		await waitFor(() => {
			const url = (
				window.location.assign as ReturnType<typeof vi.fn>
			).mock.calls.at(-1)?.[0] as string;
			expect(url).toContain("return_to=");
			// The value after return_to= should be empty (encoded empty string)
			const fragIdx = url.indexOf("#");
			const frag = url.slice(fragIdx + 1);
			const fragParams = new URLSearchParams(frag);
			expect(fragParams.get("return_to")).toBe("");
		});
	});
});
