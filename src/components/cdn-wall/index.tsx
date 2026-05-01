// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import type React from "react";
import "./styles.css";

/**
 * cdn-wall — tumblr-style scaling card layout.
 *
 * children: a list of CdnCard instances (or any component that renders a
 * .cdn-card-slot at its root). the wall itself controls only column track
 * sizing, gap, and add/remove transitions. card geometry isolation is the
 * card's responsibility — see src/components/cdn-card/.
 *
 * grid: `grid-template-columns: repeat(auto-fill, minmax(--cdn-wall-col-min-w, 1fr))`.
 * cards reflow to fill the viewport. tokens drive all sizing — bumping
 * --cdn-wall-col-min-w in design-tokens.css globally rebalances every wall.
 *
 * add / remove: when card composition changes, only opacity transitions on the
 * appearing / disappearing slot. the grid track itself does not animate height
 * (animating grid tracks would re-trigger ancestor layout, defeating the
 * geometry guarantee). add a `data-leaving="true"` attribute on a card if you
 * want a fade-out window before unmounting; otherwise removal is instant and
 * the surviving cards reflow on the next paint.
 */

export interface CdnWallProps {
	children: React.ReactNode;
	/** optional className passthrough on the wall root */
	className?: string;
	/** override column min-width for this wall instance (token usually preferred) */
	columnMinWidth?: string;
	/** override gap for this wall instance (token usually preferred) */
	gap?: string;
}

export default function CdnWall({
	children,
	className,
	columnMinWidth,
	gap,
}: CdnWallProps) {
	const style = {} as React.CSSProperties & Record<string, string>;
	if (columnMinWidth) style["--cdn-wall-col-min-w"] = columnMinWidth;
	if (gap) style["--cdn-wall-gap"] = gap;

	return (
		<div
			className={`cdn-wall${className ? ` ${className}` : ""}`}
			style={style}
		>
			{children}
		</div>
	);
}

/**
 * cdn-wall-row — full-width row inside the wall (spans every column).
 *
 * use this for hero / live blocks that should sit above the auto-fill grid
 * without being squeezed into a single column track. children render
 * unconditionally so removing the inner card does not unmount the row, and
 * does not reflow the grid below.
 */
export function CdnWallRow({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={`cdn-wall-row${className ? ` ${className}` : ""}`}>
			{children}
		</div>
	);
}
