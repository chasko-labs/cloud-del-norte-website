import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";

interface Props {
	open: boolean;
	onClose: () => void;
	kind: "bug" | "wish";
}

const ENDPOINT =
	(import.meta.env.VITE_FEEDBACK_API_URL as string | undefined) ?? "";

export default function FeedbackForm({ open, onClose, kind }: Props) {
	const { t } = useTranslation();

	const [summary, setSummary] = useState("");
	const [details, setDetails] = useState("");
	const [contactEmail, setContactEmail] = useState("");
	const [honeypot, setHoneypot] = useState("");
	const [summaryError, setSummaryError] = useState("");
	const [detailsError, setDetailsError] = useState("");
	const [globalError, setGlobalError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [issueUrl, setIssueUrl] = useState<string | null>(null);

	function reset() {
		setSummary("");
		setDetails("");
		setContactEmail("");
		setHoneypot("");
		setSummaryError("");
		setDetailsError("");
		setGlobalError("");
		setIssueUrl(null);
	}

	function handleClose() {
		reset();
		onClose();
	}

	function validate(): boolean {
		let ok = true;
		if (summary.trim().length < 8) {
			setSummaryError(t("feedbackForm.errors.summaryMin"));
			ok = false;
		} else if (summary.trim().length > 120) {
			setSummaryError(t("feedbackForm.errors.summaryMax"));
			ok = false;
		} else {
			setSummaryError("");
		}
		if (!details.trim()) {
			setDetailsError(t("feedbackForm.errors.detailsRequired"));
			ok = false;
		} else if (details.length > 2000) {
			setDetailsError(t("feedbackForm.errors.detailsMax"));
			ok = false;
		} else {
			setDetailsError("");
		}
		return ok;
	}

	async function handleSubmit() {
		if (honeypot) return;
		if (!validate()) return;

		setSubmitting(true);
		setGlobalError("");

		try {
			const res = await fetch(ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: kind,
					summary: summary.trim(),
					details: details.trim(),
					contactEmail: contactEmail.trim() || undefined,
					website: honeypot,
				}),
			});

			if (res.status === 429) {
				setGlobalError(t("feedbackForm.errors.rate"));
				return;
			}
			if (!res.ok) {
				setGlobalError(t("feedbackForm.errors.network"));
				return;
			}
			const data = (await res.json()) as { ok: boolean; issueUrl: string };
			if (data.ok) {
				setIssueUrl(data.issueUrl);
			} else {
				setGlobalError(t("feedbackForm.errors.network"));
			}
		} catch {
			setGlobalError(t("feedbackForm.errors.network"));
		} finally {
			setSubmitting(false);
		}
	}

	const title =
		kind === "bug" ? t("helpPanel.reportBugName") : t("helpPanel.makeWishName");

	if (issueUrl) {
		return (
			<Modal
				visible={open}
				onDismiss={handleClose}
				header={t("feedbackForm.thankYouTitle")}
				footer={
					<Box float="right">
						<Button variant="primary" onClick={handleClose}>
							{t("feedbackForm.closeButton")}
						</Button>
					</Box>
				}
			>
				<SpaceBetween size="m">
					<Alert type="success">{t("feedbackForm.thankYouBody")}</Alert>
					<p>
						<Link href={issueUrl} external>
							{t("feedbackForm.viewIssue")}
						</Link>
					</p>
				</SpaceBetween>
			</Modal>
		);
	}

	return (
		<Modal
			visible={open}
			onDismiss={handleClose}
			header={title}
			footer={
				<Box float="right">
					<SpaceBetween direction="horizontal" size="xs">
						<Button variant="link" onClick={handleClose} disabled={submitting}>
							{t("feedbackForm.cancelButton")}
						</Button>
						<Button
							variant="primary"
							loading={submitting}
							onClick={() => {
								void handleSubmit();
							}}
						>
							{t("feedbackForm.submitButton")}
						</Button>
					</SpaceBetween>
				</Box>
			}
		>
			{/* honeypot */}
			<div aria-hidden="true" style={{ display: "none" }}>
				<input
					type="text"
					name="website"
					tabIndex={-1}
					autoComplete="off"
					value={honeypot}
					onChange={(e) => setHoneypot(e.target.value)}
				/>
			</div>

			<Form errorText={globalError || undefined}>
				<SpaceBetween size="m">
					<FormField
						label={t("feedbackForm.fields.summary")}
						errorText={summaryError}
						description={t("feedbackForm.helpers.summary")}
					>
						<Input
							value={summary}
							onChange={({ detail }) => setSummary(detail.value)}
							placeholder={t("feedbackForm.fields.summaryPlaceholder")}
							ariaLabel={t("feedbackForm.fields.summary")}
						/>
					</FormField>

					<FormField
						label={t("feedbackForm.fields.details")}
						errorText={detailsError}
					>
						<Textarea
							value={details}
							onChange={({ detail }) => setDetails(detail.value)}
							rows={5}
							placeholder={t("feedbackForm.fields.detailsPlaceholder")}
							ariaLabel={t("feedbackForm.fields.details")}
						/>
					</FormField>

					<FormField
						label={t("feedbackForm.fields.contactEmail")}
						description={t("feedbackForm.helpers.contactEmail")}
					>
						<Input
							value={contactEmail}
							type="email"
							onChange={({ detail }) => setContactEmail(detail.value)}
							placeholder="you@example.com"
							ariaLabel={t("feedbackForm.fields.contactEmail")}
						/>
					</FormField>
				</SpaceBetween>
			</Form>
		</Modal>
	);
}
