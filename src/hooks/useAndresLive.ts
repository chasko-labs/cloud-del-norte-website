import { useEffect, useState } from "react";

const OEMBED_URL =
	"https://www.youtube.com/oembed?url=https://www.youtube.com/@andmoredev/live&format=json";
const POLL_MS = 60_000;

function parseVideoId(html: string): string | null {
	const m = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
	return m ? m[1] : null;
}

export function useAndresLive(): { live: boolean; videoId: string | null } {
	const [result, setResult] = useState<{
		live: boolean;
		videoId: string | null;
	}>({
		live: false,
		videoId: null,
	});

	useEffect(() => {
		let cancelled = false;

		async function check() {
			try {
				const r = await fetch(OEMBED_URL);
				if (cancelled) return;
				if (!r.ok) {
					// Transient API failure — KEEP PREVIOUS STATE instead of toggling
					// to offline. YouTube's oEmbed endpoint 404s on offline channels
					// AND on transient errors; without stickiness, the hero block
					// toggles every 60s creating layout jumps. Only flip to offline
					// on a confirmed-success-but-empty response (handled below).
					return;
				}
				const data = (await r.json()) as { html?: string };
				if (cancelled) return;
				if (!data.html) {
					// Confirmed offline (200 with no embed html — channel is up but
					// not live). Safe to flip to offline.
					setResult({ live: false, videoId: null });
					return;
				}
				const videoId = parseVideoId(data.html);
				setResult({ live: true, videoId });
			} catch {
				// Network/parse error — same stickiness rationale as !r.ok above.
				// Preserve previous state. The next poll in 60s will retry.
			}
		}

		check();
		const id = setInterval(check, POLL_MS);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, []);

	return result;
}
