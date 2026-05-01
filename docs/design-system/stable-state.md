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

## geometry isolation — every card has a fixed slot, content fits the slot

dispatched 2026-05-01 as a tactical sweep on top of the existing card classes, ahead of the formal `CdnCard` primitive migration. directive from operator: "all containers should have set height / width min to avoid the potential as well; if we fit the content to the containers instead of vise versa we wouldnt have this issue"

translation — every card slot owns its geometry. content fits the slot, never the other way around. no card's intrinsic content can grow / shrink to push its container size. layout-shift becomes geometrically impossible

### the four slot tiers

defined in `src/styles/design-tokens.css`. these are an enum, not freeform pixel values — need a new geometry, add a tier; never override min-height per card

| token                         | value | use                                                                       |
| ----------------------------- | ----- | ------------------------------------------------------------------------- |
| `--cdn-slot-narrow-min-h`     | 120px | compact single-row carousels: arrowhead-news inner item (already 120px)   |
| `--cdn-slot-standard-min-h`   | 220px | regular grid cards: andmore, awsml, twitch, youtube, arrowhead container  |
| `--cdn-slot-wide-min-h`       | 320px | full-row content: NextMeetup, BuilderCenterCard                           |
| `--cdn-slot-hero-min-h`       | 420px | live video embeds: TwitchAws, TwitchAwsOnAir, AndresYoutubeLive           |

### card-class to tier mapping (legacy classes, sweep applied directly)

| class                       | tier     | applied via                                                              |
| --------------------------- | -------- | ------------------------------------------------------------------------ |
| `.feed-grid__cell`          | standard | `min-height: var(--cdn-slot-standard-min-h)` in feed/styles.css          |
| `.feed-grid__cell--full`    | wide     | overrides standard with `var(--cdn-slot-wide-min-h)` in feed/styles.css  |
| `.feed-live-hero__card`     | hero     | overrides wide with `var(--cdn-slot-hero-min-h)` in feed/styles.css      |
| `.cdn-card-slot--hero`      | hero     | CdnCard primitive — `var(--cdn-slot-hero-min-h)` in cdn-card/styles.css  |
| `.cdn-card-slot--wide`      | wide     | CdnCard primitive — `var(--cdn-slot-wide-min-h)`                         |
| `.cdn-card-slot--standard`  | standard | CdnCard primitive — `var(--cdn-slot-standard-min-h)`                     |
| `.cdn-card-slot--narrow`    | narrow   | CdnCard primitive — `var(--cdn-slot-narrow-min-h)`                       |

### why content overflow over geometry expansion

| approach                                                  | failure mode                                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| container hugs intrinsic content — no min-height          | every poll tick / mount / unmount can resize the slot, reflowing siblings below                            |
| container has min-height; content can still overflow it   | impossible — no slot ever expands past its tier reservation                                                |
| container has min-height; inner content clipped via `overflow:hidden` + `text-overflow:ellipsis` | content fits the slot. long titles ellipse, long lists scroll inside, iframes letterbox. zero shift. |

### universal rules applied to every card class on /feed/

every card class also gets, regardless of tier:

- `min-width: 0` — prevents intrinsic content min-content from forcing the grid track wider than 1fr (root cause of grid blowout on long titles, wide tables)
- `display: flex; flex-direction: column` — inner content can shrink / grow within the bounded box without escaping it
- `overflow: hidden` — content cannot bleed out past the slot edge

text clamping on long-text elements happens at the inner-content level: `text-overflow: ellipsis; white-space: nowrap` for single-line, `display: -webkit-box; -webkit-line-clamp: N` for multi-line. never `word-break` — natural wrapping runs up to the clamp

### how to add a new card

1. pick a tier from the table above. start with `standard`. only escalate to `wide` / `hero` if the loaded state genuinely needs the height
2. for new cards built on the formal CdnCard primitive — pass `slot="<tier>"` per the recipe in `card-wall.md`
3. for cards still on legacy classes pre-migration — give them `class="feed-grid__cell cdn-card"` for standard, add `--full` for wide, add `feed-live-hero__card` for hero. min-height is inherited from the class; do not override

### migration plan — current status

every legacy card class on /feed/ now uses the token-based min-heights. the formal CdnCard primitive lands per-card per the table in `card-wall.md` § migration plan; until each card migrates, the tactical sweep above provides geometry isolation today

| layer        | status                                                                          |
| ------------ | ------------------------------------------------------------------------------- |
| tokens       | shipped — `src/styles/design-tokens.css` defines all four tiers                 |
| sweep        | shipped — `.feed-grid__cell` / `--full` / `.feed-live-hero__card` carry tiers   |
| primitive    | shipped — `<CdnCard>` available, used for `feed-live-hero` (proof of concept)   |
| per-card pr  | in-flight — see `card-wall.md` migration table                                  |
