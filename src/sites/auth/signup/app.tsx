// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Wizard from "@cloudscape-design/components/wizard";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import {
	AuthError,
	assertNonEmpty,
	confirmSignUp,
	FIELD_LIMITS,
	resendConfirmationCode,
	signInWithPassword,
	signUp,
} from "../../../lib/cognito";
import AuthLayout from "../_layout";
import CodeInput from "../_layout/CodeInput";

const AWSUG_ORIGIN = "https://awsug.clouddelnorte.org";
/* match verify/app.tsx — 120s gives time to switch to email/authenticator
   apps and back without missing the resend window. was 30s, too short */
const RESEND_COOLDOWN_SECS = 120;

function SignupWizard() {
	const { t } = useTranslation();
	document.title = t("auth.signup.title") + " — " + t("auth.siteTitle");

	const [activeStepIndex, setActiveStepIndex] = useState(0);

	// step 1 — only required fields per ux: email, password, display name
	const [email, setEmail] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);

	// step 2 — optional now (not required to advance)
	const [memberType, setMemberType] = useState("");
	const [location, setLocation] = useState("");

	// step 3
	const [topics, setTopics] = useState("");
	const [background, setBackground] = useState("");

	// step 4
	const [code, setCode] = useState("");
	const [cooldown, setCooldown] = useState(0);
	const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// error state
	const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});
	const [step4Errors, setStep4Errors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState("");
	const [loading, setLoading] = useState(false);
	const [signUpCalled, setSignUpCalled] = useState(false);
	const [submitState, setSubmitState] = useState<
		"idle" | "verifying" | "success" | "failed"
	>("idle");

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

	function validateStep1(): boolean {
		const errs: Record<string, string> = {};
		try {
			assertNonEmpty(email, t("auth.signup.emailLabel"));
		} catch {
			errs.email = t("auth.signup.emailLabel") + " is required";
		}
		try {
			assertNonEmpty(displayName, t("auth.signup.displayNameLabel"));
		} catch {
			errs.displayName = t("auth.signup.displayNameLabel") + " is required";
		}
		try {
			assertNonEmpty(password, t("auth.signup.passwordLabel"));
		} catch {
			errs.password = t("auth.signup.passwordLabel") + " is required";
		}
		if (password && confirmPassword !== password)
			errs.confirmPassword = t("auth.signup.passwordMismatch");
		setStep1Errors(errs);
		return Object.keys(errs).length === 0;
	}

	// step 2 fields are now optional — no validation gate. bryan's call:
	// don't be overly prohibitive. mod adds enforcement back if needed.

	async function handleNavigate({
		detail,
	}: {
		detail: { requestedStepIndex: number };
	}) {
		const { requestedStepIndex } = detail;

		if (requestedStepIndex > activeStepIndex) {
			if (activeStepIndex === 0 && !validateStep1()) return;
			// step 2 (member type + location) is optional — no validation gate

			// transition from interests (2) → verify (3): call signUp
			if (activeStepIndex === 2 && !signUpCalled) {
				setLoading(true);
				setFormError("");
				try {
					await signUp({
						email,
						password,
						displayName,
						memberType,
						location,
						topics,
						background,
					});
					setSignUpCalled(true);
					startCooldown();
				} catch (err) {
					if (err instanceof AuthError) {
						if (err.code === "UsernameExistsException") {
							setFormError(t("auth.signup.emailExists"));
						} else if (err.code === "InvalidPasswordException") {
							setStep1Errors({ password: t("auth.signup.weakPassword") });
							setActiveStepIndex(0);
							setLoading(false);
							return;
						} else {
							setFormError(t("auth.signup.genericError"));
						}
					} else {
						setFormError(t("auth.signup.genericError"));
					}
					setLoading(false);
					return;
				}
				setLoading(false);
			}
		}

		setActiveStepIndex(requestedStepIndex);
	}

	async function handleSubmit() {
		const errs: Record<string, string> = {};
		try {
			assertNonEmpty(code, t("auth.signup.verifyCodeLabel"));
		} catch {
			errs.code = t("auth.signup.verifyCodeLabel") + " is required";
		}
		if (Object.keys(errs).length > 0) {
			setStep4Errors(errs);
			return;
		}

		setLoading(true);
		setSubmitState("verifying");
		setFormError("");
		try {
			await confirmSignUp(email, code.trim());
			await signInWithPassword(email, password);
			const idToken = sessionStorage.getItem("cdn.idToken") ?? "";
			const accessToken = sessionStorage.getItem("cdn.accessToken") ?? "";
			const refreshToken = sessionStorage.getItem("cdn.refreshToken") ?? "";
			const fragment = `id_token=${encodeURIComponent(idToken)}&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
			setSubmitState("success");
			window.setTimeout(() => {
				window.location.assign(
					`${AWSUG_ORIGIN}/auth/redeem/index.html#${fragment}`,
				);
			}, 500);
		} catch (err) {
			if (err instanceof AuthError) {
				if (err.code === "CodeMismatchException") {
					setStep4Errors({
						code: "Incorrect code — check your email and try again",
					});
				} else if (err.code === "ExpiredCodeException") {
					setStep4Errors({ code: "Code expired — request a new one below" });
				} else {
					setFormError(t("auth.signup.genericError"));
				}
			} else {
				setFormError(t("auth.signup.genericError"));
			}
			setSubmitState("failed");
			setLoading(false);
			window.setTimeout(() => setSubmitState("idle"), 400);
		}
	}

	async function handleResend() {
		if (cooldown > 0) return;
		try {
			await resendConfirmationCode(email);
			startCooldown();
		} catch {
			/* best effort */
		}
	}

	const steps = [
		{
			title: t("auth.signup.step1Title"),
			content: (
				<SpaceBetween size="m">
					<FormField
						label={t("auth.signup.emailLabel")}
						errorText={step1Errors.email ?? undefined}
					>
						<Input
							type="email"
							value={email}
							onChange={({ detail }) => setEmail(detail.value)}
							placeholder={t("auth.signup.emailPlaceholder")}
							inputMode="email"
							autoFocus
						/>
					</FormField>
					<FormField
						label={t("auth.signup.displayNameLabel")}
						description={t("auth.signup.displayNameHint")}
						errorText={step1Errors.displayName ?? undefined}
						constraintText={`${displayName.length} / ${FIELD_LIMITS.display_name}`}
					>
						<Input
							value={displayName}
							onChange={({ detail }) => setDisplayName(detail.value)}
							placeholder={t("auth.signup.displayNamePlaceholder")}
						/>
					</FormField>
					<FormField
						label={t("auth.signup.passwordLabel")}
						description={t("auth.signup.passwordHint")}
						errorText={step1Errors.password ?? undefined}
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
					<FormField
						label={t("auth.signup.confirmPasswordLabel")}
						errorText={step1Errors.confirmPassword ?? undefined}
					>
						<Input
							type={showPassword ? "text" : "password"}
							value={confirmPassword}
							onChange={({ detail }) => setConfirmPassword(detail.value)}
						/>
					</FormField>
					<Box textAlign="center">
						<Link href="/login/index.html">
							{t("auth.signup.alreadyHaveAccount")}
						</Link>
					</Box>
				</SpaceBetween>
			),
		},
		{
			title: t("auth.signup.step2Title"),
			content: (
				<SpaceBetween size="m">
					<FormField
						label={t("auth.signup.memberTypeLabel")}
						constraintText={`${memberType.length} / ${FIELD_LIMITS.member_type}`}
					>
						<Input
							value={memberType}
							onChange={({ detail }) => setMemberType(detail.value)}
							placeholder={t("auth.signup.memberTypePlaceholder")}
						/>
					</FormField>
					<FormField
						label={t("auth.signup.locationLabel")}
						constraintText={`${location.length} / ${FIELD_LIMITS.location}`}
					>
						<Input
							value={location}
							onChange={({ detail }) => setLocation(detail.value)}
							placeholder={t("auth.signup.locationPlaceholder")}
						/>
					</FormField>
				</SpaceBetween>
			),
		},
		{
			title: t("auth.signup.step3Title"),
			content: (
				<SpaceBetween size="m">
					{formError && <Alert type="error">{formError}</Alert>}
					<FormField
						label={t("auth.signup.topicsLabel")}
						constraintText={`${topics.length} / ${FIELD_LIMITS.topics}`}
					>
						<Input
							value={topics}
							onChange={({ detail }) => setTopics(detail.value)}
							placeholder={t("auth.signup.topicsPlaceholder")}
						/>
					</FormField>
					<FormField
						label={t("auth.signup.backgroundLabel")}
						constraintText={`${background.length} / ${FIELD_LIMITS.background}`}
					>
						<Textarea
							value={background}
							onChange={({ detail }) => setBackground(detail.value)}
							placeholder={t("auth.signup.backgroundPlaceholder")}
							rows={4}
						/>
					</FormField>
				</SpaceBetween>
			),
		},
		{
			title: t("auth.signup.step4Title"),
			content: (
				<SpaceBetween size="m">
					{formError && <Alert type="error">{formError}</Alert>}
					<Box>We sent a 6-digit code to {email}</Box>
					<FormField
						label={t("auth.signup.verifyCodeLabel")}
						errorText={step4Errors.code ?? undefined}
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
							? t("auth.signup.resendCooldown").replace(
									"{{seconds}}",
									String(cooldown),
								)
							: t("auth.signup.resendCode")}
					</Link>
				</SpaceBetween>
			),
		},
	];

	// Disable wizard submit until all 6 cells filled (only on the verify step).
	// Submit handler ignores attempts when incomplete — the existing handleSubmit
	// below still validates so the wire stays unchanged.
	const submitDisabled =
		activeStepIndex === 3 && code.replace(/\D/g, "").length < 6;

	return (
		<div className={`cdn-auth-submit-state ${submitState}`}>
			<Wizard
				steps={steps}
				activeStepIndex={activeStepIndex}
				onNavigate={(e) => {
					void handleNavigate(e);
				}}
				onSubmit={() => {
					if (submitDisabled) return;
					void handleSubmit();
				}}
				isLoadingNextStep={loading}
				i18nStrings={{
					stepNumberLabel: (n) => `Step ${n}`,
					collapsedStepsLabel: (n, total) => `Step ${n} of ${total}`,
					navigationAriaLabel: "Signup steps",
					cancelButton: "Cancel",
					previousButton: t("auth.signup.backButton"),
					nextButton: t("auth.signup.nextButton"),
					submitButton:
						submitState === "verifying"
							? "Verifying with Cognito"
							: t("auth.signup.submitButton"),
					optional: "optional",
				}}
			/>
		</div>
	);
}

export default function App() {
	return (
		<AuthLayout pageContext="Create your account">
			<SignupWizard />
		</AuthLayout>
	);
}
