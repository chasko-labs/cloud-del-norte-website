# card wall

architectural foundation for the cloud del norte tumblr-style scaling card wall. cards are layout-isolated so growing / shrinking content, mount / unmount, and polling lifecycle inside one card cannot affect any sibling

## vision

a wall of cards that scales as the team matures. new polling sources, new live blocks, new content carousels each plug in as a `cdnCard` with a slot tier — never as a one-off layout. growth happens by adding cards and tokens, not by inventing geometry per card

## hard constraints

- **geometry isolation** — every card occupies a slot with a fixed min-height. content positions inside the slot via absolute positioning; growth or shrinkage is contained
- **layout containment** — `contain: layout` on every slot keeps child reflow scoped to the slot. ancestor layout never re-runs from a polling tick
- **sticky lifecycle** — the card always renders the slot. loading / empty / error never blanks the dom; transient failures preserve last-good content
- **compositor-only transitions** — cross-fades touch only `opacity`. no animation ever changes height, margin, padding, border-width, or any other layout-affecting property
- **no conditional wrapper** — a card is rendered or it is not. wrappers are not gated on data. data states are handled inside the slot

## architecture

```
cdnWall                 (grid: auto-fill minmax(--cdn-wall-col-min-w, 1fr))
├── cdnWallRow          (full-width band — hero / pinned blocks)
│   └── cdnCard slot=hero
└── cdnCard slot=…      (each child is one slot in the auto-fill grid)
```

| file                                         | role                                           |
| -------------------------------------------- | ---------------------------------------------- |
| `src/styles/design-tokens.css`               | slot tier heights, column min-w, transitions   |
| `src/components/cdn-card/index.tsx`          | primitive — slot + frame stack + cross-fade    |
| `src/components/cdn-card/styles.css`         | slot geometry + frame absolute positioning     |
| `src/components/cdn-wall/index.tsx`          | grid layout + full-width row helper            |
| `src/components/cdn-wall/styles.css`         | auto-fill grid + responsive column min-w       |
| `src/hooks/useStickyPoll.ts`                 | data-layer flap suppression (compose with)     |

## slot tokens

| token                           | value | use                                                                    |
| ------------------------------- | ----- | ---------------------------------------------------------------------- |
| `--cdn-slot-narrow-min-h`       | 120px | compact rows: arrowhead-news, andres-medium, feed-section items        |
| `--cdn-slot-standard-min-h`     | 220px | default content card with header + body                               |
| `--cdn-slot-wide-min-h`         | 320px | horizontal embed cards: builder-center, youtube-carousel              |
| `--cdn-slot-hero-min-h`         | 420px | live video / 16:9 embeds: twitch, youtube-live, andres-live           |
| `--cdn-wall-col-min-w`          | 320px | auto-fill grid floor — column count derives from viewport width       |
| `--cdn-wall-gap`                | 16px  | grid gap between slots                                                |
| `--cdn-card-transition-ms`      | 300ms | cross-fade duration on data swap                                      |
| `--cdn-bp-mobile / tablet / …`  | px    | reference breakpoints; cdn-wall already wires the small-viewport ones |

slot tiers are an enum, not freeform pixel values. need a new geometry? add a tier — never override min-height per card

## how to add a new card

1. pick a slot tier. start with `standard`. only escalate to `wide` / `hero` if the loaded state genuinely needs the height
2. write a renderer `function MyCard()` that returns `<CdnCard …>`
3. supply props:
   - `id` — stable string, e.g. `"my-card"`
   - `slot` — tier from above
   - `state` — derived from your data hook (`{ kind: "loading" }` / `{ kind: "ready", data }` / `{ kind: "empty" }` / `{ kind: "error" }`)
   - `render` — `(data) => <yourContent />`
   - `fallback` — geometry-stable skeleton (e.g. `<div>loading…</div>`); do NOT include height / padding that competes with the slot min-height
   - `errorState` — geometry-stable error JSX (or function `(reason) => …`); retry button optional
4. drop the card into a `<CdnWall>` (or `<CdnWallRow>` if it must span all columns)

example (sketch)

```tsx
import CdnCard from "../../components/cdn-card";
import { useStickyPoll } from "../../hooks/useStickyPoll";

function MyCard() {
  const data = useStickyPoll({ fetcher, intervalMs: 60_000, initial: null });
  const state =
    data == null ? { kind: "loading" as const }
    : { kind: "ready" as const, data };
  return (
    <CdnCard
      id="my-card"
      slot="standard"
      state={state}
      render={(d) => <Container>{d.title}</Container>}
      fallback={<Container>loading…</Container>}
      errorState={<Container>retry…</Container>}
    />
  );
}
```

## how to migrate a legacy card

1. identify the card's largest "loaded" geometry. round up to the nearest slot tier
2. extract the data fetch into a hook (use `useStickyPoll` for pull-poll, sdk events stay event-driven)
3. wrap the existing render in `<CdnCard>` with `state` derived from the hook
4. remove ad-hoc min-height / fixed-height hacks from the legacy css. the slot owns geometry now
5. remove conditional wrapper rendering at the parent. the card always renders; data branches are inside the slot
6. confirm via headless probe: card height stays fixed across loading → ready → empty transitions

## anti-patterns

- conditionally rendering the card wrapper based on data (`{hasData && <Wrapper><card /></Wrapper>}`) — wrapper itself is part of the slot lifecycle, not data
- changing min-height based on data state — pick the tier for the largest state and stick with it
- writing height / margin / padding from a polling callback — every reflow is a layout shift for siblings
- animating grid tracks (`grid-template-rows: <heightN> → <heightM>`) — defeats the wall's stable column geometry
- nesting two `<CdnCard>` slots inside each other — a slot is a single unit; use a normal flex / grid inside the renderer

## sticky polling — the data side

`src/hooks/useStickyPoll.ts` is the canonical data-layer hook. its contract:

- fetcher returns `T` → state updates
- fetcher returns `null` or throws → previous state preserved (transient failure)

cards composing with `useStickyPoll` get end-to-end flap suppression: data layer holds last-good value, slot layer holds last-good frame. transient api errors never cause visible jank

twitch sdk + similar event sources already debounce upstream; do not wrap them in stickiness — let them push real transitions through

## migration plan

migrating every card on /feed/ to `cdnCard`. lowest-risk-first; one per pull request

| card                            | current pattern                                                        | target slot   | notes                                                              |
| ------------------------------- | ---------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| `feed-live-hero`                | conditional `liveToShow.length > 0 &&` wrapper around live-priority    | `hero` (row)  | proof of concept — done in dispatch 2026-05-01                      |
| `arrowhead-news`                | already 120px fixed-height inner item, container around it             | `narrow`      | low risk — slot height already matches inner geometry              |
| `andres-medium`                 | same 120px carousel pattern                                            | `narrow`      | mirror arrowhead-news migration                                    |
| `feed-section` (FeedAndmore)    | identical post-carousel pattern                                        | `narrow`      | same                                                               |
| `feed-section` (FeedAwsml)      | identical post-carousel pattern                                        | `narrow`      | same                                                               |
| `BuilderCenterCard`             | mini-grid of 4 ranked links + container                                | `wide`        | investigate exact loaded height before slot pick                   |
| `NextMeetup`                    | already has `min-height: 180px` hack on `.feed-next-meetup`            | `wide`        | drop css hack; slot owns height after migration                    |
| `KruxPlayer`                    | active player chrome, not a feed card                                  | excluded      | stays in page header `actions` slot                                |
| `TwitchAws`                     | live embed; sdk pushes online/offline                                  | `hero` (row)  | sticky lifecycle on; sdk event drives state                        |
| `TwitchAwsOnAir`                | live embed; sdk pushes online/offline                                  | `hero` (row)  | same                                                               |
| `YoutubeCarousel`               | rotating playlist embed                                                | `hero` or `wide` | pick based on iframe aspect ratio at typical width              |

every migration follows the recipe in **how to migrate a legacy card** above. each pull request migrates one card and re-runs the geometry probe (see proof of concept) on dev to confirm no regression on neighbors

## proof of concept — feed-live-hero

dispatched 2026-05-01. the hero block previously rendered `liveToShow.length > 0 && <hr />` and only mounted live cards inside a wrapper that was itself conditional on `liveToShow.length`. wrapping in `cdnCard` with `slot=hero` always renders the slot; live priority data drives `state.kind` between `ready` (live) and `empty` (no live) without touching the dom geometry below

geometry verification uses `scripts/probe-liora-headless.mjs` adapted for any url. measurements taken before / after on dev (see commit history for the SHAs of each change)

## related

- `docs/design-system/stable-state.md` — the data-layer / sticky-slot pattern this foundation generalizes
- `src/styles/tokens.css` — global brand + cloudscape-override token sheet (imports `design-tokens.css`)
