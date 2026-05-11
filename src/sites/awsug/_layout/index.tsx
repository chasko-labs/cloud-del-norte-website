// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import ContentLayout from "@cloudscape-design/components/content-layout";
import HelpPanel from "@cloudscape-design/components/help-panel";
import Tabs from "@cloudscape-design/components/tabs";
import type React from "react";
import { useState } from "react";
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

export default function AwsugLayout({
	children,
}: {
	children: React.ReactNode;
}) {
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
			tools={<ToolsPanel />}
			identityHref="https://clouddelnorte.org/feed/index.html"
		>
			<ContentLayout>{children}</ContentLayout>
		</Shell>
	);
}
