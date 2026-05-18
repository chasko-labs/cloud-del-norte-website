// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useCallback, useState } from "react";
import "./event-bulbs-overlay.css";

/**
 * Bulb position data — coordinates are in the 1200×630 viewBox space of the
 * AWS Global Community Gatherings banner. The string of bulbs runs along the
 * upper edge in a gentle curve, with a few accent bulbs around the corners
 * and AWS Community badge area. Exact positions don't matter — flicker hides
 * imprecision. `delay` and `duration` stagger animations so bulbs don't sync.
 * A handful get faster cycles for liveness.
 */
type BulbPosition = {
	cx: number;
	cy: number;
	r: number;
	/** Animation delay in seconds (negative pushes start phase backward). */
	delay: number;
	/** Flicker cycle duration in seconds (3–7s, with 2-3 livelier ones). */
	duration: number;
};

const BULB_POSITIONS: BulbPosition[] = [
	// Top-edge curved string, left → right
	{ cx: 90, cy: 70, r: 8, delay: -0.4, duration: 5.2 },
	{ cx: 195, cy: 52, r: 7, delay: -1.7, duration: 6.1 },
	{ cx: 305, cy: 42, r: 9, delay: -2.9, duration: 4.4 },
	{ cx: 420, cy: 38, r: 7, delay: -0.9, duration: 5.8 },
	{ cx: 540, cy: 40, r: 8, delay: -3.6, duration: 3.2 }, // livelier
	{ cx: 660, cy: 44, r: 7, delay: -1.2, duration: 6.7 },
	{ cx: 780, cy: 50, r: 9, delay: -2.4, duration: 4.0 },
	{ cx: 900, cy: 58, r: 7, delay: -0.6, duration: 5.5 },
	{ cx: 1010, cy: 70, r: 8, delay: -2.1, duration: 6.3 },
	{ cx: 1110, cy: 88, r: 7, delay: -0.3, duration: 3.5 }, // livelier
	// Side / corner accents
	{ cx: 60, cy: 180, r: 6, delay: -1.5, duration: 6.9 },
	{ cx: 1140, cy: 200, r: 6, delay: -2.7, duration: 5.0 },
	{ cx: 80, cy: 320, r: 7, delay: -0.8, duration: 4.6 },
	{ cx: 1130, cy: 340, r: 7, delay: -3.1, duration: 3.8 }, // livelier
];

export default function EventBulbsOverlay() {
	const [twinklingId, setTwinklingId] = useState<number | null>(null);

	const handleClick = useCallback((id: number) => {
		setTwinklingId(id);
		// Match the .cdn-bulb--twinkling animation duration in the CSS (~600ms).
		window.setTimeout(() => {
			setTwinklingId((current) => (current === id ? null : current));
		}, 650);
	}, []);

	return (
		<svg
			className="cdn-bulbs-overlay"
			viewBox="0 0 1200 630"
			preserveAspectRatio="xMidYMid meet"
			aria-hidden="true"
			role="presentation"
			focusable="false"
		>
			<title>Decorative flickering bulbs</title>
			<defs>
				<filter
					id="cdn-bulb-halo"
					x="-100%"
					y="-100%"
					width="300%"
					height="300%"
				>
					<feGaussianBlur stdDeviation="3" />
				</filter>
			</defs>
			{BULB_POSITIONS.map((bulb, idx) => {
				const isTwinkling = twinklingId === idx;
				const className = `cdn-bulb${isTwinkling ? " cdn-bulb--twinkling" : ""}`;
				return (
					// biome-ignore lint/a11y/noStaticElementInteractions: decorative SVG inside aria-hidden parent — click is pure visual delight, no functional action
					<circle
						// biome-ignore lint/suspicious/noArrayIndexKey: bulb positions are static and stable
						key={idx}
						className={className}
						cx={bulb.cx}
						cy={bulb.cy}
						r={bulb.r}
						fill="#fde68a"
						style={{
							animationDelay: `${bulb.delay}s`,
							animationDuration: `${bulb.duration}s`,
						}}
						onMouseEnter={() => {
							/* hover state is also CSS-driven via :hover; this stub keeps a JS hook available for future per-bulb hover behaviors */
						}}
						onClick={() => handleClick(idx)}
					/>
				);
			})}
		</svg>
	);
}
