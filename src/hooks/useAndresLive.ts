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
					setResult({ live: false, videoId: null });
					return;
				}
				const data = (await r.json()) as { html?: string };
				if (cancelled) return;
				const videoId = data.html ? parseVideoId(data.html) : null;
				setResult({ live: true, videoId });
			} catch {
				if (!cancelled) setResult({ live: false, videoId: null });
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
