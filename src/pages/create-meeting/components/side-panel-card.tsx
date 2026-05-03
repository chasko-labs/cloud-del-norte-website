// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Narrow article card variant rendered inside the right-side help panel
// (Cloudscape AppLayout `tools` slot — see help-panel-home.tsx). Mirrors the
// feed's article card visual language (glass plate, brand palette) at a
// tight ~280-300px width so it fits in the panel column.
//
// w24 v0.0.0098 originally placed these under the LEFT side-navigation
// drawer; w24 v0.0.0104 moved them to the right help panel under the
// organizer's section because they were blocking Liora.

import "./side-panel-card.css";

export interface SidePanelCardItem {
	title: string;
	url: string;
	author?: string;
	authorBadge?: string;
	blurb?: string;
}

interface SidePanelCardProps {
	item: SidePanelCardItem;
}

export default function SidePanelCard({ item }: SidePanelCardProps) {
	return (
		<a
			className="side-panel-card"
			href={item.url}
			target="_blank"
			rel="noopener noreferrer"
		>
			<span className="side-panel-card__title">{item.title}</span>
			{item.author ? (
				<span className="side-panel-card__author">
					by {item.author}
					{item.authorBadge ? (
						<span className="side-panel-card__badge">{item.authorBadge}</span>
					) : null}
				</span>
			) : null}
			{item.blurb ? (
				<span className="side-panel-card__blurb">{item.blurb}</span>
			) : null}
		</a>
	);
}
