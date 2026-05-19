// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Icon from "@cloudscape-design/components/icon";
import Link from "@cloudscape-design/components/link";
import { useEffect, useState } from "react";
import posts from "../../../data/andres-medium.json";
import { useTranslation } from "../../../hooks/useTranslation";
import FeedCardShell from "./feed-card-shell";

interface Post {
	title: string;
	excerpt: string;
	date: string;
	url: string;
}

export default function AndresMedium() {
	const { t } = useTranslation();
	const items = posts as Post[];
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: items is static JSON — items.length never changes; kept for clarity
	useEffect(() => {
		if (paused || items.length <= 1) return;
		const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 6000);
		return () => clearInterval(id);
	}, [paused, items.length]);

	const post = items[index];

	// Wave 36b — actions slot mirrors Cloudscape Header's `actions` prop. The
	// shell's marquee renders this in its right-aligned slot so the "All
	// posts →" link still reads as a peer of the heading.
	const headerActions = (
		<Link href="https://andmoredev.medium.com/" external fontSize="body-s">
			{t("feedPage.andresMediumAllPosts")} <Icon name="external" />
		</Link>
	);

	return (
		<FeedCardShell
			headerText={t("feedPage.andresMediumHeader")}
			headerActions={headerActions}
			palette="navy"
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: hover/focus pause is a progressive enhancement; keyboard users reach the link directly */}
			<div
				className="feed-article-carousel"
				onMouseEnter={() => setPaused(true)}
				onMouseLeave={() => setPaused(false)}
				onFocusCapture={() => setPaused(true)}
				onBlurCapture={(e) => {
					if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
						setPaused(false);
					}
				}}
			>
				<div key={index} className="feed-article-carousel__item">
					<div className="feed-posts__title">
						<Link href={post.url} external>
							{post.title}
						</Link>
					</div>
					{post.excerpt && (
						<Box color="text-body-secondary" fontSize="body-s">
							{post.excerpt}
						</Box>
					)}
					<Box color="text-status-inactive" fontSize="body-s">
						{post.date}
					</Box>
				</div>
				<span className="feed-article-carousel__counter">
					{index + 1} / {items.length}
				</span>
			</div>
		</FeedCardShell>
	);
}
