# Resources → Favorites — Design Spec
_Status: planning · 2026-06-01_

## Problem
`src/sites/awsug/_layout/index.tsx` renders `<PodcastScrollerSibling/>` (Writing-on-the-Wall episodes) directly on the awsug member landing. Radio/podcast browsing does not belong on the landing. It belongs on a dedicated Resources → Favorites subpage, publicly accessible logged-out and logged-in, with auth-gated extras when signed in.

## Architecture Decision: Single Main-Site Route
**Decision:** One page at `src/pages/resources/` (main-site build, `vite.config.ts`). Both the main-site nav and the awsug nav link to it. No awsug-specific route.

**Rationale:**
1. The main site already carries the full stream-host CSP allowlist. The awsug CloudFront response-headers policy (`ef81b3a7-9f54-4871-9d45-0864456d843b`) is near the ~1784-char CloudFront limit; adding stream-host origins there is not viable without dropping other directives.
2. The page is inherently public/logged-out viewable as a main-site route — no auth gate needed at the route level.
3. Auth-gated extras are handled client-side: detect `sessionStorage cdn.idToken` (or `AuthContext`) and conditionally render logged-in UI.
4. Keeps the awsug shell CSP small — stream browsing lives on the main domain.

## Data Source
`src/lib/streams.ts` → `STREAMS: StreamDef[]`. Relevant fields per card:
- `key`, `label`, `type` (`'radio'|'podcast'`), `location` → `formatLocation(loc)`
- `scheduleUrl?`, `donateUrl?` — render as links when present
- `curated?: true` — filter: show only curated entries on this page
- `rssFeedUrl?` — used in Iteration 4 for podcast download affordance

**Fields to add to `StreamDef` (Iteration 3):**
- `transcription?: 'available' | 'partial' | 'none' | 'unknown'` — default `'unknown'`
- `translation?: 'available' | 'partial' | 'none' | 'unknown'` — default `'unknown'`
- `relatedLinks?: readonly { label: string; url: string }[]` — optional

## Page Structure
Route: `src/pages/resources/` → `/resources/index.html`. Wraps in `Shell` (same as all main-site pages — gets wallpaper, player, footer).

```
<ResourcesFavoritesPage>
  <section> Radio Stations
    <StreamCard /> × n  (type === 'radio', curated)
  </section>
  <section> Podcasts
    <StreamCard /> × n  (type === 'podcast', curated)
  </section>
</ResourcesFavoritesPage>
```

### StreamCard (logged-out)
- Station label + type badge
- `formatLocation(location)`
- Links: `scheduleUrl`, `donateUrl` where present

### StreamCard (logged-in extras, gated on auth)
- **Star/unstar** — `localStorage` key `cdn.favorites.<station.key>` (boolean). Future: server-side sync is out of scope.
- **Technical details panel** (expandable `<details>`) — stream serving method (derived from `url` hostname: icecast/Zeno/CloudFront/RSS/etc), queueable/downloadable flags, `transcription`, `translation`, `relatedLinks` (Iteration 3).
- **Download affordance** (podcasts only) — button to fetch latest episode enclosure URL from `rssFeedUrl` and trigger download. UI only; edge-serving/CDN mirroring is a future research item (Iteration 4).

## Navigation
- **awsug nav** (`src/sites/awsug/_layout/navigation.tsx`): add `favorites` link under the existing `resources` section → `https://clouddelnorte.org/resources/`.
- **Main-site nav** (`src/layouts/shell/`): add Resources → Favorites link.

## Accessibility
- Cards keyboard-navigable; star button has `aria-label="Favorite [station label]"` / `aria-pressed`.
- Expandable panel uses native `<details>`/`<summary>` for zero-JS keyboard support.
- WCAG AA contrast on all text/badge combinations against glassmorphic surfaces.
- `prefers-reduced-motion`: no animated transitions on card mount.

## Out of Scope
- Server-side favorites persistence (localStorage only for now).
- Podcast audio edge-serving / CDN mirroring (flagged in Iteration 4 as future).
- Transcription/translation data population (fields added; values default `'unknown'`).
