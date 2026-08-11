import { useCallback, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import "./styles.css";

const EVENT_TITLE = "Quantum Computing Workshop — Amazon Braket Part 1";
const EVENT_START = "20260830T210000Z";
const EVENT_END = "20260831T000000Z";
const EVENT_START_ISO = "2026-08-30T21:00:00Z";
const EVENT_END_ISO = "2026-08-31T00:00:00Z";
const EVENT_LOCATION = "Online — quantum.clouddelnorte.org";
const EVENT_URL = "https://quantum.clouddelnorte.org";
const EVENT_DESCRIPTION =
	"Hands-on Amazon Braket workshop. Build quantum circuits, observe superposition & collapse, run Deutsch's algorithm. Hosted by Christian Perez. Bilingual (EN/ES).";

const SHAREABLE_TEXT = `Quantum Computing Workshop — Amazon Braket Part 1
Sun Aug 30 · 3:00–6:00 PM CDT
Online: quantum.clouddelnorte.org
Hands-on Amazon Braket workshop. Build quantum circuits, observe superposition & collapse, run Deutsch's algorithm.
Register: quantum.clouddelnorte.org/register/`;

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

function buildGoogleCalendarUrl(): string {
	const params = new URLSearchParams({
		action: "TEMPLATE",
		text: EVENT_TITLE,
		dates: `${EVENT_START}/${EVENT_END}`,
		details: EVENT_DESCRIPTION,
		location: EVENT_LOCATION,
	});
	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookUrl(): string {
	const params = new URLSearchParams({
		subject: EVENT_TITLE,
		startdt: EVENT_START_ISO,
		enddt: EVENT_END_ISO,
		body: EVENT_DESCRIPTION,
		location: EVENT_LOCATION,
	});
	return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

function buildYahooUrl(): string {
	const params = new URLSearchParams({
		v: "60",
		title: EVENT_TITLE,
		st: EVENT_START,
		dur: "0300",
		desc: EVENT_DESCRIPTION,
		in_loc: EVENT_LOCATION,
	});
	return `https://calendar.yahoo.com/?${params.toString()}`;
}

function generateIcsContent(): string {
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Cloud Del Norte//Quantum Workshop//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		`DTSTART:${EVENT_START}`,
		`DTEND:${EVENT_END}`,
		`SUMMARY:${EVENT_TITLE}`,
		`DESCRIPTION:${EVENT_DESCRIPTION.replace(/,/g, "\\,")}`,
		`LOCATION:${EVENT_LOCATION}`,
		`URL:${EVENT_URL}`,
		"STATUS:CONFIRMED",
		`UID:quantum-workshop-20260830@clouddelnorte.org`,
		"END:VEVENT",
		"END:VCALENDAR",
	].join("\r\n");
}

function downloadIcs(): void {
	const content = generateIcsContent();
	const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = "quantum-workshop-braket.ics";
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
}

export default function CalendarActions() {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);
	const canShare =
		typeof navigator !== "undefined" && typeof navigator.share === "function";

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(SHAREABLE_TEXT);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard API unavailable — non-critical
		}
	}, []);

	const handleShare = useCallback(async () => {
		try {
			await navigator.share({
				title: EVENT_TITLE,
				text: SHAREABLE_TEXT,
				url: EVENT_URL,
			});
		} catch {
			// user cancelled or API unavailable — non-critical
		}
	}, []);

	return (
		<div className="calendar-actions">
			<span className="calendar-actions__label">
				{t("calendarActions.addToCalendar")}
			</span>
			<div className="calendar-actions__buttons">
				<a
					href={buildGoogleCalendarUrl()}
					target="_blank"
					rel="noopener noreferrer"
					className="calendar-actions__btn"
					aria-label={t("calendarActions.google")}
				>
					<GoogleCalendarIcon />
					<span className="calendar-actions__btn-text">
						{t("calendarActions.googleLabel")}
					</span>
				</a>
				<a
					href={buildOutlookUrl()}
					target="_blank"
					rel="noopener noreferrer"
					className="calendar-actions__btn"
					aria-label={t("calendarActions.outlook")}
				>
					<OutlookIcon />
					<span className="calendar-actions__btn-text">
						{t("calendarActions.outlookLabel")}
					</span>
				</a>
				<a
					href={buildYahooUrl()}
					target="_blank"
					rel="noopener noreferrer"
					className="calendar-actions__btn"
					aria-label={t("calendarActions.yahoo")}
				>
					<YahooIcon />
					<span className="calendar-actions__btn-text">
						{t("calendarActions.yahooLabel")}
					</span>
				</a>
				<button
					type="button"
					className="calendar-actions__btn"
					onClick={downloadIcs}
					aria-label={t("calendarActions.downloadIcs")}
				>
					<DownloadIcon />
					<span className="calendar-actions__btn-text">
						{t("calendarActions.downloadLabel")}
					</span>
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
					<span className="calendar-actions__btn-text">
						{copied
							? t("calendarActions.copied")
							: t("calendarActions.copyLabel")}
					</span>
				</button>
				{canShare && (
					<button
						type="button"
						className="calendar-actions__btn"
						onClick={handleShare}
						aria-label={t("calendarActions.share")}
					>
						<ShareIcon />
						<span className="calendar-actions__btn-text">
							{t("calendarActions.shareLabel")}
						</span>
					</button>
				)}
			</div>
		</div>
	);
}
