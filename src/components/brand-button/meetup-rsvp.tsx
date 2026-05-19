// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import "./styles.css";

export type MeetupRsvpVariant = "red" | "violet";

interface MeetupRsvpButtonProps {
	href: string;
	label: string;
	className?: string;
	/**
	 * Visual variant. Defaults to `"red"` — the Meetup brand red (#ED1C40).
	 * Pass `"violet"` to render the same M mark + label inside the Cloud
	 * Del Norte purple→violet gradient (used on the featured-event card
	 * where the page voice explicitly excludes red).
	 */
	variant?: MeetupRsvpVariant;
}

/**
 * Meetup-branded RSVP CTA. Renders a styled <a> using either Meetup's brand
 * red (#ED1C40) — the default — or a brand-violet override. The mark is
 * constructed as an inline SVG (filled circle + M strokes) so we get
 * brand instant-recognition without embedding Meetup's trademarked swarm
 * logo. Always opens in a new tab with rel="noreferrer".
 *
 * Variants:
 *   - "red"    — default. White circle + Meetup-red M, red gradient bg.
 *   - "violet" — featured-event override. White circle + cdn-purple M
 *                stroke, sitting on the brand purple→violet gradient.
 *                Avoids the page-level "no red" rule on that surface.
 */
export default function MeetupRsvpButton({
	href,
	label,
	className,
	variant = "red",
}: MeetupRsvpButtonProps) {
	const variantClass =
		variant === "violet"
			? "cdn-brand-btn--meetup-violet"
			: "cdn-brand-btn--meetup";
	const cls = ["cdn-brand-btn", variantClass, className]
		.filter(Boolean)
		.join(" ");
	const mStrokeColor = variant === "violet" ? "#5a1f8a" : "#ED1C40";
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
					stroke={mStrokeColor}
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
