// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Spinner from "@cloudscape-design/components/spinner";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import {
	fetchKexpNowPlaying,
	type KexpNowPlaying,
} from "../../lib/kexp-now-playing";
import { setMediaSession } from "../../lib/media-session";
import {
	clearPodcastPosition,
	loadPlayerState,
	type PersistedPlayerState,
	savePlayerState,
} from "../../lib/player-persist";
import { formatLocation, hexToRgbTuple } from "../../lib/streams";
import { STREAMS } from "../../lib/streams-order";
import { checkReachability } from "../../lib/streams-reachability";
import { DancerIcon } from "../dancer-icon";
import { PodcastIcon } from "../podcast-icon";
import { RadioTowerIcon } from "../radio-tower-icon";
import {
	NextEpisodeIcon,
	PodcastPauseIcon,
	PodcastPlayIcon,
	SeekBackIcon,
	SeekForwardIcon,
} from "./podcast-player-icons";
import { decidePodcastRecovery, pruneHistory } from "./podcast-recovery";
import "./styles.css";

/**
 * Wave 24c — episode-swap event name. The episode scroller dispatches this
 * with detail.url + detail.title when the user picks a back-catalog episode
 * to play. The persistent player listens (see effect inside
 * PersistentPlayerBar) and overrides the audio src + plays. Lives on window
 * so the scroller doesn't need a direct ref into the player tree.
 */
const EPISODE_SWAP_EVENT = "cdn:player:swap-episode";

/**
 * Wave 24c — read-only hook that surfaces the active stream's identifying
 * fields for sibling components (notably the podcast-episode-scroller). The
 * scroller cannot import the persisted state directly without polling, so
 * we publish state changes via a `cdn:player:state` window event from the
 * player's own state effect and replay the latest snapshot here.
 *
 * Returns nullable fields — the player may not have hydrated yet on the
 * very first paint after a cold load.
 */
export interface ActivePlayerStream {
	readonly stationKey: string | null;
	readonly stationLabel: string | null;
	readonly isPodcast: boolean;
	readonly currentEpisodeUrl: string | null;
}

const PLAYER_STATE_EVENT = "cdn:player:state";

export function useActivePlayerStream(): ActivePlayerStream {
	const [snapshot, setSnapshot] = useState<ActivePlayerStream>(() =>
		readActivePlayerStream(),
	);
	useEffect(() => {
		const handler = () => setSnapshot(readActivePlayerStream());
		// Window-level focus + storage listeners catch out-of-band updates
		// (other tabs, hydration races) without requiring the player tree to
		// share React context with consumers.
		window.addEventListener(PLAYER_STATE_EVENT, handler);
		window.addEventListener("storage", handler);
		// Initial fetch in case the publishing effect already fired before
		// this hook mounted (race on first paint).
		handler();
		return () => {
			window.removeEventListener(PLAYER_STATE_EVENT, handler);
			window.removeEventListener("storage", handler);
		};
	}, []);
	return snapshot;
}

function readActivePlayerStream(): ActivePlayerStream {
	const persisted = loadPlayerState();
	if (!persisted) {
		return {
			stationKey: null,
			stationLabel: null,
			isPodcast: false,
			currentEpisodeUrl: null,
		};
	}
	const def = STREAMS.find((s) => s.key === persisted.stationKey) ?? null;
	return {
		stationKey: persisted.stationKey,
		stationLabel: persisted.stationLabel ?? def?.label ?? null,
		isPodcast: def?.type === "podcast",
		currentEpisodeUrl:
			persisted.podcastEpisodeUrl ?? persisted.stationUrl ?? null,
	};
}

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
	onPlayStateChange,
}: {
	state: PersistedPlayerState;
	/** when true, attempt audio.play() on mount + on station-change. set when
	 *  the player was hydrated from sessionStorage (user already pressed play
	 *  this session) or after the user advances stations via skip */
	autoplay: boolean;
	onStop: () => void;
	onSkipStation: (direction: 1 | -1) => void;
	/** fired when audio play/pause state changes so the outer component can
	 *  track "is currently playing" independently of the autoplay flag */
	onPlayStateChange?: (playing: boolean) => void;
}) {
	const { t, locale } = useTranslation();
	const audioRef = useRef<HTMLAudioElement>(null);
	const [blocked, setBlocked] = useState(false);
	const [playing, setPlaying] = useState(false);
	const playingRef = useRef(false);
	const [connecting, setConnecting] = useState(false);
	const [readyToLoad, setReadyToLoad] = useState(autoplay);
	const [nowPlaying, setNowPlaying] = useState<string | null>(null);
	const [rssAudioUrl, setRssAudioUrl] = useState<string | null>(null);
	const [streamHealth, setStreamHealth] = useState<StreamHealth>("ok");
	// KEXP-only album art surface — populated by a parallel poll against
	// api.kexp.org/v2/plays whenever the active station is `kexp` AND the
	// audio is actually playing. Cleared on station-change / stop. The shared
	// fetchMeta path already populates `nowPlaying` with "song — artist", so
	// this state only holds the artwork URL + a refs-tracked "current track"
	// signature used to skip stale-data re-renders.
	const [kexpArt, setKexpArt] = useState<KexpNowPlaying | null>(null);
	// wave 93 — hide the album art entirely when the image fails to load
	// (cover-art-archive returns a 404 / network error / blocked URL). Without
	// this gate, Chromium / Firefox render the broken-image placeholder icon
	// instead of falling back to no-image. Reset on each new track URL.
	const [kexpArtError, setKexpArtError] = useState(false);
	// Reset the kexpArtError flag whenever the album-art URL changes so each
	// new track gets a fresh load attempt. Without this, a single 404 would
	// hide the thumbnail for the rest of the listening session.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only the URL drives the reset
	useEffect(() => {
		setKexpArtError(false);
	}, [kexpArt?.albumArtUrl]);
	// stable signature of the last KEXP track we accepted — lets the polling
	// effect short-circuit re-renders when KEXP returns the same row twice
	// (DJ on a long airbreak after one song, slow rotations). Stored as ref so
	// it survives across polls without joining the effect dep list.
	const kexpTrackSigRef = useRef<string | null>(null);
	// build-time podcast episode cache — populated once from /data/podcast-episodes.json.
	// used as fallback when live RSS fetch is CORS-blocked in the browser.
	// wave 28c: cache now carries enclosureUrl so the player starts from the
	// freshest URL (eliminating the stale-hardcoded-streams.ts failure mode)
	// and can recover from runtime audio errors by refetching the latest
	// enclosure URL on the fly.
	const episodeCacheRef = useRef<Record<
		string,
		{ display: string | null; enclosureUrl: string | null } | null
	> | null>(null);
	// wave 28c: timestamps of recent podcast retry attempts (sliding 60s
	// window). When >=3 attempts fall inside the window the player surfaces
	// the existing failed UI (auto-advance + manual retry button). Tracked
	// in a ref so it survives re-renders without re-arming effects.
	const podcastRetryHistoryRef = useRef<number[]>([]);
	// timer for delayed retry when the last attempt was less than 5s ago —
	// enforces the 5s backoff floor without busy-looping
	const podcastRetryTimerRef = useRef<number | null>(null);
	// debounce + retry timers — refs so cleanup can clear them across renders
	// without accidentally triggering re-renders or stale captures
	const errorTimerRef = useRef<number | null>(null);
	const retryTimerRef = useRef<number | null>(null);
	// counts retry attempts; 0 = no retry yet. each attempt tries the next
	// fallback URL before giving up (uam_radio cycles to yanapak mirror)
	const retryCountRef = useRef<number>(0);
	// true once audio has fired playing/canplaythrough at least once this session.
	// error/stall timer only arms after the stream has connected — initial buffering
	// should never surface the error UI
	const hasConnectedRef = useRef<boolean>(false);
	// stable ref so the health-monitor effect can read current streamDef
	// without being in its dep list (would force re-registration on meta updates)
	const streamDefRef = useRef(
		STREAMS.find((s) => s.key === state.stationKey) ?? null,
	);
	// stable ref for onPlayStateChange so body-class effect stays dep-clean
	const onPlayStateChangeRef = useRef(onPlayStateChange);

	const streamDef = STREAMS.find((s) => s.key === state.stationKey) ?? null;
	const isPodcast = streamDef?.type === "podcast";

	useEffect(() => {
		streamDefRef.current = streamDef;
	}, [streamDef]);
	useEffect(() => {
		onPlayStateChangeRef.current = onPlayStateChange;
	}, [onPlayStateChange]);

	// Load build-time podcast episode cache once on mount.
	// Populated by scripts/fetch-feeds.mjs → public/data/podcast-episodes.json.
	// wave 28c: also captures enclosureUrl per key so the runtime can prime
	// rssAudioUrl with the freshest URL before first play and use it as a
	// recovery target on audio errors.
	useEffect(() => {
		fetch("/data/podcast-episodes.json")
			.then((r) => (r.ok ? r.json() : null))
			.then(
				(
					data: Record<
						string,
						{ display?: string; enclosureUrl?: string } | null
					> | null,
				) => {
					if (!data) return;
					episodeCacheRef.current = Object.fromEntries(
						Object.entries(data).map(([k, v]) => [
							k,
							v
								? {
										display: v.display ?? null,
										enclosureUrl: v.enclosureUrl ?? null,
									}
								: null,
						]),
					);
				},
			)
			.catch(() => {});
	}, []);

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

	// podcast title refresh — best-effort RSS fetch for episode title + enclosure URL.
	// CORS-blocked feeds fall back to build-time episode cache (podcast-episodes.json).
	// When the enclosure URL differs from the hardcoded stationUrl, rssAudioUrl
	// overrides the audio src so the latest episode plays automatically.
	// wave 28c: ALSO seeds rssAudioUrl from the build-time enclosureUrl cache
	// before kicking off the live fetch — guarantees the audio element always
	// starts from a build-time-verified URL even when the runtime RSS request
	// is in flight or fails. This is the primary defense against stale
	// hardcoded streams.ts URLs (Triton signed CDN expiry, captivate UUID
	// rotation).
	// biome-ignore lint/correctness/useExhaustiveDependencies: state.stationKey is the reset trigger
	useEffect(() => {
		if (streamDef?.type !== "podcast" || !streamDef.rssFeedUrl) return;
		setRssAudioUrl(null); // reset on station change
		const capturedKey = state.stationKey;

		// Prime audio src from the build-time enclosure cache if it differs from
		// the hardcoded streams.ts url — this fires synchronously inside the
		// effect, so the audio element renders with the freshest URL on first
		// play. The live RSS fetch below may further refresh after a roundtrip.
		const cached = episodeCacheRef.current?.[capturedKey] ?? null;
		if (cached?.enclosureUrl && cached.enclosureUrl !== state.stationUrl) {
			setRssAudioUrl(cached.enclosureUrl);
		}
		if (cached?.display) {
			setNowPlaying(cached.display);
		}

		// corsBlocked feeds cannot be fetched in the browser — already primed above
		if (streamDef.corsBlocked) {
			return;
		}
		fetch(streamDef.rssFeedUrl)
			.then((r) => (r.ok ? r.text() : null))
			.then((xml) => {
				if (!xml) return;
				const doc = new DOMParser().parseFromString(xml, "text/xml");
				const title = doc
					.querySelector("channel > item:first-child > title")
					?.textContent?.trim();
				const subtitle = doc
					.querySelector("channel > item:first-child > itunes\\:subtitle")
					?.textContent?.trim();
				if (title) {
					setNowPlaying(
						subtitle && subtitle !== title
							? `${title} — ${subtitle.substring(0, 90)}`
							: title,
					);
				}
				// Try to extract latest episode audio URL for dynamic rotation
				const encUrl = doc
					.querySelector("channel > item:first-child > enclosure")
					?.getAttribute("url");
				if (encUrl && encUrl !== state.stationUrl) {
					setRssAudioUrl(encUrl);
				}
			})
			.catch(() => {
				// CORS-blocked at runtime — already primed from cache above; nothing to do
			});
	}, [state.stationKey]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: state.stationKey is the reset trigger; effect body intentionally only resets state
	useEffect(() => {
		setNowPlaying(null);
		setStreamHealth("ok");
		setConnecting(false);
		retryCountRef.current = 0;
		hasConnectedRef.current = false;
		// gate audio src: preserve when playing (station skip mid-play), reset when idle
		if (!playingRef.current) setReadyToLoad(false);
		// wave 28c: reset podcast-specific retry budget + clear pending backoff timer
		podcastRetryHistoryRef.current = [];
		if (podcastRetryTimerRef.current !== null) {
			window.clearTimeout(podcastRetryTimerRef.current);
			podcastRetryTimerRef.current = null;
		}
		if (errorTimerRef.current !== null) {
			window.clearTimeout(errorTimerRef.current);
			errorTimerRef.current = null;
		}
		if (retryTimerRef.current !== null) {
			window.clearTimeout(retryTimerRef.current);
			retryTimerRef.current = null;
		}
	}, [state.stationKey]);

	// Wave 24c — episode-swap listener. The podcast-episode-scroller dispatches
	// `cdn:player:swap-episode` when the user picks a back-catalog episode;
	// we override the audio src + start playback. Gated to the active podcast
	// only — radio stations ignore the event entirely.
	useEffect(() => {
		if (!isPodcast) return;
		const handler = (ev: Event) => {
			const detail = (ev as CustomEvent<{ url?: string; title?: string }>)
				.detail;
			if (!detail?.url) return;
			setRssAudioUrl(detail.url);
			if (detail.title) setNowPlaying(detail.title);
			setReadyToLoad(true);
			// best-effort autoplay — same pattern as the play() callback below.
			// failure (e.g. browser blocks autoplay) sets the blocked state via
			// the existing audio.play() catch chain.
			const audio = audioRef.current;
			if (audio) {
				// give React a tick to flush the new src before kicking play
				queueMicrotask(() => {
					try {
						audio.load();
						audio.play().catch(() => setBlocked(true));
					} catch {
						setBlocked(true);
					}
				});
			}
		};
		window.addEventListener(EPISODE_SWAP_EVENT, handler as EventListener);
		return () => {
			window.removeEventListener(EPISODE_SWAP_EVENT, handler as EventListener);
		};
	}, [isPodcast]);

	// auto-advance on persistent failure — when streamHealth reaches 'failed'
	// (auto-retry exhausted), advance to the next station after a 2s grace
	// period so the user is never permanently stuck. The 2s window lets them
	// read the error state before the skip fires.
	useEffect(() => {
		if (streamHealth !== "failed") return;
		const timer = window.setTimeout(() => onSkipStation(1), 2000);
		return () => window.clearTimeout(timer);
	}, [streamHealth, onSkipStation]);

	// stream health monitor — listens for error / stalled / abort on the audio
	// element. Brief network blips fire and clear quickly, so we only surface
	// UI when an error condition persists past STREAM_ERROR_THRESHOLD_MS. Once
	// surfaced, we auto-retry cycling through primary + fallbackUrls before
	// giving up. Healthy events (playing / canplay) reset the debounce timer
	// so a transient stall that recovers on its own is silent.
	// biome-ignore lint/correctness/useExhaustiveDependencies: isPodcast forces re-registration when audio element is recreated via key prop
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const tripError = () => {
			// only arm the error timer after the stream has successfully connected once.
			// initial buffering fires waiting/stalled before canplay — suppress those.
			if (!hasConnectedRef.current) return;
			if (errorTimerRef.current !== null) return; // already counting down
			errorTimerRef.current = window.setTimeout(() => {
				errorTimerRef.current = null;
				const fallbacks = streamDefRef.current?.fallbackUrls ?? [];
				const maxAttempts = 1 + fallbacks.length; // primary + each fallback
				if (retryCountRef.current >= maxAttempts) {
					setStreamHealth("failed");
					return;
				}
				setStreamHealth("retrying");
				const attemptIdx = retryCountRef.current;
				retryCountRef.current++;
				retryTimerRef.current = window.setTimeout(() => {
					retryTimerRef.current = null;
					// attempt 0 = primary (reload), attempt N = fallback[N-1]
					if (attemptIdx > 0) {
						const fallbackUrl = fallbacks[attemptIdx - 1];
						if (fallbackUrl) audio.src = fallbackUrl;
					}
					try {
						audio.load();
						audio.play().catch(() => setStreamHealth("failed"));
					} catch {
						setStreamHealth("failed");
					}
				}, STREAM_AUTO_RETRY_MS);
			}, STREAM_ERROR_THRESHOLD_MS);
		};

		const clearError = () => {
			// mark as connected — from here on, errors/stalls are real mid-stream drops
			hasConnectedRef.current = true;
			if (errorTimerRef.current !== null) {
				window.clearTimeout(errorTimerRef.current);
				errorTimerRef.current = null;
			}
			// don't clear retryTimerRef — let the in-flight retry complete
			setStreamHealth("ok");
			setConnecting(false);
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

	// wave 28c — podcast-specific URL recovery.
	//
	// Supplements the existing tripError state machine (which cycles through
	// fallbackUrls for radio streams). For podcasts the failure mode is
	// usually a stale enclosure URL: captivate rotated the UUID, or a Triton
	// signed CDN link expired. The fix is to refetch the RSS feed, pull the
	// freshest enclosure URL, swap audio.src, and try again.
	//
	// Budget: PODCAST_RETRY_MAX_ATTEMPTS (3) within a 60s window with a 5s
	// floor between attempts (decidePodcastRecovery). When the budget is
	// exhausted we transition streamHealth to "failed" — the existing UI
	// surfaces the manual retry button + auto-advance after 2s.
	//
	// Acts BEFORE the existing tripError debounce so the URL swap usually
	// resolves the error before the 5s threshold fires; if a fresh URL also
	// fails the existing path still runs and contributes to the same
	// failed-state transition.
	// biome-ignore lint/correctness/useExhaustiveDependencies: isPodcast forces re-registration when audio element is recreated via key prop
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		if (!isPodcast) return;

		const onError = () => {
			const def = streamDefRef.current;
			if (!def || def.type !== "podcast") return;
			const errorCode = audio.error?.code ?? null;
			const now = Date.now();
			podcastRetryHistoryRef.current = pruneHistory(
				podcastRetryHistoryRef.current,
				now,
			);
			const decision = decidePodcastRecovery(
				errorCode,
				podcastRetryHistoryRef.current,
				now,
			);

			if (decision.kind === "give-up") {
				setStreamHealth("failed");
				return;
			}

			const performRetry = () => {
				const stamp = Date.now();
				podcastRetryHistoryRef.current = [
					...pruneHistory(podcastRetryHistoryRef.current, stamp),
					stamp,
				];
				setStreamHealth("retrying");

				// Pick the best fresh URL we can find:
				// 1. Live RSS fetch (preferred — captures rotations within the session)
				// 2. Build-time enclosure cache (always present after fetch-feeds run)
				// 3. Hardcoded streams.ts url as last resort
				const tryWithUrl = (nextUrl: string | null) => {
					if (nextUrl && nextUrl !== audio.src) {
						setRssAudioUrl(nextUrl);
						audio.src = nextUrl;
					}
					try {
						audio.load();
						audio.play().catch(() => {
							// surface the existing failed UI if even the fresh URL won't play
							setStreamHealth("failed");
						});
					} catch {
						setStreamHealth("failed");
					}
				};

				const cached = episodeCacheRef.current?.[def.key]?.enclosureUrl ?? null;

				if (def.rssFeedUrl && !def.corsBlocked) {
					fetch(def.rssFeedUrl)
						.then((r) => (r.ok ? r.text() : null))
						.then((xml) => {
							if (!xml) {
								tryWithUrl(cached);
								return;
							}
							const doc = new DOMParser().parseFromString(xml, "text/xml");
							const encUrl =
								doc
									.querySelector("channel > item:first-child > enclosure")
									?.getAttribute("url") ?? null;
							tryWithUrl(encUrl ?? cached);
						})
						.catch(() => tryWithUrl(cached));
				} else {
					tryWithUrl(cached);
				}
			};

			if (decision.kind === "retry-now") {
				performRetry();
				return;
			}

			// retry-after: schedule under the 5s spacing floor
			if (podcastRetryTimerRef.current !== null) {
				window.clearTimeout(podcastRetryTimerRef.current);
			}
			podcastRetryTimerRef.current = window.setTimeout(() => {
				podcastRetryTimerRef.current = null;
				performRetry();
			}, decision.delayMs);
		};

		audio.addEventListener("error", onError);
		return () => {
			audio.removeEventListener("error", onError);
		};
	}, [isPodcast]);

	// stream-playing body class — gates audio-reactive UI (fiona head sway,
	// LED bands, dark-mode bursts) so the visualizers freeze when the user
	// stops the stream. --cdn-bass / --cdn-mid / --cdn-treble naturally drop
	// to silence on pause but the keyframes still tick; a body-class toggle
	// flips animation-play-state to paused for a clean stop
	// biome-ignore lint/correctness/useExhaustiveDependencies: isPodcast forces re-registration when audio element is recreated via key prop
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		const onPlay = () => {
			document.body.classList.add("cdn-stream-playing");
			if (isPodcast) document.body.classList.add("cdn-podcast-playing");
			setPlaying(true);
			playingRef.current = true;
			setConnecting(false);
			onPlayStateChangeRef.current?.(true);
		};
		const onStopEvt = () => {
			document.body.classList.remove("cdn-stream-playing");
			document.body.classList.remove("cdn-podcast-playing");
			setPlaying(false);
			playingRef.current = false;
			onPlayStateChangeRef.current?.(false);
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
			document.body.classList.remove("cdn-podcast-playing");
		};
	}, [isPodcast]);

	// podcast resume — save position every 5s (throttled via ref), restore on loadedmetadata
	const lastSaveRef = useRef<number>(0);
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio || !isPodcast) return;
		const onTimeUpdate = () => {
			const now = Date.now();
			if (now - lastSaveRef.current < 5000) return;
			lastSaveRef.current = now;
			const url = rssAudioUrl ?? state.stationUrl;
			savePlayerState({
				stationKey: state.stationKey,
				stationUrl: state.stationUrl,
				stationLabel: state.stationLabel,
				metaUrl: state.metaUrl,
				podcastCurrentTime: audio.currentTime,
				podcastEpisodeUrl: url,
			});
		};
		const onLoaded = () => {
			const saved = loadPlayerState();
			if (!saved) return;
			const url = rssAudioUrl ?? state.stationUrl;
			if (
				saved.podcastEpisodeUrl === url &&
				(saved.podcastCurrentTime ?? 0) > 0
			) {
				audio.currentTime = saved.podcastCurrentTime as number;
			}
		};
		audio.addEventListener("timeupdate", onTimeUpdate);
		audio.addEventListener("loadedmetadata", onLoaded);
		audio.addEventListener("ended", clearPodcastPosition);
		return () => {
			audio.removeEventListener("timeupdate", onTimeUpdate);
			audio.removeEventListener("loadedmetadata", onLoaded);
			audio.removeEventListener("ended", clearPodcastPosition);
		};
	}, [
		isPodcast,
		rssAudioUrl,
		state.stationKey,
		state.stationUrl,
		state.stationLabel,
		state.metaUrl,
	]);

	// manual retry — user-triggered escape hatch when auto-retry didn't recover.
	// Resets retry counter and restores primary URL before re-attempting
	const manualRetry = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		retryCountRef.current = 0;
		setStreamHealth("ok");
		try {
			audio.load();
			audio.play().catch(() => setBlocked(true));
		} catch {
			setStreamHealth("failed");
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: autoplay read once on mount; adding to deps restarts polling on user pause/play state changes
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

	// KEXP-only album art poll — runs in parallel with the shared metadata
	// poller above (which populates `nowPlaying` from the same /v2/plays
	// endpoint). We keep the two pollers separate because:
	//   - the shared poller sits in streams.ts territory (parseMeta returns a
	//     plain string, not artwork) and that file is owned by another wave
	//   - this poller only runs while KEXP is the active station AND audio is
	//     actually playing, so it disappears the moment the user stops or
	//     skips to a different station
	// Stale-data guard: if the API returns the same song/artist signature on
	// the next poll, we skip the setState call so React does not re-render
	// the <img> (which would otherwise re-trigger the lazy-load decode).
	//
	// Wave 40a — Page Visibility integration. The poll is suspended while
	// document.visibilityState === "hidden" (backgrounded tab) so we don't
	// burn api.kexp.org quota or battery while the UI cannot be seen. On
	// return to "visible" we kick an immediate fetch and restart the 30s
	// cadence so the album-art surface reflects whatever spun while the tab
	// was backgrounded. Cadence is unchanged — only the gating envelope
	// expands. If the tab is already hidden when the effect mounts (rare:
	// user pre-paused tab before navigating), we just attach the listener
	// and wait for the next visible transition.
	useEffect(() => {
		if (state.stationKey !== "kexp" || !playing) {
			// any non-KEXP station OR paused state immediately drops the album
			// art surface — listener should never see a stale Nu Shooz cover
			// while listening to KRUX
			setKexpArt(null);
			kexpTrackSigRef.current = null;
			return;
		}
		let cancelled = false;
		let intervalId: number | null = null;
		const poll = async () => {
			const result = await fetchKexpNowPlaying();
			if (cancelled) return;
			if (!result) {
				// API failure / airbreak — silently drop the album art block;
				// the existing player UI continues to display the station label
				// + (when present) the song-string from the shared poller
				if (kexpTrackSigRef.current !== null) {
					kexpTrackSigRef.current = null;
					setKexpArt(null);
				}
				return;
			}
			const sig = `${result.song}::${result.artist}::${result.albumArtUrl ?? ""}`;
			if (sig === kexpTrackSigRef.current) return; // unchanged — skip re-render
			kexpTrackSigRef.current = sig;
			setKexpArt(result);
		};
		const startPolling = () => {
			if (intervalId !== null) return; // already running — guard against double-start
			poll();
			intervalId = window.setInterval(poll, POLL_MS);
		};
		const stopPolling = () => {
			if (intervalId !== null) {
				window.clearInterval(intervalId);
				intervalId = null;
			}
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				stopPolling();
			} else {
				// visible — resume with an immediate fetch so the album art
				// surface catches up before the next 30s tick
				startPolling();
			}
		};
		// Initial mount: only kick polling if the tab is currently visible.
		// If it's already hidden, the visibilitychange listener below will
		// pick up the next visible transition.
		if (document.visibilityState !== "hidden") {
			startPolling();
		}
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			cancelled = true;
			stopPolling();
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [state.stationKey, playing]);

	const resume = useCallback(() => {
		audioRef.current?.play().catch(() => {});
		setBlocked(false);
	}, []);

	const play = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		setReadyToLoad(true);
		setConnecting(true);
		// Defer to next frame so React can flush the src attribute before play()
		requestAnimationFrame(() => {
			const a = audioRef.current;
			if (!a) return;
			a.load();
			a.play().catch(() => {
				setConnecting(false);
				setBlocked(true);
			});
		});
	}, []);

	const pause = useCallback(() => {
		audioRef.current?.pause();
	}, []);

	const rewindSeek = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.currentTime = Math.max(0, audio.currentTime - 15);
	}, []);

	const ffSeek = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.currentTime = Math.min(
			audio.duration || Number.POSITIVE_INFINITY,
			audio.currentTime + 15,
		);
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
				src={readyToLoad ? (rssAudioUrl ?? state.stationUrl) : undefined}
				preload="none"
				crossOrigin={isPodcast ? undefined : "anonymous"}
				onPlay={handlePlay}
				onPause={handlePause}
			/>
			{/* skip — left of meta */}
			<div className="cdn-pp__skip-wrap">
				<button
					type="button"
					className="cdn-pp__btn cdn-pp__btn--skip"
					onClick={() => onSkipStation(1)}
					aria-label="next station"
					title="next station"
				>
					{isPodcast ? <NextEpisodeIcon /> : <span aria-hidden="true">⏭</span>}
				</button>
				<span className="cdn-pp__next-hint" aria-hidden="true">
					{(() => {
						const idx = STREAMS.findIndex((s) => s.key === state.stationKey);
						if (idx < 0) return null;
						const next = STREAMS[(idx + 1) % STREAMS.length];
						return `${next.key.slice(0, 4).toUpperCase()} ›`;
					})()}
				</span>
			</div>
			{/* KEXP-only album art — small thumbnail to the LEFT of the meta
			    column. Renders only when station=kexp + we have an image URL.
			    The aria-live wrapper announces track changes for screen
			    readers; alt text on the inner <img> carries the
			    "song — artist" line for sighted users. */}
			{state.stationKey === "kexp" && kexpArt?.albumArtUrl && !kexpArtError ? (
				<span className="cdn-pp__kexp-art-wrap" aria-live="polite">
					<img
						className="cdn-pp__kexp-art"
						src={kexpArt.albumArtUrl}
						alt={
							kexpArt.song && kexpArt.artist
								? `${kexpArt.song} by ${kexpArt.artist}`
								: t("persistentPlayer.kexpNowPlayingFallback")
						}
						loading="lazy"
						decoding="async"
						width={40}
						height={40}
						onError={() => setKexpArtError(true)}
					/>
				</span>
			) : null}
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
							{t("persistentPlayer.streamErrorAdvancing")}
						</span>
					</span>
				) : showRetryingUI ? (
					<span className="cdn-pp__sub" role="status" aria-live="polite">
						<Spinner size="normal" />
						<span
							className="cdn-pp__eyebrow cdn-pp__eyebrow--warn"
							aria-hidden="true"
						>
							{t("persistentPlayer.retrying")}
						</span>
					</span>
				) : connecting ? (
					<span className="cdn-pp__sub" role="status" aria-live="polite">
						<Spinner size="normal" />
						<span
							className="cdn-pp__eyebrow cdn-pp__eyebrow--warn"
							aria-hidden="true"
						>
							{t("persistentPlayer.connecting")}
						</span>
					</span>
				) : (
					<span className="cdn-pp__sub" aria-live="polite">
						{nowPlaying ? (
							<>
								<span className="cdn-pp__track-text" title={nowPlaying}>
									{nowPlaying}
								</span>
								{streamDef && (
									<span className="cdn-pp__sep" aria-hidden="true">
										{" · "}
									</span>
								)}
							</>
						) : streamDef?.metaFallback ? (
							<>
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
								<span className="cdn-pp__sep" aria-hidden="true">
									{" · "}
								</span>
							</>
						) : null}
						{streamDef && (
							<span className="cdn-pp__geo">
								{formatLocation(streamDef.location)}
							</span>
						)}
					</span>
				)}
			</span>
			{playing && (
				<span className="cdn-pp__waveform" aria-hidden="true">
					<span />
					<span />
					<span />
					<span />
					<span />
				</span>
			)}
			{playing && (
				<span className="cdn-pp__sigil" aria-hidden="true">
					<svg
						role="img"
						aria-label="audio-reactive sigil"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<title>audio-reactive sigil</title>
						<path d="M12 22V8" />
						<path d="M9 22h6" />
						<path d="M12 8l-3 4h6l-3-4z" />
						<path d="M8 4a6 6 0 0 1 8 0" />
						<path d="M6 1.5a9 9 0 0 1 12 0" />
					</svg>
				</span>
			)}
			{playing && streamDef?.type === "radio" && <DancerIcon animate />}
			{playing && streamDef?.type === "podcast" && <PodcastIcon />}
			{/* type icon — 💃🏾 radio / 🗣️ podcast — sits left of play button */}
			<span className="cdn-pp__icon" aria-hidden="true">
				{streamDef?.type === "podcast" ? (
					<PodcastIcon />
				) : (
					<RadioTowerIcon active={playing} />
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
			{isPodcast && playing && (
				<>
					<button
						type="button"
						className="cdn-pp__btn cdn-pp__btn--seek"
						onClick={rewindSeek}
						aria-label="rewind 15 seconds"
						title="rewind 15s"
					>
						<SeekBackIcon />
					</button>
					<button
						type="button"
						className="cdn-pp__btn cdn-pp__btn--seek"
						onClick={ffSeek}
						aria-label="fast-forward 15 seconds"
						title="fast-forward 15s"
					>
						<SeekForwardIcon />
					</button>
				</>
			)}
			{blocked ? (
				<button
					type="button"
					className="cdn-pp__btn cdn-pp__btn--resume"
					onClick={resume}
					aria-label="resume playback"
				>
					{isPodcast ? <PodcastPlayIcon /> : <>&#9654;</>}
				</button>
			) : playing ? (
				<button
					type="button"
					className={`cdn-pp__btn ${isPodcast ? "cdn-pp__btn--resume" : "cdn-pp__btn--stop"}`}
					onClick={pause}
					aria-label="pause playback"
				>
					{isPodcast ? <PodcastPauseIcon /> : <>&#9632;</>}
				</button>
			) : (
				<button
					type="button"
					className="cdn-pp__btn cdn-pp__btn--play"
					onClick={play}
					aria-label="play"
					aria-disabled={connecting ? "true" : undefined}
				>
					{isPodcast ? <PodcastPlayIcon /> : <>&#9654;</>}
				</button>
			)}
		</section>
	);
}

function PersistentPlayerInner() {
	const [state, setState] = useState<PersistedPlayerState | null>(null);
	// autoplay reflects whether audio is currently running. set true by
	// handlePlayStateChange when the audio element fires "playing"; set false
	// on pause/end. session restore does NOT set this — the user must press
	// play to opt in, even after a page reload.
	const [autoplay, setAutoplay] = useState(false);

	useEffect(() => {
		// hydrate from sessionStorage; validate stationUrl against current STREAMS
		// so stale cached URLs (e.g. old RSS xml urls) never reach the audio element
		const persisted = loadPlayerState();
		if (persisted) {
			const live = STREAMS.find((s) => s.key === persisted.stationKey);
			setState(
				live
					? {
							stationKey: live.key,
							stationUrl: live.url,
							stationLabel: live.label,
							metaUrl: live.metaUrl,
						}
					: persisted,
			);
			// do NOT set autoplay here — session restore only determines the station,
			// not whether audio starts. autoplay is only true when audio is actually
			// running (set by handlePlayStateChange). this prevents skip from starting
			// playback when the user never pressed play this session.
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

	// Wave 24c — publish the active stream snapshot for sibling consumers
	// (podcast-episode-scroller). Re-fires whenever the resolved station
	// changes so useActivePlayerStream can pick up the new identity.
	// biome-ignore lint/correctness/useExhaustiveDependencies: state is the change-detection trigger; the effect body intentionally just signals
	useEffect(() => {
		if (typeof window === "undefined") return;
		window.dispatchEvent(new CustomEvent(PLAYER_STATE_EVENT));
	}, [state]);

	// skip station — direction +1 advances, -1 rewinds. Checks reachability
	// before switching; skips up to 3 unreachable stations. If all 3 fail,
	// lands on the last attempted so the audio element can surface its own error.
	const handleSkipStation = useCallback((direction: 1 | -1) => {
		const scrollY = window.scrollY;
		clearPodcastPosition();
		setState((current) => {
			if (!current) return current;
			const idx = STREAMS.findIndex((s) => s.key === current.stationKey);
			if (idx < 0) return current;

			// Kick off async reachability probing without blocking the state update.
			// We optimistically advance one step, then re-advance if it's unreachable.
			(async () => {
				const MAX_SKIPS = 3;
				let curIdx = idx;
				let lastState: PersistedPlayerState | null = null;
				for (let attempt = 0; attempt < MAX_SKIPS; attempt++) {
					curIdx = (curIdx + direction + STREAMS.length) % STREAMS.length;
					const next = STREAMS[curIdx];
					const reach = await checkReachability(next);
					const nextState: PersistedPlayerState = {
						stationKey: next.key,
						stationUrl: next.url,
						stationLabel: next.label,
						metaUrl: next.metaUrl,
					};
					lastState = nextState;
					if (reach !== "fail") {
						savePlayerState(nextState);
						setState(nextState);
						requestAnimationFrame(() => window.scrollTo(0, scrollY));
						return;
					}
				}
				// All 3 attempts failed — display the last candidate anyway
				if (lastState) {
					savePlayerState(lastState);
					setState(lastState);
					requestAnimationFrame(() => window.scrollTo(0, scrollY));
				}
			})();

			// Return current unchanged — async handler above will update state
			return current;
		});
	}, []);

	const handlePlayStateChange = useCallback((isPlaying: boolean) => {
		setAutoplay(isPlaying);
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
			onPlayStateChange={handlePlayStateChange}
		/>
	);
}

export default function PersistentPlayer() {
	if (
		typeof document !== "undefined" &&
		document.body.classList.contains("cdn-auth-subdomain")
	) {
		return null;
	}
	return <PersistentPlayerInner />;
}
