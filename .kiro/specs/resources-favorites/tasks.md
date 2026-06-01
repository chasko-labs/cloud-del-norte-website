# Resources → Favorites — Tasks

## Iteration 1 — Route + Listing (logged-out)
- [ ] Create `src/pages/resources/index.html`, `main.tsx`, `app.tsx`
- [ ] Register entry in `vite.config.ts` `rollupOptions.input`
- [ ] Implement `<ResourcesFavoritesPage>` — reads `STREAMS`, filters `curated === true`, groups by `type`, renders `<StreamCard>` (label, `formatLocation`, type badge, `scheduleUrl`/`donateUrl` links)
- [ ] Add Favorites link to awsug nav (`src/sites/awsug/_layout/navigation.tsx`) under resources section → `https://clouddelnorte.org/resources/`
- [ ] Add Resources → Favorites link to main-site shell nav
- [ ] Remove `<PodcastScrollerSibling/>` from `src/sites/awsug/_layout/index.tsx`
- [ ] Build (main + awsug) · smoke-test logged-out · deploy main · headless visual verify

## Iteration 2 — Auth Detection + Favorites Star
- [ ] Detect auth: read `sessionStorage cdn.idToken` (or `AuthContext`) in `<ResourcesFavoritesPage>`
- [ ] Add star/unstar button to `<StreamCard>` — visible only when authenticated
- [ ] Persist to `localStorage` key `cdn.favorites.<station.key>`
- [ ] Star reflects persisted state on page reload
- [ ] Build · test (logged-out: no star; logged-in: star persists) · deploy main · headless visual verify

## Iteration 3 — Technical Details Panel
- [ ] Add optional fields to `StreamDef` in `src/lib/streams.ts`: `transcription?`, `translation?`, `relatedLinks?`
- [ ] Implement expandable `<details>`/`<summary>` panel per card (logged-in only)
- [ ] Panel shows: stream serving method (derived from `url` hostname), queueable/downloadable flags, `transcription`, `translation`, `relatedLinks`
- [ ] Keyboard + ARIA: `<details>` native; verify focus management
- [ ] Build · test · deploy main · headless visual verify

## Iteration 4 — Offline Download Affordance (Podcasts)
- [ ] Add download button to podcast `<StreamCard>` (logged-in only)
- [ ] On click: fetch `rssFeedUrl`, parse latest `<enclosure url>`, trigger browser download
- [ ] Show loading/error state inline on the card
- [ ] Add spec note: edge-serving / CDN mirroring of podcast audio is a future research item; this iteration ships UI affordance only
- [ ] Build · test · deploy main · headless visual verify
