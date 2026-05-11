// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import SideNavigation, {
	type SideNavigationProps,
} from "@cloudscape-design/components/side-navigation";
import FionaFrame from "../../../components/fiona-frame";
import SpeakeasySign from "../../../components/speakeasy-sign";

const MAIN = "https://clouddelnorte.org";

export default function AwsugNavigation() {
	const items: SideNavigationProps["items"] = [
		{ type: "link", text: "meetings", href: "/meetings/index.html" },
		{ type: "link", text: "admin", href: "/admin/index.html" },
		{ type: "divider" },
		{
			type: "section",
			text: "resources",
			items: [
				{ type: "link", text: "plans", href: `${MAIN}/plans/index.html` },
				{ type: "link", text: "roadmap", href: `${MAIN}/roadmap/index.html` },
				{
					type: "link",
					text: "design system",
					href: `${MAIN}/theme/index.html`,
				},
			],
		},
		{ type: "divider" },
		{
			type: "section",
			text: "learning",
			items: [
				{
					type: "link",
					text: "tech debt countdowns",
					href: `${MAIN}/maintenance-calendar/index.html`,
				},
				{
					type: "link",
					text: "api guide",
					href: `${MAIN}/learning/api/index.html`,
				},
			],
		},
	];

	return (
		<>
			<a
				href="/index.html"
				style={{ display: "block", textDecoration: "none" }}
			>
				<SpeakeasySign />
			</a>
			<SideNavigation
				activeHref={location.pathname}
				items={items}
				onFollow={(event) => {
					if (event.detail.type === "section-header") return;
					const href = event.detail.href;
					if (href && href.startsWith("/")) {
						event.preventDefault();
						window.location.href = href;
					}
				}}
			/>
			<FionaFrame />
		</>
	);
}
