// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { LazyEmbed } from "../../../components/lazy-embed";

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
	return (
		<Container
			header={
				<Header
					variant="h2"
					actions={
						<Link
							href={authorUrl}
							external
							fontSize="body-s"
							rel="noopener noreferrer"
							target="_blank"
						>
							{author}
						</Link>
					}
				>
					{title}
				</Header>
			}
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
		</Container>
	);
}
