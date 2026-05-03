// youtube oembed probe + sessionStorage cache.
//
// Background: the youtube oembed endpoint returns 404 when a channel is not
// currently live (eg `youtube.com/oembed?url=youtube.com/@handle/live`).
// Polling that endpoint floods the console with 404s and pins the network
// panel red even though the page is functioning correctly.
//
// Contract:
//   - one probe per channel per browser session (sessionStorage scope)
//   - confirmed-live → cached as { live: true, videoId }
//   - confirmed-offline (404) → cached as { live: false, videoId: null }
//   - transient failure (network err, non-404 non-2xx) → NOT cached, returns
//     null so the caller can decide whether to retry on next mount
//
// No automatic re-poll. The cache lives for the session; a hard reload (or
// `clearOembedCache`) refreshes it.
//
// All keys namespaced under `cdn:yt-oembed:` so coexisting tabs / pages
// share the result without colliding with other sessionStorage consumers.

export type OembedResult = { live: boolean; videoId: string | null };

const KEY_PREFIX = "cdn:yt-oembed:";

function storageKey(channelUrl: string): string {
	return `${KEY_PREFIX}${channelUrl}`;
}

function readCache(channelUrl: string): OembedResult | null {
	try {
		const raw = sessionStorage.getItem(storageKey(channelUrl));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as OembedResult;
		if (typeof parsed.live !== "boolean") return null;
		return parsed;
	} catch {
		return null;
	}
}

function writeCache(channelUrl: string, result: OembedResult): void {
	try {
		sessionStorage.setItem(storageKey(channelUrl), JSON.stringify(result));
	} catch {
		// quota / disabled storage — silent; next call just re-probes
	}
}

function parseVideoId(html: string): string | null {
	const m = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
	return m ? m[1] : null;
}

/**
 * Probe oembed for a channel URL. Returns cached result if present, otherwise
 * fetches once and caches the resolved state.
 *
 * Returns:
 *   - OembedResult on confirmed live OR confirmed offline (cached)
 *   - null on transient failure (NOT cached — caller may retry next mount)
 */
export async function probeOembed(
	channelUrl: string,
	fetchImpl: typeof fetch = fetch,
): Promise<OembedResult | null> {
	const cached = readCache(channelUrl);
	if (cached) return cached;

	const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(channelUrl)}&format=json`;

	let response: Response;
	try {
		response = await fetchImpl(oembedUrl);
	} catch {
		return null;
	}

	// 404 = confirmed offline; cache it
	if (response.status === 404) {
		const result: OembedResult = { live: false, videoId: null };
		writeCache(channelUrl, result);
		return result;
	}

	// any other non-2xx is transient — do not cache
	if (!response.ok) return null;

	let data: { html?: string };
	try {
		data = (await response.json()) as { html?: string };
	} catch {
		return null;
	}

	const result: OembedResult = data.html
		? { live: true, videoId: parseVideoId(data.html) }
		: { live: false, videoId: null };
	writeCache(channelUrl, result);
	return result;
}

/** test/manual hook — drop a single channel's cache entry */
export function clearOembedCache(channelUrl: string): void {
	try {
		sessionStorage.removeItem(storageKey(channelUrl));
	} catch {
		// nothing to clean if storage is unavailable
	}
}

/** test/manual hook — drop all cdn oembed cache entries */
export function clearAllOembedCache(): void {
	try {
		const keys: string[] = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const k = sessionStorage.key(i);
			if (k?.startsWith(KEY_PREFIX)) keys.push(k);
		}
		for (const k of keys) sessionStorage.removeItem(k);
	} catch {
		// noop
	}
}
