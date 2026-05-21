// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import SideNavigation, {
	type SideNavigationProps,
} from "@cloudscape-design/components/side-navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePanelOpen } from "../../hooks/usePanelOpen";
import { useTranslation } from "../../hooks/useTranslation";
import FionaFrame from "../fiona-frame";
import "./fiona.css";
import "./menu-signage.css";

// w24 v0.0.0098 added contributor article cards (andres / bryan / wayne) here
// as a floating <nav> sibling to SideNavigation. v0.0.0104 moved them to the
// right help panel (HelpPanelHome) because the floating block was covering
// Fiona. The card component itself now lives at
// src/pages/create-meeting/components/side-panel-card.tsx.

// Silence the dynamically-loaded fiona-embed bundle's [gestureQueue]
// console.info chatter (30+ lines per gesture.glb load). We can't edit the
// vendor bundle directly, so install a console.info filter at module load
// BEFORE mountFionaPanel runs. Only swallow messages whose first arg starts
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
	// Wave 66: only mount FionaFrame (which owns a WebGL context) when the
	// navigation drawer is open. Saves a context on every page where the panel
	// is closed (the default on mobile and narrow viewports).
	const panelOpen = usePanelOpen();

	// Wave 70c: collision detection — unmount Fiona when the nav menu is tall
	// enough to collide with her slot. Uses ResizeObserver on the nav container.
	const navRef = useRef<HTMLDivElement>(null);
	const [fionaFits, setFionaFits] = useState(true);

	useEffect(() => {
		const el = navRef.current;
		if (!el) return;
		const check = () => {
			const navEl =
				el.querySelector<HTMLElement>('[class*="side-navigation"]') ??
				el.firstElementChild;
			if (!navEl) {
				setFionaFits(true);
				return;
			}
			const navHeight = navEl.scrollHeight;
			const containerHeight = el.clientHeight;
			// If container has no measurable height (SSR/jsdom), assume fits
			if (containerHeight === 0) {
				setFionaFits(true);
				return;
			}
			// Fiona frame needs ~320px minimum. If remaining space < 280px, hide her.
			const remaining = containerHeight - navHeight;
			setFionaFits(remaining >= 280);
		};
		check();
		const ro = new ResizeObserver(check);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const showFiona = panelOpen && fionaFits;

	const currentPath = location.pathname;
	const isOnPlans =
		currentPath.startsWith("/roadmap") ||
		currentPath.startsWith("/theme") ||
		currentPath.startsWith("/plans") ||
		currentPath.startsWith("/costs");
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
				...(import.meta.env.DEV
					? [
							{
								type: "link" as const,
								text: t("navigation.costs"),
								href: "/costs/index.html",
							},
						]
					: []),
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
		<div ref={navRef} className="cdn-nav-dock">
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
			{showFiona && <FionaFrame />}
		</div>
	);
}
