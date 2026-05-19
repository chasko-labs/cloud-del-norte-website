// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import "./global-globe.css";

/**
 * Wave 38c — GlobalGlobe — inline pulsing globe SVG.
 *
 * The upcoming-virtual-event card's signature personality detail (in-family
 * with featured-event's AsciiSmirk). Sits inline next to the word "global"
 * in the card description as a visual punctuation that ties the word to the
 * AWS Global Community Gatherings international/virtual mood — a small
 * cosmic globe with a soft violet/lavender breathing pulse and a slow rim
 * rotation that evokes a planet still spinning while builders dial in from
 * every time zone.
 *
 * Visual: ~16px tall (vertical-align: middle so it hugs the text baseline
 * like emoji); a circular planet body with two latitude curves + one
 * meridian curve drawn as light strokes; a soft outer halo ring that
 * breathes; the meridian rotates slowly under prefers-reduced-motion: no-
 * preference. currentColor is used for stroke + fill so the parent type
 * token carries the brand-correct hue (deep cdn-purple on light, lavender
 * on dark — scoped under .feed-upcoming-virtual-event*).
 *
 * Accessibility: aria-hidden + aria-label="globe" — decorative, the
 * description text carries meaning. All animations are gated behind
 * prefers-reduced-motion: no-preference; under reduce the static glyph
 * still reads as a globe.
 */
export default function GlobalGlobe() {
	return (
		<span className="cdn-global-globe" aria-hidden="true">
			<svg
				className="cdn-global-globe__svg"
				viewBox="0 0 24 24"
				width="16"
				height="16"
				role="img"
				aria-label="globe"
				focusable="false"
			>
				<title>globe</title>
				{/* outer halo ring — breathes opacity + scale (CSS keyframes) */}
				<circle
					className="cdn-global-globe__halo"
					cx="12"
					cy="12"
					r="11"
					fill="none"
					stroke="currentColor"
					strokeWidth="0.6"
					opacity="0.45"
				/>
				{/* planet body — solid disc filled with currentColor at low opacity
				    so the latitude/meridian strokes still read on top */}
				<circle
					className="cdn-global-globe__body"
					cx="12"
					cy="12"
					r="8"
					fill="currentColor"
					fillOpacity="0.16"
					stroke="currentColor"
					strokeWidth="1"
				/>
				{/* equator — straight horizontal line through the disc center */}
				<line
					className="cdn-global-globe__equator"
					x1="4"
					y1="12"
					x2="20"
					y2="12"
					stroke="currentColor"
					strokeWidth="0.8"
					opacity="0.7"
				/>
				{/* upper latitude — shallow arc above the equator */}
				<path
					className="cdn-global-globe__lat-upper"
					d="M 5 9 Q 12 7 19 9"
					fill="none"
					stroke="currentColor"
					strokeWidth="0.7"
					opacity="0.55"
				/>
				{/* lower latitude — mirror arc below the equator */}
				<path
					className="cdn-global-globe__lat-lower"
					d="M 5 15 Q 12 17 19 15"
					fill="none"
					stroke="currentColor"
					strokeWidth="0.7"
					opacity="0.55"
				/>
				{/* meridian — vertical ellipse-arc that rotates around the planet */}
				<ellipse
					className="cdn-global-globe__meridian"
					cx="12"
					cy="12"
					rx="3"
					ry="8"
					fill="none"
					stroke="currentColor"
					strokeWidth="0.8"
					opacity="0.7"
				/>
			</svg>
		</span>
	);
}
