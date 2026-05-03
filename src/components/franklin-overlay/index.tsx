// franklin-overlay — static SVG silhouette of the Franklin Mountains.
//
// Replaces the retired BabylonJS franklin scene (src/franklin/) per Bryan
// v0.0.0081: "the mountain scene doesnt seem to be offering benefit worth
// the pain as it doesnt really look like mountains. lets instead generate
// an svg in the shape of the christian mountains and provide that as an
// overlay on our backdrop to give the same shadowey appearance".
//
// Mounting: rendered as a sibling to the canvas-2D dark starfield from
// el-paso-nights.tsx. Visibility is theme-driven via useWallpaperTheme()
// — the overlay only renders in dark mode so the light-mode dune scene
// stays unobstructed.
//
// Geometry: silhouette path + el paso star path are built by path-builder.ts
// (pure TS, unit-tested). Both are inlined into the SVG so we ship one
// component file with no extra HTTP request.
//
// v0.0.0104 — El Paso Star reduced to a humble lightbulb landmark. Dropped
// the orange/white core (no solid centre per Bryan: "center shouldn't be
// solid white"). 5 lavender bulbs cycle ON sequentially via CSS keyframes
// with phase offsets of 1/5 each — only ~1 bulb is bright at a time, the
// rest are dim. Reads as a single mountainside bulb blinking, not a logo.

import type { ReactElement } from "react";
import { useWallpaperTheme } from "../../hooks/useWallpaperTheme";
import {
	buildSilhouettePath,
	buildStarBodyPath,
	buildStarBulbTips,
	EL_PASO_STAR_ANCHOR,
	VIEWBOX_HEIGHT,
	VIEWBOX_WIDTH,
} from "./path-builder";
import "./styles.css";

const SILHOUETTE_PATH = buildSilhouettePath();
const STAR_BODY_PATH = buildStarBodyPath(
	EL_PASO_STAR_ANCHOR.cx,
	EL_PASO_STAR_ANCHOR.cy,
	EL_PASO_STAR_ANCHOR.radius,
);
const STAR_BULB_TIPS = buildStarBulbTips(
	EL_PASO_STAR_ANCHOR.cx,
	EL_PASO_STAR_ANCHOR.cy,
	EL_PASO_STAR_ANCHOR.radius,
);

/**
 * FranklinOverlay — static SVG mountain silhouette + El Paso Star landmark.
 * Renders only in dark mode (el-paso-nights theme). Decorative — aria-hidden,
 * pointer-events:none. The 5 bulb circles cycle ON in rotation via CSS
 * keyframes; prefers-reduced-motion holds them static at the baseline opacity
 * (handled in styles.css).
 */
export function FranklinOverlay(): ReactElement | null {
	const theme = useWallpaperTheme();
	if (theme !== "el-paso-nights") return null;

	return (
		<div className="franklin-overlay" aria-hidden="true">
			<svg
				viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
				preserveAspectRatio="xMidYMax slice"
				xmlns="http://www.w3.org/2000/svg"
				role="presentation"
			>
				{/* Silhouette — mirrored horizontally per v0.0.0087. North Franklin
				    (tallest peak, authored at x=240) now renders visually at x=760
				    (right side); foothills slope off the bottom-right corner. We
				    apply the flip via SVG `transform` on this `<g>` (rather than
				    CSS on the parent <svg>) so that ONLY the silhouette mirrors —
				    the star sits outside this group and keeps its asymmetric
				    logo-star geometry un-mirrored. */}
				<g transform={`scale(-1, 1) translate(-${VIEWBOX_WIDTH}, 0)`}>
					<path d={SILHOUETTE_PATH} className="franklin-overlay__silhouette" />
				</g>
				{/* El Paso Star — humble lightbulb landmark (v0.0.0104). Two layers:
				      • star-body  → slim violet 5-arm star at opacity 0.55 (no
				        solid centre — empty star-cutout reads through to the
				        mountain silhouette behind)
				      • star-bulb  → 5 lavender bulbs at each arm tip, animated
				        with CSS keyframe phase offsets so they cycle ON in
				        rotation (bulb 0 peaks at t=0, bulb 1 at t=1/5, etc.)
				    Soft violet halo cascades from the wrapping `<g>` filter so
				    the whole composite reads as a single mountainside twinkle. */}
				<g className="franklin-overlay__star">
					<path d={STAR_BODY_PATH} className="franklin-overlay__star-body" />
					{STAR_BULB_TIPS.map((tip) => (
						<circle
							key={tip.cycleIndex}
							cx={tip.cx}
							cy={tip.cy}
							r={tip.r}
							className={`franklin-overlay__star-bulb franklin-overlay__star-bulb--c${tip.cycleIndex}`}
						/>
					))}
				</g>
			</svg>
		</div>
	);
}

export default FranklinOverlay;
