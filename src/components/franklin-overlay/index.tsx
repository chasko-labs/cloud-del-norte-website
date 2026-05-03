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

import type { ReactElement } from "react";
import { useWallpaperTheme } from "../../hooks/useWallpaperTheme";
import {
	buildSilhouettePath,
	buildStarBodyPath,
	buildStarBulbTips,
	buildStarCorePath,
	EL_PASO_STAR_ANCHOR,
	VIEWBOX_HEIGHT,
	VIEWBOX_WIDTH,
} from "./path-builder";
import "./styles.css";

const SILHOUETTE_PATH = buildSilhouettePath();
// El Paso Star — composite CDN logo-star landmark (v0.0.0102). Three layers
// stacked back-to-front so the violet body silhouettes against the dark sky,
// the orange core glows through, and the lavender bulb tips read as discrete
// pinpoints at each arm end. See path-builder.ts for full design rationale.
const STAR_BODY_PATH = buildStarBodyPath(
	EL_PASO_STAR_ANCHOR.cx,
	EL_PASO_STAR_ANCHOR.cy,
	EL_PASO_STAR_ANCHOR.radius,
);
const STAR_CORE_PATH = buildStarCorePath(
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
 * pointer-events:none. No animation; respects prefers-reduced-motion by
 * being inert.
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
				{/* El Paso Star — composite CDN brand logo-star landmark (v0.0.0102).
				    Authored at the pre-mirrored x-coord (340 = 1000 - 660) so it
				    lands on the south face of the now-visually-left South Franklin
				    without inheriting the silhouette's flip. Three stacked layers:
				      • star-body  → cdn-violet 5-arm slim starburst (the brand
				        silhouette; hero tip leans upper-right at +20°)
				      • star-core  → aws-orange concentric inner star (warm core
				        that reads through the violet body, evokes the white-hot
				        centre where multiple arm paths overlap in the brand mark)
				      • star-bulb  → 5 cdn-lavender bulb tips at each arm end; the
				        hero bulb (index 0) is enlarged + aws-orange to match the
				        cdn-bulb-tip-hero focal accent in src/components/logo-svg
				    Glow halo cascades from the wrapping `<g class="franklin-overlay__star">`
				    via the CSS drop-shadow filter chain in styles.css. */}
				<g className="franklin-overlay__star">
					<path d={STAR_BODY_PATH} className="franklin-overlay__star-body" />
					<path d={STAR_CORE_PATH} className="franklin-overlay__star-core" />
					{STAR_BULB_TIPS.map((tip) => (
						<circle
							key={`${tip.cx.toFixed(2)}-${tip.cy.toFixed(2)}`}
							cx={tip.cx}
							cy={tip.cy}
							r={tip.r}
							className={
								tip.hero
									? "franklin-overlay__star-bulb franklin-overlay__star-bulb--hero"
									: "franklin-overlay__star-bulb"
							}
						/>
					))}
				</g>
			</svg>
		</div>
	);
}

export default FranklinOverlay;
