// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import ContentLayout from "@cloudscape-design/components/content-layout";
import HelpPanel from "@cloudscape-design/components/help-panel";
import Tabs from "@cloudscape-design/components/tabs";
import type React from "react";
import { useCallback, useState } from "react";
import {
	type ActivePlayerStream,
	useActivePlayerStream,
} from "../../../components/persistent-player";
import { PodcastEpisodeScroller } from "../../../components/podcast-episode-scroller";
import { SessionExpiredModal } from "../../../components/session-expired-modal";
import Shell from "../../../layouts/shell";
import { savePlayerState } from "../../../lib/player-persist";
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

/**
 * Wave 24c — sibling-of-the-player wiring. Reads the active stream via the
 * read-only useActivePlayerStream hook (exposed by persistent-player) and
 * passes the relevant fields into the scroller. The scroller renders nothing
 * for radio streams, so the wrapper is safe to mount unconditionally — the
 * vertical reservation only appears when a podcast is active.
 *
 * onEpisodeSelect:
 *   1. persists the chosen enclosure URL via savePlayerState so a page
 *      reload resumes on the same episode (existing podcast-resume contract)
 *   2. dispatches the `cdn:player:swap-episode` window event the player
 *      listens to (read-only on player core: the player adds the listener,
 *      not refactors existing logic). The player overrides rssAudioUrl +
 *      starts playback in response.
 */
function PodcastScrollerSibling() {
	const stream: ActivePlayerStream = useActivePlayerStream();
	const handleEpisodeSelect = useCallback(
		(url: string, _title: string) => {
			if (!stream.stationKey) return;
			savePlayerState({
				stationKey: stream.stationKey,
				stationUrl: url,
				stationLabel: stream.stationLabel ?? stream.stationKey,
				podcastEpisodeUrl: url,
				podcastCurrentTime: 0,
			});
			window.dispatchEvent(
				new CustomEvent("cdn:player:swap-episode", {
					detail: { url, title: _title },
				}),
			);
		},
		[stream.stationKey, stream.stationLabel],
	);
	return (
		<PodcastEpisodeScroller
			isPodcast={stream.isPodcast}
			currentStreamKey={stream.stationKey ?? ""}
			currentEpisodeUrl={stream.currentEpisodeUrl ?? ""}
			onEpisodeSelect={handleEpisodeSelect}
		/>
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
			hidePlayer
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
			identityHref="/"
		>
			<PendingApprovalBanner />
			<PodcastScrollerSibling />
			<ContentLayout>{children}</ContentLayout>
			<SessionExpiredModal />
		</Shell>
	);
}
