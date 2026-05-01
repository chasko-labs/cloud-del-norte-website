# stable state

pattern for cards / hero blocks whose visibility depends on remote-polled or event-pushed signals. covers the data layer (sticky polling) and visual layer (reserved-slot wrapper) so transient api failures cannot flap dom presence and shift content below

## the problem

a feed card that polls a remote endpoint (e.g. youtube oembed for live status) gets two failure modes from a single api hiccup:

- 4xx/5xx during a transient network blip
- 4xx returned for the steady-state offline case

without explicit handling, both produce the same `live=false` and the card unmounts. when the next poll succeeds 60s later, it remounts. content below jumps up, then back down. iframe re-fetches. user-visible jank for what is actually a stable upstream

twitch sdk is different — `ONLINE` / `OFFLINE` events fire only on confirmed state transitions, the sdk itself debounces. those don't need stickiness; the rule below applies to poll-pull sources

## the two-layer fix

### data layer — `useStickyPoll`

`src/hooks/useStickyPoll.ts`

```ts
useStickyPoll<T>({
  fetcher: () => Promise<T | null>,  // null = transient, preserve prior state
  intervalMs: number,
  initial: T,
}): T
```

contract:

- fetcher resolves to `T` → state updates (confirmed result)
- fetcher resolves to `null` → state preserved (transient failure, retry next tick)
- fetcher throws → state preserved (network/parse error, retry next tick)

only confirmed-success values flip state. eliminates the "transient 4xx flips card off" pattern at the source

### visual layer — `.cdn-stable-slot`

`src/styles/tokens.css`

wrapper class for any container that conditionally renders dynamic-visibility children. the wrapper renders unconditionally so children mounting / unmounting cannot reflow ancestors. the class reserves no min-height — paired with the sticky hook above, transient flaps are already suppressed at the data layer, so reserving permanent dead space for the rare real transition is worse ux than the one-time shift

## how to use

### sticky data fetch

```ts
import { useStickyPoll } from "../../hooks/useStickyPoll";

const fetcher = useCallback(async () => {
  const r = await fetch(url);
  if (!r.ok) return null;            // transient — sticky preserves prior state
  const data = await r.json();
  if (!data.something) return INITIAL; // confirmed-empty
  return parseSuccess(data);
}, []);

const value = useStickyPoll({ fetcher, intervalMs: 60_000, initial: INITIAL });
```

### stable wrapper

```tsx
<div className="feed-live-hero cdn-stable-slot">
  {liveToShow.map((key) => <LiveCard key={key} ... />)}
  {liveToShow.length > 0 && <hr className="feed-section-divider" />}
</div>
```

the wrapper itself is always present; only its children flip on real state. when empty it collapses to 0 height (no dead space)

## examples in this repo

- `src/hooks/useAndresLive.ts` — youtube oembed sticky poll, gates the andres-live card
- `src/pages/feed/app.tsx` (feed-live-hero) — stable-slot wrapper around live-priority cards

## when not to apply

- carousels rotating local static data (no remote dependency, no failure mode) — `arrowhead-news`, `andres-medium`, `feed-section.PostCarousel`
- now-playing text inside a station card (text content, not gating layout) — fetch failure already swallowed via `.catch(() => {})`, no card visibility flip
- sdk event sources that already debounce upstream (twitch `ONLINE` / `OFFLINE`) — adding stickiness on top would suppress real transitions
