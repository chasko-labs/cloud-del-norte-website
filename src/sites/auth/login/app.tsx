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
import { useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import {
	type AuthChallenge,
	AuthError,
	assertNonEmpty,
	associateSoftwareToken,
	base64urlToBuffer,
	completePasskeyAuth,
	initiatePasskeyAuth,
	respondToMfaChallenge,
	signInWithPassword,
	verifySoftwareToken,
} from "../../../lib/cognito";
import AuthLayout from "../_layout";

const AWSUG_ORIGIN = "https://awsug.clouddelnorte.org";

type Step = "credentials" | "mfa-setup" | "mfa-verify";

function redirectWithTokens() {
	const idToken = sessionStorage.getItem("cdn.idToken") ?? "";
	const accessToken = sessionStorage.getItem("cdn.accessToken") ?? "";
	const refreshToken = sessionStorage.getItem("cdn.refreshToken") ?? "";
	const returnTo =
		new URLSearchParams(window.location.search).get("return_to") ?? "";
	const fragment = `id_token=${encodeURIComponent(idToken)}&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&return_to=${encodeURIComponent(returnTo)}`;
	window.location.assign(`${AWSUG_ORIGIN}/auth/redeem/index.html#${fragment}`);
}

function LoginForm() {
	const { t } = useTranslation();
	const [email, setEmail] = useState(
		() => localStorage.getItem("cdn.passkey_email") ?? "",
	);
	const passkeyAutoRef = useRef(false);
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
			// Step 1: Try to get a passkey from the browser without specifying allowCredentials
			// This shows ALL available passkeys for clouddelnorte.org (discoverable credentials)
			let passkeyEmail =
				email.trim() || localStorage.getItem("cdn.passkey_email") || "";

			if (!passkeyEmail) {
				// No email known — try discoverable credential flow
				// Ask browser to show available passkeys without server round-trip
				const discoverResult = (await navigator.credentials.get({
					publicKey: {
						challenge: crypto.getRandomValues(new Uint8Array(32)),
						rpId: "clouddelnorte.org",
						userVerification: "preferred",
					},
				})) as PublicKeyCredential | null;

				if (!discoverResult) throw new AuthError("passkey cancelled");

				// Extract email from userHandle (Cognito stores the sub there)
				const response =
					discoverResult.response as AuthenticatorAssertionResponse;
				if (response.userHandle) {
					// userHandle is the Cognito user sub — we need to look up the email
					// For now, decode it as UTF-8 in case it's the email directly
					const decoded = new TextDecoder().decode(response.userHandle);
					// If it looks like an email, use it; otherwise it's a sub UUID
					if (decoded.includes("@")) {
						passkeyEmail = decoded;
					} else {
						// It's a sub — we can't use InitiateAuth without email
						// Fall back to asking for email
						setEmailError(
							"please enter your email to complete passkey sign-in",
						);
						setLoading(false);
						return;
					}
				} else {
					setEmailError("please enter your email to complete passkey sign-in");
					setLoading(false);
					return;
				}
			}

			// Step 2: Now we have the email — do the Cognito flow
			const { session, credentials } = await initiatePasskeyAuth(passkeyEmail);
			const publicKey = (credentials as any).publicKey ?? credentials;
			publicKey.challenge = base64urlToBuffer(publicKey.challenge);
			if (publicKey.allowCredentials) {
				publicKey.allowCredentials = publicKey.allowCredentials.map(
					(c: any) => ({ ...c, id: base64urlToBuffer(c.id) }),
				);
			}
			const assertion = (await navigator.credentials.get({
				publicKey,
			})) as PublicKeyCredential;
			if (!assertion) throw new AuthError("passkey cancelled");
			await completePasskeyAuth(session, assertion);
			redirectWithTokens();
		} catch (err) {
			setFormError(
				err instanceof AuthError ? err.message : "passkey login failed",
			);
			setLoading(false);
		}
	}

	// Auto-trigger passkey if user has one registered
	if (!passkeyAutoRef.current && localStorage.getItem("cdn.passkey_email")) {
		passkeyAutoRef.current = true;
		setTimeout(() => {
			void handlePasskeyLogin();
		}, 600);
	}

	async function handleCredentialsSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!validate()) return;
		setLoading(true);
		setFormError("");
		try {
			sessionStorage.setItem("cdn.mfaUsername", email);
			const result = await signInWithPassword(email, password);
			if (result.type === "success") {
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
				setFormError(t("auth.login.invalidCredentials"));
			} else {
				setFormError(t("auth.login.genericError"));
			}
			setLoading(false);
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
			redirectWithTokens();
		} catch (err) {
			setFormError(
				err instanceof AuthError ? err.message : "Verification failed",
			);
			setLoading(false);
		}
	}

	function handleCancelConfirm() {
		[
			"cdn.idToken",
			"cdn.accessToken",
			"cdn.refreshToken",
			"cdn.mfaUsername",
		].forEach((k) => {
			sessionStorage.removeItem(k);
			localStorage.removeItem(k);
		});
		window.location.assign("https://auth.clouddelnorte.org/index.html");
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
					errorText={formError || undefined}
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
			<Box margin={{ top: "m" }} textAlign="center">
				<SpaceBetween size="xs">
					<Link href="/forgot-password/index.html">
						{t("auth.login.forgotPassword")}
					</Link>
					<Link href="/signup/index.html">{t("auth.login.noAccount")}</Link>
				</SpaceBetween>
			</Box>
			{window.PublicKeyCredential && (
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
