// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 52 — spin-language placeholder primitive.
// Renders newest + oldest video preview cards with a spin button.
// Used by all 3 YouTube carousel components while data is loading (ready === false)
// or as an overlay once data is present.
//
// Wave 53 hook: data-spin-anchor marks the Babylon mount point.
// Wave 53 will replace the rotateY CSS transform with a Babylon scene.

import { useCallback, useState } from "react";
import "./youtube-carousel-spin.css";

export interface SpinItem {
	videoId: string;
	title: string;
	thumbnailUrl: string;
	publishedAt: string;
}

interface Props {
	/** The first (newest) item in the data set. */
	newest: SpinItem | null;
	/** The last (oldest) item in the data set. */
	oldest: SpinItem | null;
	/** Label shown in the spin button. */
	spinLabel: string;
	/** aria-label for the placeholder region. */
	ariaLabel: string;
	/** Called when a preview card is clicked (e.g., open video). */
	onSelect?: (videoId: string) => void;
	/** i18n strings */
	i18n: {
		newestBadge: string;
		oldestBadge: string;
	};
}

/** Format an ISO date string as a short relative label ("3 mo ago", "2 yr ago", etc.) */
function relativeDate(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime();
	const days = Math.floor(ms / 86_400_000);
	if (days < 1) return "today";
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months} mo ago`;
	return `${Math.floor(months / 12)} yr ago`;
}

export function YouTubeSpinPlaceholder({
	newest,
	oldest,
	spinLabel,
	ariaLabel,
	onSelect,
	i18n,
}: Props) {
	const [spinning, setSpinning] = useState(false);

	const toggleSpin = useCallback(() => {
		setSpinning((prev) => !prev);
	}, []);

	const items: Array<{ item: SpinItem; badge: string }> = [];
	if (newest) items.push({ item: newest, badge: i18n.newestBadge });
	if (oldest && oldest.videoId !== newest?.videoId)
		items.push({ item: oldest, badge: i18n.oldestBadge });

	return (
		/* Wave 53 hook: data-spin-anchor — Babylon will mount here */
		<div
			className="yt-carousel-placeholder"
			role="region"
			aria-label={ariaLabel}
			data-spin-anchor="true"
		>
			<div className="yt-placeholder-header">
				<span aria-hidden="true" />
				<button
					type="button"
					className="yt-spin-btn"
					onClick={toggleSpin}
					aria-pressed={spinning}
					data-testid="spin-btn"
				>
					{/* SVG chevron — wave 38b/c personality style */}
					<svg
						width="14"
						height="14"
						viewBox="0 0 14 14"
						aria-hidden="true"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M3 5l4 4 4-4" />
					</svg>
					{spinLabel}
				</button>
			</div>

			<div
				className={`yt-carousel-spin-root${spinning ? " yt-spin-root--spinning" : ""}`}
				data-testid="spin-root"
			>
				<div className="yt-spin-preview-cards">
					{items.map(({ item, badge }) => (
						<button
							type="button"
							key={item.videoId}
							className="yt-spin-card"
							onClick={() => onSelect?.(item.videoId)}
							aria-label={item.title}
							data-testid="spin-card"
						>
							<div className="yt-spin-card__thumb-wrap">
								<img
									src={item.thumbnailUrl}
									alt=""
									loading="lazy"
									className="yt-spin-card__thumb"
									onError={(e) => {
										(e.currentTarget as HTMLImageElement).style.display =
											"none";
									}}
								/>
								<span className="yt-spin-card__badge">{badge}</span>
								<span className="yt-spin-card__chevron" aria-hidden="true">
									▶
								</span>
							</div>
							<div className="yt-spin-card__body">
								<p className="yt-spin-card__title">{item.title}</p>
								<p className="yt-spin-card__date">
									{relativeDate(item.publishedAt)}
								</p>
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
