// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Link from "@cloudscape-design/components/link";
import { LazyEmbed } from "../../../components/lazy-embed";
import FeedCardShell from "./feed-card-shell";

interface FeaturedVideoCardProps {
	videoId: string;
	title: string;
	author: string;
	authorUrl: string;
	thumbnailUrl?: string;
}

export default function FeaturedVideoCard({
	videoId,
	title,
	author,
	authorUrl,
	thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
}: FeaturedVideoCardProps) {
	const headerActions = (
		<Link
			href={authorUrl}
			external
			fontSize="body-s"
			rel="noopener noreferrer"
			target="_blank"
		>
			{author}
		</Link>
	);

	return (
		<FeedCardShell
			headerText={title}
			headerActions={headerActions}
			palette="lavender"
		>
			<div className="feed-carousel">
				<div className="feed-carousel__viewport">
					<div className="feed-carousel__frame">
						<LazyEmbed
							src={`https://www.youtube.com/embed/${videoId}`}
							title={title}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
						/>
					</div>
				</div>
				{/* Wave 48c — right column: thumbnail (hidden fallback) + link with
				    descriptive label so the touch target is larger and the column
				    reads as a companion panel rather than just "Watch on YouTube". */}
				<div className="featured-video-card__fallback">
					<img
						src={thumbnailUrl}
						alt={title}
						loading="lazy"
						width={480}
						height={360}
						style={{ display: "none" }}
						data-testid="featured-video-thumbnail"
					/>
					<Link href={`https://www.youtube.com/watch?v=${videoId}`} external>
						Watch on YouTube
					</Link>
				</div>
			</div>
		</FeedCardShell>
	);
}
