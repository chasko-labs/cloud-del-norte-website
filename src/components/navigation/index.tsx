// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import SideNavigation, {
	type SideNavigationProps,
} from "@cloudscape-design/components/side-navigation";
import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../hooks/useTranslation";
import { LioraPanel } from "../liora-panel";

export default function Navigation() {
	const { t } = useTranslation();
	const { isModerator } = useAuth();

	const items: SideNavigationProps["items"] = [
		{
			type: "link",
			text: t("navigation.roadmap"),
			href: "/roadmap/index.html",
		},
		{
			type: "link",
			text: t("navigation.meetings"),
			href: "/meetings/index.html",
		},
		...(isModerator
			? [
					{
						type: "link" as const,
						text: t("navigation.admin"),
						href: "/admin/index.html",
					},
				]
			: []),
		{ type: "divider" },
		{
			type: "section",
			text: t("navigation.resources"),
			defaultExpanded: false,
			items: [
				{
					type: "link",
					text: t("navigation.techDebtCountdowns"),
					href: "/maintenance-calendar/",
				},
				{
					type: "link",
					text: t("navigation.designSystem"),
					href: "/theme/index.html",
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
					href: "/learning/api/",
					defaultExpanded: false,
					items: [
						{
							type: "link",
							text: t("navigation.restOverview"),
							href: "/learning/api/#overview",
						},
						{
							type: "link",
							text: t("navigation.uniformInterface"),
							href: "/learning/api/#uniform-interface",
						},
						{
							type: "link",
							text: t("navigation.clientServer"),
							href: "/learning/api/#client-server",
						},
						{
							type: "link",
							text: t("navigation.stateless"),
							href: "/learning/api/#stateless",
						},
						{
							type: "link",
							text: t("navigation.cacheable"),
							href: "/learning/api/#cacheable",
						},
						{
							type: "link",
							text: t("navigation.layeredSystem"),
							href: "/learning/api/#layered-system",
						},
						{
							type: "link",
							text: t("navigation.codeOnDemand"),
							href: "/learning/api/#code-on-demand",
						},
						{
							type: "link",
							text: t("navigation.cheatSheet"),
							href: "/learning/api/#cheat-sheet",
						},
						{
							type: "link",
							text: t("navigation.howItWorks"),
							href: "/learning/api/#how-it-works",
						},
						{
							type: "link",
							text: t("navigation.projectResources"),
							href: "/learning/api/#resources",
						},
					],
				},
			],
		},
	];

	return (
		<>
			<SideNavigation
				activeHref={location.pathname}
				header={{ href: "/home/index.html", text: t("navigation.home") }}
				items={items}
				onFollow={(event) => {
					// Let section expand/collapse toggles pass through to Cloudscape
					if (event.detail.type === "section-header") return;

					// For actual links: prevent default SPA behavior, navigate via full page load
					const href = event.detail.href;
					if (!event.detail.external && href && href !== "#") {
						event.preventDefault();
						window.location.href = href;
					}
				}}
			/>
			<LioraPanel />
		</>
	);
}
