// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Breadcrumbs from "../../components/breadcrumbs";
import Navigation from "../../components/navigation";
import { useAndresLive } from "../../hooks/useAndresLive";
import { useChannelLive } from "../../hooks/useChannelLive";
import { useTranslation } from "../../hooks/useTranslation";
import Shell from "../../layouts/shell";
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../utils/locale";
import {
	applyTheme,
	initializeTheme,
	setStoredTheme,
	type Theme,
} from "../../utils/theme";
import { HelpPanelHome } from "../create-meeting/components/help-panel-home";
import AndresYoutubeLive from "./components/andres-youtube-live";
import ArrowheadNews from "./components/arrowhead-news";
import BuilderCenterCard from "./components/builder-center-card";
import { FeedAndmore, FeedAwsml } from "./components/feed-section";
import NextMeetup from "./components/next-meetup";
import { TwitchAws, TwitchAwsOnAir } from "./components/twitch-section";
import YoutubeCarousel from "./components/youtube-carousel";
import YouTubeChannelCarousel from "./components/youtube-channel-carousel";
import "./styles.css";

// builder center top-4 is rendered as its own pinned section (between two hr
// dividers, just below next-meetup) — NOT part of the rotating shuffled feed.
// twitch was previously one full-span card with two panes; split into per-channel
// cards so the 2-up grid is even (6 cells, 3 rows of 2 instead of 5 with one wide).
type SectionKey =
	| "youtube"
	| "twitchAws"
	| "twitchAwsOnAir"
	| "andmore"
	| "awsml"
	| "arrowhead"
	| "vbrownbag"
	| "theZacsShow";

// priority order for live hero — first live item wins the top slot
const LIVE_PRIORITY = [
	"andresYoutube",
	"theZacsShow",
	"vbrownbag",
	"twitchAwsOnAir",
	"twitchAws",
] as const;
type LiveKey = (typeof LIVE_PRIORITY)[number];

// stable shuffled order generated once per page load
const SECTION_KEYS: SectionKey[] = [
	"youtube",
	"twitchAws",
	"twitchAwsOnAir",
	"andmore",
	"awsml",
	"arrowhead",
	"vbrownbag",
	"theZacsShow",
];

const VBROWNBAG_IDS = [
	"VBROWNBAG_1",
	"VBROWNBAG_2",
	"VBROWNBAG_3",
	"VBROWNBAG_4",
	"VBROWNBAG_5",
	"VBROWNBAG_6",
	"VBROWNBAG_7",
];
const ZACSSHOW_IDS = [
	"ZACSSHOW_1",
	"ZACSSHOW_2",
	"ZACSSHOW_3",
	"ZACSSHOW_4",
	"ZACSSHOW_5",
	"ZACSSHOW_6",
	"ZACSSHOW_7",
];

function shuffled<T>(arr: T[]): T[] {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

function AppContent({
	theme,
	onThemeChange,
	locale,
	onLocaleChange,
	onOpenTools,
}: {
	theme: Theme;
	onThemeChange: (t: Theme) => void;
	locale: Locale;
	onLocaleChange: (l: Locale) => void;
	onOpenTools: () => void;
}) {
	const { t } = useTranslation();

	const [liveKeys, setLiveKeys] = useState<Set<string>>(new Set());
	// twitch channels confirmed offline — drop from gridOrder so the empty
	// card doesn't take up a slot. Confirmed via upfront gql probe OR via the
	// embed SDK OFFLINE event; see twitch-section.tsx for detection.
	const [offlineKeys, setOfflineKeys] = useState<Set<string>>(new Set());

	const markLive = useCallback((key: string, isLive: boolean) => {
		setLiveKeys((prev) => {
			// bail out if nothing changes — avoids remount loops when SDK re-fires
			if (prev.has(key) === isLive) return prev;
			const next = new Set(prev);
			if (isLive) next.add(key);
			else next.delete(key);
			return next;
		});
	}, []);

	const markOffline = useCallback((key: string, isOffline: boolean) => {
		setOfflineKeys((prev) => {
			if (prev.has(key) === isOffline) return prev;
			const next = new Set(prev);
			if (isOffline) next.add(key);
			else next.delete(key);
			return next;
		});
	}, []);

	const { live: andresLive, videoId: andresVideoId } = useAndresLive();
	const { live: vbrownbagLive, videoId: vbrownbagVideoId } = useChannelLive(
		"https://www.youtube.com/@vBrownBag/live",
	);
	const { live: zacsLive, videoId: zacsVideoId } = useChannelLive(
		"https://www.youtube.com/@thezacsshowtalkingaws/live",
	);

	// sections wired with live callbacks — stable because markLive is stable
	useEffect(() => {
		markLive("vbrownbag", vbrownbagLive);
	}, [vbrownbagLive, markLive]);

	useEffect(() => {
		markLive("theZacsShow", zacsLive);
	}, [zacsLive, markLive]);

	const sections = useMemo<Partial<Record<SectionKey, React.ReactNode>>>(
		() => ({
			youtube: <YoutubeCarousel />,
			twitchAws: (
				<TwitchAws
					onLiveChange={(live) => markLive("twitchAws", live)}
					onOfflineChange={(off) => markOffline("twitchAws", off)}
				/>
			),
			twitchAwsOnAir: (
				<TwitchAwsOnAir
					onLiveChange={(live) => markLive("twitchAwsOnAir", live)}
					onOfflineChange={(off) => markOffline("twitchAwsOnAir", off)}
				/>
			),
			andmore: <FeedAndmore />,
			awsml: <FeedAwsml />,
			arrowhead: <ArrowheadNews />,
			vbrownbag: (
				<YouTubeChannelCarousel
					name={t("feedPage.vbrownbagHeader")}
					channelUrl="https://www.youtube.com/@vBrownBag"
					videoIds={VBROWNBAG_IDS}
					live={vbrownbagLive}
					liveVideoId={vbrownbagVideoId}
				/>
			),
			theZacsShow: (
				<YouTubeChannelCarousel
					name={t("feedPage.theZacsShowHeader")}
					channelUrl="https://www.youtube.com/@thezacsshowtalkingaws"
					videoIds={ZACSSHOW_IDS}
					live={zacsLive}
					liveVideoId={zacsVideoId}
				/>
			),
		}),
		[
			markLive,
			markOffline,
			t,
			vbrownbagLive,
			vbrownbagVideoId,
			zacsLive,
			zacsVideoId,
		],
	);

	// stable shuffle — recomputed only if sections reference changes (it won't)
	// biome-ignore lint/correctness/useExhaustiveDependencies: SECTION_KEYS is module-level constant
	const shuffledOrder = useMemo<SectionKey[]>(() => shuffled(SECTION_KEYS), []);

	// union of twitch + andres live keys
	const allLiveKeys = useMemo(() => {
		const s = new Set(liveKeys);
		if (andresLive) s.add("andresYoutube");
		if (vbrownbagLive) s.add("vbrownbag");
		if (zacsLive) s.add("theZacsShow");
		return s;
	}, [liveKeys, andresLive, vbrownbagLive, zacsLive]);

	const liveToShow = LIVE_PRIORITY.filter((k) => allLiveKeys.has(k));
	const gridOrder = shuffledOrder.filter(
		(k) => !allLiveKeys.has(k) && !offlineKeys.has(k),
	);

	return (
		<ContentLayout
			header={<Header variant="h1">{t("feedPage.header")}</Header>}
		>
			{/* Stable hero slot — wrapper renders always so cards appearing /
			    disappearing don't unmount a parent and reflow content below.
			    Pair with sticky-poll on data sources gating `liveToShow` so
			    transient API failures don't flap the inner cards either. See
			    docs/design-system/stable-state.md. */}
			<div className="feed-live-hero cdn-stable-slot">
				{liveToShow.map((key) => (
					<div
						key={key}
						className="feed-grid__cell cdn-card feed-grid__cell--full feed-live-hero__card"
					>
						{key === "andresYoutube" ? (
							<AndresYoutubeLive videoId={andresVideoId} />
						) : (
							sections[key as SectionKey]
						)}
					</div>
				))}
				{liveToShow.length > 0 && <hr className="feed-section-divider" />}
			</div>
			<div className="feed-grid__cell cdn-card feed-grid__cell--full">
				<NextMeetup />
			</div>
			<hr className="feed-section-divider" />
			<div className="feed-grid__cell cdn-card feed-grid__cell--full">
				<BuilderCenterCard />
			</div>
			<hr className="feed-section-divider" />
			<div className="feed-grid">
				{gridOrder.map((key) => (
					<div key={key} className="feed-grid__cell cdn-card">
						{sections[key]}
					</div>
				))}
			</div>
		</ContentLayout>
	);
}

function BreadcrumbsContent() {
	const { t } = useTranslation();
	return (
		<Breadcrumbs
			active={{ text: t("feedPage.breadcrumb"), href: "/feed/index.html" }}
		/>
	);
}

export default function App() {
	const [theme, setTheme] = useState<Theme>(() => initializeTheme());
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());
	const [toolsOpen, setToolsOpen] = useState(false);

	const handleThemeChange = (newTheme: Theme) => {
		setTheme(newTheme);
		applyTheme(newTheme);
		setStoredTheme(newTheme);
	};

	const handleLocaleChange = (newLocale: Locale) => {
		setLocale(newLocale);
		applyLocale(newLocale);
		setStoredLocale(newLocale);
	};

	return (
		<Shell
			theme={theme}
			onThemeChange={handleThemeChange}
			locale={locale}
			onLocaleChange={handleLocaleChange}
			breadcrumbs={<BreadcrumbsContent />}
			navigation={<Navigation />}
			tools={<HelpPanelHome />}
			toolsOpen={toolsOpen}
			onToolsChange={setToolsOpen}
		>
			<AppContent
				theme={theme}
				onThemeChange={handleThemeChange}
				locale={locale}
				onLocaleChange={handleLocaleChange}
				onOpenTools={() => setToolsOpen(true)}
			/>
		</Shell>
	);
}
