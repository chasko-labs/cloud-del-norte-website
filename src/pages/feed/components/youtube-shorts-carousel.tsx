// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 24e — Mescalero YouTube Shorts carousel.
// Renders horizontal thumbnail strip; click opens Cloudscape Modal with
// in-place YouTube embed. Build-time data source: public/data/youtube-shorts.json
// (produced by scripts/fetch-youtube-shorts.mjs). When the JSON is empty,
// the component renders an empty-state message — it does NOT return null,
// so the slot remains a stable presence in the rotating feed grid.

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Modal from "@cloudscape-design/components/modal";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import "./youtube-shorts-carousel.css";

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

	const focusThumb = useCallback((next: number) => {
		setActiveIndex(next);
		// defer focus until the next render's ref attaches
		queueMicrotask(() => buttonsRef.current[next]?.focus());
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
			if (shorts.length === 0) return;
			if (e.key === "ArrowRight") {
				e.preventDefault();
				focusThumb((i + 1) % shorts.length);
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				focusThumb((i - 1 + shorts.length) % shorts.length);
			} else if (e.key === "Home") {
				e.preventDefault();
				focusThumb(0);
			} else if (e.key === "End") {
				e.preventDefault();
				focusThumb(shorts.length - 1);
			}
		},
		[shorts.length, focusThumb],
	);

	const activeShort = shorts.find((s) => s.videoId === modalShortId) ?? null;

	const announce = ready
		? shorts.length > 0
			? `${t("feedPage.shortsNowShowing")} ${activeIndex + 1} ${t("feedPage.articleAriaConnector")} ${shorts.length}`
			: t("feedPage.shortsEmpty")
		: "";

	return (
		<Container
			header={<Header variant="h2">{t("feedPage.shortsHeader")}</Header>}
		>
			{shorts.length === 0 ? (
				<Box
					color="text-status-inactive"
					fontSize="body-s"
					data-testid="shorts-empty-state"
				>
					{t("feedPage.shortsEmpty")}
				</Box>
			) : (
				<>
					<div
						className="feed-shorts-carousel"
						role="group"
						aria-label={t("feedPage.shortsHeader")}
					>
						<ul
							className="feed-shorts-carousel__track"
							data-testid="shorts-track"
						>
							{shorts.map((short, i) => (
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
