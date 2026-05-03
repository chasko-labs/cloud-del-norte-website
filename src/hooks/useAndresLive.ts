import { useEffect, useState } from "react";
import { probeOembed } from "../lib/youtube-oembed-cache";

const CHANNEL_URL = "https://www.youtube.com/@andmoredev/live";

type AndresLive = { live: boolean; videoId: string | null };

const INITIAL: AndresLive = { live: false, videoId: null };

/**
 * useAndresLive — single-shot probe of the andmore-dev youtube channel's
 * /live oembed endpoint, with sessionStorage cache.
 *
 * Behavior change from prior implementation: NO automatic re-poll. The oembed
 * endpoint returns 404 when the channel is not currently live; repeatedly
 * polling that endpoint floods the console + network panel with 404 errors
 * even though the page is healthy. Per-session cache keeps the page quiet
 * while still letting a hard reload pick up "channel went live since last
 * load". See lib/youtube-oembed-cache.ts for cache semantics.
 */
export function useAndresLive(): AndresLive {
	const [value, setValue] = useState<AndresLive>(INITIAL);

	useEffect(() => {
		let cancelled = false;
		probeOembed(CHANNEL_URL).then((result) => {
			if (cancelled || !result) return;
			setValue({ live: result.live, videoId: result.videoId });
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return value;
}
