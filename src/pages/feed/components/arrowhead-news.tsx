// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import React, { useEffect, useState } from "react";
import articles from "../../../data/arrowhead-news.json";
import { useTranslation } from "../../../hooks/useTranslation";

export default function ArrowheadNews() {
	const { t } = useTranslation();
	const total = articles.length;
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: total is derived from a static JSON import — never changes at runtime
	useEffect(() => {
		if (paused || total <= 1) return;
		const id = setInterval(() => setIndex((i) => (i + 1) % total), 6000);
		return () => clearInterval(id);
	}, [paused, total]);

	const article = articles[index];

	return (
		<Container
			header={
				<Header variant="h2">
					Arrowhead Research Park
					<span className="feed-card-header-sub">at NMSU</span>
				</Header>
			}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-only hover-to-pause; keyboard users reach article links directly */}
			<div
				className="feed-article-carousel"
				onMouseEnter={() => setPaused(true)}
				onMouseLeave={() => setPaused(false)}
			>
				<div key={index} className="feed-article-carousel__item">
					<Box>
						<Badge color="blue">{article.source}</Badge>{" "}
						<Box
							color="text-status-inactive"
							fontSize="body-s"
							display="inline"
						>
							{article.date}
						</Box>
					</Box>
					<div className="feed-posts__title">
						<Link href={article.url} external>
							{article.title}
						</Link>
					</div>
					<Box color="text-body-secondary" fontSize="body-s">
						{article.excerpt}
					</Box>
				</div>
				<div className="feed-article-carousel__progress" aria-hidden="true">
					<div
						key={`progress-${index}`}
						className={`feed-article-carousel__progress-fill${paused ? "" : " feed-article-carousel__progress-fill--running"}`}
					/>
				</div>
				<div
					className="feed-article-carousel__dots"
					role="tablist"
					aria-label="article selector"
				>
					{(articles as { id: string }[]).map((a, i) => (
						<button
							key={a.id}
							role="tab"
							aria-selected={i === index}
							aria-label={`article ${i + 1} of ${total}`}
							className={`feed-article-carousel__dot${i === index ? " feed-article-carousel__dot--active" : ""}`}
							onClick={() => {
								setIndex(i);
								setPaused(true);
							}}
						/>
					))}
				</div>
			</div>
		</Container>
	);
}
