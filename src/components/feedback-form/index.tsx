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
import { useAuth } from "../../hooks/useAuth";
import { useFeedbackDraft } from "../../hooks/useFeedbackDraft";
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
			const base64Data = result.split(",")[1] ?? "";
			resolve({ filename: file.name, contentType: file.type, base64Data });
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

export default function FeedbackForm({ open, onClose, kind }: Props) {
	const { t } = useTranslation();
	const { isAuthenticated, email: userEmail, sub: reporterSub } = useAuth();
	const isSignedIn = isAuthenticated && reporterSub != null;

	const { draft, setDraftField, clearDraft, hasPersistedDraft } =
		useFeedbackDraft(kind);

	const [honeypot, setHoneypot] = useState("");
	const [summaryError, setSummaryError] = useState("");
	const [detailsError, setDetailsError] = useState("");
	const [attachmentError, setAttachmentError] = useState("");
	const [globalError, setGlobalError] = useState("");
	const [showRetry, setShowRetry] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [issueUrl, setIssueUrl] = useState<string | null>(null);
	const [attachments, setAttachments] = useState<File[]>([]);
	const [draftDismissed, setDraftDismissed] = useState(false);

	// Track object URLs for revocation
	const objectUrlsRef = useRef<string[]>([]);

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
		setHoneypot("");
		setSummaryError("");
		setDetailsError("");
		setAttachmentError("");
		setGlobalError("");
		setShowRetry(false);
		setIssueUrl(null);
		setDraftDismissed(false);
		revokeObjectUrls();
		setAttachments([]);
	}

	function handleClose() {
		reset();
		onClose();
	}

	function validate(): boolean {
		let ok = true;
		if (draft.summary.trim().length < 8) {
			setSummaryError(t("feedbackForm.errors.summaryMin"));
			ok = false;
		} else if (draft.summary.trim().length > 120) {
			setSummaryError(t("feedbackForm.errors.summaryMax"));
			ok = false;
		} else {
			setSummaryError("");
		}
		if (!draft.details.trim()) {
			setDetailsError(t("feedbackForm.errors.detailsRequired"));
			ok = false;
		} else if (draft.details.length > 2000) {
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
		setShowRetry(false);

		try {
			const attachmentPayload =
				attachments.length > 0
					? await Promise.all(attachments.map(readAsBase64))
					: undefined;

			const payload: Record<string, unknown> = {
				type: kind,
				summary: draft.summary.trim(),
				details: draft.details.trim(),
				contactEmail: draft.contactEmail.trim() || undefined,
				website: honeypot,
				...(attachmentPayload ? { attachments: attachmentPayload } : {}),
			};
			if (isSignedIn && reporterSub) {
				payload.reporterSub = reporterSub;
			}

			const res = await fetch(ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(15000),
			});

			if (res.status === 429) {
				setGlobalError(t("feedbackForm.errors.rate"));
				return;
			}
			if (res.status >= 500) {
				setGlobalError(t("feedbackForm.errors.server"));
				setShowRetry(true);
				return;
			}
			if (!res.ok) {
				setGlobalError(t("feedbackForm.errors.network"));
				setShowRetry(true);
				return;
			}
			const data = (await res.json()) as { ok: boolean; issueUrl: string };
			if (data.ok) {
				clearDraft();
				setIssueUrl(data.issueUrl);
			} else {
				setGlobalError(t("feedbackForm.errors.network"));
				setShowRetry(true);
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") {
				setGlobalError(t("feedbackForm.errors.timeout"));
			} else if (err instanceof TypeError) {
				setGlobalError(t("feedbackForm.errors.offline"));
			} else {
				setGlobalError(t("feedbackForm.errors.network"));
			}
			setShowRetry(true);
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

	const showDraftBanner = hasPersistedDraft && !draftDismissed && !issueUrl;

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

			<SpaceBetween size="m">
				{showDraftBanner && (
					<Alert
						type="info"
						action={
							<Button
								onClick={() => {
									clearDraft();
									setDraftDismissed(true);
								}}
							>
								{t("feedbackForm.discardDraft")}
							</Button>
						}
					>
						{t("feedbackForm.draftRestored")}
					</Alert>
				)}

				<Form errorText={globalError || undefined}>
					<SpaceBetween size="m">
						<FormField
							label={t("feedbackForm.fields.summary")}
							errorText={summaryError}
							description={t("feedbackForm.helpers.summary")}
						>
							<Input
								value={draft.summary}
								onChange={({ detail }) =>
									setDraftField("summary", detail.value)
								}
								placeholder={t("feedbackForm.fields.summaryPlaceholder")}
								ariaLabel={t("feedbackForm.fields.summary")}
							/>
						</FormField>

						<FormField
							label={t("feedbackForm.fields.details")}
							errorText={detailsError}
						>
							<Textarea
								value={draft.details}
								onChange={({ detail }) =>
									setDraftField("details", detail.value)
								}
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

						{isSignedIn ? (
							<Box variant="small">
								{t("feedbackForm.signedInAs").replace(
									"{email}",
									userEmail ?? "",
								)}
							</Box>
						) : (
							<>
								<FormField
									label={t("feedbackForm.fields.contactEmail")}
									description={t("feedbackForm.helpers.contactEmail")}
								>
									<Input
										value={draft.contactEmail}
										type="email"
										onChange={({ detail }) =>
											setDraftField("contactEmail", detail.value)
										}
										placeholder="you@example.com"
										ariaLabel={t("feedbackForm.fields.contactEmail")}
									/>
								</FormField>
								<Box variant="small">
									<Link href="/login/?returnTo=/feed/">
										{t("feedbackForm.signInToFollow")}
									</Link>
								</Box>
							</>
						)}

						{showRetry && globalError && (
							<Button
								onClick={() => {
									void handleSubmit();
								}}
							>
								{t("feedbackForm.retry")}
							</Button>
						)}
					</SpaceBetween>
				</Form>
			</SpaceBetween>
		</Modal>
	);
}
