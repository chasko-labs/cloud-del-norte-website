// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import ContentLayout from "@cloudscape-design/components/content-layout";
import HelpPanel from "@cloudscape-design/components/help-panel";
import Tabs from "@cloudscape-design/components/tabs";
import type React from "react";
import { useState } from "react";
import { SessionExpiredModal } from "../../../components/session-expired-modal";
import Shell from "../../../layouts/shell";
import { HelpPanelHome } from "../../../pages/create-meeting/components/help-panel-home";
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../../utils/locale";
import {
	applyTheme,
	initializeTheme,
	setStoredTheme,
	type Theme,
} from "../../../utils/theme";
import { PendingApprovalBanner } from "../components/pending-approval-banner";
import { SpeakerForm } from "../components/speaker-form";
import AwsugNavigation from "./navigation";
import "./styles.css";

function ToolsPanel() {
	return (
		<HelpPanel header={<h2>Community</h2>}>
			<Tabs
				tabs={[
					{ id: "info", label: "Info", content: <HelpPanelHome /> },
					{
						id: "speak",
						label: "Speak",
						content: <SpeakerForm />,
					},
				]}
			/>
		</HelpPanel>
	);
}

export interface AwsugLayoutProps {
	children: React.ReactNode;
	/** Hide the tools (help) panel entirely — used in immersive mode */
	toolsHide?: boolean;
	/** Override the navigation-open state. When provided, the layout uses this
	 *  value instead of Shell's internal state. The user can still toggle the
	 *  drawer open/closed via the hamburger — this only sets the initial/forced value. */
	navigationOpen?: boolean;
	/** Callback when the user toggles navigation. Required when navigationOpen is provided. */
	onNavigationChange?: (open: boolean) => void;
}

export default function AwsugLayout({
	children,
	toolsHide,
	navigationOpen,
	onNavigationChange,
}: AwsugLayoutProps) {
	const [theme, setTheme] = useState<Theme>(() => initializeTheme());
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

	return (
		<Shell
			theme={theme}
			onThemeChange={(t) => {
				setTheme(t);
				applyTheme(t);
				setStoredTheme(t);
			}}
			locale={locale}
			onLocaleChange={(l) => {
				setLocale(l);
				applyLocale(l);
				setStoredLocale(l);
			}}
			navigation={<AwsugNavigation />}
			tools={toolsHide ? undefined : <ToolsPanel />}
			toolsHide={toolsHide}
			navigationOpen={navigationOpen}
			onNavigationChange={onNavigationChange}
			identityHref="/"
		>
			<PendingApprovalBanner />
			<ContentLayout>{children}</ContentLayout>
			<SessionExpiredModal />
		</Shell>
	);
}
