// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 24e — Mescalero YouTube Shorts carousel.
// Wave 28b — wired to The Fight For Our Existence Podcast
// (@fight4ourexistencepodcast, channel UCCzkF6zRCRfZ0oxxsiPzG6w) +
// added a SegmentedControl to flip sort order between newest-first
// (default) and oldest-first, with the user's choice persisted to
// localStorage under "cdn-shorts-sort".
//
// Renders horizontal thumbnail strip; click opens Cloudscape Modal with
// in-place YouTube embed. Build-time data source: public/data/youtube-shorts.json
// (produced by scripts/fetch-youtube-shorts.mjs). When the JSON is empty,
// the component renders an empty-state message — it does NOT return null,
// so the slot remains a stable presence in the rotating feed grid.

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Modal from "@cloudscape-design/components/modal";
import SegmentedControl from "@cloudscape-design/components/segmented-control";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import "./youtube-shorts-carousel.css";
import { YouTubeSpinPlaceholder } from "./youtube-spin-placeholder";

export interface YouTubeShort {
	videoId: string;
	title: string;
	thumbnailUrl: string;
	publishedAt: string;
}

export interface YouTubeShortsCarouselProps {
	/** Optional override — when provided, skips the network fetch (used in tests). */
	shorts?: YouTubeShort[];
	/** Optional custom data source URL; defaults to /data/youtube-shorts.json. */
	dataUrl?: string;
}

const DEFAULT_DATA_URL = "/data/youtube-shorts.json";

/** localStorage key persisting the user's sort preference between visits. */
export const SHORTS_SORT_STORAGE_KEY = "cdn-shorts-sort";

type ShortsSortOrder = "newest" | "oldest";

function readStoredSort(): ShortsSortOrder {
	if (typeof window === "undefined") return "newest";
	try {
		const raw = window.localStorage.getItem(SHORTS_SORT_STORAGE_KEY);
		return raw === "oldest" ? "oldest" : "newest";
	} catch {
		return "newest";
	}
}

function writeStoredSort(value: ShortsSortOrder): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(SHORTS_SORT_STORAGE_KEY, value);
	} catch {
		// ignore storage failures (private mode, quota, etc.)
	}
}

async function fetchShorts(url: string): Promise<YouTubeShort[]> {
	try {
		const res = await fetch(url);
		if (!res.ok) return [];
		const data = (await res.json()) as YouTubeShort[];
		return Array.isArray(data) ? data : [];
	} catch {
		return [];
	}
}

export default function YouTubeShortsCarousel({
	shorts: shortsProp,
	dataUrl = DEFAULT_DATA_URL,
}: YouTubeShortsCarouselProps = {}) {
	const { t } = useTranslation();
	const [shorts, setShorts] = useState<YouTubeShort[]>(shortsProp ?? []);
	const [ready, setReady] = useState<boolean>(shortsProp !== undefined);
	const [activeIndex, setActiveIndex] = useState(0);
	const [modalShortId, setModalShortId] = useState<string | null>(null);
	const [sortOrder, setSortOrder] = useState<ShortsSortOrder>(() =>
		readStoredSort(),
	);
	const [sortAnnouncement, setSortAnnouncement] = useState<string>("");
	const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

	useEffect(() => {
		if (shortsProp !== undefined) return;
		let cancelled = false;
		fetchShorts(dataUrl).then((data) => {
			if (cancelled) return;
			setShorts(data);
			setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, [shortsProp, dataUrl]);

	// Source JSON arrives in newest-first order from the YouTube RSS feed.
	// Reverse for oldest-first; do not mutate the source array.
	const orderedShorts = useMemo<YouTubeShort[]>(
		() => (sortOrder === "oldest" ? shorts.slice().reverse() : shorts),
		[shorts, sortOrder],
	);

	const handleSortChange = useCallback(
		(next: ShortsSortOrder) => {
			if (next === sortOrder) return;
			setSortOrder(next);
			writeStoredSort(next);
			setActiveIndex(0);
			setSortAnnouncement(
				next === "oldest"
					? t("feedPage.shortsSort.changedAriaOldest")
					: t("feedPage.shortsSort.changedAriaNewest"),
			);
		},
		[sortOrder, t],
	);

	const focusThumb = useCallback((next: number) => {
		setActiveIndex(next);
		// defer focus until the next render's ref attaches
		queueMicrotask(() => buttonsRef.current[next]?.focus());
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
			if (orderedShorts.length === 0) return;
			if (e.key === "ArrowRight") {
				e.preventDefault();
				focusThumb((i + 1) % orderedShorts.length);
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				focusThumb((i - 1 + orderedShorts.length) % orderedShorts.length);
			} else if (e.key === "Home") {
				e.preventDefault();
				focusThumb(0);
			} else if (e.key === "End") {
				e.preventDefault();
				focusThumb(orderedShorts.length - 1);
			}
		},
		[orderedShorts.length, focusThumb],
	);

	const activeShort =
		orderedShorts.find((s) => s.videoId === modalShortId) ?? null;

	const announce = ready
		? orderedShorts.length > 0
			? `${t("feedPage.shortsNowShowing")} ${activeIndex + 1} ${t("feedPage.articleAriaConnector")} ${orderedShorts.length}`
			: t("feedPage.shortsEmpty")
		: "";

	// Wave 52 — newest/oldest for the spin placeholder.
	// posts[0] = newest (RSS order), posts[posts.length-1] = oldest.
	const newestShort = shorts.length > 0 ? shorts[0] : null;
	const oldestShort = shorts.length > 1 ? shorts[shorts.length - 1] : null;

	return (
		<Container
			header={
				// Wave 42a — Bryan asked: "instead of putting Hosted by Ma-tonth
				// (Rolling Fox)... under 'Mescalero shorts on YouTube' replace
				// 'Mescalero shorts on YouTube' with it". The wave 24e
				// Cloudscape <Header variant="h2"> + the wave 41a body Box that
				// rendered the host blurb under the header are both retired —
				// the host attribution IS the header now. role="heading" +
				// aria-level=2 reasserts the h2 ARIA contract since we're
				// trading Cloudscape's <h2> chrome for the custom div. The
				// .feed-shorts__attribution-header CSS rule (in
				// youtube-shorts-carousel.css) clamps the font-size with
				// clamp() and caps at 2 lines via -webkit-line-clamp so the
				// blurb fits responsively at every viewport — addressing
				// Bryan's "wasted / awkward spacing on this card" note.
				// feedPage.shortsHeader is preserved as the aria-label on the
				// inner carousel <div role="group"> below so AT users still
				// hear "Mescalero shorts on YouTube" as the carousel
				// description even though the visible header is now the host
				// blurb.
				<div
					className="feed-shorts__attribution-header"
					role="heading"
					aria-level={2}
				>
					{t("feedPage.shortsHostBlurb")}
				</div>
			}
		>
			{/* Wave 52 — spin placeholder shown while loading or when data is empty */}
			{!ready ? (
				<YouTubeSpinPlaceholder
					newest={null}
					oldest={null}
					spinLabel={t("feedPage.spinBtnLabel")}
					ariaLabel={t("feedPage.spinPlaceholderAriaLabel")}
					i18n={{
						newestBadge: t("feedPage.spinNewestBadge"),
						oldestBadge: t("feedPage.spinOldestBadge"),
					}}
				/>
			) : orderedShorts.length === 0 ? (
				<>
					<YouTubeSpinPlaceholder
						newest={null}
						oldest={null}
						spinLabel={t("feedPage.spinBtnLabel")}
						ariaLabel={t("feedPage.spinPlaceholderAriaLabel")}
						i18n={{
							newestBadge: t("feedPage.spinNewestBadge"),
							oldestBadge: t("feedPage.spinOldestBadge"),
						}}
					/>
					<Box
						color="text-status-inactive"
						fontSize="body-s"
						data-testid="shorts-empty-state"
					>
						{t("feedPage.shortsEmpty")}
					</Box>
				</>
			) : (
				<>
					<YouTubeSpinPlaceholder
						newest={newestShort}
						oldest={oldestShort}
						spinLabel={t("feedPage.spinBtnLabel")}
						ariaLabel={t("feedPage.spinPlaceholderAriaLabel")}
						onSelect={(id) => setModalShortId(id)}
						i18n={{
							newestBadge: t("feedPage.spinNewestBadge"),
							oldestBadge: t("feedPage.spinOldestBadge"),
						}}
					/>
					<div className="feed-shorts-carousel__sort" data-testid="shorts-sort">
						<Box
							fontSize="body-s"
							color="text-status-inactive"
							margin={{ right: "xs" }}
						>
							<span id="shorts-sort-legend">
								{t("feedPage.shortsSort.legend")}
							</span>
						</Box>
						<SegmentedControl
							selectedId={sortOrder}
							ariaLabelledby="shorts-sort-legend"
							options={[
								{
									id: "newest",
									text: t("feedPage.shortsSort.newest"),
								},
								{
									id: "oldest",
									text: t("feedPage.shortsSort.oldest"),
								},
							]}
							onChange={({ detail }) =>
								handleSortChange(detail.selectedId as ShortsSortOrder)
							}
						/>
					</div>
					<div
						className="feed-shorts-carousel"
						role="group"
						aria-label={t("feedPage.shortsHeader")}
					>
						<ul
							className="feed-shorts-carousel__track"
							data-testid="shorts-track"
						>
							{orderedShorts.map((short, i) => (
								<li key={short.videoId} className="feed-shorts-carousel__item">
									<button
										type="button"
										ref={(el) => {
											buttonsRef.current[i] = el;
										}}
										className="feed-shorts-carousel__thumb"
										aria-label={`${t("feedPage.shortsPlay")}: ${short.title}`}
										data-testid="shorts-thumb"
										tabIndex={i === activeIndex ? 0 : -1}
										onFocus={() => setActiveIndex(i)}
										onClick={() => {
											setActiveIndex(i);
											setModalShortId(short.videoId);
										}}
										onKeyDown={(e) => handleKeyDown(e, i)}
									>
										<img
											src={short.thumbnailUrl}
											alt=""
											loading="lazy"
											width={320}
											height={180}
											className="feed-shorts-carousel__thumb-img"
										/>
										<span
											className="feed-shorts-carousel__play-overlay"
											aria-hidden="true"
										>
											▶
										</span>
										<span className="feed-shorts-carousel__title">
											{short.title}
										</span>
									</button>
								</li>
							))}
						</ul>
					</div>
					<Box
						margin={{ top: "xs" }}
						color="text-status-inactive"
						fontSize="body-s"
					>
						<span aria-live="polite" data-testid="shorts-live-region">
							{announce}
						</span>
						<span
							aria-live="polite"
							className="feed-shorts-carousel__sr-only"
							data-testid="shorts-sort-live-region"
						>
							{sortAnnouncement}
						</span>
					</Box>
				</>
			)}
			<Modal
				visible={modalShortId !== null}
				onDismiss={() => setModalShortId(null)}
				header={t("feedPage.shortsModalTitle")}
				closeAriaLabel={t("feedPage.shortsModalClose")}
				size="medium"
			>
				{activeShort && (
					<div className="feed-shorts-carousel__modal-frame">
						<iframe
							title={activeShort.title}
							src={`https://www.youtube.com/embed/${activeShort.videoId}`}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
							allowFullScreen
						/>
					</div>
				)}
			</Modal>
		</Container>
	);
}
