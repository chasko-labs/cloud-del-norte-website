// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import {
	AuthError,
	assertNonEmpty,
	confirmForgotPassword,
	forgotPassword,
	respondToMfaChallenge,
	signInWithPassword,
} from "../../../lib/cognito";
import AuthLayout from "../_layout";

type Phase = "request" | "reset" | "signing-in" | "mfa-verify" | "done";

function ForgotPasswordForm() {
	const { t } = useTranslation();
	document.title = `${t("auth.forgotPassword.title")} — ${t("auth.siteTitle")}`;

	// Read email + sent flags from URL — supports the wave 92 1-tap path:
	// login page sends ForgotPassword, then redirects here with ?email=X&sent=1
	// to skip the request phase entirely.
	const initialParams =
		typeof window !== "undefined"
			? new URLSearchParams(window.location.search)
			: new URLSearchParams();
	const initialEmail = initialParams.get("email")?.trim() ?? "";
	const arrivedFromOneTap = initialParams.get("sent") === "1";

	const [phase, setPhase] = useState<Phase>(
		initialEmail && arrivedFromOneTap ? "reset" : "request",
	);
	const [email, setEmail] = useState(initialEmail);
	const [code, setCode] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);

	const [emailError, setEmailError] = useState("");
	const [codeError, setCodeError] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [formError, setFormError] = useState("");
	const [loading, setLoading] = useState(false);
	const [submitState, setSubmitState] = useState<
		"idle" | "verifying" | "success" | "failed"
	>("idle");

	// MFA state for auto sign-in challenge handling
	const [mfaSession, setMfaSession] = useState("");
	const [mfaCode, setMfaCode] = useState("");
	const [mfaChallengeName, setMfaChallengeName] = useState("");

	const MAIN_ORIGIN = "https://clouddelnorte.org";

	function redirectWithTokens() {
		const idToken = sessionStorage.getItem("cdn.idToken") ?? "";
		const accessToken = sessionStorage.getItem("cdn.accessToken") ?? "";
		const refreshToken = sessionStorage.getItem("cdn.refreshToken") ?? "";
		const returnTo =
			new URLSearchParams(window.location.search).get("return_to") ?? "";

		let finalReturnTo = returnTo;
		if (returnTo.startsWith("/")) {
			finalReturnTo = `${MAIN_ORIGIN}${returnTo}`;
		} else if (!returnTo) {
			finalReturnTo = `${MAIN_ORIGIN}/`;
		}

		const fragment = `id_token=${encodeURIComponent(idToken)}&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&return_to=${encodeURIComponent(finalReturnTo)}`;
		window.location.assign(`${MAIN_ORIGIN}/auth/callback/#${fragment}`);
	}

	async function handleRequestCode(e: React.FormEvent) {
		e.preventDefault();
		setEmailError("");
		setFormError("");
		try {
			assertNonEmpty(email, t("auth.forgotPassword.emailLabel"));
		} catch {
			setEmailError(`${t("auth.forgotPassword.emailLabel")} is required`);
			return;
		}
		setLoading(true);
		setSubmitState("verifying");
		try {
			await forgotPassword(email);
			setSubmitState("success");
			window.setTimeout(() => {
				setPhase("reset");
				setSubmitState("idle");
			}, 500);
		} catch {
			// don't reveal whether email exists — still flash success then advance
			setSubmitState("success");
			window.setTimeout(() => {
				setPhase("reset");
				setSubmitState("idle");
			}, 500);
		} finally {
			setLoading(false);
		}
	}

	async function handleReset(e: React.FormEvent) {
		e.preventDefault();
		setCodeError("");
		setPasswordError("");
		setFormError("");
		let valid = true;
		try {
			assertNonEmpty(code, t("auth.forgotPassword.codeLabel"));
		} catch {
			setCodeError(`${t("auth.forgotPassword.codeLabel")} is required`);
			valid = false;
		}
		try {
			assertNonEmpty(newPassword, t("auth.forgotPassword.newPasswordLabel"));
		} catch {
			setPasswordError(
				`${t("auth.forgotPassword.newPasswordLabel")} is required`,
			);
			valid = false;
		}
		if (!valid) return;
		setLoading(true);
		setSubmitState("verifying");
		try {
			await confirmForgotPassword(email, code.trim(), newPassword);
			setSubmitState("success");
			// Auto sign-in: attempt to sign the user in with the new password
			setPhase("signing-in");
			try {
				sessionStorage.setItem("cdn.mfaUsername", email);
				const result = await signInWithPassword(email, newPassword);
				if (result.type === "success") {
					redirectWithTokens();
					return;
				}
				// MFA challenge — show the TOTP code entry step
				setMfaSession(result.challenge.session);
				setMfaChallengeName(result.challenge.challengeName);
				setPhase("mfa-verify");
				setLoading(false);
			} catch {
				// Sign-in failed — fall back to the manual "Back to sign in" UX
				setPhase("done");
				setLoading(false);
			}
		} catch (err) {
			if (err instanceof AuthError) {
				if (err.code === "CodeMismatchException") {
					setCodeError("Incorrect code — check your email and try again");
				} else if (err.code === "ExpiredCodeException") {
					setCodeError("Code expired — go back and request a new one");
				} else if (err.code === "InvalidPasswordException") {
					setPasswordError(t("auth.signup.weakPassword"));
				} else {
					setFormError(t("auth.forgotPassword.genericError"));
				}
			} else {
				setFormError(t("auth.forgotPassword.genericError"));
			}
			setSubmitState("failed");
			setLoading(false);
			window.setTimeout(() => setSubmitState("idle"), 400);
		}
	}

	async function handleMfaVerifySubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormError("");
		setLoading(true);
		try {
			await respondToMfaChallenge(mfaSession, mfaCode, mfaChallengeName);
			redirectWithTokens();
		} catch (err) {
			setFormError(
				err instanceof AuthError
					? err.message
					: t("auth.forgotPassword.genericError"),
			);
			setLoading(false);
		}
	}

	if (phase === "signing-in") {
		return (
			<div className="cdn-auth-form-inner">
				<SpaceBetween size="m">
					<Box textAlign="center" padding="xl">
						{t("auth.forgotPassword.signingIn")}
					</Box>
				</SpaceBetween>
			</div>
		);
	}

	if (phase === "mfa-verify") {
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
								{t("auth.forgotPassword.mfaVerifyButton")}
							</Button>
						}
						errorText={formError || undefined}
					>
						<SpaceBetween size="m">
							<Alert type="info">{t("auth.forgotPassword.mfaPrompt")}</Alert>
							<FormField label={t("auth.forgotPassword.mfaCodeLabel")}>
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

	if (phase === "done") {
		return (
			<div className="cdn-auth-form-inner">
				<SpaceBetween size="m">
					<Alert type="success">
						{t("auth.forgotPassword.successMessage")}
					</Alert>
					<Box textAlign="center">
						<Link href="/login/index.html">
							{t("auth.forgotPassword.backToSignIn")}
						</Link>
					</Box>
				</SpaceBetween>
			</div>
		);
	}

	if (phase === "reset") {
		return (
			<div className="cdn-auth-form-inner">
				<form
					onSubmit={(e) => {
						void handleReset(e);
					}}
					noValidate
				>
					<Form
						actions={
							<span className={`cdn-auth-submit-state ${submitState}`}>
								<Button formAction="submit" variant="primary" loading={loading}>
									{submitState === "verifying"
										? "Verifying with Cognito"
										: t("auth.forgotPassword.resetButton")}
								</Button>
								{submitState === "success" && (
									<span className="cdn-auth-success-check" aria-hidden="true">
										✓
									</span>
								)}
							</span>
						}
						errorText={formError || undefined}
					>
						<SpaceBetween size="m">
							{arrivedFromOneTap ? (
								<Alert
									type="success"
									header={t("auth.forgotPassword.codeSentHeader")}
								>
									{t("auth.forgotPassword.codeSentBody").replace(
										"{email}",
										email,
									)}
								</Alert>
							) : (
								<Box>We sent a reset code to {email}</Box>
							)}
							<FormField
								label={t("auth.forgotPassword.codeLabel")}
								errorText={codeError || undefined}
							>
								<Input
									value={code}
									onChange={({ detail }) => setCode(detail.value)}
									placeholder={t("auth.forgotPassword.codePlaceholder")}
									inputMode="numeric"
									autoFocus
								/>
							</FormField>
							<FormField
								label={t("auth.forgotPassword.newPasswordLabel")}
								description={t("auth.forgotPassword.newPasswordHint")}
								errorText={passwordError || undefined}
							>
								<SpaceBetween size="xs">
									<Input
										type={showPassword ? "text" : "password"}
										value={newPassword}
										onChange={({ detail }) => setNewPassword(detail.value)}
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
					<Link onFollow={() => setPhase("request")}>
						Back — request new code
					</Link>
				</Box>
			</div>
		);
	}

	return (
		<div className="cdn-auth-form-inner">
			<form
				onSubmit={(e) => {
					void handleRequestCode(e);
				}}
				noValidate
			>
				<Form
					actions={
						<span className={`cdn-auth-submit-state ${submitState}`}>
							<Button formAction="submit" variant="primary" loading={loading}>
								{submitState === "verifying"
									? "Sending reset code"
									: t("auth.forgotPassword.sendCodeButton")}
							</Button>
							{submitState === "success" && (
								<span className="cdn-auth-success-check" aria-hidden="true">
									✓
								</span>
							)}
						</span>
					}
					errorText={formError || undefined}
				>
					<SpaceBetween size="m">
						<FormField
							label={t("auth.forgotPassword.emailLabel")}
							errorText={emailError || undefined}
						>
							<Input
								type="email"
								value={email}
								onChange={({ detail }) => setEmail(detail.value)}
								placeholder={t("auth.forgotPassword.emailPlaceholder")}
								inputMode="email"
								autoFocus
							/>
						</FormField>
					</SpaceBetween>
				</Form>
			</form>
			<Box margin={{ top: "m" }} textAlign="center">
				<Link href="/login/index.html">
					{t("auth.forgotPassword.backToSignIn")}
				</Link>
			</Box>
		</div>
	);
}

export default function App() {
	return (
		<AuthLayout pageContext="Reset your password">
			<ForgotPasswordForm />
		</AuthLayout>
	);
}
