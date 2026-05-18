// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { useEffect, useId, useRef, useState } from "react";
import { SkeletonLine, SkeletonTitle } from "../../../components/skeleton";
import { useTranslation } from "../../../hooks/useTranslation";

export interface FeedPost {
	title: string;
	link: string;
	pubDate: string;
	excerpt: string;
}

interface FeedsData {
	andmore: FeedPost[];
	awsml: FeedPost[];
	readysetcloud: FeedPost[];
}

// shared module-level cache so both feed components fetch /data/feeds.json once
let feedsCache: FeedsData | null = null;
let feedsPromise: Promise<FeedsData | null> | null = null;

function loadFeeds(): Promise<FeedsData | null> {
	if (feedsCache) return Promise.resolve(feedsCache);
	if (feedsPromise) return feedsPromise;
	feedsPromise = fetch("/data/feeds.json")
		.then((r) => (r.ok ? (r.json() as Promise<FeedsData>) : null))
		.then((data) => {
			if (data) feedsCache = data;
			return data;
		})
		.catch(() => null);
	return feedsPromise;
}

function useFeed(key: "andmore" | "awsml" | "readysetcloud", limit = 5): {
	posts: FeedPost[];
	ready: boolean;
} {
	const [data, setData] = useState<FeedsData | null>(feedsCache);
	useEffect(() => {
		if (data) return;
		loadFeeds().then((d) => setData(d));
	}, [data]);
	return { posts: data?.[key]?.slice(0, limit) ?? [], ready: data !== null };
}

function PostCarousel({ posts, ready }: { posts: FeedPost[]; ready: boolean }) {
	const { t } = useTranslation();
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	const panelIdBase = useId();
	const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

	useEffect(() => {
		if (paused || posts.length <= 1) return;
		const id = setInterval(() => setIndex((i) => (i + 1) % posts.length), 6000);
		return () => clearInterval(id);
	}, [paused, posts.length]);

	if (!ready) {
		return (
			<>
				{[0, 1, 2, 3, 4].map((i) => (
					<div key={i} style={{ marginBottom: "0.75rem" }}>
						<SkeletonTitle />
						<SkeletonLine />
					</div>
				))}
			</>
		);
	}

	if (posts.length === 0) {
		return <p className="feed-posts__empty">{t("feedPage.feedPostsEmpty")}</p>;
	}
	const post = posts[index];
	// Single panel for the carousel — tabs all reference it; content swaps inside.
	const panelId = `${panelIdBase}-panel`;

	function focusTab(next: number) {
		setIndex(next);
		setPaused(true);
		// next render places the new active tab in tabsRef; defer focus to after commit
		queueMicrotask(() => tabsRef.current[next]?.focus());
	}

	function handleTabKeyDown(
		e: React.KeyboardEvent<HTMLButtonElement>,
		i: number,
	) {
		if (e.key === "ArrowRight") {
			e.preventDefault();
			focusTab((i + 1) % posts.length);
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			focusTab((i - 1 + posts.length) % posts.length);
		} else if (e.key === "Home") {
			e.preventDefault();
			focusTab(0);
		} else if (e.key === "End") {
			e.preventDefault();
			focusTab(posts.length - 1);
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: pause-on-hover/focus is a progressive enhancement; keyboard users get the dot tablist below
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
				<div className="feed-posts__title">
					<Link href={post.link} external>
						{post.title}
					</Link>
				</div>
				{post.excerpt && (
					<Box color="text-body-secondary" fontSize="body-s">
						{post.excerpt}
					</Box>
				)}
				<Box color="text-status-inactive" fontSize="body-s">
					{post.pubDate}
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
				{posts.map((dotPost, i) => (
					<button
						type="button"
						key={dotPost.link}
						ref={(el) => {
							tabsRef.current[i] = el;
						}}
						role="tab"
						aria-selected={i === index}
						aria-controls={panelId}
						aria-label={`${t("feedPage.articleAriaPrefix")} ${i + 1} ${t("feedPage.articleAriaConnector")} ${posts.length}`}
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
	);
}

export function FeedAndmore() {
	const { t } = useTranslation();
	const { posts, ready } = useFeed("andmore");
	return (
		<Container
			header={
				<Header
					variant="h2"
					actions={
						<Link href="https://andmore.dev" external fontSize="body-s">
							{t("feedPage.andresMediumAllPosts")}
						</Link>
					}
				>
					{t("feedPage.andmoreDevHeader")}
					<span className="feed-card-header-sub">
						{t("feedPage.andmoreByAndres")}
					</span>
				</Header>
			}
		>
			<PostCarousel posts={posts} ready={ready} />
		</Container>
	);
}

export function FeedAwsml() {
	const { t } = useTranslation();
	const { posts, ready } = useFeed("awsml");
	return (
		<Container
			header={
				<Header
					variant="h2"
					actions={
						<Link
							href="https://aws.amazon.com/blogs/machine-learning/"
							external
							fontSize="body-s"
						>
							{t("feedPage.awsMlBlogAllPosts")}
						</Link>
					}
				>
					{t("feedPage.awsMlBlog")}
				</Header>
			}
		>
			<PostCarousel posts={posts} ready={ready} />
		</Container>
	);
}

export function FeedReadysetcloud() {
	const { t } = useTranslation();
	const { posts, ready } = useFeed("readysetcloud", 10);
	const latestBlog = posts.find((p) => p.link.includes("/blog/"));
	const latestNewsletter = posts.find((p) => p.link.includes("/newsletter/"));

	const excerptClamp: React.CSSProperties = {
		display: "-webkit-box",
		WebkitLineClamp: 3,
		WebkitBoxOrient: "vertical",
		overflow: "hidden",
	};

	return (
		<Container
			header={<Header variant="h2">{t("feedPage.readysetcloudHeader")}</Header>}
		>
			{!ready ? (
				<>
					<SkeletonTitle />
					<SkeletonLine />
					<SkeletonTitle />
					<SkeletonLine />
				</>
			) : (
				<SpaceBetween size="m">
					<SpaceBetween size="xs">
						<Box variant="h3" fontWeight="bold" fontSize="heading-s">
							{t("feedPage.readysetcloudLatestBlog")}
						</Box>
						{latestBlog ? (
							<>
								<Link href={latestBlog.link} external>
									{latestBlog.title}
								</Link>
								<Box color="text-status-inactive" fontSize="body-s">
									{latestBlog.pubDate}
								</Box>
								{latestBlog.excerpt && (
									<Box
										variant="p"
										color="text-body-secondary"
										fontSize="body-s"
									>
										<span style={excerptClamp}>{latestBlog.excerpt}</span>
									</Box>
								)}
							</>
						) : (
							<Box color="text-status-inactive" fontSize="body-s">
								{t("feedPage.readysetcloudNoBlog")}
							</Box>
						)}
					</SpaceBetween>
					<SpaceBetween size="xs">
						<Box variant="h3" fontWeight="bold" fontSize="heading-s">
							{t("feedPage.readysetcloudLatestNewsletter")}
						</Box>
						{latestNewsletter ? (
							<>
								<Link href={latestNewsletter.link} external>
									{latestNewsletter.title}
								</Link>
								<Box color="text-status-inactive" fontSize="body-s">
									{latestNewsletter.pubDate}
								</Box>
								{latestNewsletter.excerpt && (
									<Box
										variant="p"
										color="text-body-secondary"
										fontSize="body-s"
									>
										<span style={excerptClamp}>
											{latestNewsletter.excerpt}
										</span>
									</Box>
								)}
							</>
						) : (
							<Box color="text-status-inactive" fontSize="body-s">
								{t("feedPage.readysetcloudNoNewsletter")}
							</Box>
						)}
					</SpaceBetween>
				</SpaceBetween>
			)}
		</Container>
	);
}

// backward-compat default export retained in case any other importer references the old name
export default function FeedSection() {
	return (
		<>
			<FeedAndmore />
			<FeedAwsml />
		</>
	);
}
