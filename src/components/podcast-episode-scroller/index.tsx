// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SegmentedControl from "@cloudscape-design/components/segmented-control";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { STREAMS } from "../../lib/streams-order";
import "./styles.css";

/**
 * Wave 24c — Podcast episode scroller.
 *
 * Surfaces the last-N episodes of the active podcast feed below the
 * persistent player pill. Reads from the build-time
 * `/data/podcast-episodes.json` cache (extended by scripts/fetch-feeds.mjs
 * to include up to 50 episodes per podcast key, with date / duration /
 * optional <podcast:transcript> URL).
 *
 * Renders nothing when the active stream is not a podcast — the wrapper
 * mounted in the awsug shell can call this unconditionally and rely on
 * the gate.
 *
 * Sort: newest / oldest first. Selection persisted to localStorage so it
 * survives page reloads. Pagination: PAGE_SIZE rows per "load more" click.
 *
 * Accessibility: list region announces sort changes via aria-live=polite;
 * each play button gets an aria-label containing the episode title; the
 * currently-playing row exposes aria-current=true.
 */

export interface PodcastEpisode {
	readonly guid: string;
	readonly title: string;
	/** ISO 8601 datetime — empty string when feed omits pubDate */
	readonly pubDate: string;
	/** seconds; 0 when feed omits itunes:duration */
	readonly duration: number;
	readonly enclosureUrl: string;
	readonly transcriptUrl?: string;
}

interface PodcastEpisodeData {
	readonly title?: string | null;
	readonly subtitle?: string | null;
	readonly display?: string | null;
	readonly episodes?: PodcastEpisode[];
}

export interface PodcastEpisodeScrollerProps {
	/** When false the component renders nothing (radio stations skip it). */
	readonly isPodcast: boolean;
	/** Active stream key — used to select the matching episode array. */
	readonly currentStreamKey: string;
	/**
	 * Currently-playing enclosure URL — drives the aria-current marker on
	 * the matching row. Empty string when no episode override is active.
	 */
	readonly currentEpisodeUrl: string;
	/** Fired when a row's play button is clicked. */
	readonly onEpisodeSelect: (url: string, title: string) => void;
}

type SortDirection = "newest" | "oldest";

const PAGE_SIZE = 50;
const SORT_STORAGE_KEY = "cdn:podcast-scroller:sort:v1";

function readStoredSort(): SortDirection {
	try {
		const raw = localStorage.getItem(SORT_STORAGE_KEY);
		if (raw === "oldest") return "oldest";
	} catch {
		// localStorage unavailable — fall through to default
	}
	return "newest";
}

function writeStoredSort(value: SortDirection): void {
	try {
		localStorage.setItem(SORT_STORAGE_KEY, value);
	} catch {
		// non-fatal
	}
}

/** Format seconds as H:MM:SS or M:SS — empty string when value is 0/missing. */
function formatDuration(secs: number): string {
	if (!secs || secs <= 0 || !Number.isFinite(secs)) return "";
	const total = Math.floor(secs);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h > 0) {
		return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	}
	return `${m}:${String(s).padStart(2, "0")}`;
}

export function PodcastEpisodeScroller({
	isPodcast,
	currentStreamKey,
	currentEpisodeUrl,
	onEpisodeSelect,
}: PodcastEpisodeScrollerProps) {
	const { t, locale } = useTranslation();
	const [data, setData] = useState<Record<
		string,
		PodcastEpisodeData | null
	> | null>(null);
	const [sort, setSort] = useState<SortDirection>(() => readStoredSort());
	const [pageCount, setPageCount] = useState<number>(1);

	// Lazy-load the cache only when this scroller actually renders for a
	// podcast. Radio listeners never pay the network cost.
	useEffect(() => {
		if (!isPodcast) return;
		let cancelled = false;
		fetch("/data/podcast-episodes.json")
			.then((r) => (r.ok ? r.json() : null))
			.then((d: Record<string, PodcastEpisodeData | null> | null) => {
				if (cancelled) return;
				setData(d);
			})
			.catch(() => {
				if (cancelled) return;
				setData(null);
			});
		return () => {
			cancelled = true;
		};
	}, [isPodcast]);

	// Reset pagination when the active podcast or sort flips so the user
	// always re-enters at "first page" of the new view.
	// biome-ignore lint/correctness/useExhaustiveDependencies: pageCount reset is intentional on key/sort change
	useEffect(() => {
		setPageCount(1);
	}, [currentStreamKey, sort]);

	const podcastEntry = data?.[currentStreamKey] ?? null;
	const allEpisodes = useMemo<PodcastEpisode[]>(() => {
		const list = podcastEntry?.episodes ?? [];
		return Array.isArray(list) ? list : [];
	}, [podcastEntry]);

	const sortedEpisodes = useMemo<PodcastEpisode[]>(() => {
		const eps = [...allEpisodes];
		eps.sort((a, b) => {
			const aTime = a.pubDate ? Date.parse(a.pubDate) : 0;
			const bTime = b.pubDate ? Date.parse(b.pubDate) : 0;
			const aValid = Number.isFinite(aTime) ? aTime : 0;
			const bValid = Number.isFinite(bTime) ? bTime : 0;
			return sort === "newest" ? bValid - aValid : aValid - bValid;
		});
		return eps;
	}, [allEpisodes, sort]);

	const visibleEpisodes = sortedEpisodes.slice(0, pageCount * PAGE_SIZE);
	const hasMore = sortedEpisodes.length > visibleEpisodes.length;

	if (!isPodcast) return null;

	const streamDef = STREAMS.find((s) => s.key === currentStreamKey) ?? null;
	const podcastLabel = streamDef?.label ?? currentStreamKey;
	const headerText = `${podcastLabel}${t("feedPage.episodeScroller.headerSuffix")}`;
	const dateLocale = locale === "mx" ? "es-MX" : "en-US";
	const dateFormatter = new Intl.DateTimeFormat(dateLocale, {
		dateStyle: "medium",
	});

	function handleSortChange(next: SortDirection) {
		setSort(next);
		writeStoredSort(next);
	}

	function handleLoadMore() {
		setPageCount((c) => c + 1);
	}

	const playAriaTemplate = t("feedPage.episodeScroller.playEpisodeAria");
	const transcriptLabel = t("feedPage.episodeScroller.transcriptLink");
	const emptyLabel = t("feedPage.episodeScroller.empty");

	return (
		<section
			className="cdn-podcast-scroller"
			data-testid="podcast-episode-scroller"
			data-station={currentStreamKey}
		>
			<Container header={<Header variant="h3">{headerText}</Header>}>
				<div className="cdn-podcast-scroller__sort-bar">
					<SegmentedControl
						selectedId={sort}
						onChange={({ detail }) => {
							const id = detail.selectedId;
							if (id === "newest" || id === "oldest") {
								handleSortChange(id);
							}
						}}
						label={t("feedPage.episodeScroller.headerSuffix")}
						options={[
							{
								id: "newest",
								text: t("feedPage.episodeScroller.sortNewest"),
							},
							{
								id: "oldest",
								text: t("feedPage.episodeScroller.sortOldest"),
							},
						]}
					/>
				</div>
				<ul
					className="cdn-podcast-scroller__list"
					aria-live="polite"
					aria-label={headerText}
				>
					{visibleEpisodes.length === 0 ? (
						<li className="cdn-podcast-scroller__empty">{emptyLabel}</li>
					) : (
						visibleEpisodes.map((ep) => {
							const isCurrent =
								!!currentEpisodeUrl && ep.enclosureUrl === currentEpisodeUrl;
							const dateText =
								ep.pubDate && Number.isFinite(Date.parse(ep.pubDate))
									? dateFormatter.format(new Date(ep.pubDate))
									: "";
							const durationText = formatDuration(ep.duration);
							const playAria = playAriaTemplate.replace("{title}", ep.title);
							return (
								<li
									key={ep.guid}
									className={`cdn-podcast-scroller__row${
										isCurrent ? " cdn-podcast-scroller__row--current" : ""
									}`}
									aria-current={isCurrent ? "true" : undefined}
								>
									<button
										type="button"
										className="cdn-podcast-scroller__play"
										aria-label={playAria}
										onClick={() => onEpisodeSelect(ep.enclosureUrl, ep.title)}
									>
										<span aria-hidden="true">▶</span>
									</button>
									<span
										className="cdn-podcast-scroller__title"
										title={ep.title}
									>
										{ep.title}
									</span>
									{dateText && (
										<span className="cdn-podcast-scroller__date">
											{dateText}
										</span>
									)}
									{durationText && (
										<span className="cdn-podcast-scroller__duration">
											{durationText}
										</span>
									)}
									{ep.transcriptUrl ? (
										<a
											className="cdn-podcast-scroller__transcript"
											href={ep.transcriptUrl}
											target="_blank"
											rel="noopener noreferrer"
										>
											{transcriptLabel}
										</a>
									) : null}
								</li>
							);
						})
					)}
				</ul>
				{hasMore && (
					<div className="cdn-podcast-scroller__load-more">
						<Button onClick={handleLoadMore}>
							{t("feedPage.episodeScroller.loadMore")}
						</Button>
					</div>
				)}
			</Container>
		</section>
	);
}

export default PodcastEpisodeScroller;
