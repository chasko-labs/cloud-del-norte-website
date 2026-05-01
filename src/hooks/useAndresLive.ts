import { useCallback } from "react";
import { useStickyPoll } from "./useStickyPoll";

const OEMBED_URL =
	"https://www.youtube.com/oembed?url=https://www.youtube.com/@andmoredev/live&format=json";
const POLL_MS = 60_000;

type AndresLive = { live: boolean; videoId: string | null };

const INITIAL: AndresLive = { live: false, videoId: null };

function parseVideoId(html: string): string | null {
	const m = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
	return m ? m[1] : null;
}

export function useAndresLive(): AndresLive {
	// fetcher resolves to:
	//   - null on transient failure (network err / non-2xx) → useStickyPoll preserves prior state
	//   - {live:false,videoId:null} on confirmed-empty 200 (channel up, not streaming)
	//   - {live:true,videoId:...} on confirmed live embed
	// YouTube's oEmbed returns 4xx for both offline channels AND transient API
	// errors — without stickiness the hero block toggles every 60s and creates
	// layout jumps. The shared hook now enforces this contract uniformly.
	const fetcher = useCallback(async (): Promise<AndresLive | null> => {
		const r = await fetch(OEMBED_URL);
		if (!r.ok) return null;
		const data = (await r.json()) as { html?: string };
		if (!data.html) return { live: false, videoId: null };
		return { live: true, videoId: parseVideoId(data.html) };
	}, []);

	return useStickyPoll<AndresLive>({
		fetcher,
		intervalMs: POLL_MS,
		initial: INITIAL,
	});
}
