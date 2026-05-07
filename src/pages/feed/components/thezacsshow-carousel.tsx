import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { useEffect, useState } from "react";
import { useChannelLive } from "../../../hooks/useChannelLive";
import { useTranslation } from "../../../hooks/useTranslation";

const CHANNEL_URL = "https://www.youtube.com/@thezacsshowtalkingaws/live";
const VIDEO_IDS = [
	"ZACSSHOW_1",
	"ZACSSHOW_2",
	"ZACSSHOW_3",
	"ZACSSHOW_4",
	"ZACSSHOW_5",
	"ZACSSHOW_6",
	"ZACSSHOW_7",
];

interface Props {
	onLiveChange?: (isLive: boolean) => void;
	onOfflineChange?: (isOffline: boolean) => void;
}

export default function TheZacsShowCarousel({
	onLiveChange,
	onOfflineChange,
}: Props) {
	const { t } = useTranslation();
	const { live, videoId } = useChannelLive(CHANNEL_URL);
	const [current, setCurrent] = useState(() =>
		Math.floor(Math.random() * VIDEO_IDS.length),
	);

	useEffect(() => {
		onLiveChange?.(live);
		onOfflineChange?.(!live);
	}, [live, onLiveChange, onOfflineChange]);

	const prev = () =>
		setCurrent((c) => (c - 1 + VIDEO_IDS.length) % VIDEO_IDS.length);
	const next = () => setCurrent((c) => (c + 1) % VIDEO_IDS.length);

	const embedId = live && videoId ? videoId : VIDEO_IDS[current];

	return (
		<Container
			header={
				<Header variant="h2">
					{live && <span className="feed-live-dot" />}
					<Link href="https://www.youtube.com/@thezacsshowtalkingaws" external>
						{t("feedPage.theZacsShowHeader")}
					</Link>
				</Header>
			}
		>
			<div className="feed-carousel">
				<div className="feed-carousel__viewport">
					<div className="feed-carousel__frame">
						<iframe
							loading="lazy"
							src={`https://www.youtube.com/embed/${embedId}`}
							title={`${t("feedPage.theZacsShowHeader")} ${current + 1} ${t("feedPage.articleAriaConnector")} ${VIDEO_IDS.length}`}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
						/>
					</div>
				</div>
				{!live && (
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
							{current + 1} / {VIDEO_IDS.length}
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
