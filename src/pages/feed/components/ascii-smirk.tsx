// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import "./ascii-smirk.css";

/**
 * AsciiSmirk — inline animated ASCII-style smirking face SVG.
 *
 * Sits inline next to the "game." line in the featured-event description as
 * a smirk-line hook. Drawn with squarish/blocky stroke geometry to evoke a
 * retro-terminal `;)` / `^,~` aesthetic. ~18px tall — fits inline like emoji.
 *
 * Animations (CSS): default loop (4–6s subtle eye blink + smirk widen),
 * intermittent micro-twitch (eyebrow raise every 12–18s), and on hover a
 * squint + spark-glow flourish. All animations respect prefers-reduced-motion
 * (disabled under reduce). aria-hidden + aria-label='smirk' — decorative;
 * description text carries meaning.
 */
export default function AsciiSmirk() {
	return (
		<span className="cdn-ascii-smirk" aria-hidden="true">
			<svg
				className="cdn-ascii-smirk__svg"
				viewBox="0 0 32 22"
				width="22"
				height="16"
				role="img"
				aria-label="smirk"
				focusable="false"
			>
				<title>smirk</title>
				{/* spark / glow ring — only visible on hover (CSS) */}
				<circle
					className="cdn-ascii-smirk__spark"
					cx="16"
					cy="11"
					r="11"
					fill="none"
					stroke="currentColor"
					strokeWidth="0.6"
					opacity="0"
				/>
				{/* left eye — squarish dot, blinks on loop */}
				<rect
					className="cdn-ascii-smirk__eye cdn-ascii-smirk__eye--left"
					x="8"
					y="6"
					width="3"
					height="4"
					rx="0.5"
					fill="currentColor"
				/>
				{/* right eye — same dot, raised brow above twitches */}
				<rect
					className="cdn-ascii-smirk__eye cdn-ascii-smirk__eye--right"
					x="21"
					y="6"
					width="3"
					height="4"
					rx="0.5"
					fill="currentColor"
				/>
				{/* right eyebrow — short tick that twitches up periodically */}
				<rect
					className="cdn-ascii-smirk__brow"
					x="20"
					y="3"
					width="5"
					height="1.4"
					rx="0.5"
					fill="currentColor"
				/>
				{/* asymmetric smirk mouth — flat-then-curl-up on the right side
				    drawn as a path so we can blocky-step the corner like a
				    monospace glyph would */}
				<path
					className="cdn-ascii-smirk__mouth"
					d="M 8 16 L 18 16 L 20 14.5 L 22 12.5"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.6"
					strokeLinecap="square"
					strokeLinejoin="miter"
				/>
			</svg>
		</span>
	);
}
