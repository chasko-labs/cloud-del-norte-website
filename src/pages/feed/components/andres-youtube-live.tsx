// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 48b — Andres YouTube Live fanfare uplift:
//   - Brand star (/brand/logo.svg) inline in marquee header
//   - Live-broadcast sigil (concentric rose arcs) SVG personality detail
//   - Depth stack: perspective + preserve-3d already on FeedCardShell base;
//     .ayl-container adds GPU hints gated to ≥768px per wave 37a discipline
//   - 2-line title clamp + clamp() font-size via feed-card-shell__marquee-text
//   - prefers-reduced-motion + body.cdn-scrolling gated in CSS

import Link from "@cloudscape-design/components/link";
import { LazyEmbed } from "../../../components/lazy-embed";
import { SkeletonFrame } from "../../../components/skeleton";
import { useTranslation } from "../../../hooks/useTranslation";
import "./andres-youtube-live.css";
import FeedCardShell from "./feed-card-shell";

/** Rose-tinted live-broadcast wave sigil — concentric arcs evoke broadcasting.
 *  aria-hidden; prefers-reduced-motion + cdn-scrolling pause integrated in CSS.
 */
function LiveBroadcastSigil() {
	return (
		<span className="ayl-sigil" aria-hidden="true">
			<svg
				className="ayl-sigil__svg"
				viewBox="0 0 28 28"
				width="22"
				height="22"
				role="presentation"
				aria-hidden="true"
				focusable="false"
			>
				{/* inner core dot */}
				<circle
					className="ayl-sigil__arc-core"
					cx="14"
					cy="14"
					r="3"
					fill="currentColor"
					opacity="0.9"
				/>
				{/* middle arc */}
				<path
					className="ayl-sigil__arc-mid"
					d="M 7.5 19 A 8 8 0 0 1 7.5 9"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					opacity="0.65"
				/>
				<path
					className="ayl-sigil__arc-mid"
					d="M 20.5 9 A 8 8 0 0 1 20.5 19"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					opacity="0.65"
				/>
				{/* outer arc */}
				<path
					className="ayl-sigil__arc-outer"
					d="M 4 22 A 12 12 0 0 1 4 6"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					opacity="0.38"
				/>
				<path
					className="ayl-sigil__arc-outer"
					d="M 24 6 A 12 12 0 0 1 24 22"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					opacity="0.38"
				/>
			</svg>
		</span>
	);
}

export default function AndresYoutubeLive({
	videoId,
}: {
	videoId: string | null;
}) {
	const { t } = useTranslation();

	// Wave 48b — header: brand star + live-dot + title in a compact row.
	// The FeedCardShell marquee-text already applies 2-line clamp + clamp()
	// font-size so this ReactNode just needs to supply the inline content.
	const headerText = (
		<span className="ayl-header-row">
			{/* rose-tinted brand star */}
			<span
				className="ayl-brand-star"
				role="img"
				aria-label={t("feedPage.upcomingVirtualEventUgMarkLabel")}
			>
				<img
					src="/brand/logo.svg"
					alt=""
					aria-hidden="true"
					width={16}
					height={16}
					onError={(e) => {
						(e.currentTarget as HTMLImageElement).style.display = "none";
					}}
				/>
			</span>
			{/* live-broadcast sigil — personality detail */}
			<LiveBroadcastSigil />
			{t("feedPage.andresYoutubeLiveHeader")}
		</span>
	);

	const headerActions = (
		<Link href="https://www.youtube.com/@andmoredev" external fontSize="body-s">
			{t("feedPage.andresYoutubeChannel")}
		</Link>
	);

	return (
		<div className="ayl-container">
			<FeedCardShell
				headerText={headerText}
				headerActions={headerActions}
				palette="rose"
			>
				{videoId ? (
					<div className="feed-carousel">
						<div className="feed-carousel__viewport">
							<div className="feed-carousel__frame">
								<LazyEmbed
									src={`https://www.youtube.com/embed/${videoId}?autoplay=0`}
									title={t("feedPage.andresYoutubeLiveTitle")}
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
								/>
							</div>
						</div>
					</div>
				) : (
					<SkeletonFrame />
				)}
			</FeedCardShell>
		</div>
	);
}
