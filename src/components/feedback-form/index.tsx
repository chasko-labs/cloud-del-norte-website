import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FileUpload from "@cloudscape-design/components/file-upload";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";

interface Props {
	open: boolean;
	onClose: () => void;
	kind: "bug" | "wish";
}

const ENDPOINT =
	(import.meta.env.VITE_FEEDBACK_API_URL as string | undefined) ?? "";

const MAX_FILES = 3;
const MAX_FILE_BYTES = 2_000_000;
const ALLOWED_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
]);

function readAsBase64(file: File): Promise<{
	filename: string;
	contentType: string;
	base64Data: string;
}> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			// strip "data:<mime>;base64," prefix
			const base64Data = result.split(",")[1] ?? "";
			resolve({ filename: file.name, contentType: file.type, base64Data });
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

export default function FeedbackForm({ open, onClose, kind }: Props) {
	const { t } = useTranslation();

	const [summary, setSummary] = useState("");
	const [details, setDetails] = useState("");
	const [contactEmail, setContactEmail] = useState("");
	const [honeypot, setHoneypot] = useState("");
	const [summaryError, setSummaryError] = useState("");
	const [detailsError, setDetailsError] = useState("");
	const [attachmentError, setAttachmentError] = useState("");
	const [globalError, setGlobalError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [issueUrl, setIssueUrl] = useState<string | null>(null);
	const [attachments, setAttachments] = useState<File[]>([]);

	// Track object URLs for revocation
	const objectUrlsRef = useRef<string[]>([]);

	// Revoke all outstanding object URLs
	function revokeObjectUrls() {
		for (const url of objectUrlsRef.current) {
			URL.revokeObjectURL(url);
		}
		objectUrlsRef.current = [];
	}

	// Clipboard paste listener while modal is open
	useEffect(() => {
		if (!open) return;

		function handlePaste(e: ClipboardEvent) {
			const items = Array.from(e.clipboardData?.items ?? []);
			const imageItems = items.filter((item) => item.type.startsWith("image/"));
			if (!imageItems.length) return;
			setAttachments((prev) => {
				const slots = MAX_FILES - prev.length;
				if (slots <= 0) return prev;
				const newFiles = imageItems
					.slice(0, slots)
					.map((item) => item.getAsFile())
					.filter((f): f is File => f !== null);
				return [...prev, ...newFiles];
			});
		}

		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [open]);

	// Revoke object URLs on unmount
	useEffect(() => {
		const ref = objectUrlsRef;
		return () => {
			for (const url of ref.current) {
				URL.revokeObjectURL(url);
			}
			ref.current = [];
		};
	}, []);

	function reset() {
		setSummary("");
		setDetails("");
		setContactEmail("");
		setHoneypot("");
		setSummaryError("");
		setDetailsError("");
		setAttachmentError("");
		setGlobalError("");
		setIssueUrl(null);
		revokeObjectUrls();
		setAttachments([]);
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
		if (attachments.length > MAX_FILES) {
			setAttachmentError(t("feedbackForm.errors.attachmentsMax"));
			ok = false;
		} else if (attachments.some((f) => !ALLOWED_TYPES.has(f.type))) {
			setAttachmentError(t("feedbackForm.errors.attachmentType"));
			ok = false;
		} else if (attachments.some((f) => f.size > MAX_FILE_BYTES)) {
			setAttachmentError(t("feedbackForm.errors.attachmentSize"));
			ok = false;
		} else {
			setAttachmentError("");
		}
		return ok;
	}

	async function handleSubmit() {
		if (honeypot) return;
		if (!validate()) return;

		setSubmitting(true);
		setGlobalError("");

		try {
			const attachmentPayload =
				attachments.length > 0
					? await Promise.all(attachments.map(readAsBase64))
					: undefined;

			const res = await fetch(ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: kind,
					summary: summary.trim(),
					details: details.trim(),
					contactEmail: contactEmail.trim() || undefined,
					website: honeypot,
					...(attachmentPayload ? { attachments: attachmentPayload } : {}),
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
						label={t("feedbackForm.fields.attachments")}
						description={t("feedbackForm.helpers.attachments")}
						errorText={attachmentError}
					>
						<FileUpload
							value={attachments}
							onChange={({ detail }) => {
								revokeObjectUrls();
								setAttachments(detail.value);
								setAttachmentError("");
							}}
							accept="image/png,image/jpeg,image/gif,image/webp"
							multiple
							showFileThumbnail
							tokenLimit={MAX_FILES}
							i18nStrings={{
								uploadButtonText: () =>
									t("feedbackForm.fileUpload.uploadButton"),
								dropzoneText: () => t("feedbackForm.fileUpload.dropzoneText"),
								removeFileAriaLabel: (fileIndex) =>
									t("feedbackForm.fileUpload.removeFileAriaLabel").replace(
										"{{name}}",
										attachments[fileIndex]?.name ?? String(fileIndex),
									),
								limitShowFewer: t("feedbackForm.fileUpload.limitShowFewer"),
								limitShowMore: t("feedbackForm.fileUpload.limitShowMore"),
								errorIconAriaLabel: t(
									"feedbackForm.fileUpload.errorIconAriaLabel",
								),
							}}
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
