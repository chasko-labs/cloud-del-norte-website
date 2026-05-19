// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import "./live-pulse-dot.css";

/**
 * LivePulseDot — inline animated pulsing dot SVG.
 *
 * Wave 38b — sits inline before the meetup date-plate as a "next live
 * session" microcue. The dot itself is a solid steel-blue/teal disc
 * (currentColor), wrapped in a soft outer ring that breathes on a 2s loop
 * — the small idiosyncratic detail that gives the next-meetup card a bit
 * of character without competing with the marquee shimmer or the date-
 * plate diagonal-sweep VFX. Adjacent in spirit to featured-event's inline
 * AsciiSmirk after "game" — a tiny, quiet glyph that lives inside the
 * card body and rewards close inspection.
 *
 * Adopts the cooler steel-blue / teal palette via the parent type token
 * (color: var(--cdn-nm-live-dot) on light, lighter teal on dark) and a
 * matching outer-ring halo. Sized ~16px tall so it hugs the baseline
 * like an emoji and pairs visually with the date-plate text it sits
 * beside.
 *
 * Animations (CSS): the outer ring pulses opacity + scale on a 2s loop
 * (live-indicator vibe). The inner core stays solid. Reduced-motion
 * strips the animation; the static halo still reads as a soft ring.
 *
 * Accessibility: the wrapping span is aria-hidden — the date string
 * itself carries the meaning. The inner SVG uses role="img" + a title
 * element so AT that traverse roles can still discover the glyph as
 * a "live indicator".
 */
export default function LivePulseDot() {
	return (
		<span className="cdn-live-pulse-dot" aria-hidden="true">
			<svg
				className="cdn-live-pulse-dot__svg"
				viewBox="0 0 16 16"
				width="16"
				height="16"
				role="img"
				aria-label="live indicator"
				focusable="false"
			>
				<title>live indicator</title>
				{/* outer halo ring — opacity + scale pulse on 2s loop */}
				<circle
					className="cdn-live-pulse-dot__halo"
					cx="8"
					cy="8"
					r="7"
					fill="none"
					stroke="currentColor"
					strokeWidth="1"
					opacity="0.45"
				/>
				{/* inner core — solid disc */}
				<circle
					className="cdn-live-pulse-dot__core"
					cx="8"
					cy="8"
					r="3"
					fill="currentColor"
				/>
			</svg>
		</span>
	);
}
