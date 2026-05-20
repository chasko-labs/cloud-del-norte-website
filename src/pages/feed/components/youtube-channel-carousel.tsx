import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { useEffect, useState } from "react";
import { LazyEmbed } from "../../../components/lazy-embed";
import { useTranslation } from "../../../hooks/useTranslation";
import {
	type SpinItem,
	YouTubeSpinPlaceholder,
} from "./youtube-spin-placeholder";

interface Props {
	name: string;
	channelUrl: string;
	videoIds: string[];
	live?: boolean;
	liveVideoId?: string | null;
	/** Optional metadata for spin preview cards (newest/oldest). Falls back
	 *  to derived thumbnails from videoIds[0] and videoIds[last]. */
	spinMeta?: { newest: SpinItem; oldest: SpinItem };
}

export default function YouTubeChannelCarousel({
	name,
	channelUrl,
	videoIds,
	live = false,
	liveVideoId = null,
	spinMeta,
}: Props) {
	const { t } = useTranslation();
	const [mounted, setMounted] = useState(false);
	const [current, setCurrent] = useState(() =>
		Math.floor(Math.random() * videoIds.length),
	);

	useEffect(() => {
		setMounted(true);
	}, []);

	const prev = () =>
		setCurrent((c) => (c - 1 + videoIds.length) % videoIds.length);
	const next = () => setCurrent((c) => (c + 1) % videoIds.length);

	const embedId = live && liveVideoId ? liveVideoId : videoIds[current];

	// Wave 52 — derive spin preview items from videoIds if no spinMeta provided.
	const derivedNewest: SpinItem = spinMeta?.newest ?? {
		videoId: videoIds[0],
		title: `${name} — video 1`,
		thumbnailUrl: `https://i.ytimg.com/vi/${videoIds[0]}/hqdefault.jpg`,
		publishedAt: new Date().toISOString().slice(0, 10),
	};
	const derivedOldest: SpinItem = spinMeta?.oldest ?? {
		videoId: videoIds[videoIds.length - 1],
		title: `${name} — video ${videoIds.length}`,
		thumbnailUrl: `https://i.ytimg.com/vi/${videoIds[videoIds.length - 1]}/hqdefault.jpg`,
		publishedAt: "2024-01-01",
	};

	return (
		<Container
			header={
				<Header
					variant="h2"
					actions={
						<Link href={channelUrl} external fontSize="body-s">
							{t("feedPage.visitChannel")}
						</Link>
					}
				>
					{live && (
						<span className="feed-twitch__live-dot" aria-hidden="true" />
					)}
					{live ? ` ${name} — ${t("feedPage.twitchLive")}` : name}
				</Header>
			}
		>
			{/* Wave 52 — spin placeholder shown before SSR mount */}
			{!mounted ? (
				<YouTubeSpinPlaceholder
					newest={derivedNewest}
					oldest={derivedOldest}
					spinLabel={t("feedPage.spinBtnLabel")}
					ariaLabel={t("feedPage.spinPlaceholderAriaLabel")}
					onSelect={(id) => {
						const idx = videoIds.indexOf(id);
						if (idx !== -1) setCurrent(idx);
					}}
					i18n={{
						newestBadge: t("feedPage.spinNewestBadge"),
						oldestBadge: t("feedPage.spinOldestBadge"),
					}}
				/>
			) : (
				<div className="feed-carousel">
					<div className="feed-carousel__viewport">
						<div className="feed-carousel__frame">
							<LazyEmbed
								src={`https://www.youtube.com/embed/${embedId}`}
								title={`${name} ${current + 1} / ${videoIds.length}`}
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
							/>
						</div>
					</div>
					{!live && videoIds.length > 1 && (
						<div className="feed-carousel__controls">
							<button
								type="button"
								className="feed-carousel__btn"
								onClick={prev}
								aria-label={t("feedPage.youtubePrevVideo")}
							>
								&#8592;
							</button>
							<span className="feed-carousel__counter">
								{current + 1} / {videoIds.length}
							</span>
							<button
								type="button"
								className="feed-carousel__btn"
								onClick={next}
								aria-label={t("feedPage.youtubeNextVideo")}
							>
								&#8594;
							</button>
						</div>
					)}
				</div>
			)}
		</Container>
	);
}
