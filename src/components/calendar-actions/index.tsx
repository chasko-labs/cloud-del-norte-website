import { useCallback, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import "./styles.css";

export interface CalendarActionsProps {
	title?: string;
	description?: string;
	startUtc?: string;
	endUtc?: string;
	location?: string;
}

const DEFAULT_TITLE = "Quantum Computing Workshop — Amazon Braket Part 1";
const DEFAULT_START_ISO = "2026-08-30T21:00:00Z";
const DEFAULT_END_ISO = "2026-08-31T00:00:00Z";
const DEFAULT_LOCATION = "Online — quantum.clouddelnorte.org";
const DEFAULT_DESCRIPTION =
	"Hands-on Amazon Braket workshop. Build quantum circuits, observe superposition & collapse, run Deutsch's algorithm. Hosted by Christian Perez. Bilingual (EN/ES).";

function isoToCalFormat(iso: string): string {
	return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildShareableText(
	title: string,
	location: string,
	description: string,
): string {
	return `${title}\nOnline: ${location}\n${description}\nRegister: quantum.clouddelnorte.org/register/`;
}

function GoogleCalendarIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2z"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M16 2v4M8 2v4M4 10h16"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
			<circle cx="12" cy="15" r="1.5" fill="#4285F4" />
		</svg>
	);
}

function OutlookIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2z"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M16 2v4M8 2v4M4 10h16"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
			<circle cx="12" cy="15" r="1.5" fill="#0078D4" />
		</svg>
	);
}

function YahooIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2z"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M16 2v4M8 2v4M4 10h16"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
			<circle cx="12" cy="15" r="1.5" fill="#6001D2" />
		</svg>
	);
}

function DownloadIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M12 3v12m0 0l-4-4m4 4l4-4"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function CopyIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<rect
				x="9"
				y="9"
				width="11"
				height="11"
				rx="2"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
		</svg>
	);
}

function ShareIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
			<circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
			<circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.5" />
			<path
				d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M5 13l4 4L19 7"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function buildGoogleCalendarUrl(
	title: string,
	start: string,
	end: string,
	description: string,
	location: string,
): string {
	const params = new URLSearchParams({
		action: "TEMPLATE",
		text: title,
		dates: `${isoToCalFormat(start)}/${isoToCalFormat(end)}`,
		details: description,
		location,
	});
	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookUrl(
	title: string,
	start: string,
	end: string,
	description: string,
	location: string,
): string {
	const params = new URLSearchParams({
		subject: title,
		startdt: start,
		enddt: end,
		body: description,
		location,
	});
	return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

function buildYahooUrl(
	title: string,
	start: string,
	description: string,
	location: string,
): string {
	const startCal = isoToCalFormat(start);
	const params = new URLSearchParams({
		v: "60",
		title,
		st: startCal,
		dur: "0300",
		desc: description,
		in_loc: location,
	});
	return `https://calendar.yahoo.com/?${params.toString()}`;
}

function generateIcsContent(
	title: string,
	start: string,
	end: string,
	description: string,
	location: string,
): string {
	const uid = `${title.replace(/\W+/g, "-").toLowerCase()}-${isoToCalFormat(start)}@clouddelnorte.org`;
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Cloud Del Norte//Quantum Workshop//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		`DTSTART:${isoToCalFormat(start)}`,
		`DTEND:${isoToCalFormat(end)}`,
		`SUMMARY:${title}`,
		`DESCRIPTION:${description.replace(/,/g, "\\,")}`,
		`LOCATION:${location}`,
		`URL:https://quantum.clouddelnorte.org`,
		"STATUS:CONFIRMED",
		`UID:${uid}`,
		"END:VEVENT",
		"END:VCALENDAR",
	].join("\r\n");
}

function downloadIcs(
	title: string,
	start: string,
	end: string,
	description: string,
	location: string,
): void {
	const content = generateIcsContent(title, start, end, description, location);
	const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `${title.replace(/\W+/g, "-").toLowerCase()}.ics`;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
}

export default function CalendarActions(props: CalendarActionsProps = {}) {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);
	const canShare =
		typeof navigator !== "undefined" && typeof navigator.share === "function";

	const title = props.title ?? DEFAULT_TITLE;
	const description = props.description ?? DEFAULT_DESCRIPTION;
	const startUtc = props.startUtc ?? DEFAULT_START_ISO;
	const endUtc = props.endUtc ?? DEFAULT_END_ISO;
	const location = props.location ?? DEFAULT_LOCATION;
	const shareableText = buildShareableText(title, location, description);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(shareableText);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard API unavailable — non-critical
		}
	}, [shareableText]);

	const handleShare = useCallback(async () => {
		try {
			await navigator.share({
				title,
				text: shareableText,
				url: "https://quantum.clouddelnorte.org",
			});
		} catch {
			// user cancelled or API unavailable — non-critical
		}
	}, [title, shareableText]);

	const handleDownloadIcs = useCallback(() => {
		downloadIcs(title, startUtc, endUtc, description, location);
	}, [title, startUtc, endUtc, description, location]);

	return (
		<div className="calendar-actions">
			<span className="calendar-actions__label">
				{t("calendarActions.addToCalendar")}
			</span>
			<div className="calendar-actions__buttons">
				<a
					href={buildGoogleCalendarUrl(
						title,
						startUtc,
						endUtc,
						description,
						location,
					)}
					target="_blank"
					rel="noopener noreferrer"
					className="calendar-actions__btn"
					aria-label={t("calendarActions.google")}
				>
					<GoogleCalendarIcon />
					{t("calendarActions.googleLabel")}
				</a>
				<a
					href={buildOutlookUrl(title, startUtc, endUtc, description, location)}
					target="_blank"
					rel="noopener noreferrer"
					className="calendar-actions__btn"
					aria-label={t("calendarActions.outlook")}
				>
					<OutlookIcon />
					{t("calendarActions.outlookLabel")}
				</a>
				<a
					href={buildYahooUrl(title, startUtc, description, location)}
					target="_blank"
					rel="noopener noreferrer"
					className="calendar-actions__btn"
					aria-label={t("calendarActions.yahoo")}
				>
					<YahooIcon />
					{t("calendarActions.yahooLabel")}
				</a>
				<button
					type="button"
					className="calendar-actions__btn"
					onClick={handleDownloadIcs}
					aria-label={t("calendarActions.downloadIcs")}
				>
					<DownloadIcon />
					{t("calendarActions.downloadLabel")}
				</button>
				<button
					type="button"
					className="calendar-actions__btn"
					onClick={handleCopy}
					aria-label={
						copied
							? t("calendarActions.copied")
							: t("calendarActions.copyDetails")
					}
				>
					{copied ? <CheckIcon /> : <CopyIcon />}
					{copied
						? t("calendarActions.copied")
						: t("calendarActions.copyLabel")}
				</button>
				{canShare && (
					<button
						type="button"
						className="calendar-actions__btn"
						onClick={handleShare}
						aria-label={t("calendarActions.share")}
					>
						<ShareIcon />
						{t("calendarActions.shareLabel")}
					</button>
				)}
			</div>
		</div>
	);
}
