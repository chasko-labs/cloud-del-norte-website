// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { QRCodeSVG } from "qrcode.react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import {
	type AuthChallenge,
	AuthError,
	assertNonEmpty,
	associateSoftwareToken,
	base64urlToBuffer,
	completePasskeyAuth,
	forgotPassword,
	initiatePasskeyAuth,
	respondToMfaChallenge,
	signInWithPassword,
	verifySoftwareToken,
} from "../../../lib/cognito";
import AuthLayout from "../_layout";
import { stashReturnTo } from "../_shared/return-to";

const AWSUG_ORIGIN = "https://awsug.clouddelnorte.org";

type Step = "credentials" | "mfa-setup" | "mfa-verify";

function redirectWithTokens() {
	const idToken = sessionStorage.getItem("cdn.idToken") ?? "";
	const accessToken = sessionStorage.getItem("cdn.accessToken") ?? "";
	const refreshToken = sessionStorage.getItem("cdn.refreshToken") ?? "";
	const returnTo =
		new URLSearchParams(window.location.search).get("return_to") ?? "";

	// After new account email verify, send to verification-setup before the feed
	if (sessionStorage.getItem("cdn.needsVerificationSetup") === "1") {
		sessionStorage.removeItem("cdn.needsVerificationSetup");
		stashReturnTo(returnTo);
		window.location.assign(
			`/verification-setup/index.html${window.location.search}`,
		);
		return;
	}

	const fragment = `id_token=${encodeURIComponent(idToken)}&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&return_to=${encodeURIComponent(returnTo)}`;
	window.location.assign(`${AWSUG_ORIGIN}/auth/redeem/index.html#${fragment}`);
}

function LoginForm() {
	const { t } = useTranslation();
	const [email, setEmail] = useState(
		() => localStorage.getItem("cdn.passkey_email") ?? "",
	);
	const _passkeyAutoRef = useRef(false);
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [emailError, setEmailError] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [formError, setFormError] = useState("");
	const [loading, setLoading] = useState(false);

	const [step, setStep] = useState<Step>("credentials");
	const [mfaSession, setMfaSession] = useState("");
	const [mfaCode, setMfaCode] = useState("");
	const [totpSecret, setTotpSecret] = useState("");
	const [challengeName, setChallengeName] = useState("");
	const [cancelModalVisible, setCancelModalVisible] = useState(false);
	const [magicLinkLoading, setMagicLinkLoading] = useState(false);
	const [magicLinkError, setMagicLinkError] = useState("");
	const [showCredentialHelp, setShowCredentialHelp] = useState(false);
	const [passkeyPlatformAvailable, setPasskeyPlatformAvailable] =
		useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				if (
					window.PublicKeyCredential &&
					typeof window.PublicKeyCredential
						.isUserVerifyingPlatformAuthenticatorAvailable === "function"
				) {
					const available =
						await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
					if (!cancelled) setPasskeyPlatformAvailable(available);
				}
			} catch {
				// Feature detection failed — treat as unavailable
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	document.title = `${t("auth.login.title")} — ${t("auth.siteTitle")}`;

	function validate(): boolean {
		let valid = true;
		setEmailError("");
		setPasswordError("");
		try {
			assertNonEmpty(email, t("auth.login.emailLabel"));
		} catch {
			setEmailError(`${t("auth.login.emailLabel")} is required`);
			valid = false;
		}
		try {
			assertNonEmpty(password, t("auth.login.passwordLabel"));
		} catch {
			setPasswordError(`${t("auth.login.passwordLabel")} is required`);
			valid = false;
		}
		return valid;
	}

	async function handlePasskeyLogin() {
		setLoading(true);
		setFormError("");
		setEmailError("");
		try {
			const passkeyEmail =
				email.trim() || localStorage.getItem("cdn.passkey_email") || "";

			if (!passkeyEmail) {
				// Cognito InitiateAuth requires a USERNAME — we cannot start the
				// WebAuthn ceremony without knowing which user to authenticate.
				// The email field has autoComplete="username webauthn" so the
				// browser will offer a saved passkey via conditional UI in the
				// autofill dropdown, which then fills the email AND submits.
				// If the user clicks the button without typing, point them at the
				// email field rather than triggering a wasted biometric prompt.
				setEmailError(
					"enter your email first — your passkey will be offered automatically",
				);
				setLoading(false);
				return;
			}

			const { session, credentials } = await initiatePasskeyAuth(passkeyEmail);
			const publicKey =
				((credentials as Record<string, unknown>).publicKey as Record<
					string,
					unknown
				>) ?? (credentials as Record<string, unknown>);
			publicKey.challenge = base64urlToBuffer(publicKey.challenge as string);
			if (publicKey.allowCredentials) {
				publicKey.allowCredentials = (
					publicKey.allowCredentials as Array<Record<string, unknown>>
				).map((c) => ({ ...c, id: base64urlToBuffer(c.id as string) }));
			}
			const assertion = (await navigator.credentials.get({
				publicKey: publicKey as unknown as PublicKeyCredentialRequestOptions,
			})) as PublicKeyCredential;
			if (!assertion) throw new AuthError("passkey cancelled");
			await completePasskeyAuth(session, assertion);
			// Persist email so the next sign-in pre-fills the field.
			localStorage.setItem("cdn.passkey_email", passkeyEmail);
			redirectWithTokens();
		} catch (err) {
			if (err instanceof AuthError) {
				const passkeyErrorMap: Record<string, string> = {
					PasskeyNoCredential: "auth.login.passkeyNoCredential",
					PasskeyServerError: "auth.login.passkeyServerError",
					PasskeyAuthFlowNotEnabled: "auth.login.passkeyServerError",
					MissingCredentialRequestOptions: "auth.login.passkeyNotEnrolled",
				};
				const key = err.code ? passkeyErrorMap[err.code] : undefined;
				if (key === "auth.login.passkeyNotEnrolled") {
					setFormError(key);
				} else {
					setFormError(key ? t(key) : err.message);
				}
			} else if (
				err instanceof DOMException ||
				(err instanceof Error && err.name === "NotAllowedError")
			) {
				setFormError(t("auth.login.passkeyPlatformUnavailable"));
			} else {
				setFormError(
					err instanceof Error
						? err.message
						: t("auth.login.passkeyServerError"),
				);
			}
			setLoading(false);
		}
	}

	// Auto-trigger passkey disabled — Cognito user pool WebAuthn configuration
	// is incomplete (CredentialRequestOptions missing from challenge response).
	// Users can still click "Sign in with passkey" manually if they want to try.
	// Re-enable once Cognito WebAuthn is properly configured.

	async function handleCredentialsSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!validate()) return;
		setLoading(true);
		setFormError("");
		setMagicLinkError("");
		setShowCredentialHelp(false);
		try {
			sessionStorage.setItem("cdn.mfaUsername", email);
			const result = await signInWithPassword(email, password);
			if (result.type === "success") {
				localStorage.setItem("cdn.passkey_email", email);
				redirectWithTokens();
				return;
			}
			await handleChallenge(result.challenge);
		} catch (err) {
			if (
				err instanceof AuthError &&
				(err.code === "NotAuthorizedException" ||
					err.code === "UserNotFoundException")
			) {
				setFormError(t("auth.login.credentialsErrorMessage"));
				setShowCredentialHelp(true);
			} else {
				setFormError(t("auth.login.genericError"));
				setShowCredentialHelp(false);
			}
			setLoading(false);
		}
	}

	async function handleSendMagicLink() {
		setMagicLinkError("");
		if (!email.trim()) {
			setMagicLinkError(t("auth.login.magicLinkEmailRequired"));
			return;
		}
		setMagicLinkLoading(true);
		try {
			// Always advance to the reset page even if Cognito errors —
			// matches forgot-password's existing pattern of not revealing
			// whether the email exists.
			try {
				await forgotPassword(email.trim());
			} catch {
				// swallow; advance regardless
			}
			const params = new URLSearchParams({
				email: email.trim(),
				sent: "1",
			});
			window.location.assign(
				`/forgot-password/index.html?${params.toString()}`,
			);
		} finally {
			setMagicLinkLoading(false);
		}
	}

	async function handleChallenge(challenge: AuthChallenge) {
		setChallengeName(challenge.challengeName);
		setMfaSession(challenge.session);
		if (challenge.challengeName === "MFA_SETUP") {
			const { secretCode, session } = await associateSoftwareToken(
				challenge.session,
			);
			setTotpSecret(secretCode);
			setMfaSession(session);
			setStep("mfa-setup");
		} else {
			setStep("mfa-verify");
		}
		setLoading(false);
	}

	async function handleMfaSetupSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormError("");
		setLoading(true);
		try {
			const session = await verifySoftwareToken(mfaSession, mfaCode);
			await respondToMfaChallenge(session, mfaCode, "MFA_SETUP");
			localStorage.setItem("cdn.passkey_email", email);
			redirectWithTokens();
		} catch (err) {
			setFormError(
				err instanceof AuthError ? err.message : "Verification failed",
			);
			setLoading(false);
		}
	}

	async function handleMfaVerifySubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormError("");
		setLoading(true);
		try {
			await respondToMfaChallenge(mfaSession, mfaCode, challengeName);
			localStorage.setItem("cdn.passkey_email", email);
			redirectWithTokens();
		} catch (err) {
			setFormError(
				err instanceof AuthError ? err.message : "Verification failed",
			);
			setLoading(false);
		}
	}

	function handleCancelConfirm() {
		setCancelModalVisible(false);
		setStep("credentials");
		setMfaSession("");
		setTotpSecret("");
		setMfaCode("");
		setFormError("");
		setLoading(false);
	}

	if (step === "mfa-setup") {
		const otpauthUri = `otpauth://totp/CloudDelNorte:${encodeURIComponent(email)}?secret=${totpSecret}&issuer=CloudDelNorte`;
		return (
			<div className="cdn-auth-form-inner">
				<Modal
					visible={cancelModalVisible}
					onDismiss={() => setCancelModalVisible(false)}
					header={t("auth.login.mfaSetup.cancelConfirmTitle")}
					footer={
						<Box float="right">
							<SpaceBetween direction="horizontal" size="xs">
								<Button variant="link" onClick={handleCancelConfirm}>
									{t("auth.login.mfaSetup.cancelConfirmYes")}
								</Button>
								<Button
									variant="primary"
									onClick={() => setCancelModalVisible(false)}
								>
									{t("auth.login.mfaSetup.cancelConfirmStay")}
								</Button>
							</SpaceBetween>
						</Box>
					}
				>
					{t("auth.login.mfaSetup.cancelConfirmBody")}
				</Modal>
				<form
					onSubmit={(e) => {
						void handleMfaSetupSubmit(e);
					}}
					noValidate
				>
					<Form
						actions={
							<SpaceBetween direction="horizontal" size="xs">
								<Button
									variant="link"
									onClick={() => setCancelModalVisible(true)}
									formAction="none"
								>
									{t("auth.login.mfaSetup.cancelButton")}
								</Button>
								<Button formAction="submit" variant="primary" loading={loading}>
									Verify & sign in
								</Button>
							</SpaceBetween>
						}
						errorText={formError || undefined}
					>
						<SpaceBetween size="m">
							<Alert
								type="warning"
								header={t("auth.login.mfaSetup.hostageHeader")}
							>
								{t("auth.login.mfaSetup.hostageBody")}
							</Alert>
							<Alert type="info" header={t("auth.login.mfaSetup.alertHeader")}>
								<SpaceBetween size="xs">
									<Box variant="p">{t("auth.login.mfaSetup.description")}</Box>
									<Box variant="p">
										{t("auth.login.mfaSetup.downloadLabel")}{" "}
										<Link
											external
											href="https://apps.apple.com/app/google-authenticator/id388497605"
										>
											{t("auth.login.mfaSetup.googleIos")}
										</Link>
										{", "}
										<Link
											external
											href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
										>
											{t("auth.login.mfaSetup.googleAndroid")}
										</Link>
										{", "}
										{t("auth.login.mfaSetup.otherOptions")}
									</Box>
								</SpaceBetween>
							</Alert>
							<Box variant="p">
								Scan this QR code with your authenticator app:
							</Box>
							<Box variant="div" textAlign="center">
								<QRCodeSVG value={otpauthUri} size={180} level="M" />
							</Box>
							<Box variant="small" color="text-body-secondary">
								Or enter this secret manually:
							</Box>
							<Box variant="code">
								<span style={{ fontFamily: "monospace", userSelect: "all" }}>
									{totpSecret}
								</span>
							</Box>
							<Box variant="small">
								<Link href={otpauthUri} external>
									Open in authenticator app
								</Link>
							</Box>
							<FormField label="6-digit code from your authenticator">
								<Input
									type="text"
									value={mfaCode}
									onChange={({ detail }) => setMfaCode(detail.value)}
									inputMode="numeric"
									autoFocus
								/>
							</FormField>
						</SpaceBetween>
					</Form>
				</form>
			</div>
		);
	}

	if (step === "mfa-verify") {
		return (
			<div className="cdn-auth-form-inner">
				<form
					onSubmit={(e) => {
						void handleMfaVerifySubmit(e);
					}}
					noValidate
				>
					<Form
						actions={
							<Button formAction="submit" variant="primary" loading={loading}>
								Verify & sign in
							</Button>
						}
						errorText={formError || undefined}
					>
						<SpaceBetween size="m">
							<FormField label="6-digit code from your authenticator">
								<Input
									type="text"
									value={mfaCode}
									onChange={({ detail }) => setMfaCode(detail.value)}
									inputMode="numeric"
									autoComplete="one-time-code"
									autoFocus
								/>
							</FormField>
						</SpaceBetween>
					</Form>
				</form>
			</div>
		);
	}

	return (
		<div className="cdn-auth-form-inner">
			<Box textAlign="center" margin={{ bottom: "m" }}>
				<Box fontSize="heading-m" fontWeight="bold">
					{t("auth.login.welcomeBack")}
				</Box>
			</Box>
			<form
				onSubmit={(e) => {
					void handleCredentialsSubmit(e);
				}}
				noValidate
			>
				<Form
					actions={
						<SpaceBetween direction="horizontal" size="xs">
							<Button formAction="submit" variant="primary" loading={loading}>
								{t("auth.login.signInButton")}
							</Button>
						</SpaceBetween>
					}
					errorText={
						formError && formError !== "auth.login.passkeyNotEnrolled"
							? formError
							: undefined
					}
				>
					<SpaceBetween size="m">
						<FormField
							label={t("auth.login.emailLabel")}
							errorText={emailError || undefined}
						>
							<Input
								type="email"
								value={email}
								onChange={({ detail }) => setEmail(detail.value)}
								placeholder={t("auth.login.emailPlaceholder")}
								autoFocus
								inputMode="email"
								autoComplete="username webauthn"
							/>
						</FormField>
						<FormField
							label={t("auth.login.passwordLabel")}
							errorText={passwordError || undefined}
						>
							<SpaceBetween size="xs">
								<Input
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={({ detail }) => setPassword(detail.value)}
								/>
								<Link onFollow={() => setShowPassword((p) => !p)}>
									{showPassword ? "Hide password" : "Show password"}
								</Link>
							</SpaceBetween>
						</FormField>
					</SpaceBetween>
				</Form>
			</form>
			{showCredentialHelp && (
				<Box margin={{ top: "m" }}>
					<Alert
						type="info"
						header={t("auth.login.magicLinkHeader")}
						action={
							<Button
								variant="primary"
								loading={magicLinkLoading}
								onClick={() => {
									void handleSendMagicLink();
								}}
								data-testid="magic-link-cta"
							>
								{t("auth.login.magicLinkCta")}
							</Button>
						}
					>
						<SpaceBetween size="xs">
							<Box variant="p">{t("auth.login.magicLinkDescription")}</Box>
							{magicLinkError && (
								<Box variant="small" color="text-status-error">
									{magicLinkError}
								</Box>
							)}
						</SpaceBetween>
					</Alert>
				</Box>
			)}
			<Box margin={{ top: "m" }} textAlign="center">
				<SpaceBetween size="xs">
					<Box fontSize="heading-s">
						<Link
							href={`/signup/index.html${typeof window !== "undefined" && window.location.search ? window.location.search : ""}`}
						>
							{t("auth.login.noAccount")} {t("auth.login.signUpLink")}
						</Link>
					</Box>
					<Link href="/forgot-password/index.html">
						{t("auth.login.forgotPassword")}
					</Link>
				</SpaceBetween>
			</Box>
			{passkeyPlatformAvailable && (
				<Box margin={{ top: "m" }} textAlign="center">
					<Button
						variant="link"
						onClick={() => {
							void handlePasskeyLogin();
						}}
						loading={loading}
					>
						{t("auth.login.passkeyButton")}
					</Button>
				</Box>
			)}
			{formError === "auth.login.passkeyNotEnrolled" && (
				<Box margin={{ top: "m" }}>
					<Alert type="info" data-testid="passkey-not-enrolled-alert">
						{t("auth.login.passkeyNotEnrolled")}{" "}
						<Link href="/passkeys/index.html">
							{t("auth.login.passkeyEnrollLink")}
						</Link>
					</Alert>
				</Box>
			)}
		</div>
	);
}

export default function App() {
	return (
		<AuthLayout pageContextKey="auth.login.pageContext">
			<LoginForm />
		</AuthLayout>
	);
}
