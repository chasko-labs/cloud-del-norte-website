// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Link from "@cloudscape-design/components/link";
import { useEffect, useId, useRef, useState } from "react";
import { SkeletonLine, SkeletonTitle } from "../../../components/skeleton";
import { useTranslation } from "../../../hooks/useTranslation";
import FeedCardShell from "./feed-card-shell";

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

function useFeed(
	key: "andmore" | "awsml" | "readysetcloud",
	limit = 5,
): {
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

	// Task 1.4 / Task 2: cap excerpt to ~140 chars, bump to body-m for legibility.
	const excerpt =
		post.excerpt && post.excerpt.length > 140
			? `${post.excerpt.slice(0, 140).trimEnd()}…`
			: post.excerpt;

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
				{excerpt && (
					<div className="feed-posts__excerpt--body-m">{excerpt}</div>
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

// Wave 36b — feed-section variants each pick a FeedCardShell palette via the
// section-key-to-palette map below. Detection happens internally per variant
// (no `palette` prop on the public FeedAndmore/FeedAwsml/FeedReadysetcloud
// components — keeps app.tsx untouched). Mapping rationale:
//   andmore       → amber  (warm dev/casual — andmore.dev is a personal /
//                            project blog with a warm voice)
//   awsml         → teal   (cool / technical — AWS ML blog reads cooler,
//                            data-heavy)
//   readysetcloud → navy   (long-form publication — Allen Helton's serious
//                            serverless blog + newsletter; reuses the navy
//                            palette already assigned to andres-medium since
//                            both are bylined long-form tech publications,
//                            an intentional family pairing)
// Documented in feed-card-shell.tsx FeedCardShellPalette JSDoc + commit msg.

export function FeedAndmore() {
	const { t } = useTranslation();
	const { posts, ready } = useFeed("andmore");

	const headerText = (
		<>
			<span className="feed-andmore-header-row">
				{/* Wave 45 — brand star: reuse /brand/logo.svg with onError fallback.
				    Mirrors the wave 33b upcoming-virtual-event primitive. */}
				<span
					className="feed-andmore-brand-star"
					role="img"
					aria-label={t("feedPage.upcomingVirtualEventUgMarkLabel")}
				>
					<img
						src="/brand/logo.svg"
						alt=""
						aria-hidden="true"
						width={32}
						height={32}
						onError={(e) => {
							(e.currentTarget as HTMLImageElement).style.display = "none";
						}}
					/>
				</span>
				{t("feedPage.andmoreDevHeader")}
			</span>
			<span className="feed-card-header-sub">
				{t("feedPage.andmoreCoOrganizer")}
			</span>
		</>
	);
	const headerActions = (
		<Link href="https://andmore.dev" external fontSize="body-s">
			{t("feedPage.andresMediumAllPosts")}
		</Link>
	);

	return (
		<FeedCardShell
			headerText={headerText}
			headerActions={headerActions}
			palette="amber"
		>
			<PostCarousel posts={posts} ready={ready} />
		</FeedCardShell>
	);
}

export function FeedAwsml() {
	const { t } = useTranslation();
	const { posts, ready } = useFeed("awsml");

	const headerActions = (
		<Link
			href="https://aws.amazon.com/blogs/machine-learning/"
			external
			fontSize="body-s"
		>
			{t("feedPage.awsMlBlogAllPosts")}
		</Link>
	);

	return (
		<FeedCardShell
			headerText={
				<span className="feed-awsml-header">{t("feedPage.awsMlBlog")}</span>
			}
			headerActions={headerActions}
			palette="teal"
		>
			<PostCarousel posts={posts} ready={ready} />
		</FeedCardShell>
	);
}

export function FeedReadysetcloud() {
	const { t } = useTranslation();
	const { posts, ready } = useFeed("readysetcloud", 10);
	const latestBlog = posts.find((p) => p.link.includes("/blog/"));
	const latestNewsletter = posts.find((p) => p.link.includes("/newsletter/"));

	return (
		<FeedCardShell
			headerText={t("feedPage.readysetcloudHeader")}
			palette="navy"
		>
			{!ready ? (
				<>
					<SkeletonTitle />
					<SkeletonLine />
					<SkeletonTitle />
					<SkeletonLine />
				</>
			) : (
				// Wave 42a — Bryan: "on allen's panel instead of this & the blog
				// version taking 3 lines each Latest newsletter / Think again
				// about running agents locally / 2026-05-18 work to make that 1
				// line each responsively".
				//
				// Each entry now renders as a single inline-flex row:
				//   {label} — {title} · {date}
				// with white-space: nowrap + text-overflow: ellipsis on the
				// title at desktop. At narrow viewports the rule drops nowrap
				// + caps to 2 lines via -webkit-line-clamp so the entry stays
				// readable on phones (the responsive-but-truncate brief).
				// Replaces the wave 36b SpaceBetween + 3-Box-children stack that
				// was forcing 3 lines per entry.
				<div className="feed-rsc__entries">
					{latestBlog ? (
						<RscEntry
							label={t("feedPage.readysetcloudLatestBlog")}
							title={latestBlog.title}
							link={latestBlog.link}
							date={latestBlog.pubDate}
							excerpt={latestBlog.excerpt}
						/>
					) : (
						<Box color="text-status-inactive" fontSize="body-s">
							{t("feedPage.readysetcloudNoBlog")}
						</Box>
					)}
					{latestNewsletter ? (
						<RscEntry
							label={t("feedPage.readysetcloudLatestNewsletter")}
							title={latestNewsletter.title}
							link={latestNewsletter.link}
							date={latestNewsletter.pubDate}
							excerpt={latestNewsletter.excerpt}
						/>
					) : (
						<Box color="text-status-inactive" fontSize="body-s">
							{t("feedPage.readysetcloudNoNewsletter")}
						</Box>
					)}
				</div>
			)}
		</FeedCardShell>
	);
}

/**
 * Wave 42a — single-line ReadySetCloud entry row.
 * Wave 45 — adds 2-sentence excerpt below the title row.
 */
function RscEntry({
	label,
	title,
	link,
	date,
	excerpt,
}: {
	label: string;
	title: string;
	link: string;
	date: string;
	excerpt?: string;
}) {
	// Task 3: split on `. `, take first 2 sentences, cap at 140 chars.
	const twoSentences = (() => {
		if (!excerpt) return "";
		const chunks = excerpt.split(/\.\s+/);
		const joined =
			chunks.length >= 2 ? `${chunks[0]}. ${chunks[1]}.` : chunks[0];
		return joined.length > 140 ? `${joined.slice(0, 140).trimEnd()}…` : joined;
	})();

	return (
		<div className="feed-rsc__entry-group">
			<div className="feed-rsc__entry">
				<span className="feed-rsc__entry-label">{label}</span>
				<span className="feed-rsc__entry-sep" aria-hidden="true">
					{" — "}
				</span>
				<Link href={link} external>
					<span className="feed-rsc__entry-title">{title}</span>
				</Link>
				<span className="feed-rsc__entry-sep" aria-hidden="true">
					{" · "}
				</span>
				<span className="feed-rsc__entry-date">{date}</span>
			</div>
			{twoSentences && (
				<p className="feed-rsc__entry-excerpt">{twoSentences}</p>
			)}
		</div>
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
