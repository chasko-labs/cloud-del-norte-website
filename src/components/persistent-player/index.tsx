// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { clearMediaSession, setMediaSession } from "../../lib/media-session";
import {
	clearPlayerState,
	loadPlayerState,
	type PersistedPlayerState,
	savePlayerState,
} from "../../lib/player-persist";
import { hexToRgbTuple } from "../../lib/streams";
import { STREAMS } from "../../lib/streams-order";
import "./styles.css";

const POLL_MS = 30_000;
/** how long an audio error/stall must persist before we surface UI to the user */
const STREAM_ERROR_THRESHOLD_MS = 5_000;
/** auto-retry delay after the first error trip — one shot, then surface to user */
const STREAM_AUTO_RETRY_MS = 3_000;

/**
 * Stream error UI states. "ok" = healthy (or transient blip below threshold),
 * "retrying" = first error trip surfaced + auto-retry in flight, "failed" =
 * auto-retry exhausted, user must intervene. uam_radio (mexiserver:1124) is
 * the chronic offender — 503s, SSL hiccups, mid-stream stalls — but the
 * machinery here is station-agnostic so any flaky icecast endpoint benefits
 */
type StreamHealth = "ok" | "retrying" | "failed";

function PersistentPlayerBar({
	state,
	onStop,
	onSkipStation,
}: {
	state: PersistedPlayerState;
	onStop: () => void;
	onSkipStation: (direction: 1 | -1) => void;
}) {
	const { t } = useTranslation();
	const audioRef = useRef<HTMLAudioElement>(null);
	const [blocked, setBlocked] = useState(false);
	const [nowPlaying, setNowPlaying] = useState<string | null>(null);
	const [streamHealth, setStreamHealth] = useState<StreamHealth>("ok");
	// debounce + retry timers — refs so cleanup can clear them across renders
	// without accidentally triggering re-renders or stale captures
	const errorTimerRef = useRef<number | null>(null);
	const retryTimerRef = useRef<number | null>(null);
	const retriedRef = useRef<boolean>(false);

	const streamDef = STREAMS.find((s) => s.key === state.stationKey) ?? null;

	const fetchMeta = useCallback(() => {
		if (!streamDef) return;
		// stations without a now-playing endpoint (uam_radio, concepto_radial)
		// just show label — Android notification still gets the station name
		if (!streamDef.metaUrl || !streamDef.parseMeta) return;
		const parse = streamDef.parseMeta;
		fetch(streamDef.metaUrl)
			.then((r) => (r.ok ? r.json() : null))
			.then((data: unknown) => {
				if (!data) return;
				const text = parse(data);
				if (text) setNowPlaying(text);
			})
			.catch(() => {});
	}, [streamDef]);

	// reset nowPlaying + stream health when station changes — otherwise the
	// previous station's track briefly leaks into the new station's lockscreen
	// notification, and a "failed" badge from a flaky uam_radio session would
	// stick around when the user skips to a healthy station
	// biome-ignore lint/correctness/useExhaustiveDependencies: state.stationKey is the reset trigger; effect body intentionally only resets state
	useEffect(() => {
		setNowPlaying(null);
		setStreamHealth("ok");
		retriedRef.current = false;
		if (errorTimerRef.current !== null) {
			window.clearTimeout(errorTimerRef.current);
			errorTimerRef.current = null;
		}
		if (retryTimerRef.current !== null) {
			window.clearTimeout(retryTimerRef.current);
			retryTimerRef.current = null;
		}
	}, [state.stationKey]);

	// stream health monitor — listens for error / stalled / abort on the audio
	// element. Brief network blips fire and clear quickly, so we only surface
	// UI when an error condition persists past STREAM_ERROR_THRESHOLD_MS. Once
	// surfaced, we auto-retry once after STREAM_AUTO_RETRY_MS (reload the
	// audio src — re-establishes the icecast connection) before falling back
	// to user-facing failure UI. Healthy events (playing / canplay) reset the
	// debounce timer so a transient stall that recovers on its own is silent.
	//
	// uam_radio at sp2.servidorrprivado.com:1124 / mexiserver:1124 is the
	// motivating case: 503s + SSL hiccups are routine. Logic is station-agnostic
	// so any flaky icecast endpoint benefits without per-station branching
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const tripError = () => {
			if (errorTimerRef.current !== null) return; // already counting down
			errorTimerRef.current = window.setTimeout(() => {
				errorTimerRef.current = null;
				if (retriedRef.current) {
					setStreamHealth("failed");
					return;
				}
				// first trip — surface "retrying" + reload audio src after a brief delay
				setStreamHealth("retrying");
				retriedRef.current = true;
				retryTimerRef.current = window.setTimeout(() => {
					retryTimerRef.current = null;
					try {
						audio.load();
						audio.play().catch(() => {
							// retry attempt blocked / failed — surface failure UI immediately,
							// don't wait for another threshold cycle
							setStreamHealth("failed");
						});
					} catch {
						setStreamHealth("failed");
					}
				}, STREAM_AUTO_RETRY_MS);
			}, STREAM_ERROR_THRESHOLD_MS);
		};

		const clearError = () => {
			if (errorTimerRef.current !== null) {
				window.clearTimeout(errorTimerRef.current);
				errorTimerRef.current = null;
			}
			// don't clear retryTimerRef — let the in-flight retry complete
			setStreamHealth("ok");
		};

		audio.addEventListener("error", tripError);
		audio.addEventListener("stalled", tripError);
		audio.addEventListener("abort", tripError);
		audio.addEventListener("playing", clearError);
		audio.addEventListener("canplay", clearError);

		return () => {
			audio.removeEventListener("error", tripError);
			audio.removeEventListener("stalled", tripError);
			audio.removeEventListener("abort", tripError);
			audio.removeEventListener("playing", clearError);
			audio.removeEventListener("canplay", clearError);
		};
	}, []);

	// stream-playing body class — gates audio-reactive UI (liora head sway,
	// LED bands, dark-mode bursts) so the visualizers freeze when the user
	// stops the stream. --cdn-bass / --cdn-mid / --cdn-treble naturally drop
	// to silence on pause but the keyframes still tick; a body-class toggle
	// flips animation-play-state to paused for a clean stop
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		const onPlay = () => document.body.classList.add("cdn-stream-playing");
		const onStopEvt = () =>
			document.body.classList.remove("cdn-stream-playing");
		audio.addEventListener("playing", onPlay);
		audio.addEventListener("pause", onStopEvt);
		audio.addEventListener("ended", onStopEvt);
		audio.addEventListener("emptied", onStopEvt);
		return () => {
			audio.removeEventListener("playing", onPlay);
			audio.removeEventListener("pause", onStopEvt);
			audio.removeEventListener("ended", onStopEvt);
			audio.removeEventListener("emptied", onStopEvt);
			document.body.classList.remove("cdn-stream-playing");
		};
	}, []);

	// manual retry — user-triggered escape hatch when auto-retry didn't recover.
	// Resets the retried flag so a fresh failure cycle gets one more auto-retry
	const manualRetry = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		retriedRef.current = false;
		setStreamHealth("ok");
		try {
			audio.load();
			audio.play().catch(() => setBlocked(true));
		} catch {
			setStreamHealth("failed");
		}
	}, []);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.play().catch(() => setBlocked(true));

		// SSE branch: Zeno.fm mounts push metadata as text/event-stream. open
		// an EventSource for the lifetime of the bar and parse each message.
		// no polling interval needed — server pushes on track change
		if (
			streamDef?.metaUrl &&
			streamDef.parseMeta &&
			streamDef.metaFormat === "sse"
		) {
			const parse = streamDef.parseMeta;
			const es = new EventSource(streamDef.metaUrl);
			es.addEventListener("message", (ev) => {
				try {
					const data = JSON.parse(ev.data);
					const text = parse(data);
					if (text) setNowPlaying(text);
				} catch {
					// malformed event — ignore, next push will retry
				}
			});
			return () => {
				es.close();
				audio.pause();
			};
		}

		// JSON polling branch (default)
		fetchMeta();
		const id = setInterval(fetchMeta, POLL_MS);
		return () => {
			clearInterval(id);
			audio.pause();
		};
	}, [fetchMeta, streamDef]);

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

	// MediaSession integration — populates the OS-level media notification
	// (Android lockscreen, macOS Now Playing, Chrome desktop global media hub)
	// with station label + live track info instead of "AWS UG Cloud Del No...".
	// Re-runs on station change AND on nowPlaying update so the notification
	// title tracks the live song
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		setMediaSession({
			stationLabel: state.stationLabel,
			nowPlaying,
			onPlay: () => {
				audio.play().catch(() => setBlocked(true));
			},
			onPause: () => audio.pause(),
			onSkipNext: () => onSkipStation(1),
			onSkipPrev: () => onSkipStation(-1),
		});
		return () => {
			// only clear on full unmount (handled by parent onStop). Returning
			// nothing here keeps metadata visible across re-renders / track-change
		};
	}, [state.stationLabel, nowPlaying, onSkipStation]);

	// per-station theming — emit the active station's brand palette as CSS
	// custom properties so the pill border / play+stop button glow + hover
	// inherit the institution's colors (KEXP buttercup vs KRUX crimson).
	// primaryLight / primaryDark contrast-tune for cream and navy bgs; the
	// CSS resolves them inside :root vs .awsui-dark-mode blocks.
	const stationStyle: React.CSSProperties | undefined = streamDef
		? ({
				"--station-primary": streamDef.colors.primary,
				"--station-primary-rgb": hexToRgbTuple(streamDef.colors.primary),
				"--station-secondary": streamDef.colors.secondary,
				"--station-secondary-rgb": hexToRgbTuple(streamDef.colors.secondary),
				"--station-accent": streamDef.colors.accent,
				"--station-primary-light":
					streamDef.colors.primaryLight ?? streamDef.colors.primary,
				"--station-primary-light-rgb": hexToRgbTuple(
					streamDef.colors.primaryLight ?? streamDef.colors.primary,
				),
				"--station-primary-dark":
					streamDef.colors.primaryDark ?? streamDef.colors.primary,
				"--station-primary-dark-rgb": hexToRgbTuple(
					streamDef.colors.primaryDark ?? streamDef.colors.primary,
				),
			} as React.CSSProperties)
		: undefined;

	// surface state derivations — keeps JSX readable and centralizes the
	// "what gets shown in the eyebrow / track row" decision tree:
	//   1. failed   → red error message + retry button (auto-retry exhausted)
	//   2. retrying → soft "retrying" hint, no retry button (auto-retry in flight)
	//   3. track    → "now playing" eyebrow + nowPlaying string
	//   4. neither  → "streaming on clouddelnorte.org" fallback eyebrow
	//                 (matches the lockscreen artist line set in media-session.ts)
	const showFailedUI = streamHealth === "failed";
	const showRetryingUI = streamHealth === "retrying";
	const fallbackSubtitle = t("persistentPlayer.streamingFallback");

	return (
		<section
			className={`cdn-pp${nowPlaying ? " cdn-pp--has-track" : ""}${showFailedUI ? " cdn-pp--failed" : ""}${showRetryingUI ? " cdn-pp--retrying" : ""}`}
			aria-label="now playing"
			data-station={state.stationKey}
			style={stationStyle}
		>
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
			<span className="cdn-pp__meta">
				<span className="cdn-pp__label">{state.stationLabel}</span>
				{showFailedUI ? (
					<span
						className="cdn-pp__error"
						role="status"
						aria-live="polite"
						title={t("persistentPlayer.streamErrorPersistent")}
					>
						<span className="cdn-pp__error-text">
							{t("persistentPlayer.streamErrorPersistent")}
						</span>
					</span>
				) : showRetryingUI ? (
					<span className="cdn-pp__track" role="status" aria-live="polite">
						<span
							className="cdn-pp__eyebrow cdn-pp__eyebrow--warn"
							aria-hidden="true"
						>
							{t("persistentPlayer.streamErrorRetrying")}
						</span>
					</span>
				) : nowPlaying ? (
					<span className="cdn-pp__track" aria-live="polite" title={nowPlaying}>
						<span className="cdn-pp__eyebrow" aria-hidden="true">
							now playing
						</span>
						<span className="cdn-pp__track-text">{nowPlaying}</span>
					</span>
				) : (
					<span className="cdn-pp__track" aria-hidden="true">
						<span className="cdn-pp__eyebrow">{fallbackSubtitle}</span>
					</span>
				)}
			</span>
			{showFailedUI && (
				<button
					type="button"
					className="cdn-pp__btn cdn-pp__btn--retry"
					onClick={manualRetry}
					aria-label={t("persistentPlayer.streamErrorRetryButton")}
					title={t("persistentPlayer.streamErrorRetryButton")}
				>
					<span aria-hidden="true">↻</span>
				</button>
			)}
			<button
				type="button"
				className="cdn-pp__btn cdn-pp__btn--skip"
				onClick={() => onSkipStation(1)}
				aria-label="next station"
				title="next station"
			>
				<span aria-hidden="true">⏭</span>
			</button>
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
		clearMediaSession();
		setState(null);
	}, []);

	// skip station — direction +1 advances, -1 rewinds. Mirrors KruxPlayer's
	// modulo arithmetic so the carousel order in feed/app.tsx stays in sync
	// with the persistent-player skip buttons + Android notification skip
	const handleSkipStation = useCallback((direction: 1 | -1) => {
		setState((current) => {
			if (!current) return current;
			const idx = STREAMS.findIndex((s) => s.key === current.stationKey);
			if (idx < 0) return current;
			const nextIdx = (idx + direction + STREAMS.length) % STREAMS.length;
			const next = STREAMS[nextIdx];
			const nextState: PersistedPlayerState = {
				stationKey: next.key,
				stationUrl: next.url,
				stationLabel: next.label,
				metaUrl: next.metaUrl,
			};
			savePlayerState(nextState);
			return nextState;
		});
	}, []);

	if (!state) return null;

	return (
		<PersistentPlayerBar
			state={state}
			onStop={handleStop}
			onSkipStation={handleSkipStation}
		/>
	);
}
