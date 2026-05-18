// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import "./styles.css";

interface SpeakeasyRsvpButtonProps {
	href: string;
	label: string;
	className?: string;
}

/**
 * On-site RSVP CTA with Cloud Del Norte brand identity. Renders a styled <a>
 * over a purple→violet gradient with a white 5-point star (the same star mark
 * carried in the UG glyph + favicon). Internal link, no new tab.
 */
export default function SpeakeasyRsvpButton({
	href,
	label,
	className,
}: SpeakeasyRsvpButtonProps) {
	const cls = ["cdn-brand-btn", "cdn-brand-btn--speakeasy", className]
		.filter(Boolean)
		.join(" ");
	return (
		<a className={cls} href={href} aria-label={label}>
			<svg
				className="cdn-brand-btn__mark"
				viewBox="0 0 24 24"
				width="22"
				height="22"
				aria-hidden="true"
				focusable="false"
			>
				<title>Cloud Del Norte</title>
				<path
					d="M12 2 L14.6 9.2 L22 9.6 L16.2 14.2 L18.2 21.4 L12 17.3 L5.8 21.4 L7.8 14.2 L2 9.6 L9.4 9.2 Z"
					fill="#FFFFFF"
				/>
			</svg>
			<span className="cdn-brand-btn__label">{label}</span>
			<svg
				className="cdn-brand-btn__chevron"
				viewBox="0 0 24 24"
				width="14"
				height="14"
				aria-hidden="true"
				focusable="false"
			>
				<path
					d="M9 6 L15 12 L9 18"
					stroke="currentColor"
					strokeWidth="2.4"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
			</svg>
		</a>
	);
}
