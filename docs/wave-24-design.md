# Wave 24 — Radio + Podcast UI Buildout Design

_Author: Liora (UX/visual design specialist), 2026-05-18_
_Status: planning artifact, awaiting Bryan review_

## Summary

Wave 24 transforms the Cloud Del Norte radio/podcast player from a single-episode-at-a-time experience into a full-featured podcast client with episode browsing, offline downloads, and proper loading feedback. It adds three new podcasts (Writing on the Wall, El Sonido by KEXP, The Fight for Our Existence), introduces a loading/connecting state between Play and Stop so users know their tap registered, builds an episode scroller with sort controls, surfaces transcript links where available, enables IndexedDB-backed offline downloads for signed-in users, and places a carousel of short-form episodes on the feed page.

Success criteria: (1) user never wonders "did my tap register?" — spinner appears within 100ms of press, (2) all 3 new podcasts play reliably with correct metadata, (3) signed-in users can download episodes and play them offline, (4) episode list is browsable and sortable without leaving the player context.

## Open questions for Bryan

1. **"Shorts" interpretation** — I'm reading "carousel of shorts" as podcast episodes under 5 minutes duration (parsed from `itunes:duration`). If you mean video shorts (YouTube Shorts, TikTok-style clips) or manually curated highlight clips, the implementation changes significantly. Please confirm.
2. **Curated status for new podcasts** — I recommend `curated: true` for The Fight for Our Existence (regional alignment with El Paso/Las Cruces/Mescalero audience). Writing on the Wall also has Mescalero ties. Should both be curated, or just one?
3. **El Sonido CORS** — `traffic.omny.fm` audio CORS needs verification in-browser. If it fails, we'd need to mark it `corsBlocked: true` and rely on build-time data. Acceptable fallback?
4. **Download storage quota warning threshold** — At what remaining space should we warn users? I propose 100MB remaining triggers a "storage low" notice before download starts.
5. **Auto-download sync frequency** — When auto-download is enabled, how often should we check for new episodes? On every page load? Once per hour? I propose: check on page load, debounced to once per 30 minutes via localStorage timestamp.
6. **Transcript availability** — Of the 3 new podcasts, none appear to publish `<podcast:transcript>` tags in their RSS. Should we still build the transcript row infrastructure for Talk Python (which does have transcripts) and future podcasts, or defer entirely?
7. **Episode scroller max depth** — Some feeds have 500+ episodes. Show all (with virtual scroll) or cap at 50 most recent with a "load more" button?

## Implementation wave decomposition

| Sub-wave | Scope | Effort | Dependencies |
|----------|-------|--------|--------------|
| **24a** | 3 new podcasts + CSP `*.cloudfront.net` wildcard collapse + probe HEAD→GET fix | S | None — can ship independently |
| **24b** | Loading state UI between Play/Stop (spinner + connecting/retrying/failed states) | S | None — touches persistent-player only |
| **24c** | Episode scroller + sort-to-oldest + transcripts row | M | 24a (new podcasts need to be in STREAMS array) |
| **24d** | Offline downloads (IndexedDB) + Speakeasy preferences | L | 24c (episode list provides the download button surface) |
| **24e** | Carousel of shorts on feed page | M | 24a (new podcasts feed the shorts pool) |

Recommended order: 24a → 24b → 24c → 24d → 24e. Each is independently shippable. 24b can run in parallel with 24a.

---

## Design areas

### 1. Loading state between Play and Stop

#### UX intent

The user presses Play and currently sees nothing until audio starts or the Stop button appears. This gap (2–15s for icecast, 1–3s for podcast mp3s) creates uncertainty: "Did my tap register? Is it loading? Is the station dead?" The fix: a visible connecting state that transitions through a clear state machine.

#### State machine

```
idle → connecting → playing
                  ↘ retrying → playing
                             ↘ failed → auto-advance (2s grace)
```

| State | Trigger IN | Visual | Trigger OUT |
|-------|-----------|--------|-------------|
| `idle` | Component mount / stop pressed | Play button visible | User presses Play |
| `connecting` | `audio.play()` called | Spinner replaces Play button + "connecting…" label | `canplay` or `playing` event fires |
| `playing` | `playing` event | Stop/Pause button visible, waveform animates | User presses Stop, or error/stall fires |
| `retrying` | Error persists past `STREAM_ERROR_THRESHOLD_MS` (5000ms) | Spinner + "retrying…" label, muted color | `playing` event (recovery) or retry count exhausted |
| `failed` | Retry count exhausted | Error icon + "station unavailable" + auto-advance countdown | `onSkipStation(1)` fires after 2000ms |

#### Visual states (plain text)

- **idle**: Standard play button (▶ for radio, PodcastPlayIcon for podcasts). Station label + geo visible.
- **connecting**: Play button replaced by Cloudscape `<Spinner size="normal" />` inside a `<Box>` with visually-hidden label "connecting". Button area maintains same dimensions to prevent layout shift. Station label remains visible.
- **playing**: Current behavior — Stop/Pause button, waveform bars animate, DancerIcon/PodcastIcon visible.
- **retrying**: Spinner returns, label changes to "retrying…" (en) / "reintentando…" (es). Muted opacity (0.7) on the station label. No user action needed.
- **failed**: Red-tinted error icon (existing `cdn-pp--failed` class). "Station unavailable — advancing…" text. 2s countdown then auto-skip.

#### Interaction touchpoints

- Play button press → immediate visual feedback (spinner appears within 1 frame)
- During `connecting`: button is disabled (no double-tap issues)
- During `retrying`: no user action required, but manual retry button appears after 1s in retrying state
- `prefers-reduced-motion`: spinner replaced with static "loading…" text

#### Accessibility

- `aria-live="assertive"` region announces state transitions: "connecting to [station]", "now playing [station]", "retrying connection", "station unavailable, advancing to next"
- Spinner has `aria-label="connecting to stream"`
- Button disabled state uses `aria-disabled="true"` (not `disabled` attribute — keeps it focusable for screen readers)

#### Technical feasibility

- Existing `STREAM_ERROR_THRESHOLD_MS` and `STREAM_AUTO_RETRY_MS` constants in `src/components/persistent-player/index.tsx` already handle the retry logic
- The `hasConnectedRef` already tracks whether audio has connected once — reuse to distinguish "initial buffering" from "mid-stream drop"
- New state: add `connecting` to the component's local state (currently only tracks `playing` boolean + `streamHealth`)
- Cloudscape `Spinner` is already imported in `src/sites/awsug/app.tsx` — add to persistent-player

#### Dependencies + risks

- Risk: Some podcast CDNs (Triton Digital) have slow initial response. The 5s threshold may be too aggressive for podcasts. Consider a separate `PODCAST_CONNECT_TIMEOUT_MS = 10000`.
- No external dependencies.

#### Effort: S

#### Files touched

- `src/components/persistent-player/index.tsx` — add `connecting` state, spinner render
- `src/components/persistent-player/styles.css` — spinner positioning, transition animations
- `src/locales/en-US.json` — "connecting", "retrying" labels
- `src/locales/es-MX.json` — "conectando", "reintentando" labels

---

### 2. Three new podcasts

#### UX intent

Expand the podcast roster with three shows that serve the Cloud Del Norte audience: indigenous voices from the Mescalero/El Paso corridor, Latin music curation from KEXP, and indigenous land/water rights advocacy. Each gets a distinct color palette that doesn't clash with existing stations.

#### New station definitions

| Key | Label | Location | RSS | Audio CDN | Curated? |
|-----|-------|----------|-----|-----------|----------|
| `writing_on_the_wall` | Writing on the Wall | Mescalero, New Mexico, USA | `https://feeds.captivate.fm/writing-on-the-wall/` | `podcasts.captivate.fm/media/*` | Recommend yes |
| `el_sonido_kexp` | El Sonido (KEXP) | Seattle, Washington, USA | `https://www.omnycontent.com/d/playlist/.../podcast.rss` | `traffic.omny.fm/d/clips/*` | No (CORS unverified) |
| `fight_for_our_existence` | The Fight for Our Existence | distributed, indigenous rights, USA | `https://media.rss.com/fight4ourexistence/feed.xml` | `content.rss.com` → 307 → `rsscom.pdn.tritondigital.com` | Recommend yes |

#### Color palettes

Constraints: must not clash with existing AWS-orange (#FF9900), KEXP-buttercup (#F5B21F), KRUX-crimson (#8C0B42), or KUTX burnt-orange (#bf5700).

| Station | Primary | Secondary | Accent | Rationale |
|---------|---------|-----------|--------|-----------|
| writing_on_the_wall | `#2E8B57` (sea green) | `#D2691E` (chocolate/earth) | `#faf7f0` | Mescalero landscape — green pines + desert earth. Distinct from all existing primaries. |
| el_sonido_kexp | `#9B59B6` (amethyst purple) | `#E74C3C` (alizarin red) | `#1a1a1a` | Latin music energy — purple/red. Distinct from KEXP parent (yellow). |
| fight_for_our_existence | `#CD853F` (peru/copper) | `#1C3A13` (dark forest green) | `#faf7f0` | Earth/copper tones — indigenous land connection. Oak Flat copper mine reference. |

Light/dark mode overrides:

| Station | primaryLight (cream bg) | primaryDark (navy bg) |
|---------|------------------------|----------------------|
| writing_on_the_wall | `#1d6b3f` (deepened for 4.5:1 on cream) | `#4ade80` (brightened for navy) |
| el_sonido_kexp | `#7b2d8b` (deepened for cream) | `#c084fc` (brightened for navy) |
| fight_for_our_existence | `#8b5a2b` (deepened for cream) | `#dda15e` (brightened for navy) |

#### StreamLocation values

```ts
// Writing on the Wall
{ city: "Mescalero", region: "New Mexico", country: "USA" }
// El Sonido
{ city: "Seattle", region: "Washington", country: "USA" }
// The Fight for Our Existence
{ city: "distributed", region: "indigenous rights", country: "USA" }
```

#### CSP additions required

New domains needed in `connect-src` and/or `media-src`:

| Domain | Directive | Purpose |
|--------|-----------|---------|
| `feeds.captivate.fm` | connect-src | RSS fetch for Writing on the Wall |
| `podcasts.captivate.fm` | media-src, connect-src | Audio playback |
| `www.omnycontent.com` | connect-src | RSS fetch for El Sonido |
| `traffic.omny.fm` | media-src, connect-src | Audio playback (CORS TBD) |
| `media.rss.com` | connect-src | RSS fetch for Fight for Our Existence |
| `content.rss.com` | media-src, connect-src | Audio redirect origin |
| `rsscom.pdn.tritondigital.com` | media-src | Audio final destination (signed URL) |

**Total new chars: ~178.** Current CSP in `infra/cloudfront-security-headers.main.json` is near the 1784 char practical limit.

**Recommended fix**: Collapse the 3 specific `*.cloudfront.net` subdomains (`d1le29qyzha1u4.cloudfront.net`, `d3gih7jbfe3jlq.cloudfront.net`, `d3ctxlq1ktw2nl.cloudfront.net`) into a single `*.cloudfront.net` wildcard. Saves ~158 chars of headroom. All three are AWS-owned CDN subdomains serving podcast audio — the wildcard is acceptable security posture for media-src and connect-src (not script-src).

Before collapse: 3 × ~30 chars = ~90 chars for cloudfront entries
After collapse: `*.cloudfront.net` = ~18 chars
Net savings: ~72 chars per directive × 2 directives (connect-src + media-src) ≈ 144 chars freed

This gives enough headroom for the 7 new domains.

#### Triton Digital signed-URL consideration

The Fight for Our Existence audio path: `content.rss.com/episodes/*` → HTTP 307 → `rsscom.pdn.tritondigital.com/v1/download/*?awCollectionId=...&awEpisodeId=...&Expires=...&Signature=...`

- The `<audio>` element follows 307 redirects natively — no code needed
- The signed URL has an `Expires` parameter — typically valid for 24-48 hours
- Implication: RSS-fetched enclosure URLs work for current playback but won't work as permanent bookmarks
- Acceptable: we always fetch fresh enclosure URLs from RSS before playback
- Risk for offline downloads: downloaded blob is permanent, but if user tries to re-stream a stale URL it will 403. Mitigated by always re-fetching RSS before streaming.

#### PODCAST_FEEDS addition in fetch-feeds.mjs

Add 3 entries to the `PODCAST_FEEDS` array in `scripts/fetch-feeds.mjs`:

```js
{ key: "writing_on_the_wall", url: "https://feeds.captivate.fm/writing-on-the-wall/" },
{ key: "el_sonido_kexp", url: "https://www.omnycontent.com/d/playlist/bad5d079.../podcast.rss" },
{ key: "fight_for_our_existence", url: "https://media.rss.com/fight4ourexistence/feed.xml" },
```

#### Dependencies + risks

- El Sonido `traffic.omny.fm` CORS status unverified in-browser. If blocked, mark `corsBlocked: true` and rely on build-time cache.
- Triton Digital signed URLs expire — offline download must store the blob, not the URL.
- Captivate.fm RSS confirmed CORS `*` — no issues expected.

#### Effort: S

#### Files touched

- `src/lib/streams.ts` — 3 new StreamDef entries
- `scripts/fetch-feeds.mjs` — 3 new PODCAST_FEEDS entries
- `infra/cloudfront-security-headers.main.json` — CSP additions + wildcard collapse
- `scripts/verify-csp.sh` — may need update if it validates specific subdomains

---

### 3. Episode scroller + sort

#### UX intent

Currently the player only plays the latest episode. Users want to browse back-catalog, find specific episodes, and sort oldest-first for binge listening. Bryan: "our podcast player needs to add ability to scroll through episodes for users & sort to oldest. we may need another row for buttons."

#### UI placement decision

Options considered:

| Option | Pros | Cons |
|--------|------|------|
| A. Collapsed accordion below player pill | Stays in context, no modal | Player pill is compact — accordion below it breaks the "pill" metaphor |
| B. Modal/drawer triggered by "Episodes" button | Clean separation, can be large | Loses spatial context of the player |
| C. Expandable panel below the player section | In-context, can be tall | Needs careful z-index management |
| **D. New button row + slide-down panel** | Bryan's hint ("another row for buttons"), keeps pill compact, panel slides down on demand | Adds vertical space when open |

**Recommendation: Option D** — Add a secondary button row below the persistent player pill. This row contains: `[Episodes ▾]` `[Transcript 📄]` `[Download ⬇]`. Pressing "Episodes" slides down a scrollable episode list panel.

#### Episode list panel design

- **Container**: Full-width panel below the button row, max-height 400px, overflow-y scroll
- **Each row**: Episode title (truncated at 80 chars) | Date (locale-formatted) | Duration | Play button | Download button (if signed in)
- **Currently-playing marker**: Left border accent color + bold title + "▶ now playing" badge
- **Sort control**: Toggle button in panel header — "Newest first ↓" / "Oldest first ↑". Default: newest first.
- **Empty state**: "No episodes available" with suggestion to check connection

#### Default sort + toggle

- Default: newest first (matches RSS natural order)
- Toggle: single button that flips between "Newest ↓" and "Oldest ↑"
- Sort is per-session (not persisted) — resets to newest on page reload
- Sort applies client-side to the already-fetched episode array

#### Pagination strategy

For podcasts with 500+ episodes:

- **Initial load**: Show 50 most recent episodes
- **"Load more" button** at bottom of list: loads next 50
- **Why not virtual scroll**: Cloudscape doesn't ship a virtual-scroll list. Building one adds complexity. 50-item pages with "load more" is simpler and sufficient.
- **Why not Cloudscape Table**: Table component is heavy (~40KB gzipped) and designed for data-dense admin UIs. A simple `<ul>` with styled `<li>` rows is lighter and more appropriate for a media list.

#### Data source

- RSS feed is already fetched in `persistent-player/index.tsx` for the latest episode
- Extend: parse ALL `<item>` elements (not just first) when the episode panel is opened
- Store in component state: `episodes: Array<{ title, date, duration, enclosureUrl, guid }>`
- Lazy fetch: only fetch full episode list when user opens the panel (not on every station change)

#### Episode row interface sketch

```ts
interface EpisodeRow {
  guid: string;
  title: string;
  pubDate: string; // ISO date
  duration: number; // seconds, from itunes:duration
  enclosureUrl: string;
  transcriptUrl?: string; // from podcast:transcript tag
}
```

#### Date format

- en-US: "May 18, 2026" (`Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })`)
- es-MX: "18 may 2026" (`Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' })`)
- Use existing `locale` from `useTranslation()` hook

#### Keyboard navigation

- Tab into episode list → focus first row
- Arrow Up/Down → move between rows
- Enter/Space on row → play that episode
- Escape → close panel, return focus to Episodes button
- `role="listbox"` on container, `role="option"` on each row

#### State for currently-playing episode

- New ref: `currentEpisodeGuid` in persistent-player
- When user clicks an episode row: set `rssAudioUrl` to that episode's enclosure URL, set `currentEpisodeGuid`
- Episode list highlights the row matching `currentEpisodeGuid`
- On station change: clear `currentEpisodeGuid`

#### Accessibility

- Panel has `aria-label="Episode list for [podcast name]"`
- Sort button announces current sort direction
- Currently-playing row has `aria-current="true"`
- Episode count announced: "50 episodes loaded, 200 total available"

#### Dependencies + risks

- Risk: Large RSS feeds (500+ items) may be slow to parse in-browser. Mitigate with web worker or requestIdleCallback parsing.
- Risk: Some RSS feeds paginate (rare for podcasts). Not handling pagination in v1 — document as known limitation.
- Dependency: Requires podcast to be in STREAMS array (24a).

#### Effort: M

#### Files touched

- `src/components/persistent-player/index.tsx` — episode fetch logic, panel toggle state, currentEpisodeGuid
- `src/components/persistent-player/episode-panel.tsx` — new component (episode list + sort)
- `src/components/persistent-player/styles.css` — panel slide-down animation, row styles, button row
- `src/locales/en-US.json` — "Episodes", "Newest first", "Oldest first", "Load more"
- `src/locales/es-MX.json` — "Episodios", "Más recientes", "Más antiguos", "Cargar más"

---

### 4. Transcripts row

#### UX intent

Bryan: "I'd like to add a transcript row for podcasts that make it available including a link to the transcript." Some podcasts publish transcripts via the `<podcast:transcript>` RSS extension tag or at predictable URLs (e.g. Talk Python's show pages). Surface these as a simple link — don't embed the transcript inline.

#### Source URL strategy

Two approaches, recommend **Option B** for v1:

**Option A — Pattern-based URL builder** (per-station function):
```ts
transcriptUrlPattern?: (episode: EpisodeRow) => string | null;
// e.g. for Talk Python:
// (ep) => `https://talkpython.fm/episodes/show/${ep.number}/${ep.slug}`
```
Problem: requires per-station custom logic, episode number/slug extraction from RSS varies.

**Option B — RSS tag extraction** (generic):
- Parse `<podcast:transcript url="..." type="text/html" />` from each `<item>` in RSS
- Also check `<itunes:transcript>` (less common but exists)
- Store as optional `transcriptUrl` on each `EpisodeRow`
- Falls back to null when tag is absent — link simply doesn't render

**Recommendation**: Option B for the generic case. Add a per-station `transcriptBaseUrl` field to StreamDef for stations like Talk Python where the transcript lives at a predictable URL pattern but isn't in the RSS tags.

#### StreamDef addition

```ts
interface StreamDef {
  // ... existing fields ...
  /** Base URL for transcript pages. Appended with episode slug/number. */
  readonly transcriptBaseUrl?: string;
  /** Function to build transcript URL from episode metadata. */
  readonly buildTranscriptUrl?: (episode: { guid: string; title: string }) => string | null;
}
```

For Talk Python specifically:
- RSS `<link>` tag on each item contains the show page URL (e.g. `https://talkpython.fm/episodes/show/548/event-sourcing-design-pattern`)
- The show page IS the transcript page
- Strategy: use the `<link>` value from RSS as the transcript URL when `transcriptBaseUrl` is set

#### Surface position

- In the episode list panel (design area 3): each episode row that has a transcript shows a small 📄 icon-link at the right edge
- In the persistent player pill (for currently-playing episode): "View transcript" text link in the secondary button row, between Episodes and Download buttons
- Link only renders when `transcriptUrl` is non-null for the current episode

#### Behavior

- Opens in new tab: `target="_blank" rel="noopener noreferrer"`
- External navigation — no in-app transcript rendering (out of scope for Wave 24)
- Link text: "View transcript" (en) / "Ver transcripción" (es)
- If transcript URL is absent: button/link simply doesn't render (no disabled state, no placeholder)

#### Locale-aware labels

| Locale | Label | Aria-label |
|--------|-------|------------|
| en-US | "Transcript" | "View transcript for [episode title]" |
| es-MX | "Transcripción" | "Ver transcripción de [episode title]" |

#### Accessibility

- Link has descriptive `aria-label` including episode title (not just "transcript")
- Icon (📄) is `aria-hidden="true"` — the text label carries the meaning
- Link is a standard `<a>` element (not a button) since it navigates away

#### Which podcasts have transcripts?

| Podcast | Has `<podcast:transcript>` tag? | Has predictable URL? |
|---------|--------------------------------|---------------------|
| Talk Python | No tag in RSS | Yes — `<link>` element = show page with transcript |
| Rustacean Station | No | No |
| Syntax.fm | Yes (some episodes) | No |
| AWS Podcast | No | No |
| AWS Bites | No | No |
| Writing on the Wall | TBD (check RSS) | Unknown |
| El Sonido | No (music show) | N/A |
| Fight for Our Existence | TBD | Unknown |

#### Dependencies + risks

- Dependency: Episode scroller (24c) provides the surface for per-episode transcript links
- Risk: `<podcast:transcript>` tag adoption is still low (~15% of podcasts). Many episodes will show no link. This is acceptable — the feature is additive.
- Risk: External transcript pages may change URL structure. Links could 404 over time. Acceptable — we're linking, not embedding.

#### Effort: S

#### Files touched

- `src/lib/streams.ts` — add optional `transcriptBaseUrl` / `buildTranscriptUrl` to StreamDef interface
- `src/components/persistent-player/episode-panel.tsx` — transcript icon-link per row
- `src/components/persistent-player/index.tsx` — parse `<podcast:transcript>` from RSS items
- `src/locales/en-US.json` — "Transcript", "View transcript for {title}"
- `src/locales/es-MX.json` — "Transcripción", "Ver transcripción de {title}"

---

### 5. Offline downloads

#### UX intent

Bryan: "signed in users to 'download' podcasts for offline use... store in browser — once downloaded the download option needs to switch to 'remove' & there should be a yes/no popout at the end of download to 'remove download?' yes | no similar to the end credits of our fiona scene where we have popout yes | no."

This is the most complex feature in Wave 24. Users who commute through areas with poor connectivity (common in southern NM/west TX) can pre-download episodes for offline playback.

#### Storage technology decision

| Option | Max size | API complexity | Offline playback | Verdict |
|--------|----------|---------------|-----------------|---------|
| LocalStorage | 5-10MB | Low | No (string only) | ❌ Too small |
| Cache API | Quota-based (~GB) | Medium | Yes (with service worker) | Viable but adds SW complexity |
| **IndexedDB** | Quota-based (~GB) | Medium | Yes (via blob URL) | ✅ Recommended |

**Decision: IndexedDB** with `createObjectURL()` for playback. No service worker required.

Rationale: Service workers add deployment complexity (cache invalidation, update lifecycle). IndexedDB blob → `URL.createObjectURL(blob)` gives us a playable audio URL without intercepting fetch requests. The blob URL works as a standard `<audio src="blob:...">` source.

#### IndexedDB schema

Database name: `cdn-podcast-downloads`
Version: 1

Object stores:

**`episodes`** — stores downloaded audio blobs
```ts
interface DownloadedEpisode {
  guid: string;              // primary key
  podcastKey: string;        // index — which podcast this belongs to
  title: string;
  pubDate: string;
  duration: number;
  blob: Blob;                // the actual audio file
  downloadedAt: number;      // Date.now() timestamp
  sizeBytes: number;         // blob.size for quota tracking
  enclosureUrl: string;      // original URL (for dedup)
}
```

**`preferences`** — stores per-user download preferences
```ts
interface DownloadPreferences {
  userSub: string;           // primary key — Cognito user.sub
  autoDownload: boolean;     // default: false
  subscribedPodcasts: string[]; // podcast keys opted into auto-download
  updatedAt: number;
}
```

#### Download button state machine

```
idle → downloading (progress%) → downloaded → removing
                                            ↗
                              prompt-remove ←
```

| State | Visual | User action |
|-------|--------|-------------|
| `idle` | ⬇ Download button (outline style) | Click → starts download |
| `downloading` | Progress bar (0-100%) + cancel ✕ | Click ✕ → cancels, returns to idle |
| `downloaded` | "Remove" button (filled, different color) | Click → shows remove prompt |
| `prompt-remove` | Fiona-style popout: "Remove download? [Yes] [No]" | Yes → removes, No → returns to downloaded |
| `removing` | Spinner (brief) | Automatic → returns to idle |

#### Download flow

1. User clicks Download on an episode row
2. Check quota: `navigator.storage.estimate()` — if `quota - usage < episodeSize * 1.2`, show warning
3. Fetch audio URL with `fetch()` — stream response body
4. Track progress via `response.body.getReader()` + `Content-Length` header
5. On complete: store blob in IndexedDB `episodes` store
6. Update button state to `downloaded`
7. Show fiona-style popout: "Download complete. Remove download? [Yes] [No]"
   - This matches Bryan's directive: popout appears at END of download
   - "Yes" → immediately removes the download (user was just testing)
   - "No" → keeps the download (expected path for most users)

#### Fiona-style popout pattern

Reference: The fiona scene end-credits pattern. Based on reading `src/components/fiona-panel/index.tsx` and `src/components/fiona-frame/index.tsx`, the "popout" is a small overlay card with two action buttons that appears contextually.

Design for download popout:
- **Position**: Anchored below the download button (or above if near viewport bottom)
- **Appearance**: Small card with rounded corners, subtle shadow, station-colored border-top
- **Content**: "Remove download?" (en) / "¿Eliminar descarga?" (es)
- **Buttons**: `[Yes / Sí]` `[No]` — side by side, equal width
- **Animation**: Fade-in + slight scale-up (0.95 → 1.0), 200ms ease-out
- **Dismiss**: Clicking outside closes (same as "No"), Escape key closes
- **Accessibility**: `role="alertdialog"`, `aria-labelledby` pointing to the question text, focus trapped between Yes/No buttons

#### Offline playback

When user plays an episode that exists in IndexedDB:
1. Check IndexedDB for matching `guid`
2. If found: `URL.createObjectURL(storedEpisode.blob)` → set as audio src
3. If not found: use normal enclosure URL (online playback)
4. Revoke object URL on episode change: `URL.revokeObjectURL(previousBlobUrl)`

#### Quota awareness

- Before download: check `navigator.storage.estimate()`
- If remaining space < 100MB: show warning "Storage is low. This episode is ~X MB. Continue?"
- If remaining space < episode size: block download with error "Not enough storage space"
- Display total downloaded size in Speakeasy preferences (design area 6)

#### Sign-in gate

- Download button only renders when `AuthState` indicates authenticated user
- Anonymous users see no download affordance (not a disabled button — completely absent)
- Existing auth check: `isMember(auth)` from `src/sites/awsug/_shared/auth.ts`
- For the persistent player (which renders on all pages): check auth state via the same mechanism used by the Speakeasy page

#### Progress tracking

- Use `ReadableStream` from fetch response: `response.body.getReader()`
- Calculate progress: `bytesReceived / contentLength * 100`
- If `Content-Length` header is absent (some CDNs strip it): show indeterminate progress bar
- Cancel support: `AbortController` — user can cancel mid-download

#### Dependencies + risks

- Risk: IndexedDB quota varies by browser. Chrome: ~60% of disk. Safari: ~1GB then prompts. Firefox: ~2GB. Mobile Safari is most restrictive.
- Risk: Large episodes (60+ min talk shows) can be 50-100MB each. 10 downloaded episodes = 500MB-1GB. Need quota management.
- Risk: `navigator.storage.estimate()` is not available in all browsers (Safari < 17). Fallback: skip quota check, let IndexedDB throw on quota exceeded.
- Risk: Triton Digital signed URLs expire. For Fight for Our Existence, the download must happen while the URL is fresh. Once stored as blob, expiry doesn't matter.
- Dependency: Episode scroller (24c) provides the row where download buttons live.
- Pattern reference: `src/hooks/useFeedbackDraft.ts` — demonstrates localStorage-based per-user state with debounced persistence. IndexedDB version follows same hook pattern.

#### Effort: L

#### Files touched

- `src/lib/podcast-downloads.ts` — new module: IndexedDB open/read/write/delete operations
- `src/hooks/usePodcastDownload.ts` — new hook: download state machine, progress tracking
- `src/components/persistent-player/episode-panel.tsx` — download button per row
- `src/components/persistent-player/download-popout.tsx` — new component: fiona-style yes/no prompt
- `src/components/persistent-player/index.tsx` — offline playback logic (check IndexedDB before streaming)
- `src/components/persistent-player/styles.css` — download button states, progress bar, popout styles
- `src/locales/en-US.json` — download labels
- `src/locales/es-MX.json` — download labels

---

### 6. Speakeasy preferences

#### UX intent

Bryan: "option in the logged in speakeasy for users to set to download new podcasts by default & select them — should all be defaulted to no do not download."

A new preferences section in the authenticated Speakeasy page where users configure auto-download behavior per podcast.

#### Page placement

Current Speakeasy layout in `src/sites/awsug/app.tsx`:
1. Greeting container (greeting + quick action buttons)
2. Next meetup card
3. Feedback section
4. (proposed) **Podcast Preferences card** — new, placed after the greeting container

The card sits high because download preferences are a "set once, benefit always" interaction — users configure it early, then forget about it.

#### Preferences UI

```
┌─────────────────────────────────────────────────┐
│ Podcast Downloads                          [?]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Auto-download new episodes    [OFF]             │
│                                                 │
│ When enabled, new episodes from selected        │
│ podcasts download automatically.                │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ Podcasts to auto-download:                      │
│ ☐ Talk Python to Me                             │
│ ☐ AWS Bites                                     │
│ ☐ Rustacean Station                             │
│ ☐ Writing on the Wall                           │
│ ☐ El Sonido (KEXP)                              │
│ ☐ The Fight for Our Existence                   │
│ ☐ ... (all non-hidden podcasts)                 │
│                                                 │
│ ─────────────────────────────────────────────── │
│ Downloaded: 3 episodes (127 MB)    [Manage ›]   │
│ Available: ~2.1 GB                              │
└─────────────────────────────────────────────────┘
```

#### Components used

- **Auto-download toggle**: Cloudscape `Toggle` component (already used elsewhere in the project)
- **Podcast checklist**: Cloudscape `Checkbox` per podcast (disabled when toggle is OFF)
- **Storage summary**: Plain text with `navigator.storage.estimate()` values
- **"Manage" link**: Navigates to a future download management view (or scrolls to episode list in player)

#### Preference keys + defaults

```ts
interface DownloadPreferences {
  userSub: string;              // Cognito sub — primary key
  autoDownload: boolean;        // default: false
  subscribedPodcasts: string[]; // default: [] (empty — no podcasts selected)
  updatedAt: number;            // last modification timestamp
}
```

All defaults are "off" / empty — no downloads happen without explicit user opt-in.

#### Storage

- Same IndexedDB database as downloads: `cdn-podcast-downloads`
- Object store: `preferences` (keyed by `userSub`)
- Read on Speakeasy page mount
- Write on toggle/checkbox change (debounced 500ms, same pattern as `useFeedbackDraft`)

#### Sync behavior — auto-download trigger

When auto-download is enabled for a podcast:
1. On page load (any page with persistent player), check: has a new episode appeared since last download?
2. Compare latest RSS episode `guid` against IndexedDB `episodes` store
3. If new episode exists AND podcast is in `subscribedPodcasts` AND `autoDownload === true`:
   - Trigger background download (no UI prompt — silent)
   - Show subtle notification in player: "Downloaded new episode of [podcast]" (toast, auto-dismiss 5s)
4. Debounce: only check once per 30 minutes (store last-check timestamp in localStorage)

#### Edge cases

- User disables auto-download: stop future downloads, keep existing downloads
- User unchecks a podcast: stop future downloads for that podcast, keep existing episodes
- User has no network: skip auto-download check silently, retry next page load
- Storage full: skip download, show warning next time user visits Speakeasy

#### Accessibility

- Toggle has `aria-label="Auto-download new podcast episodes"`
- Checkboxes have `aria-label="Auto-download [podcast name]"`
- Storage summary is `aria-live="polite"` (updates when downloads complete)
- Disabled checkboxes (when toggle is OFF) have `aria-disabled="true"` with explanation

#### Dependencies + risks

- Dependency: IndexedDB infrastructure from design area 5
- Dependency: Podcast list from STREAMS array (24a)
- Risk: Background downloads on mobile may be killed by OS. Mitigate: only download on WiFi? (Future enhancement, not v1)
- Risk: User clears browser data — all downloads + preferences lost. Acceptable for v1 (no server-side sync).

#### Effort: M

#### Files touched

- `src/sites/awsug/app.tsx` — new PodcastPreferences card section
- `src/sites/awsug/components/podcast-preferences.tsx` — new component
- `src/lib/podcast-downloads.ts` — preferences read/write functions
- `src/hooks/usePodcastAutoDownload.ts` — new hook: background download trigger logic
- `src/locales/en-US.json` — preference labels
- `src/locales/es-MX.json` — preference labels

---

### 7. Carousel of shorts on feed page

#### UX intent

Bryan: "I'd like to feature a carousel of shorts on a card on the feed page as well as for you to add the podcast to the player."

#### Interpretation of "shorts"

**My interpretation**: Short-form podcast episodes (under 5 minutes duration). These are quick-hit episodes — news updates, tips, intros — that a user can consume in a single scroll-pause. NOT video shorts (no YouTube Shorts / TikTok integration in scope).

Rationale: The context is "add the podcast to the player" — this is audio content. The carousel surfaces bite-sized audio from across all podcasts, encouraging discovery.

If Bryan means something else (curated highlight clips, manually selected segments), the implementation changes significantly — flagged in Open Questions.

#### Definition of "short"

- Episode with `itunes:duration` < 300 seconds (5 minutes)
- Parsed at build time from RSS feeds by `scripts/fetch-feeds.mjs`
- Stored in `public/data/podcast-shorts.json`

#### Data pipeline extension

Add to `scripts/fetch-feeds.mjs`:

```js
// After existing PODCAST_FEEDS loop, extract shorts
const shorts = [];
for (const { key, url } of PODCAST_FEEDS) {
  // parse all items, filter duration < 300s
  // store: { podcastKey, title, duration, enclosureUrl, pubDate, coverArt }
}
// Write public/data/podcast-shorts.json
```

Cover art source: `<itunes:image>` on the `<channel>` element (podcast-level art). Per-episode art (`<itunes:image>` on `<item>`) is rare.

#### Feed page placement

Current feed page structure (`src/pages/feed/app.tsx`):
1. Live hero slot
2. NextMeetup card (full-width)
3. BuilderCenterCard (full-width)
4. Shuffled grid (youtube, twitch, andmore, awsml, arrowhead, etc.)

**Proposed placement**: New full-width card between BuilderCenterCard and the shuffled grid. Rationale: high visibility, doesn't compete with live content, introduces audio content before the user scrolls into the video-heavy grid.

```
[Live hero]
[NextMeetup]
─────────────
[BuilderCenter]
─────────────
[🎧 Podcast Shorts carousel]  ← NEW
─────────────
[Shuffled grid...]
```

#### Carousel design

Cloudscape does NOT ship a Carousel component. Options:

| Option | Pros | Cons |
|--------|------|------|
| A. CSS scroll-snap horizontal scroller | Native, performant, touch-friendly | Need custom arrow buttons, no built-in a11y |
| B. Reuse existing `feed-carousel` pattern | Already built for YouTube carousel | Designed for iframes, not cards |
| **C. Custom horizontal card scroller** | Purpose-built for audio cards, scroll-snap | Small amount of new CSS |

**Recommendation: Option C** — Custom horizontal scroller with CSS `scroll-snap-type: x mandatory`. Reuse the arrow button pattern from `src/pages/feed/components/youtube-carousel.tsx`.

#### Card design (each short)

```
┌──────────────────────┐
│ ┌────┐               │
│ │ 🎨 │  Episode Title │
│ │art │  Podcast Name  │
│ └────┘  ⏱ 2:34       │
│         [▶ Play]      │
└──────────────────────┘
```

- **Dimensions**: ~200px wide × 140px tall (compact card)
- **Cover art**: 48×48px podcast artwork (from `itunes:image`)
- **Title**: Episode title, truncated at 40 chars with ellipsis
- **Podcast name**: Smaller text, station label
- **Duration**: Formatted as M:SS
- **Play button**: Click → plays in persistent player (sets `rssAudioUrl` + station context)

#### Scroll behavior

- Horizontal scroll with `scroll-snap-type: x mandatory` on container
- Each card has `scroll-snap-align: start`
- Left/right arrow buttons at container edges (hidden when at start/end)
- Touch: native swipe scrolling
- Mouse: click-drag or arrow buttons
- Show 3-4 cards at desktop width, 1.5 cards on mobile (peek effect)

#### Click-to-play behavior

When user clicks Play on a shorts card:
1. Identify which podcast the short belongs to (via `podcastKey`)
2. Set persistent player to that podcast station
3. Set `rssAudioUrl` to the short's `enclosureUrl`
4. Player begins playback with connecting → playing state machine

#### Empty state

If no podcasts have episodes under 5 minutes: don't render the carousel at all. The component returns `null` when `shorts.length === 0`.

#### Accessibility

- Container: `role="region"` with `aria-label="Short podcast episodes"`
- Arrow buttons: `aria-label="Previous short" / "Next short"`
- Each card: `role="article"` with descriptive content
- Play button: `aria-label="Play [episode title] from [podcast name]"`
- Keyboard: Tab to arrow buttons, Enter/Space to navigate. Tab into cards, Enter to play.
- `prefers-reduced-motion`: disable scroll-snap animation, show all cards in vertical stack

#### Dependencies + risks

- Dependency: `scripts/fetch-feeds.mjs` extension (24a timeline)
- Dependency: New podcasts in STREAMS array (24a)
- Risk: Few podcasts publish episodes under 5 minutes. If the pool is too small (< 3 shorts), the carousel looks sparse. Fallback: increase threshold to 10 minutes, or don't render if < 3 items.
- Risk: Cover art URLs may be large images. Mitigate: use `loading="lazy"` + constrain to 48×48 CSS.

#### Effort: M

#### Files touched

- `scripts/fetch-feeds.mjs` — extract shorts from RSS, write `podcast-shorts.json`
- `public/data/podcast-shorts.json` — new build-time data file (gitignored, generated)
- `src/pages/feed/app.tsx` — import + render PodcastShortsCarousel
- `src/pages/feed/components/podcast-shorts-carousel.tsx` — new component
- `src/pages/feed/styles.css` — scroll-snap container, card styles, arrow buttons
- `src/locales/en-US.json` — "Podcast Shorts", "Play", duration format
- `src/locales/es-MX.json` — "Podcasts cortos", "Reproducir"

---

### 8. Probe script HEAD→GET fix

#### UX intent

Not user-facing. Developer tooling fix. The weekly stream health probe (`scripts/probe-stream-health.mjs`) uses HTTP HEAD requests. Icecast servers (notably KRUX 91.5) reject HEAD with 405 Method Not Allowed or return misleading responses, causing false-negative "FAIL" reports.

#### Current behavior

```js
const res = await fetch(e.url, {
  method: "HEAD",
  signal: ctrl.signal,
  redirect: "follow",
});
```

KRUX's icecast at `kruxstream.nmsu.edu` returns 200 for HEAD but some icecast configurations return 405 or hang. The probe reports a healthy stream as failed.

#### Proposed fix

Switch to GET with a `Range` header requesting only the first 1024 bytes, then abort:

```js
const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort(), 8000);
const res = await fetch(e.url, {
  method: "GET",
  headers: { "Range": "bytes=0-1024" },
  signal: ctrl.signal,
  redirect: "follow",
});
// Read first chunk to confirm stream is alive
const reader = res.body?.getReader();
if (reader) {
  await reader.read(); // first chunk received = stream is alive
  reader.cancel();     // abort the rest
}
ctrl.abort();
```

This confirms the stream is actually serving audio bytes, not just responding to metadata requests.

#### Edge cases

- Streams that don't support Range requests: they'll return 200 with full body — the abort after first chunk handles this
- Podcast mp3 URLs: Range is well-supported on CDNs (CloudFront, Podbean, etc.)
- Signed URLs (Triton Digital): GET with Range should work within expiry window

#### Dependencies + risks

- No dependencies on other Wave 24 work
- Risk: None — this is a developer script, not user-facing
- Improvement: eliminates false-negative alerts for KRUX and any future icecast stations

#### Effort: S

#### Files touched

- `scripts/probe-stream-health.mjs` — replace HEAD with GET+Range+abort pattern

---

## Risks + constraints

| Risk | Impact | Mitigation |
|------|--------|-----------|
| CSP header length approaching limit | New domains may exceed CloudFront's practical CSP length | Collapse `*.cloudfront.net` wildcard (saves ~144 chars) |
| IndexedDB quota varies by browser | Safari mobile may limit to ~1GB, then prompt user | Check quota before download, warn at 100MB remaining |
| Triton Digital signed URLs expire | Stale bookmarked URLs will 403 | Always fetch fresh RSS before streaming; offline downloads store blob not URL |
| El Sonido CORS unverified | `traffic.omny.fm` may block browser audio fetch | Mark `corsBlocked: true` as fallback, use build-time cache |
| Large RSS feeds (500+ items) | Parsing may block main thread | Use `requestIdleCallback` or web worker for parsing |
| Mobile background download killed by OS | Auto-downloads may fail silently | v1 accepts this; future: use Background Fetch API |
| Browser data cleared by user | All downloads + preferences lost | Acceptable for v1; no server-side sync planned |
| Accessibility regression | New interactive elements (carousel, episode list, popout) | Each design area includes ARIA spec; test with VoiceOver + NVDA |
| `prefers-reduced-motion` | Carousel scroll-snap, spinner, popout animations | All animations respect reduced-motion media query |

## What this design DOES NOT include

- **Video shorts** — No YouTube Shorts or TikTok integration. "Shorts" means short audio episodes only.
- **Server-side sync of downloads** — Downloads are browser-local only. Clearing browser data loses them.
- **Service worker** — No SW registration. Offline playback uses IndexedDB blob URLs directly.
- **Transcript embedding** — Transcripts open in new tab at external URL. No in-app transcript viewer.
- **Background Fetch API** — Downloads happen in foreground only. Background Fetch is a future enhancement.
- **Podcast search** — No search across episodes. Users browse the list or sort.
- **Podcast subscriptions (RSS reader)** — No "add your own podcast" feature. Station list is curated by Bryan.
- **Push notifications for new episodes** — Auto-download is passive (checks on page load). No push.
- **HLS/DASH streaming** — No adaptive bitrate. All audio is direct mp3/aac file playback.
- **Cross-device sync** — No syncing download state or playback position across devices.
- **Playlist/queue** — No "play next" queue. User plays one episode at a time.
- **Playback speed control** — Not in Wave 24 scope (good future enhancement).

## Files this design proposes touching (consolidated list)

### New files

| Path | Sub-wave | Purpose |
|------|----------|---------|
| `src/components/persistent-player/episode-panel.tsx` | 24c | Episode list + sort UI |
| `src/components/persistent-player/download-popout.tsx` | 24d | Fiona-style yes/no removal prompt |
| `src/lib/podcast-downloads.ts` | 24d | IndexedDB operations module |
| `src/hooks/usePodcastDownload.ts` | 24d | Download state machine hook |
| `src/hooks/usePodcastAutoDownload.ts` | 24d | Auto-download trigger hook |
| `src/sites/awsug/components/podcast-preferences.tsx` | 24d | Speakeasy preferences card |
| `src/pages/feed/components/podcast-shorts-carousel.tsx` | 24e | Shorts carousel component |
| `public/data/podcast-shorts.json` | 24e | Build-time shorts data (gitignored) |

### Modified files

| Path | Sub-wave(s) | Changes |
|------|-------------|---------|
| `src/lib/streams.ts` | 24a, 24c | 3 new StreamDef entries + `transcriptBaseUrl` field |
| `src/components/persistent-player/index.tsx` | 24b, 24c, 24d | Connecting state, episode fetch, offline playback |
| `src/components/persistent-player/styles.css` | 24b, 24c, 24d | Spinner, panel, download button, popout styles |
| `scripts/fetch-feeds.mjs` | 24a, 24e | 3 new PODCAST_FEEDS + shorts extraction |
| `scripts/probe-stream-health.mjs` | 24a | HEAD→GET fix |
| `infra/cloudfront-security-headers.main.json` | 24a | CSP additions + wildcard collapse |
| `src/sites/awsug/app.tsx` | 24d | PodcastPreferences card import + render |
| `src/pages/feed/app.tsx` | 24e | PodcastShortsCarousel import + render |
| `src/pages/feed/styles.css` | 24e | Carousel scroll-snap styles |
| `src/locales/en-US.json` | 24b-24e | All new UI labels |
| `src/locales/es-MX.json` | 24b-24e | All new UI labels (Spanish) |
| `scripts/verify-csp.sh` | 24a | May need update for wildcard validation |

### Files NOT touched (explicit)

- `src/components/franklin-overlay/` — decorative SVG, no changes needed
- `src/components/fiona-panel/` — reference only for popout pattern, not modified
- `src/components/fiona-frame/` — reference only, not modified
- `public/data/podcast-episodes.json` — existing file, format unchanged (new entries added by fetch-feeds.mjs at build time)
- `src/lib/streams-order.ts` — no changes needed (shuffle logic is station-agnostic)

---

_End of design document._
