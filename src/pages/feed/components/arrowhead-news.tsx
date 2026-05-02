// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import articles from "../../../data/arrowhead-news.json";
import { useTranslation } from "../../../hooks/useTranslation";

export default function ArrowheadNews() {
	const { t } = useTranslation();
	const total = articles.length;
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	const panelIdBase = useId();
	const panelId = `${panelIdBase}-panel`;
	const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: total is derived from a static JSON import — never changes at runtime
	useEffect(() => {
		if (paused || total <= 1) return;
		const id = setInterval(() => setIndex((i) => (i + 1) % total), 6000);
		return () => clearInterval(id);
	}, [paused, total]);

	const article = articles[index];

	function focusTab(next: number) {
		setIndex(next);
		setPaused(true);
		queueMicrotask(() => tabsRef.current[next]?.focus());
	}

	function handleTabKeyDown(
		e: React.KeyboardEvent<HTMLButtonElement>,
		i: number,
	) {
		if (e.key === "ArrowRight") {
			e.preventDefault();
			focusTab((i + 1) % total);
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			focusTab((i - 1 + total) % total);
		} else if (e.key === "Home") {
			e.preventDefault();
			focusTab(0);
		} else if (e.key === "End") {
			e.preventDefault();
			focusTab(total - 1);
		}
	}

	return (
		<Container
			header={
				<Header variant="h2">
					Arrowhead Research Park
					<span className="feed-card-header-sub">
						{t("feedPage.arrowheadAtNmsu")}
					</span>
				</Header>
			}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: hover/focus pause is a progressive enhancement; keyboard users reach article links directly */}
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
				<div
					key={index}
					id={panelId}
					role="tabpanel"
					className="feed-article-carousel__item"
				>
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
					aria-label={t("feedPage.articleSelector")}
				>
					{(articles as { id: string }[]).map((a, i) => (
						<button
							type="button"
							key={a.id}
							ref={(el) => {
								tabsRef.current[i] = el;
							}}
							role="tab"
							aria-selected={i === index}
							aria-controls={panelId}
							aria-label={`${t("feedPage.articleAriaPrefix")} ${i + 1} ${t("feedPage.articleAriaConnector")} ${total}`}
							tabIndex={i === index ? 0 : -1}
							className={`feed-article-carousel__dot${i === index ? " feed-article-carousel__dot--active" : ""}`}
							onClick={() => {
								setIndex(i);
								setPaused(true);
							}}
							onKeyDown={(e) => handleTabKeyDown(e, i)}
						/>
					))}
				</div>
			</div>
		</Container>
	);
}
