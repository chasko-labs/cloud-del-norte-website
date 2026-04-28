// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import React, { useState } from "react";

const VIDEO_IDS = ["yQNrgpIp1Fs", "WUJUvTu2Qjo", "S2G6eDE4Jok"];

export default function YoutubeCarousel() {
	const [current, setCurrent] = useState(0);

	const prev = () =>
		setCurrent((c) => (c - 1 + VIDEO_IDS.length) % VIDEO_IDS.length);
	const next = () => setCurrent((c) => (c + 1) % VIDEO_IDS.length);

	const videoId = VIDEO_IDS[current];

	return (
		<Container header={<Header variant="h2">on YouTube</Header>}>
			<div className="feed-carousel">
				<div className="feed-carousel__viewport">
					<div className="feed-carousel__frame">
						<iframe
							loading="lazy"
							src={`https://www.youtube.com/embed/${videoId}`}
							title={`Featured video ${current + 1} of ${VIDEO_IDS.length}`}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
						/>
					</div>
				</div>
				<div className="feed-carousel__controls">
					<button
						className="feed-carousel__btn"
						onClick={prev}
						aria-label="Previous video"
					>
						&#8592;
					</button>
					<span className="feed-carousel__counter">
						{current + 1} / {VIDEO_IDS.length}
					</span>
					<button
						className="feed-carousel__btn"
						onClick={next}
						aria-label="Next video"
					>
						&#8594;
					</button>
				</div>
			</div>
		</Container>
	);
}
