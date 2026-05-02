// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { useTranslation } from "../../../hooks/useTranslation";

export default function AndresYoutubeLive({
	videoId,
}: {
	videoId: string | null;
}) {
	const { t } = useTranslation();
	const header = (
		<Header
			variant="h2"
			actions={
				<Link
					href="https://www.youtube.com/@andmoredev"
					external
					fontSize="body-s"
				>
					{t("feedPage.andresYoutubeChannel")}
				</Link>
			}
		>
			<span className="feed-twitch__live-dot" aria-hidden="true" />
			{` ${t("feedPage.andresYoutubeLiveHeader")}`}
		</Header>
	);

	return (
		<Container header={header}>
			{videoId ? (
				<div className="feed-carousel">
					<div className="feed-carousel__viewport">
						<div className="feed-carousel__frame">
							<iframe
								src={`https://www.youtube.com/embed/${videoId}?autoplay=0`}
								title={t("feedPage.andresYoutubeLiveTitle")}
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowFullScreen
							/>
						</div>
					</div>
				</div>
			) : (
				<p>
					<Link href="https://www.youtube.com/@andmoredev/live" external>
						{t("feedPage.andresYoutubeWatchLive")}
					</Link>
				</p>
			)}
		</Container>
	);
}
