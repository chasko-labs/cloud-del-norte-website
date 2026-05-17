import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cognito from "../../../../lib/cognito";

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
		vi.mocked(cognito.getAccessToken).mockReturnValue("fake-token");
		vi.mocked(cognito.setUserAttribute).mockResolvedValue(undefined as never);
		vi.mocked(cognito.associateSoftwareTokenWithAccessToken).mockResolvedValue(
			undefined as never,
		);
	});

	it("redirects to login and sets session flag when no access token", () => {
		vi.mocked(cognito.getAccessToken).mockReturnValue(null);

		const assign = vi.fn();
		Object.defineProperty(window, "location", {
			value: {
				assign,
				href: "https://auth.clouddelnorte.org/verification-setup/",
			},
			writable: true,
		});

		render(<App />);

		// assign is called synchronously during render when no token
		expect(assign).toHaveBeenCalledWith("/login/index.html");
		expect(sessionStorage.getItem("cdn.needsVerificationSetup")).toBe("1");
	});

	it("renders three method options when authenticated", async () => {
		setAuthSession();
		render(<App />);

		await waitFor(() => {
			expect(
				screen.getByText(/authenticator app \(TOTP\)/i),
			).toBeInTheDocument();
		});
		expect(screen.getByText(/passkey \(biometric/i)).toBeInTheDocument();
		expect(screen.getAllByText(/skip for now/i).length).toBeGreaterThanOrEqual(
			1,
		);
	});

	it("passkey selection + continue navigates to passkeys page", async () => {
		setAuthSession();
		const assign = vi.fn();
		Object.defineProperty(window, "location", {
			value: {
				assign,
				href: "https://auth.clouddelnorte.org/verification-setup/",
			},
			writable: true,
		});

		render(<App />);

		await waitFor(() => screen.getByText(/passkey \(biometric/i));
		const radios = screen.getAllByRole("radio");
		fireEvent.click(radios[1]); // passkey
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));

		await waitFor(() => {
			expect(assign).toHaveBeenCalledWith("/passkeys/index.html");
		});
	});

	it("skip selection calls setUserAttribute and redirects to feed", async () => {
		setAuthSession();
		const assign = vi.fn();
		Object.defineProperty(window, "location", {
			value: {
				assign,
				href: "https://auth.clouddelnorte.org/verification-setup/",
			},
			writable: true,
		});

		render(<App />);

		await waitFor(() => screen.getAllByText(/skip for now/i));
		const radios = screen.getAllByRole("radio");
		fireEvent.click(radios[2]); // skip
		fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));

		await waitFor(() => {
			expect(cognito.setUserAttribute).toHaveBeenCalledWith(
				"custom:verificationSkipped",
				"1",
			);
			expect(assign).toHaveBeenCalledWith(
				expect.stringContaining("awsug.clouddelnorte.org/auth/redeem"),
			);
		});
	});

	it("TOTP selection + continue shows QR code step", async () => {
		vi.mocked(cognito.associateSoftwareTokenWithAccessToken).mockResolvedValue({
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
	});
});
