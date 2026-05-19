// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Link from "@cloudscape-design/components/link";
import { LazyEmbed } from "../../../components/lazy-embed";
import { SkeletonFrame } from "../../../components/skeleton";
import { useTranslation } from "../../../hooks/useTranslation";
import FeedCardShell from "./feed-card-shell";

export default function AndresYoutubeLive({
	videoId,
}: {
	videoId: string | null;
}) {
	const { t } = useTranslation();

	// Wave 36b — header copy carries an inline live-dot indicator (same
	// pattern as the previous Cloudscape Header). headerText accepts
	// ReactNode so the leading red-dot span renders inside the marquee
	// before the headline string.
	const headerText = (
		<>
			<span className="feed-twitch__live-dot" aria-hidden="true" />
			{` ${t("feedPage.andresYoutubeLiveHeader")}`}
		</>
	);

	const headerActions = (
		<Link href="https://www.youtube.com/@andmoredev" external fontSize="body-s">
			{t("feedPage.andresYoutubeChannel")}
		</Link>
	);

	return (
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
	);
}
