// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const props = {
	viewBox: "0 0 24 24",
	width: 24,
	height: 24,
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.5,
	strokeLinecap: "round" as const,
	strokeLinejoin: "round" as const,
};

/** Stylised triangle play — riffs on the dancer brand vocabulary. */
export function PodcastPlayIcon() {
	return (
		<svg {...props} aria-hidden="true">
			<polygon points="6,3 21,12 6,21" />
			<polygon points="6,6 17,12 6,18" strokeOpacity="0.35" />
		</svg>
	);
}

/** Two vertical bars — pause. */
export function PodcastPauseIcon() {
	return (
		<svg {...props} aria-hidden="true">
			<line x1="7" y1="4" x2="7" y2="20" />
			<line x1="17" y1="4" x2="17" y2="20" />
		</svg>
	);
}

/** Curved counter-clockwise arrow with inline '15'. */
export function SeekBackIcon() {
	return (
		<svg {...props} aria-hidden="true">
			<path d="M9 12a5 5 0 1 1 0 .01" />
			<polyline points="6,9 9,12 12,9" />
			<text
				x="9"
				y="17"
				fontSize="5.5"
				fontWeight="600"
				stroke="none"
				fill="currentColor"
				textAnchor="middle"
			>
				15
			</text>
		</svg>
	);
}

/** Curved clockwise arrow with inline '15' — mirror of SeekBackIcon. */
export function SeekForwardIcon() {
	return (
		<svg {...props} aria-hidden="true">
			<path d="M15 12a5 5 0 1 0 0 .01" />
			<polyline points="18,9 15,12 12,9" />
			<text
				x="15"
				y="17"
				fontSize="5.5"
				fontWeight="600"
				stroke="none"
				fill="currentColor"
				textAnchor="middle"
			>
				15
			</text>
		</svg>
	);
}

/** Skip-forward / next-episode: bar + chevron. */
export function NextEpisodeIcon() {
	return (
		<svg {...props} aria-hidden="true">
			<line x1="17" y1="5" x2="17" y2="19" />
			<polyline points="7,5 15,12 7,19" />
		</svg>
	);
}
