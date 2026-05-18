// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import "./styles.css";

interface MeetupRsvpButtonProps {
	href: string;
	label: string;
	className?: string;
}

/**
 * Meetup-branded RSVP CTA. Renders a styled <a> using Meetup's brand red
 * (#ED1C40) with a recognizable white "M" mark. The mark is constructed as
 * an inline SVG (white M strokes inside a filled red circle) — this gives
 * brand instant-recognition without embedding Meetup's trademarked swarm
 * logo. Always opens in a new tab with rel="noreferrer".
 */
export default function MeetupRsvpButton({
	href,
	label,
	className,
}: MeetupRsvpButtonProps) {
	const cls = ["cdn-brand-btn", "cdn-brand-btn--meetup", className]
		.filter(Boolean)
		.join(" ");
	return (
		<a
			className={cls}
			href={href}
			target="_blank"
			rel="noreferrer"
			aria-label={`${label} (opens in new tab)`}
		>
			<svg
				className="cdn-brand-btn__mark"
				viewBox="0 0 24 24"
				width="22"
				height="22"
				aria-hidden="true"
				focusable="false"
			>
				<title>Meetup</title>
				<circle cx="12" cy="12" r="11" fill="#FFFFFF" />
				<path
					d="M6.5 8 L8.5 16 L12 11 L15.5 16 L17.5 8"
					stroke="#ED1C40"
					strokeWidth="2.4"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
			</svg>
			<span className="cdn-brand-btn__label">{label}</span>
			<svg
				className="cdn-brand-btn__external"
				viewBox="0 0 24 24"
				width="14"
				height="14"
				aria-hidden="true"
				focusable="false"
			>
				<path
					d="M14 4 L20 4 L20 10 M20 4 L11 13 M9 5 H6 a2 2 0 0 0 -2 2 v11 a2 2 0 0 0 2 2 h11 a2 2 0 0 0 2 -2 v-3"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
			</svg>
		</a>
	);
}
