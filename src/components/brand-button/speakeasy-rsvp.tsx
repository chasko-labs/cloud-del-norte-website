// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import "./styles.css";

interface SpeakeasyRsvpButtonProps {
	href: string;
	label: string;
	className?: string;
}

/**
 * On-site RSVP CTA — the PRIMARY action on event cards. Renders a styled <a>
 * over a purple→violet gradient with the Cloud Del Norte brand logo (the
 * animated violet star + bulbs) inline as the leading mark. Internal link,
 * no new tab.
 *
 * Design intent: this button reads as PRIMARY (larger, glowing pulse ring)
 * to encourage on-site signup over the secondary external Meetup CTA.
 *
 * The brand logo at /brand/logo.svg is referenced as <img>; modern browsers
 * render the SVG's internal CSS animations (bulb blink, arm pulse) inside
 * <img src> contexts, adding a subtle motion accent at the 22×22 mark size.
 * `prefers-reduced-motion` is handled inside the SVG itself.
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
			<img
				className="cdn-brand-btn__mark cdn-brand-btn__mark--logo"
				src="/brand/logo.svg"
				alt="Cloud Del Norte"
				width={22}
				height={22}
			/>
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
