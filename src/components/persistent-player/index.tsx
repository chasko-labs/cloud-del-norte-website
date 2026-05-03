// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { setMediaSession } from "../../lib/media-session";
import {
	loadPlayerState,
	type PersistedPlayerState,
	savePlayerState,
} from "../../lib/player-persist";
import { formatLocation, hexToRgbTuple } from "../../lib/streams";
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
	autoplay,
	onStop,
	onSkipStation,
}: {
	state: PersistedPlayerState;
	/** when true, attempt audio.play() on mount + on station-change. set when
	 *  the player was hydrated from sessionStorage (user already pressed play
	 *  this session) or after the user advances stations via skip */
	autoplay: boolean;
	onStop: () => void;
	onSkipStation: (direction: 1 | -1) => void;
}) {
	const { t, locale } = useTranslation();
	const audioRef = useRef<HTMLAudioElement>(null);
	const [blocked, setBlocked] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [nowPlaying, setNowPlaying] = useState<string | null>(null);
	const [streamHealth, setStreamHealth] = useState<StreamHealth>("ok");
	// debounce + retry timers — refs so cleanup can clear them across renders
	// without accidentally triggering re-renders or stale captures
	const errorTimerRef = useRef<number | null>(null);
	const retryTimerRef = useRef<number | null>(null);
	const retriedRef = useRef<boolean>(false);

	const streamDef = STREAMS.find((s) => s.key === state.stationKey) ?? null;
	const isPodcast = streamDef?.type === "podcast";

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

	// podcast title refresh — best-effort RSS fetch for episode title.
	// audio src comes from state.stationUrl directly (no audioSrc state needed).
	// RSS fetch is CORS-blocked from the browser for most feeds; silently ignored.
	// biome-ignore lint/correctness/useExhaustiveDependencies: state.stationKey is the reset trigger
	useEffect(() => {
		if (streamDef?.type !== "podcast" || !streamDef.rssFeedUrl) return;
		fetch(streamDef.rssFeedUrl)
			.then((r) => (r.ok ? r.text() : null))
			.then((xml) => {
				if (!xml) return;
				const doc = new DOMParser().parseFromString(xml, "text/xml");
				const title = doc
					.querySelector("channel > item:first-child > title")
					?.textContent?.trim();
				if (title) setNowPlaying(title);
			})
			.catch(() => {});
	}, [state.stationKey]);

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
	}, [isPodcast]);

	// stream-playing body class — gates audio-reactive UI (liora head sway,
	// LED bands, dark-mode bursts) so the visualizers freeze when the user
	// stops the stream. --cdn-bass / --cdn-mid / --cdn-treble naturally drop
	// to silence on pause but the keyframes still tick; a body-class toggle
	// flips animation-play-state to paused for a clean stop
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		const onPlay = () => {
			document.body.classList.add("cdn-stream-playing");
			setPlaying(true);
		};
		const onStopEvt = () => {
			document.body.classList.remove("cdn-stream-playing");
			setPlaying(false);
		};
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
	}, [isPodcast]);

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
		// only auto-play when the user already pressed play this session
		// (state was hydrated from sessionStorage). On bootstrap (no prior
		// state) the pill renders idle so first-paint isn't a forced play
		// attempt — the user clicks play to opt in
		if (autoplay) {
			audio.play().catch(() => setBlocked(true));
		}

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

	const play = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.play().catch(() => setBlocked(true));
	}, []);

	const pause = useCallback(() => {
		audioRef.current?.pause();
	}, []);

	const handlePlay = useCallback(() => {
		const a = audioRef.current;
		if (!a || isPodcast) return;
		window.dispatchEvent(
			new CustomEvent("cdn:audio:play", {
				detail: { element: a, stationKey: state.stationKey },
			}),
		);
	}, [state.stationKey, isPodcast]);

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

	// v0.0.0084 — promote the station palette vars to :root so OUTSIDE the
	// .cdn-pp subtree (Volunteer pill, hamburger / info Cloudscape toggles in
	// the AppLayout chrome) the audio-reactive ring rules in
	// cdn-glass-streaks.css can resolve --station-primary-rgb instead of
	// falling back to the static aws-orange / lavender. Without this the
	// v0.0.0066 audio-reactive trigger rings always wore the same fallback
	// color regardless of which station was playing — visually broken
	useEffect(() => {
		const root = document.documentElement;
		if (!streamDef) {
			root.style.removeProperty("--station-primary");
			root.style.removeProperty("--station-primary-rgb");
			root.style.removeProperty("--station-secondary");
			root.style.removeProperty("--station-secondary-rgb");
			root.style.removeProperty("--station-accent");
			root.style.removeProperty("--station-primary-light");
			root.style.removeProperty("--station-primary-light-rgb");
			root.style.removeProperty("--station-primary-dark");
			root.style.removeProperty("--station-primary-dark-rgb");
			return;
		}
		root.style.setProperty("--station-primary", streamDef.colors.primary);
		root.style.setProperty(
			"--station-primary-rgb",
			hexToRgbTuple(streamDef.colors.primary),
		);
		root.style.setProperty("--station-secondary", streamDef.colors.secondary);
		root.style.setProperty(
			"--station-secondary-rgb",
			hexToRgbTuple(streamDef.colors.secondary),
		);
		root.style.setProperty("--station-accent", streamDef.colors.accent);
		const primaryLight =
			streamDef.colors.primaryLight ?? streamDef.colors.primary;
		const primaryDark =
			streamDef.colors.primaryDark ?? streamDef.colors.primary;
		root.style.setProperty("--station-primary-light", primaryLight);
		root.style.setProperty(
			"--station-primary-light-rgb",
			hexToRgbTuple(primaryLight),
		);
		root.style.setProperty("--station-primary-dark", primaryDark);
		root.style.setProperty(
			"--station-primary-dark-rgb",
			hexToRgbTuple(primaryDark),
		);
		return () => {
			// only clear on unmount — station change replaces in place above
			root.style.removeProperty("--station-primary");
			root.style.removeProperty("--station-primary-rgb");
			root.style.removeProperty("--station-secondary");
			root.style.removeProperty("--station-secondary-rgb");
			root.style.removeProperty("--station-accent");
			root.style.removeProperty("--station-primary-light");
			root.style.removeProperty("--station-primary-light-rgb");
			root.style.removeProperty("--station-primary-dark");
			root.style.removeProperty("--station-primary-dark-rgb");
		};
	}, [streamDef]);

	// surface state derivations — keeps JSX readable and centralizes the
	// "what gets shown in the track row" decision tree:
	//   1. failed   → red error message + retry button (auto-retry exhausted)
	//   2. retrying → soft "retrying" hint, no retry button (auto-retry in flight)
	//   3. track    → nowPlaying string (no eyebrow — listener knows it's playing)
	//   4. fallback → station-specific link (playlist / podcasts / programs)
	//   5. neither  → origin geo line ("City, Region, Country")
	const showFailedUI = streamHealth === "failed";
	const showRetryingUI = streamHealth === "retrying";

	return (
		<section
			className={`cdn-pp${nowPlaying ? " cdn-pp--has-track" : ""}${showFailedUI ? " cdn-pp--failed" : ""}${showRetryingUI ? " cdn-pp--retrying" : ""}`}
			aria-label="now playing"
			data-station={state.stationKey}
			style={stationStyle}
		>
			{/* biome-ignore lint/a11y/useMediaCaption: live radio stream — no caption track available */}
			<audio
				key={isPodcast ? "podcast" : "radio"}
				ref={audioRef}
				src={state.stationUrl}
				preload="none"
				crossOrigin={isPodcast ? undefined : "anonymous"}
				onPlay={handlePlay}
				onPause={handlePause}
			/>
			{/* skip — left of meta */}
			<button
				type="button"
				className="cdn-pp__btn cdn-pp__btn--skip"
				onClick={() => onSkipStation(1)}
				aria-label="next station"
				title="next station"
			>
				<span aria-hidden="true">⏭</span>
			</button>
			<span className="cdn-pp__meta">
				{streamDef?.donateUrl ? (
					<a
						className="cdn-pp__label cdn-pp__label--donate"
						href={streamDef.donateUrl}
						target="_blank"
						rel="noreferrer"
						title={`donate to ${state.stationLabel}`}
					>
						<span className="cdn-pp__label-text">{state.stationLabel}</span>
						<span className="cdn-pp__label-donate" aria-hidden="true">
							{" · donate"}
						</span>
					</a>
				) : (
					<span className="cdn-pp__label">{state.stationLabel}</span>
				)}
				{/* sub-row: always show geo, append song title or fallback when present */}
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
					<span className="cdn-pp__sub" role="status" aria-live="polite">
						<span
							className="cdn-pp__eyebrow cdn-pp__eyebrow--warn"
							aria-hidden="true"
						>
							{t("persistentPlayer.streamErrorRetrying")}
						</span>
					</span>
				) : (
					<span className="cdn-pp__sub" aria-live="polite">
						{streamDef && (
							<span className="cdn-pp__geo">
								{formatLocation(streamDef.location)}
							</span>
						)}
						{nowPlaying ? (
							<>
								{streamDef && (
									<span className="cdn-pp__sep" aria-hidden="true">
										{" · "}
									</span>
								)}
								<span className="cdn-pp__track-text" title={nowPlaying}>
									{nowPlaying}
								</span>
							</>
						) : streamDef?.metaFallback ? (
							<>
								<span className="cdn-pp__sep" aria-hidden="true">{" · "}</span>
								<a
									className="cdn-pp__now-playing-link"
									href={streamDef.metaFallback.href}
									target="_blank"
									rel="noreferrer"
								>
									{locale === "mx"
										? streamDef.metaFallback.labelEs
										: streamDef.metaFallback.labelEn}
								</a>
							</>
						) : null}
					</span>
				)}
			</span>
			{/* type icon — 💃🏾 radio / 🗣️ podcast — sits left of play button */}
			<span className="cdn-pp__icon" aria-hidden="true">
				{streamDef?.type === "podcast" ? "🗣️" : "💃🏾"}
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
			{blocked ? (
				<button
					type="button"
					className="cdn-pp__btn cdn-pp__btn--resume"
					onClick={resume}
					aria-label="resume playback"
				>
					&#9654;
				</button>
			) : playing ? (
				<button
					type="button"
					className="cdn-pp__btn cdn-pp__btn--stop"
					onClick={pause}
					aria-label="pause playback"
				>
					&#9632;
				</button>
			) : (
				<button
					type="button"
					className="cdn-pp__btn cdn-pp__btn--play"
					onClick={play}
					aria-label="play"
				>
					&#9654;
				</button>
			)}
		</section>
	);
}

export default function PersistentPlayer() {
	const [state, setState] = useState<PersistedPlayerState | null>(null);
	// autoplay = true once the user has indicated intent (hydrated from
	// sessionStorage = previously pressed play, OR clicked skip on the
	// idle bootstrap pill). Stays true for the rest of the session so a
	// station skip mid-playback doesn't drop into idle
	const [autoplay, setAutoplay] = useState(false);

	useEffect(() => {
		// hydrate from sessionStorage; validate stationUrl against current STREAMS
		// so stale cached URLs (e.g. old RSS xml urls) never reach the audio element
		const persisted = loadPlayerState();
		if (persisted) {
			const live = STREAMS.find((s) => s.key === persisted.stationKey);
			setState(
				live
					? { stationKey: live.key, stationUrl: live.url, stationLabel: live.label, metaUrl: live.metaUrl }
					: persisted,
			);
			setAutoplay(true);
			return;
		}
		const first = STREAMS[0];
		if (!first) return;
		setState({
			stationKey: first.key,
			stationUrl: first.url,
			stationLabel: first.label,
			metaUrl: first.metaUrl,
		});
	}, []);

	// skip station — direction +1 advances, -1 rewinds. Mirrors the
	// previous KruxPlayer modulo arithmetic so OS media-session skip
	// behaves the same. After the first user-initiated skip, flip autoplay
	// on so subsequent station changes resume audio without an extra click
	const handleSkipStation = useCallback((direction: 1 | -1) => {
		setAutoplay(true);
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

	// stop button removed — pause keeps the pill visible. Old onStop
	// closed the pill entirely; with the bootstrap behavior we want the
	// widget permanently on screen so the user can re-engage
	const handleStop = useCallback(() => {
		// no-op: kept on the prop signature for future "close pill" UI
	}, []);

	if (!state) return null;

	return (
		<PersistentPlayerBar
			state={state}
			autoplay={autoplay}
			onStop={handleStop}
			onSkipStation={handleSkipStation}
		/>
	);
}
