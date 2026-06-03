// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from "react";
import "./styles.css";

interface SpeakeasyRsvpButtonProps {
	href: string;
	label: string;
	className?: string;
}

/**
 * On-site RSVP CTA — the PRIMARY action on event cards. Renders a styled <a>
 * over a purple→violet gradient with the Cloud del Norte brand logo (the
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
 *
 * Wave 30a — error handling: if /brand/logo.svg fails to load (deploy
 * misconfig, CDN cache miss, ad-blocker quirk), the button swaps the broken
 * <img> for a static inline 5-point star SVG so it still has a visible
 * leading mark and the button doesn't render label-only-with-a-gap. The
 * fallback uses currentColor so it inherits the cream button label color.
 */
export default function SpeakeasyRsvpButton({
	href,
	label,
	className,
}: SpeakeasyRsvpButtonProps) {
	const [logoBroken, setLogoBroken] = useState(false);
	const cls = ["cdn-brand-btn", "cdn-brand-btn--speakeasy", className]
		.filter(Boolean)
		.join(" ");
	return (
		<a className={cls} href={href} aria-label={label}>
			{logoBroken ? (
				// Static 5-point star fallback — no animation, no external asset
				// dependency. Sized to match the 22×22 logo so layout doesn't
				// reflow when the swap happens after first paint.
				<svg
					className="cdn-brand-btn__mark cdn-brand-btn__mark--logo"
					width={22}
					height={22}
					viewBox="0 0 24 24"
					aria-hidden="true"
					focusable="false"
				>
					<title>Cloud del Norte</title>
					<polygon
						points="12,2 14.9,8.6 22,9.3 16.5,14.1 18.2,21 12,17.3 5.8,21 7.5,14.1 2,9.3 9.1,8.6"
						fill="currentColor"
					/>
				</svg>
			) : (
				<img
					className="cdn-brand-btn__mark cdn-brand-btn__mark--logo"
					src="/brand/logo.svg"
					alt="Cloud del Norte"
					width={22}
					height={22}
					onError={() => setLogoBroken(true)}
				/>
			)}
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
