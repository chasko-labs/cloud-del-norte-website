// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import { lazy, useEffect, useState } from "react";
import BabylonGate from "../../../components/babylon-gate";
import { useTranslation } from "../../../hooks/useTranslation";
import { YouTubeSpinPlaceholder } from "./youtube-spin-placeholder";

const BabylonSpinDemo = lazy(
	() => import("../../../components/babylon-spin-demo"),
);

// Base (English) video set. `yQNrgpIp1Fs` is Spanish-only — it is prepended
// for the "mx" locale below. `WUJUvTu2Qjo` was removed (preview did not render).
const BASE_VIDEO_IDS = ["S2G6eDE4Jok"];
const MX_ONLY_VIDEO_ID = "yQNrgpIp1Fs";

export default function YoutubeCarousel() {
	const { t, locale } = useTranslation();
	const [mounted, setMounted] = useState(false);
	const [current, setCurrent] = useState(0);

	// Spanish gets the mx-only video prepended; English sees only the base set.
	const VIDEO_IDS =
		locale === "mx" ? [MX_ONLY_VIDEO_ID, ...BASE_VIDEO_IDS] : BASE_VIDEO_IDS;

	// Wave 52 — static metadata for newest/oldest spin preview cards.
	// These mirror the resolved VIDEO_IDS above; no fetch script needed.
	const SPIN_ITEMS = [
		{
			videoId: VIDEO_IDS[0],
			title: "Featured video 1",
			thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO_IDS[0]}/hqdefault.jpg`,
			publishedAt: "2026-05-01",
		},
		{
			videoId: VIDEO_IDS[VIDEO_IDS.length - 1],
			title: "Featured video 3",
			thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO_IDS[VIDEO_IDS.length - 1]}/hqdefault.jpg`,
			publishedAt: "2025-11-01",
		},
	];

	useEffect(() => {
		setMounted(true);
	}, []);

	const prev = () =>
		setCurrent((c) => (c - 1 + VIDEO_IDS.length) % VIDEO_IDS.length);
	const next = () => setCurrent((c) => (c + 1) % VIDEO_IDS.length);

	// Clamp: the list length changes with locale, so a stale `current` from a
	// longer list must not index past the end (would embed ".../undefined").
	const safeIndex = current % VIDEO_IDS.length;
	const videoId = VIDEO_IDS[safeIndex];

	return (
		<Container
			header={<Header variant="h2">{t("feedPage.youtubeHeader")}</Header>}
		>
			{/* Wave 52/53 — spin placeholder shown before SSR mount.
		    Wave 53: BabylonGate enhances capable devices (≥medium) with a
		    Babylon spinning quad; incapable devices keep the CSS spin. */}
			{!mounted ? (
				<BabylonGate
					tier="medium"
					fallback={
						<YouTubeSpinPlaceholder
							newest={SPIN_ITEMS[0]}
							oldest={SPIN_ITEMS[1]}
							spinLabel={t("feedPage.spinBtnLabel")}
							ariaLabel={t("feedPage.spinPlaceholderAriaLabel")}
							onSelect={(id) => {
								const idx = VIDEO_IDS.indexOf(id);
								if (idx !== -1) setCurrent(idx);
							}}
							i18n={{
								newestBadge: t("feedPage.spinNewestBadge"),
								oldestBadge: t("feedPage.spinOldestBadge"),
							}}
						/>
					}
				>
					<BabylonSpinDemo thumbnailUrl={SPIN_ITEMS[0].thumbnailUrl} />
				</BabylonGate>
			) : (
				<div className="feed-carousel">
					<div className="feed-carousel__viewport">
						<div className="feed-carousel__frame">
							<iframe
								loading="lazy"
								src={`https://www.youtube.com/embed/${videoId}`}
								title={`${t("feedPage.youtubeFeaturedVideo")} ${safeIndex + 1} ${t("feedPage.articleAriaConnector")} ${VIDEO_IDS.length}`}
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
							/>
						</div>
					</div>
					<div className="feed-carousel__controls">
						<button
							type="button"
							className="feed-carousel__btn"
							onClick={prev}
							aria-label={t("feedPage.youtubePrevVideo")}
						>
							&#8592;
						</button>
						<span className="feed-carousel__counter">
							{safeIndex + 1} / {VIDEO_IDS.length}
						</span>
						<button
							type="button"
							className="feed-carousel__btn"
							onClick={next}
							aria-label={t("feedPage.youtubeNextVideo")}
						>
							&#8594;
						</button>
					</div>
				</div>
			)}
		</Container>
	);
}
