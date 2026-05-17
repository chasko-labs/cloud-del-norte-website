import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import {
	AuthError,
	associateSoftwareTokenWithAccessToken,
	verifySoftwareTokenWithAccessToken,
} from "../../../lib/cognito";

interface TotpStepProps {
	email: string;
	onSuccess: () => void;
	onBack: () => void;
}

export default function TotpStep({ email, onSuccess, onBack }: TotpStepProps) {
	const { t } = useTranslation();
	const [secretCode, setSecretCode] = useState("");
	const [code, setCode] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [fetchError, setFetchError] = useState("");

	useEffect(() => {
		associateSoftwareTokenWithAccessToken()
			.then(({ secretCode: s }) => setSecretCode(s))
			.catch((err) => {
				setFetchError(
					err instanceof AuthError
						? err.message
						: t("auth.verificationSetup.genericError"),
				);
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [t]);

	const otpauthUri = secretCode
		? `otpauth://totp/CloudDelNorte:${encodeURIComponent(email)}?secret=${secretCode}&issuer=CloudDelNorte`
		: "";

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			await verifySoftwareTokenWithAccessToken(code.trim());
			onSuccess();
		} catch (err) {
			setError(
				err instanceof AuthError
					? err.message
					: t("auth.verificationSetup.genericError"),
			);
			setLoading(false);
		}
	}

	if (fetchError) {
		return (
			<SpaceBetween size="m">
				<Alert type="error">{fetchError}</Alert>
				<Button variant="link" onClick={onBack}>
					{t("auth.verificationSetup.backButton")}
				</Button>
			</SpaceBetween>
		);
	}

	if (!secretCode) {
		return (
			<Box textAlign="center" padding="xl">
				{t("auth.verificationSetup.loading")}
			</Box>
		);
	}

	return (
		<form
			onSubmit={(e) => {
				void handleSubmit(e);
			}}
			noValidate
		>
			<Form
				actions={
					<SpaceBetween direction="horizontal" size="xs">
						<Button variant="link" onClick={onBack} formAction="none">
							{t("auth.verificationSetup.backButton")}
						</Button>
						<Button
							formAction="submit"
							variant="primary"
							loading={loading}
							disabled={code.replace(/\D/g, "").length < 6}
						>
							{t("auth.verificationSetup.totpVerifyButton")}
						</Button>
					</SpaceBetween>
				}
				errorText={error || undefined}
			>
				<SpaceBetween size="m">
					<Box variant="p">{t("auth.verificationSetup.totpScanPrompt")}</Box>
					<Box variant="div" textAlign="center">
						<QRCodeSVG
							value={otpauthUri}
							size={180}
							level="M"
							style={{
								borderRadius: "8px",
								border: "2px solid var(--cdn-violet, #9060f0)",
							}}
						/>
					</Box>
					<Box variant="small" color="text-body-secondary">
						{t("auth.verificationSetup.totpManualLabel")}
					</Box>
					<Box variant="code">
						<span style={{ fontFamily: "monospace", userSelect: "all" }}>
							{secretCode}
						</span>
					</Box>
					<FormField label={t("auth.verificationSetup.totpCodeLabel")}>
						<Input
							type="text"
							value={code}
							onChange={({ detail }) => setCode(detail.value)}
							inputMode="numeric"
							autoFocus
						/>
					</FormField>
				</SpaceBetween>
			</Form>
		</form>
	);
}
