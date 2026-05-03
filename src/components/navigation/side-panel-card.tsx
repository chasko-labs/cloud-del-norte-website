// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Narrow article card variant for the side-nav drawer column. Mirrors the
// feed's article card visual language (glass plate, brand palette) but with
// tighter sizing (~280-300px max width) so it fits beneath the SideNavigation
// items without forcing a horizontal scroll on the drawer.
//
// Cloudscape's SideNavigation `items` prop only supports its built-in item
// types (link / section / divider / expandable-link-group / link-group) — no
// arbitrary JSX. So this card is rendered OUTSIDE the SideNavigation tree, as
// a floating block under a labelled section header that lives in the same
// React fragment. See ../index.tsx for the wiring.

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
