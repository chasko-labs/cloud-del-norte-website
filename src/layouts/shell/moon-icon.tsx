// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Stylized crescent moon icon. v0.0.0109 — abandons the date-driven
 * synodic phase math (v0.0.0069 → v0.0.0107). Six successive geometric
 * rewrites all rendered as a near-full disc at the live phase: the lit
 * area was either too thin (paper-cut terminator vanishes against the
 * violet halo) or sweep-flag inversions painted the dark side. Bryan
 * verdict across five reviews: "looks like sun".
 *
 * Trade: lose astronomical accuracy, gain immediate recognizability.
 * Single closed path renders a fat waxing crescent — concave inner
 * boundary unmistakably reads as MOON. Same shape used by Material
 * Icons, Hero Icons, Apple SF Symbols.
 *
 * Path geometry (22×22 viewBox, fits inside disc of r=8.5 at center 11,11):
 *   - Outer convex limb: arc starting at upper-right (16.2, 3.6) sweeping
 *     CCW (large-arc, sweep=0) the long way around through left/bottom
 *     to lower-right (18.6, 15.6).
 *   - Inner concave bite: arc back from (18.6, 15.6) up to (16.2, 3.6)
 *     using a smaller r=6.5 ellipse, large-arc + sweep=1 so it bows
 *     INWARD, carving the bite that makes the shape a crescent.
 *   - Mouth opens to the upper-right — reads as a fat waxing crescent.
 *   - No defs, mask, or clipPath: Cloudscape's iconSvg clones the SVG
 *     into the overflow menu DOM, which historically broke id refs.
 */
export const MOON_CRESCENT_PATH =
	"M 16.2,3.6 A 8.5,8.5 0 1,0 18.6,15.6 A 6.5,6.5 0 1,1 16.2,3.6 Z";

export function MoonSvg() {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative; aria-hidden inside button which carries ariaLabel
		<svg
			className="cdn-svg-moon"
			width="22"
			height="22"
			viewBox="0 0 22 22"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			data-testid="cdn-moon-icon"
		>
			<path className="cdn-svg-moon__disc" d={MOON_CRESCENT_PATH} />
		</svg>
	);
}
