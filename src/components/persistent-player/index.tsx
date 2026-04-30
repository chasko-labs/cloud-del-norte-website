// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useCallback, useEffect, useRef, useState } from "react";
import {
	clearPlayerState,
	loadPlayerState,
	type PersistedPlayerState,
} from "../../lib/player-persist";
import { STREAMS } from "../../lib/streams";
import "./styles.css";

const POLL_MS = 30_000;

function PersistentPlayerBar({
	state,
	onStop,
}: {
	state: PersistedPlayerState;
	onStop: () => void;
}) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [blocked, setBlocked] = useState(false);
	const [nowPlaying, setNowPlaying] = useState<string | null>(null);

	const streamDef = STREAMS.find((s) => s.key === state.stationKey) ?? null;

	const fetchMeta = useCallback(() => {
		if (!streamDef) return;
		fetch(streamDef.metaUrl)
			.then((r) => (r.ok ? r.json() : null))
			.then((data: unknown) => {
				if (!data) return;
				const text = streamDef.parseMeta(data);
				if (text) setNowPlaying(text);
			})
			.catch(() => {});
	}, [streamDef]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.play().catch(() => setBlocked(true));
		fetchMeta();
		const id = setInterval(fetchMeta, POLL_MS);
		return () => {
			clearInterval(id);
			audio.pause();
		};
	}, [fetchMeta]);

	const resume = useCallback(() => {
		audioRef.current?.play().catch(() => {});
		setBlocked(false);
	}, []);

	const handlePlay = useCallback(() => {
		const a = audioRef.current;
		if (!a) return;
		window.dispatchEvent(
			new CustomEvent("cdn:audio:play", {
				detail: { element: a, stationKey: state.stationKey },
			}),
		);
	}, [state.stationKey]);

	const handlePause = useCallback(() => {
		window.dispatchEvent(new CustomEvent("cdn:audio:stop"));
	}, []);

	return (
		<section className="cdn-pp" aria-label="now playing">
			{/* biome-ignore lint/a11y/useMediaCaption: live radio stream — no caption track available */}
			<audio
				ref={audioRef}
				src={state.stationUrl}
				preload="none"
				crossOrigin="anonymous"
				onPlay={handlePlay}
				onPause={handlePause}
			/>
			<span className="cdn-pp__headphones" aria-hidden="true">
				🎧
			</span>
			<span className="cdn-pp__label">{state.stationLabel}</span>
			{nowPlaying && (
				<span className="cdn-pp__track" aria-live="polite">
					{nowPlaying}
				</span>
			)}
			{blocked ? (
				<button
					type="button"
					className="cdn-pp__btn cdn-pp__btn--resume"
					onClick={resume}
					aria-label="resume playback"
				>
					&#9654;
				</button>
			) : (
				<button
					type="button"
					className="cdn-pp__btn cdn-pp__btn--stop"
					onClick={onStop}
					aria-label="stop playback"
				>
					&#9632;
				</button>
			)}
		</section>
	);
}

export default function PersistentPlayer() {
	const [state, setState] = useState<PersistedPlayerState | null>(null);

	useEffect(() => {
		// only activate on non-feed pages — feed has its own KruxPlayer
		if (window.location.pathname.includes("/feed/")) return;
		setState(loadPlayerState());
	}, []);

	const handleStop = useCallback(() => {
		clearPlayerState();
		setState(null);
	}, []);

	if (!state) return null;

	return <PersistentPlayerBar state={state} onStop={handleStop} />;
}
