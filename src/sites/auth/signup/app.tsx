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
import { LocaleProvider } from "../../../contexts/locale-context";
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
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../../utils/locale";
import AuthLayout from "../_layout";

const AWSUG_ORIGIN = "https://awsug.clouddelnorte.org";
const RESEND_COOLDOWN_SECS = 30;

function SignupWizard() {
	const { t } = useTranslation();
	document.title = t("auth.signup.title") + " — " + t("auth.siteTitle");

	const [activeStepIndex, setActiveStepIndex] = useState(0);

	// step 1
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);

	// step 2
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
	const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});
	const [step4Errors, setStep4Errors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState("");
	const [loading, setLoading] = useState(false);
	const [signUpCalled, setSignUpCalled] = useState(false);

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
			assertNonEmpty(password, t("auth.signup.passwordLabel"));
		} catch {
			errs.password = t("auth.signup.passwordLabel") + " is required";
		}
		if (password && confirmPassword !== password)
			errs.confirmPassword = t("auth.signup.passwordMismatch");
		setStep1Errors(errs);
		return Object.keys(errs).length === 0;
	}

	function validateStep2(): boolean {
		const errs: Record<string, string> = {};
		try {
			assertNonEmpty(memberType, t("auth.signup.memberTypeLabel"));
		} catch {
			errs.memberType = t("auth.signup.memberTypeLabel") + " is required";
		}
		try {
			assertNonEmpty(location, t("auth.signup.locationLabel"));
		} catch {
			errs.location = t("auth.signup.locationLabel") + " is required";
		}
		setStep2Errors(errs);
		return Object.keys(errs).length === 0;
	}

	async function handleNavigate({
		detail,
	}: {
		detail: { requestedStepIndex: number };
	}) {
		const { requestedStepIndex } = detail;

		if (requestedStepIndex > activeStepIndex) {
			if (activeStepIndex === 0 && !validateStep1()) return;
			if (activeStepIndex === 1 && !validateStep2()) return;

			// transition from interests (2) → verify (3): call signUp
			if (activeStepIndex === 2 && !signUpCalled) {
				setLoading(true);
				setFormError("");
				try {
					await signUp({
						email,
						password,
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
		setFormError("");
		try {
			await confirmSignUp(email, code.trim());
			await signInWithPassword(email, password);
			const idToken = sessionStorage.getItem("cdn.idToken") ?? "";
			const accessToken = sessionStorage.getItem("cdn.accessToken") ?? "";
			const refreshToken = sessionStorage.getItem("cdn.refreshToken") ?? "";
			const fragment = `id_token=${encodeURIComponent(idToken)}&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
			window.location.assign(
				`${AWSUG_ORIGIN}/auth/redeem/index.html#${fragment}`,
			);
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
			setLoading(false);
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
						errorText={step2Errors.memberType ?? undefined}
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
						errorText={step2Errors.location ?? undefined}
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
						<Input
							value={code}
							onChange={({ detail }) => setCode(detail.value)}
							placeholder={t("auth.signup.verifyCodePlaceholder")}
							inputMode="numeric"
						/>
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

	return (
		<Wizard
			steps={steps}
			activeStepIndex={activeStepIndex}
			onNavigate={(e) => {
				void handleNavigate(e);
			}}
			onSubmit={() => {
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
				submitButton: t("auth.signup.submitButton"),
				optional: "optional",
			}}
		/>
	);
}

export default function App() {
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

	function handleLocaleChange(next: Locale) {
		setLocale(next);
		applyLocale(next);
		setStoredLocale(next);
	}
	void handleLocaleChange;

	return (
		<LocaleProvider locale={locale}>
			<AuthLayout maxWidth="640px">
				<SignupWizard />
			</AuthLayout>
		</LocaleProvider>
	);
}
