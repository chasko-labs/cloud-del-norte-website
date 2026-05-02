// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Icon from "@cloudscape-design/components/icon";
import Link from "@cloudscape-design/components/link";
import React, { useEffect, useState } from "react";
import posts from "../../../data/andres-medium.json";
import { useTranslation } from "../../../hooks/useTranslation";

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

	return (
		<Container
			header={
				<Header
					variant="h2"
					actions={
						<Link
							href="https://andmoredev.medium.com/"
							external
							fontSize="body-s"
						>
							{t("feedPage.andresMediumAllPosts")} <Icon name="external" />
						</Link>
					}
				>
					{t("feedPage.andresMediumHeader")}
				</Header>
			}
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
		</Container>
	);
}
