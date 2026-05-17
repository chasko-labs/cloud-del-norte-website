import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import RadioGroup from "@cloudscape-design/components/radio-group";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import { decodeToken } from "../../../lib/auth";
import {
	AuthError,
	getAccessToken,
	setUserAttribute,
} from "../../../lib/cognito";
import AuthLayout from "../_layout";
import TotpStep from "./totp-step";

const AWSUG_ORIGIN = "https://awsug.clouddelnorte.org";

type Selection = "totp" | "passkey" | "skip";

function getEmailFromToken(): string {
	try {
		const idToken = sessionStorage.getItem("cdn.idToken");
		if (!idToken) return "";
		const payload = decodeToken(idToken);
		return (payload.email as string) ?? "";
	} catch {
		return "";
	}
}

function redirectToFeed() {
	const idToken = sessionStorage.getItem("cdn.idToken") ?? "";
	const accessToken = sessionStorage.getItem("cdn.accessToken") ?? "";
	const refreshToken = sessionStorage.getItem("cdn.refreshToken") ?? "";
	const fragment = `id_token=${encodeURIComponent(idToken)}&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&return_to=`;
	window.location.assign(`${AWSUG_ORIGIN}/auth/redeem/index.html#${fragment}`);
}

function SetupForm() {
	const { t } = useTranslation();
	document.title = `${t("auth.verificationSetup.title")} — ${t("auth.siteTitle")}`;

	const [selection, setSelection] = useState<Selection>("totp");
	const [showTotp, setShowTotp] = useState(false);
	const [skipping, setSkipping] = useState(false);
	const [error, setError] = useState("");
	const email = getEmailFromToken();

	// Guard: if no access token, send to login
	if (!getAccessToken()) {
		sessionStorage.setItem("cdn.needsVerificationSetup", "1");
		window.location.assign("/login/index.html");
		return null;
	}

	if (showTotp) {
		return (
			<div className="cdn-auth-form-inner">
				<TotpStep
					email={email}
					onSuccess={redirectToFeed}
					onBack={() => setShowTotp(false)}
				/>
			</div>
		);
	}

	async function handleContinue(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (selection === "totp") {
			setShowTotp(true);
			return;
		}
		if (selection === "passkey") {
			window.location.assign("/passkeys/index.html");
			return;
		}
		// skip
		setSkipping(true);
		try {
			await setUserAttribute("custom:verificationSkipped", "1");
		} catch (err) {
			// non-fatal — don't block the user
			console.warn(
				"[verification-setup] could not set skip attribute:",
				err instanceof AuthError ? err.message : err,
			);
		}
		redirectToFeed();
	}

	return (
		<div className="cdn-auth-form-inner">
			<form
				onSubmit={(e) => {
					void handleContinue(e);
				}}
				noValidate
			>
				<Form
					actions={
						<Button formAction="submit" variant="primary" loading={skipping}>
							{selection === "skip"
								? t("auth.verificationSetup.skipButton")
								: t("auth.verificationSetup.continueButton")}
						</Button>
					}
					errorText={error || undefined}
				>
					<SpaceBetween size="m">
						<Alert type="info">{t("auth.verificationSetup.description")}</Alert>
						<FormField label={t("auth.verificationSetup.chooseLabel")}>
							<RadioGroup
								value={selection}
								onChange={({ detail }) =>
									setSelection(detail.value as Selection)
								}
								items={[
									{
										value: "totp",
										label: t("auth.verificationSetup.totpLabel"),
										description: t("auth.verificationSetup.totpDescription"),
									},
									{
										value: "passkey",
										label: t("auth.verificationSetup.passkeyLabel"),
										description: t("auth.verificationSetup.passkeyDescription"),
									},
									{
										value: "skip",
										label: t("auth.verificationSetup.skipLabel"),
										description: t("auth.verificationSetup.skipDescription"),
									},
								]}
							/>
						</FormField>
					</SpaceBetween>
				</Form>
			</form>
		</div>
	);
}

export default function App() {
	return (
		<AuthLayout pageContextKey="auth.verificationSetup.pageContext">
			<SetupForm />
		</AuthLayout>
	);
}
