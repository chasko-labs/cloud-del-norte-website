import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { useState } from "react";
import { LazyEmbed } from "../../../components/lazy-embed";
import { useTranslation } from "../../../hooks/useTranslation";

interface Props {
	name: string;
	channelUrl: string;
	videoIds: string[];
	live?: boolean;
	liveVideoId?: string | null;
}

export default function YouTubeChannelCarousel({
	name,
	channelUrl,
	videoIds,
	live = false,
	liveVideoId = null,
}: Props) {
	const { t } = useTranslation();
	const [current, setCurrent] = useState(() =>
		Math.floor(Math.random() * videoIds.length),
	);

	const prev = () =>
		setCurrent((c) => (c - 1 + videoIds.length) % videoIds.length);
	const next = () => setCurrent((c) => (c + 1) % videoIds.length);

	const embedId = live && liveVideoId ? liveVideoId : videoIds[current];

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
		</Container>
	);
}
