// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import SideNavigation, {
	type SideNavigationProps,
} from "@cloudscape-design/components/side-navigation";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../hooks/useTranslation";
import LioraFrame from "../liora-frame";
import "./liora.css";

// w24 v0.0.0098 added contributor article cards (andres / bryan / wayne) here
// as a floating <nav> sibling to SideNavigation. v0.0.0104 moved them to the
// right help panel (HelpPanelHome) because the floating block was covering
// Liora. The card component itself now lives at
// src/pages/create-meeting/components/side-panel-card.tsx.

// Silence the dynamically-loaded liora-embed bundle's [gestureQueue]
// console.info chatter (30+ lines per gesture.glb load). We can't edit the
// vendor bundle directly, so install a console.info filter at module load
// BEFORE mountLioraPanel runs. Only swallow messages whose first arg starts
// with "[gestureQueue]" — every other info call passes through unchanged.
// Not restored: gestureQueue calls fire across the panel lifetime.
if (typeof console !== "undefined") {
	const originalInfo = console.info.bind(console);
	console.info = (...args: unknown[]) => {
		const first = args[0];
		if (typeof first === "string" && first.startsWith("[gestureQueue]")) return;
		originalInfo(...args);
	};
}

export default function Navigation() {
	const { t } = useTranslation();
	const { isModerator } = useAuth();

	const currentPath = location.pathname;
	const isOnPlans =
		currentPath.startsWith("/roadmap") ||
		currentPath.startsWith("/theme") ||
		currentPath.startsWith("/plans");
	const isOnReferences =
		currentPath.startsWith("/learning") ||
		currentPath.startsWith("/maintenance-calendar");

	// home (feed) is reachable via the "cloud del norte" header above and the top-nav title.
	// about is reachable from the right-side info panel only — not duplicated in the left nav.
	const items: SideNavigationProps["items"] = [
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
			defaultExpanded: isOnPlans,
			items: [
				{
					type: "link",
					text: t("navigation.plansPage"),
					href: "/plans/index.html",
				},
				{
					type: "link",
					text: t("navigation.ugRoadmap"),
					href: "/roadmap/index.html",
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
			defaultExpanded: isOnReferences,
			items: [
				{
					type: "link",
					text: t("navigation.techDebtCountdowns"),
					// Trailing-slash routes hit the S3+CloudFront default fallback
					// and serve the feed bundle instead of the page. Always link
					// to /…/index.html explicitly (matches /meetings/index.html).
					href: "/maintenance-calendar/index.html",
				},
				{
					type: "expandable-link-group",
					text: t("navigation.apiGuide"),
					href: "/learning/api/index.html",
					defaultExpanded: currentPath.startsWith("/learning"),
					items: [
						// Submenu hashes match Container id="" anchors in
						// src/pages/learning/api/RiftRewindDashboard.tsx.
						// Removed nav links to #rest-overview / #cheat-sheet /
						// #how-it-works / #resources — no Container on the page
						// to scroll to. Re-add when content lands.
						{
							type: "link",
							text: t("navigation.uniformInterface"),
							href: "/learning/api/index.html#uniform-interface",
						},
						{
							type: "link",
							text: t("navigation.clientServer"),
							href: "/learning/api/index.html#client-server",
						},
						{
							type: "link",
							text: t("navigation.stateless"),
							href: "/learning/api/index.html#stateless",
						},
						{
							type: "link",
							text: t("navigation.cacheable"),
							href: "/learning/api/index.html#cacheable",
						},
						{
							type: "link",
							text: t("navigation.layeredSystem"),
							href: "/learning/api/index.html#layered-system",
						},
						{
							type: "link",
							text: t("navigation.codeOnDemand"),
							href: "/learning/api/index.html#code-on-demand",
						},
					],
				},
			],
		},
	];

	return (
		<>
			<SideNavigation
				activeHref={location.pathname + location.hash}
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
			<LioraFrame />
		</>
	);
}
