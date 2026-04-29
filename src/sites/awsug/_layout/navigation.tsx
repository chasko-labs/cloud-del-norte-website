// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import SideNavigation, {
	type SideNavigationProps,
} from "@cloudscape-design/components/side-navigation";

const MAIN = "https://clouddelnorte.org";

export default function AwsugNavigation() {
	const items: SideNavigationProps["items"] = [
		{ type: "link", text: "Meetings", href: "/meetings/index.html" },
		{ type: "link", text: "Admin", href: "/admin/index.html" },
		{ type: "divider" },
		{
			type: "section",
			text: "Main site",
			defaultExpanded: false,
			items: [
				{
					type: "link",
					text: "Community feed",
					href: `${MAIN}/feed/index.html`,
				},
				{
					type: "link",
					text: "Meetup schedule",
					href: `${MAIN}/meetings/index.html`,
				},
				{ type: "link", text: "Roadmap", href: `${MAIN}/roadmap/index.html` },
			],
		},
	];

	return (
		<SideNavigation
			activeHref={location.pathname}
			header={{ href: "/index.html", text: "Cloud Del Norte — Members" }}
			items={items}
			onFollow={(event) => {
				if (event.detail.type === "section-header") return;
				const href = event.detail.href;
				if (!event.detail.external && href && href !== "#") {
					event.preventDefault();
					window.location.href = href;
				}
			}}
		/>
	);
}
