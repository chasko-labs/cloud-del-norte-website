// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import {
	AuthError,
	assertNonEmpty,
	confirmSignUp,
	resendConfirmationCode,
} from "../../../lib/cognito";
import AuthLayout from "../_layout";
import CodeInput from "../_layout/CodeInput";

/* 120s gives users time to switch to authenticator/email apps and back
   without missing the resend window — was 30s, too short for app-switch UX */
const RESEND_COOLDOWN_SECS = 120;

function VerifyForm() {
	const { t } = useTranslation();
	document.title = t("auth.verify.title") + " — " + t("auth.siteTitle");

	const [email] = useState(
		() => new URLSearchParams(window.location.search).get("email") ?? "",
	);
	const [code, setCode] = useState("");
	const [codeError, setCodeError] = useState("");
	const [formError, setFormError] = useState("");
	const [loading, setLoading] = useState(false);
	const [submitState, setSubmitState] = useState<
		"idle" | "verifying" | "success" | "failed"
	>("idle");
	const [done, setDone] = useState(false);
	const [cooldown, setCooldown] = useState(0);
	const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(
		() => () => {
			if (cooldownRef.current) clearInterval(cooldownRef.current);
		},
		[],
	);

	function startCooldown() {
		setCooldown(RESEND_COOLDOWN_SECS);
		cooldownRef.current = setInterval(() => {
			setCooldown((prev) => {
				if (prev <= 1) {
					clearInterval(cooldownRef.current!);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setCodeError("");
		setFormError("");
		try {
			assertNonEmpty(code, t("auth.verify.codeLabel"));
		} catch {
			setCodeError(t("auth.verify.codeLabel") + " is required");
			return;
		}
		setLoading(true);
		setSubmitState("verifying");
		try {
			await confirmSignUp(email, code.trim());
			setSubmitState("success");
			window.setTimeout(() => setDone(true), 500);
		} catch (err) {
			if (err instanceof AuthError) {
				if (err.code === "CodeMismatchException") {
					setCodeError("Incorrect code — check your email and try again");
				} else if (err.code === "ExpiredCodeException") {
					setCodeError("Code expired — request a new one below");
				} else if (err.code === "NotAuthorizedException") {
					setFormError("This account is already confirmed. Sign in instead.");
				} else {
					setFormError(t("auth.verify.genericError"));
				}
			} else {
				setFormError(t("auth.verify.genericError"));
			}
			setSubmitState("failed");
			setLoading(false);
			window.setTimeout(() => setSubmitState("idle"), 400);
		}
	}

	async function handleResend() {
		if (cooldown > 0 || !email) return;
		try {
			await resendConfirmationCode(email);
			startCooldown();
		} catch {
			/* best effort */
		}
	}

	if (done) {
		return (
			<div className="cdn-auth-form-inner">
				<SpaceBetween size="m">
					<Alert type="success">Email confirmed — you can now sign in.</Alert>
					<Box textAlign="center">
						<Link href="/login/index.html">Sign in</Link>
					</Box>
				</SpaceBetween>
			</div>
		);
	}

	return (
		<div className="cdn-auth-form-inner">
			<form
				onSubmit={(e) => {
					void handleSubmit(e);
				}}
				noValidate
			>
				<Form
					actions={
						<span className={`cdn-auth-submit-state ${submitState}`}>
							<Button
								formAction="submit"
								variant="primary"
								loading={loading}
								disabled={code.replace(/\D/g, "").length < 6}
							>
								{submitState === "verifying"
									? "Verifying with Cognito"
									: t("auth.verify.confirmButton")}
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
						{email && (
							<Box>
								{t("auth.verify.description").replace("{{email}}", email)}
							</Box>
						)}
						<FormField
							label={t("auth.verify.codeLabel")}
							errorText={codeError || undefined}
						>
							<CodeInput value={code} onChange={setCode} autoFocus />
						</FormField>
						<Link
							onFollow={() => {
								void handleResend();
							}}
							variant={cooldown > 0 ? "secondary" : "primary"}
						>
							{cooldown > 0
								? `Resend available in ${cooldown}s`
								: t("auth.verify.resendCode")}
						</Link>
					</SpaceBetween>
				</Form>
			</form>
			<Box margin={{ top: "m" }} textAlign="center">
				<Link href="/login/index.html">Back to sign in</Link>
			</Box>
		</div>
	);
}

export default function App() {
	return (
		<AuthLayout pageContext="Verify your email">
			<VerifyForm />
		</AuthLayout>
	);
}
