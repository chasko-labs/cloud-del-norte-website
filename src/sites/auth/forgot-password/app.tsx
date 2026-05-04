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
} from "../../../lib/cognito";
import AuthLayout from "../_layout";

type Phase = "request" | "reset" | "done";

function ForgotPasswordForm() {
	const { t } = useTranslation();
	document.title = t("auth.forgotPassword.title") + " — " + t("auth.siteTitle");

	const [phase, setPhase] = useState<Phase>("request");
	const [email, setEmail] = useState("");
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

	async function handleRequestCode(e: React.FormEvent) {
		e.preventDefault();
		setEmailError("");
		setFormError("");
		try {
			assertNonEmpty(email, t("auth.forgotPassword.emailLabel"));
		} catch {
			setEmailError(t("auth.forgotPassword.emailLabel") + " is required");
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
			setCodeError(t("auth.forgotPassword.codeLabel") + " is required");
			valid = false;
		}
		try {
			assertNonEmpty(newPassword, t("auth.forgotPassword.newPasswordLabel"));
		} catch {
			setPasswordError(
				t("auth.forgotPassword.newPasswordLabel") + " is required",
			);
			valid = false;
		}
		if (!valid) return;
		setLoading(true);
		setSubmitState("verifying");
		try {
			await confirmForgotPassword(email, code.trim(), newPassword);
			setSubmitState("success");
			window.setTimeout(() => setPhase("done"), 500);
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

	if (phase === "done") {
		return (
			<div className="cdn-auth-form-inner">
				<SpaceBetween size="m">
					<Alert type="success">
						Password updated — you can now sign in with your new password.
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
							<Box>We sent a reset code to {email}</Box>
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
