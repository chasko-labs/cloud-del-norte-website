// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import SideNavigation, {
	type SideNavigationProps,
} from "@cloudscape-design/components/side-navigation";
import { useTranslation } from "../../../hooks/useTranslation";

const BASE = "https://clouddelnorte.org";

export default function AuthNavigation() {
	const { t } = useTranslation();

	const items: SideNavigationProps["items"] = [
		{
			type: "link",
			text: t("navigation.meetings"),
			href: `${BASE}/meetings/index.html`,
		},
		{ type: "divider" },
		{
			type: "section",
			text: t("navigation.resources"),
			defaultExpanded: false,
			items: [
				{
					type: "link",
					text: t("navigation.ugRoadmap"),
					href: `${BASE}/roadmap/index.html`,
				},
				{
					type: "link",
					text: t("navigation.techDebtCountdowns"),
					href: `${BASE}/maintenance-calendar/`,
				},
				{
					type: "link",
					text: t("navigation.designSystem"),
					href: `${BASE}/theme/index.html`,
				},
			],
		},
		{ type: "divider" },
		{
			type: "section",
			text: t("navigation.learning"),
			defaultExpanded: false,
			items: [
				{
					type: "expandable-link-group",
					text: t("navigation.apiGuide"),
					href: `${BASE}/learning/api/`,
					defaultExpanded: false,
					items: [
						{
							type: "link",
							text: t("navigation.restOverview"),
							href: `${BASE}/learning/api/#overview`,
						},
						{
							type: "link",
							text: t("navigation.uniformInterface"),
							href: `${BASE}/learning/api/#uniform-interface`,
						},
						{
							type: "link",
							text: t("navigation.stateless"),
							href: `${BASE}/learning/api/#stateless`,
						},
						{
							type: "link",
							text: t("navigation.cacheable"),
							href: `${BASE}/learning/api/#cacheable`,
						},
					],
				},
			],
		},
	];

	return (
		<SideNavigation
			activeHref=""
			header={{ href: `${BASE}/feed/index.html`, text: t("shell.siteTitle") }}
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
