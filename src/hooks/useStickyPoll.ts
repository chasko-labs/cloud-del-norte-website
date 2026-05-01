import { useEffect, useState } from "react";

/**
 * useStickyPoll — sticky polling hook.
 *
 * Polls `fetcher` every `intervalMs`. Stickiness rule:
 *   - fetcher resolves to a non-null T → state updates (confirmed result)
 *   - fetcher resolves to null OR throws → state preserved (transient failure)
 *
 * Eliminates the "transient 4xx flips card off" pattern. Cards gated on this
 * value stay visible across momentary network blips; only confirmed-success
 * results mutate state. The next interval retries.
 *
 * For event-pushed sources (SSE, SDK callbacks) where the upstream itself
 * already debounces, prefer wiring the source directly. This hook is for the
 * poll-pull case where every tick is a fresh request that may fail in flight.
 *
 * @param fetcher async — return T on success, null on transient failure
 * @param intervalMs poll cadence
 * @param initial seed value before first successful fetch
 */
export function useStickyPoll<T>(opts: {
	fetcher: () => Promise<T | null>;
	intervalMs: number;
	initial: T;
}): T {
	const { fetcher, intervalMs, initial } = opts;
	const [value, setValue] = useState<T>(initial);

	useEffect(() => {
		let cancelled = false;

		async function tick() {
			try {
				const next = await fetcher();
				if (cancelled) return;
				// null = transient failure → keep previous state (sticky)
				if (next === null) return;
				setValue(next);
			} catch {
				// network/parse error — same stickiness rationale; retry next tick
			}
		}

		tick();
		const id = setInterval(tick, intervalMs);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [fetcher, intervalMs]);

	return value;
}
