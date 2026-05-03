// twitch live-state probe + sessionStorage cache.
//
// Background: Twitch's embed SDK shows an "AWS is offline — visit AWS" CTA
// when the channel is down, which Bryan finds useless. We want to HIDE the
// card entirely if not currently live. The Helix API would be the official
// path but requires a client_id+secret pair we don't have configured. Twitch
// also exposes an unauthenticated public GQL endpoint at gql.twitch.tv that
// the official web player itself uses; the well-known client ID
// `kimne78kx3ncx6brgo4mv6wki5h1ko` is hard-coded in the public twitch.tv
// bundle and accepts the `UseLive` operation without OAuth. We use it here
// purely to read the boolean live-state of a channel — same data the green
// "LIVE" dot on twitch.tv reads from. No personal data, no scopes.
//
// Contract:
//   - one probe per channel per browser session (sessionStorage scope)
//   - confirmed-live → cached as { live: true }
//   - confirmed-offline → cached as { live: false }
//   - transient failure (network err, non-2xx, malformed json) → NOT cached,
//     returns null so caller can decide whether to retry on next mount
//
// All keys namespaced under `cdn:twitch-live:` so coexisting tabs / pages
// share the result without colliding with other sessionStorage consumers.

export type TwitchLiveResult = { live: boolean };

const KEY_PREFIX = "cdn:twitch-live:";
const GQL_ENDPOINT = "https://gql.twitch.tv/gql";
// public hard-coded client id used by the official twitch.tv web bundle for
// unauthenticated read of public stream state. Not a secret.
const PUBLIC_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

function storageKey(channelId: string): string {
	return `${KEY_PREFIX}${channelId.toLowerCase()}`;
}

function readCache(channelId: string): TwitchLiveResult | null {
	try {
		const raw = sessionStorage.getItem(storageKey(channelId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as TwitchLiveResult;
		if (typeof parsed.live !== "boolean") return null;
		return parsed;
	} catch {
		return null;
	}
}

function writeCache(channelId: string, result: TwitchLiveResult): void {
	try {
		sessionStorage.setItem(storageKey(channelId), JSON.stringify(result));
	} catch {
		// quota / disabled storage — silent; next call just re-probes
	}
}

/**
 * Probe twitch live-state for a channel id (the lowercased login name, eg
 * "aws" or "awsonair"). Returns cached result if present, otherwise fetches
 * once and caches the resolved state.
 *
 * Returns:
 *   - TwitchLiveResult on confirmed live OR confirmed offline (cached)
 *   - null on transient failure (NOT cached — caller may retry next mount)
 */
export async function probeTwitchLive(
	channelId: string,
	fetchImpl: typeof fetch = fetch,
): Promise<TwitchLiveResult | null> {
	const cached = readCache(channelId);
	if (cached) return cached;

	const body = JSON.stringify([
		{
			operationName: "UseLive",
			variables: { channelLogin: channelId.toLowerCase() },
			extensions: {
				persistedQuery: {
					version: 1,
					sha256Hash:
						"639d5f11bfb8bf3053b424d9ef650d04c4ebb7d94711d644afb08fe9a0fad5d9",
				},
			},
		},
	]);

	let response: Response;
	try {
		response = await fetchImpl(GQL_ENDPOINT, {
			method: "POST",
			headers: {
				"Client-Id": PUBLIC_CLIENT_ID,
				"Content-Type": "text/plain;charset=UTF-8",
			},
			body,
		});
	} catch {
		return null;
	}

	if (!response.ok) return null;

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		return null;
	}

	// Expected shape:
	//   [{ data: { user: { stream: { id, createdAt } | null } } }]
	// stream === null → channel is offline. stream object → live.
	if (!Array.isArray(payload) || payload.length === 0) return null;
	const first = payload[0] as {
		data?: { user?: { stream?: { id?: string } | null } | null };
	};
	const user = first?.data?.user;
	// user === null is a valid response too (channel does not exist) — treat
	// as offline so we hide the card rather than re-probe forever.
	if (user === undefined) return null;
	const live = user !== null && user.stream != null;
	const result: TwitchLiveResult = { live };
	writeCache(channelId, result);
	return result;
}

/** test/manual hook — drop a single channel's cache entry */
export function clearTwitchLiveCache(channelId: string): void {
	try {
		sessionStorage.removeItem(storageKey(channelId));
	} catch {
		// nothing to clean if storage is unavailable
	}
}

/** test/manual hook — drop all cdn twitch-live cache entries */
export function clearAllTwitchLiveCache(): void {
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
