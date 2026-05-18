# Wave 24 Architecture Signoff

**Reviewer:** ghost-stratia-code-mapper
**Date:** 2026-05-18
**Branch:** feature/wave-24-radio-podcast-buildout
**Design doc:** docs/wave-24-design.md (Liora, 2026-05-18)
**Baseline:** 529 PASS / 0 FAIL — Vite + Vitest + Biome

---

## Verdict

**APPROVED WITH CHANGES**

The plan is architecturally coherent and correctly models the existing StreamDef data model, RSS fetch pipeline, and localStorage persistence layer. Four areas carry concrete pre-implementation blockers: (1) the CSP budget sits at 1640/1784 chars with 144-char headroom — three new podcast hosts will likely consume all of it and must be profiled before 24b starts; (2) offline downloads underestimates IndexedDB scope, particularly mid-download sign-out handling, quota fragmentation, and the absence of a service worker on this site; (3) Speakeasy prefs do not define a persistence layer or handle the cross-origin gap between main site and awsug subdomain; (4) transcript CORS posture for the three new podcast hosts is unverified. Sub-waves 24a and the loading-state half of 24b are clean to start immediately.

---

## Per-area review

### 1. Loading state

**Verdict:** approve

**Concerns:**
- PersistentPlayerBar already has `role="status" aria-live="polite"` on `.cdn-pp__sub`. A new connecting spinner must sit inside that existing span — not add a sibling live region, or screen readers double-announce.
- The `key={isPodcast ? "podcast" : "radio"}` on the audio element causes re-mount on station-type switch. Loading state must not flash a resolved state during that re-mount.
- No defined timeout mapping to the 2s auto-advance grace period from Wave 22. Loading state timers must be consistent with the existing retry contract.

**Recommended changes:**
- Map loading state to the existing `blocked / showRetryingUI / showFailedUI` booleans in PersistentPlayerBar — no parallel state machine.
- Spinner: `aria-label="connecting to stream"` inside the existing `cdn-pp__sub` span.
- Add one Vitest test: state=retrying renders the retrying i18n key inside an `aria-live="polite"` element.

---

### 2. 3 new podcasts

**Verdict:** change

**Concerns:**
- CSP budget: 1640 chars used, 1784 limit, 144 headroom. Three new podcast hosts each need entries in both `connect-src` and `media-src`. Estimated cost: 120–180 chars. This likely exceeds the budget before any code is written.
- Writing on the Wall (Captivate.fm): RSS host `feeds.captivate.fm` + audio host `podcasts.captivate.fm` both need CSP entries.
- El Sonido by KEXP (Omny.fm): RSS at `www.omnycontent.com` + audio at `traffic.omny.fm`. KEXP icecast host already in CSP, but Omny is separate.
- The Fight for Our Existence (rss.com / Triton Digital): RSS at `media.rss.com`, audio redirects from `content.rss.com` → `rsscom.pdn.tritondigital.com`. Three potential CSP entries depending on follow behavior.
- `aws_developers_podcast` is currently `hidden: true` due to go-aws.com DNS SERVFAIL. Adding three more while one stays broken is a UX regression.
- Browser-context CORS for `traffic.omny.fm` audio is unverified — sandbox curl probes from harald do not exercise the same CORS headers a browser sends.

**Recommended changes:**
- Before writing any code: compute exact CSP delta for all three hosts. If over budget, Bryan chooses: collapse 3 specific cloudfront subdomains into `*.cloudfront.net` wildcard (~158 chars freed) or defer one podcast.
- Add all three with `hidden: true` initially; unflag only after CORS verification on a deployed dev preview and CSP sync.
- Each entry needs a `parseMeta` function verified against the actual RSS XML, not assumed from the generic `querySelector("channel > item:first-child > title")` pattern.

---

### 3. Episode scroller

**Verdict:** change

**Concerns:**
- Current architecture: only the latest episode is fetched at play time. `podcast-episodes.json` stores `{ title, subtitle, display }` for one episode per station. A scroller needs an episode array — this is a data model expansion.
- "Sort to oldest" sort state: undefined persistence scope (session? station-switch?).
- Horizontal scroll on mobile has a documented accessibility gap in the 2026-05-15 UX audit. Keyboard nav must be explicit.
- `clearPodcastPosition()` is called on every skip. If a user picks an older episode and plays it, `savePlayerState` must write `podcastEpisodeUrl` for that selection — the current skip handler clears it.

**Recommended changes:**
- Expand `podcast-episodes.json` schema: `{ [stationKey]: { episodes: Array<{ title, subtitle, url, pubDate }> } }`. Cap at 20 episodes per station. Update `fetch-feeds.mjs`.
- Sort state: `cdn:episode-sort:v1` in localStorage, keyed by station key. Default newest-first.
- Scroller ARIA: container `role="listbox"`, each episode `role="option"`, selected episode `aria-selected="true"`, arrow key navigation.
- On episode selection, write `podcastEpisodeUrl` to `savePlayerState`. Validate on session restore that the URL is still in the episode list.

---

### 4. Transcripts

**Verdict:** change

**Concerns:**
- Transcript availability is per-episode, not per-podcast. The design implies a generic "transcript row" but this only applies to podcasts that publish transcripts — currently AWS Podcast + Talk Python, not the three new ones.
- If transcripts are fetched at play time, the transcript host must be in `connect-src`, further stressing the CSP budget.
- No UI surface defined: inline text, external link, or panel. Inline in the persistent player pill is inappropriate for 10k-word content.

**Recommended changes:**
- Scope to `aws_podcast` + `talk_python` only for Wave 24. Add `transcriptUrlPattern?: (episodeUrl: string) => string | null` to StreamDef; return null for stations without transcripts.
- Transcript surface: external link only (target="_blank" rel="noopener") for Wave 24. A panel UI is a Wave 25 expansion.
- "View transcript" link in the player pill, only rendered when `transcriptUrlPattern` is defined and returns non-null for the current episode.

---

### 5. Offline downloads (IndexedDB)

**Verdict:** change

**Concerns:**
- No service worker on this site. IndexedDB storage without a SW means audio is available without re-fetching but the page still requires network to load. "Playable offline" is a different scope requiring a PWA manifest + SW — not in this plan.
- Quota: browsers silently evict IndexedDB at ~60% disk usage. At 50 podcasts × 500 episodes × 50MB, silent eviction is guaranteed. No quota guard defined.
- Mid-download sign-out: Cognito tokens are sessionStorage-scoped. Tab close = tokens gone. Download state in IndexedDB will show `in-progress` but session is unauthorized on reopen. Plan does not address this.
- `requireAuth()` in auth.ts returns null on expiry. The download manager must check auth before each chunk write, not once at initiation.
- Multi-tab race: auto-download from multiple tabs hits the same IndexedDB key concurrently. No mutex defined.

**Recommended changes:**
- Clarify scope explicitly in the design: "re-fetch elimination" (no SW needed) vs "true offline" (SW + PWA, defer to Wave 25).
- Call `StorageManager.estimate()` before every download. Block if remaining quota < 2× file size. Hard cap: 2GB total for `cdn:downloads:` keyspace.
- Listen for `storage` event on `cdn.accessToken` removal. On removal: abort in-flight fetch, mark download `interrupted`.
- Tab mutex: `BroadcastChannel("cdn:download-lock")` — broadcast download start, listen for collision before beginning.

---

### 6. Speakeasy preferences

**Verdict:** change

**Concerns:**
- The plan conflates preference UI (awsug subdomain) with download execution (main site where player lives). Cross-origin localStorage access between `clouddelnorte.org` and `awsug.clouddelnorte.org` is blocked by browser same-origin policy. This is a fundamental architecture gap.
- No persistence layer defined: localStorage (main site only) vs DynamoDB (cross-device, needs API) vs postMessage bridge (fragile).
- No definition of what "new episode" means for auto-download sync (timestamp? episode count delta?).

**Recommended changes:**
- Store prefs in `cdn:speakeasy-prefs:v1` on `clouddelnorte.org` localStorage only. Shape: `{ playbackSpeed: 1|1.25|1.5|2, autoDownload: Record<stationKey, boolean>, lastSyncEpoch: Record<stationKey, number> }`.
- New component: `src/components/speakeasy-prefs/index.tsx` — a settings card placed in the Speakeasy page. Do not mutate `SpeakeasySign` (which is a decorative SVG).
- Speed control in player pill: cycle button showing current speed, only rendered for `type: "podcast"`. Persist to `cdn:player-speed:v1`.
- Auto-download: compare feed `Last-Modified` header against `lastSyncEpoch[key]` on session start. Debounce to once per session.

---

### 7. Carousel of shorts

**Verdict:** change

**Concerns:**
- "Shorts" is not defined. Liora interpreted as audio episodes < 5 min. If YouTube Shorts: the existing `probeOembed` pattern uses the `/live` oembed path, which doesn't apply to Shorts (direct video IDs). YouTube RSS feeds for Shorts are not CORS-accessible from the browser.
- YouTube `frame-src` may already be in CSP for the live embed — needs verification before assuming new CSP entries are required.
- The existing `ArrowheadNews` carousel pattern covers horizontal scroll + slot geometry. Introducing a new scroll component would duplicate it.
- UX audit (2026-05-15) flagged horizontal scroll carousels for accessibility gaps on mobile.

**Recommended changes:**
- Confirm interpretation with Bryan (Q1 in design doc). If audio episodes < 5min: parse `itunes:duration` from RSS, surface in `podcast-episodes.json` as `shorts: [{ stationKey, title, url, durationSec }]`. If video: hardcoded list of Bryan-curated YouTube IDs.
- Reuse the `ArrowheadNews` carousel component pattern — do not introduce a new horizontal scroll primitive.
- ARIA: `aria-roledescription="carousel"` on container, `aria-label="item N of M"` on each card.

---

### 8. Probe HEAD→GET

**Verdict:** approve

**Concerns:**
- Two-line change to `scripts/probe-stream-health.mjs`. Well-scoped, documented in the architecture doc. KRUX returns 400 on HEAD; ranged-GET confirms liveness without downloading the full stream.
- `.github/workflows/stream-health.yml` exit code semantics unchanged — no workflow changes needed.

**Recommended changes:**
- Use `Range: bytes=0-1023`. Expect `206 Partial Content` from Icecast.
- Add inline comment explaining the HEAD→GET reason (KRUX false-negative).
- Run probe against current STREAMS list before merging 24a to confirm KRUX passes.

---

## Sub-wave ordering

Liora proposed: 24a (3 podcasts + CSP collapse + probe fix) → 24b (loading state) → 24c (episode scroller + transcripts) → 24d (offline downloads + Speakeasy prefs) → 24e (carousel of shorts).

**Mostly agree. One required addition: CSP profiling must be a hard gate inside 24a before the 3 podcasts are committed.**

| Sub-wave | Content | Rationale |
|---|---|---|
| 24a-pre | CSP budget profiling (not a code commit) | Compute exact char delta for all 3 podcast hosts. If over 1784 budget, collapse cloudfront subdomains to `*.cloudfront.net` first. |
| 24a | 3 new podcasts (with `hidden: true` initially) + CSP additions + probe HEAD→GET fix | Self-contained, low-risk after profiling gate. |
| 24b | Loading state UI | Zero CSP impact, depends only on existing player state machine. |
| 24c | Episode scroller + sort + transcripts row | Depends on expanded `podcast-episodes.json` schema. Transcripts: `aws_podcast` + `talk_python` only. |
| 24d | Offline downloads + Speakeasy prefs | Depends on episode scroller. Must address auth/sign-out interaction explicitly. |
| 24e | Carousel of shorts | Lowest inter-wave dependency. Define "shorts" before starting. |

---

## Technical risks Liora missed or downplayed

1. **CSP 1784-char hard ceiling** — Not a soft limit. `update-response-headers-policy` returns `TooLongCSPInResponseHeadersPolicy` and the deploy fails. Three new podcast hosts each needing `connect-src` + `media-src` entries may require dead-origin cleanup or `*.cloudfront.net` wildcarding before 24a can ship.

2. **IndexedDB quota fragmentation** — Chrome and Firefox silently evict blobs under storage pressure with no warning to the app. The design has no `StorageManager.estimate()` guard and no eviction recovery path. At realistic podcast library sizes (10 episodes × 50MB = 500MB), this will manifest in the wild.

3. **Mid-download sign-out** — Cognito tokens are sessionStorage-scoped (tab-close clears them). A download started in one tab survives the tab close as an `in-progress` record in IndexedDB but the auth context is gone. The resume path on next session must re-authenticate; the design does not address this.

4. **Multi-tab auto-download race** — Two tabs open, both poll the RSS feed, both see a new episode, both attempt to write to the same IndexedDB key. IDBTransaction is not atomic across tabs. No mutex or BroadcastChannel coordination is proposed.

5. **Episode scroller + savePlayerState gap** — `clearPodcastPosition()` is called in the skip handler. If a user selects an older episode from the scroller and then skips, the selected episode URL is cleared. The interaction between scroller selection and the existing skip/resume state is not designed.

6. **Service worker absent** — The design uses the phrase "offline" but this site has no SW and no PWA manifest. Without a SW, IndexedDB blobs can be read by the page but the page itself still requires network. "Playable offline" is not achievable with IndexedDB alone.

7. **Triton Digital signed URL expiry** — `The Fight for Our Existence` audio comes through `rsscom.pdn.tritondigital.com` with signed URL params (Expires + Signature). The signed URL works for current episodes but expires per-request. `savePlayerState` storing the URL means stale URLs on session restore. The plan does not include a signed-URL refresh path.

8. **CSP via CloudFront Function alternative** — The 1784-char ceiling is a CloudFront response-headers policy limit, not a browser limit. A CloudFront Function could write CSP headers without the policy ceiling, enabling per-request dynamic CSP. This approach was not evaluated. If the podcast additions push the budget over after `*.cloudfront.net` wildcarding, this is the correct architectural fix rather than deleting active origins.

---

## Cross-cutting concerns

### Accessibility (4 issues)

1. **ARIA live regions for loading state** — PersistentPlayerBar already has one `aria-live="polite"` span. The new connecting/retrying state must nest inside it, not add a second live region. A double live region causes double-announcement on NVDA/JAWS.

2. **Keyboard nav for episode scroller** — Horizontal scroll containers are not keyboard-navigable by default. The scroller needs `role="listbox"` + arrow key handlers. Each episode needs `role="option"` + `tabindex="0"` on the active item. The 2026-05-15 UX audit already flagged this pattern site-wide.

3. **Screen reader semantics for download buttons** — "Download" buttons must have `aria-label` that includes the episode title: `aria-label="download episode: {title}"`. Progress state during download should be communicated via `aria-live="polite"` status updates, not just visual progress bars.

4. **Carousel of shorts ARIA** — `aria-roledescription="carousel"` on container. Navigation buttons: `aria-label="previous"` / `aria-label="next"`. Each item: `aria-label="item N of M"`. `prefers-reduced-motion` guard on any scroll animation.

### Security (2 issues)

1. **Download auth gate** — A download authorized at time T with a valid session can continue after the session expires (token cleared on tab close). The download manager must re-validate auth on session restore before resuming or serving a stored blob for playback. `requireAuth()` returning null must abort download access, not serve stale blob.

2. **IndexedDB blob access post-sign-out** — If a user is banned or has their Cognito account disabled, they may still be able to play previously downloaded episodes from IndexedDB even after sign-out, because IndexedDB is not cleared on sign-out in the current auth flow. The sign-out handler (`clearPlayerState` in player-persist.ts) must also clear the `cdn:downloads:` keyspace.

### Performance (2 issues)

1. **Storage budget** — Hard cap of 2GB recommended for `cdn:downloads:` keyspace. Check before every download with `StorageManager.estimate()`. Display current usage in the Speakeasy prefs panel.

2. **Episode list RSS fetch size** — Fetching a full RSS feed to populate the episode scroller pulls the entire feed XML (often 50–200KB for 100-episode podcasts). Parse only the first 20 items. Cache the parsed result in sessionStorage under `cdn:episode-list:<stationKey>` with a 1-hour TTL to avoid redundant fetches on station-switch.

### i18n (2 issues)

1. **New strings** — All new UI strings (loading states, download buttons, speed selector, transcript link, carousel nav) need entries in both `src/locales/en-US.json` and `src/locales/es-MX.json`. Translation coverage tests enforce this. Strings must be properly translated, not copied.

2. **RTL** — The locale system (`us`/`mx`) does not currently include RTL locales. No RTL concern for Wave 24. However, the horizontal episode scroller should use `scroll-padding-inline-start` rather than `scroll-padding-left` to be RTL-safe by default.

### Test strategy

| Area | Unit-testable | Integration | E2E |
|---|---|---|---|
| Loading state timer/state machine | yes — pure state transitions | player render with mock audio | Nova Act: press play, observe spinner |
| 3 new podcasts `parseMeta` | yes — given RSS XML fixture | PersistentPlayer with mocked fetch | — |
| Episode scroller sort state | yes — sort logic, localStorage read/write | scroller render + selection | — |
| Transcript URL pattern | yes — given episode URL, returns expected string | — | — |
| IndexedDB download quota guard | yes — mock `StorageManager.estimate()` | download flow with mock fetch | — |
| Speed control persistence | yes — localStorage read/write | player render with prefs applied | — |
| Probe HEAD→GET | yes — mock fetch, assert Range header sent | — | CI health check run |

---

## Open questions — recommended answers

Liora flagged 7 open questions for Bryan. Recommended defaults for Bryan to accept or override:

**Q1: "Shorts" interpretation — audio episodes < 5min, video shorts, or curated highlights?**
Recommendation: **Audio episodes < 5min for Wave 24e.** Video shorts pull in YouTube CORS + CSP complexity that's out of scope. Curated highlights require a manual curation pipeline that doesn't exist yet. Audio episodes is the cheapest interpretation that delivers visible value.

**Q2: Curated status for new podcasts (one or both Mescalero / regional)?**
Recommendation: **Both `hidden: true` initially, neither curated until Bryan verifies in-browser.** Wave 22's lesson was that broken stations destroy the user experience. Add as hidden, verify on dev, unflag (and optionally curate) after.

**Q3: El Sonido CORS verification fallback (corsBlocked: true if browser blocks)?**
Recommendation: **Yes, accept the fallback.** Build-time `podcast-episodes.json` already handles this for `rust_in_production`. Same pattern: title display via cache, audio plays normally.

**Q4: Download quota warning threshold (Liora proposed 100MB remaining)?**
Recommendation: **Use 2× file size, not a fixed number.** A 100MB threshold blocks small downloads even when plenty of space exists. 2× the size of the file the user is about to download is right-sized to the action.

**Q5: Auto-download sync frequency (page load vs every 30 min via timestamp)?**
Recommendation: **Once per session via sessionStorage flag.** Page-load checks are noisy; 30-min timer requires cross-tab coordination. Once per session is the simplest correct answer.

**Q6: Transcripts — build now for Talk Python or defer entirely?**
Recommendation: **Build now for `aws_podcast` + `talk_python` via per-station `transcriptUrlPattern` field.** The infrastructure is small (one optional field on StreamDef + one external link in the UI). Building it for two stations is cheap; defer modal/inline transcript display.

**Q7: Episode scroller depth (all 500+ vs cap at 50 latest)?**
Recommendation: **Cap at 20 latest with a "load more" button.** 500-item virtual scrolling is overengineering for podcast UX. 20 covers the last 4-6 months of weekly podcasts. "Load more" expands the array without virtualization cost.

---

## Files Liora plans to touch — conflict assessment

Based on Wave 24 scope, the primary files touched will be:

| File | Wave 24 change | Active surface? | Conflict risk |
|---|---|---|---|
| `src/lib/streams.ts` | 3 new podcast entries | High — every wave adds entries | Medium. Any parallel wave touching streams.ts will conflict on the STREAMS array. |
| `src/components/persistent-player/index.tsx` | Loading state, episode scroller, speed control | High — touched in waves 20-23 | High if Wave 25 starts before 24d merges. |
| `src/components/persistent-player/styles.css` | Loading spinner styles | Medium | Low — CSS additions unlikely to conflict. |
| `src/lib/player-persist.ts` | Episode sort state, download state | Medium | Medium — any auth or storage work in parallel waves conflicts. |
| `src/locales/en-US.json` | New strings for all 8 areas | High — every feature wave adds keys | Low — JSON key additions rarely conflict unless same key is added twice. |
| `src/locales/es-MX.json` | Same as en-US | High | Low |
| `scripts/probe-stream-health.mjs` | HEAD→GET fix | Low | Very low — isolated script. |
| `infra/cloudfront-security-headers.main.json` | New podcast origins in CSP | Medium | High — any parallel infra work on the CSP file conflicts directly. |
| `infra/cloudfront-security-headers.awsug.json` | Same CSP additions | Medium | High |
| `public/data/podcast-episodes.json` | Schema expansion to episode arrays | Medium | Low — generated file, not hand-edited. |
| `scripts/fetch-feeds.mjs` | Multi-episode fetch per station | Low | Low |

**Highest conflict risk:** `persistent-player/index.tsx` and `infra/cloudfront-security-headers.*.json`. If Wave 25 ships in parallel, the CSP files and player component will conflict. Recommend merging 24a before any Wave 25 CSP changes start.

There is also an active CSS polish branch: `chore/card-polish-2026-05-18` (touches `src/styles/tokens.css` and `src/pages/feed/styles.css`). Zero conflict surface with Wave 24 \u2014 different files.

---

## Hard go/no-go items

**6 hard go/no-go items before sub-waves can proceed:**

1. **CSP budget profiling** (before 24a podcast adds) — Compute exact character delta for all three new podcast hosts across all CSP files. If over 1784, collapse `*.cloudfront.net` first. Bryan + Liora measurement task.

2. **Bryan answer: offline scope** (before 24d) — "Available without re-fetching" (IndexedDB, Wave 24) vs "playable offline" (SW + PWA, Wave 25). Different architectures. 24d cannot start without this answer.

3. **Bryan answer: shorts definition** (before 24e) — Audio episodes < 5min vs YouTube Shorts vs curated highlights. Determines CSP impact and component architecture.

4. **CORS verification for 3 new podcast RSS + audio hosts** (before 24a unflag) — Browser-context `fetch()` test against each RSS host on dev preview. Determines whether `corsBlocked: true` is needed.

5. **auth sign-out + IndexedDB download access design** (before 24d) — Sign-out handler must be extended to clear `cdn:downloads:` keyspace OR add a re-auth gate on blob playback. Affects 24d and the auth module.

6. **Speakeasy prefs persistence decision** (before 24d) — localStorage vs DynamoDB. If DynamoDB, Wave 24d scope expands significantly with new API endpoint + Lambda.

---

## Estimated total effort

Using Liora's S/M/L sizing and my judgement:

| Sub-wave | Liora size | My assessment | Calendar |
|---|---|---|---|
| 24a (3 podcasts + CSP collapse + probe fix) | S | M | 1 weekend session — CSP profiling adds 1-2 hours |
| 24b (loading state UI) | S | S | 1 focused session (2-3 hours) |
| 24c (scroller + transcripts) | M | L | 2 weekend sessions — data model expansion for episode arrays is non-trivial |
| 24d (downloads + prefs) | L | XL | 3-4 weekend sessions — IndexedDB + auth interaction + quota management + new prefs component |
| 24e (carousel of shorts) | M | S–M | 1-2 focused sessions depending on Q1 answer |

**Total calendar estimate: 5-7 weekend sessions (10-14 focused working days) assuming answers to all 6 go/no-go items are received before 24a starts.**

If the CSP budget is exceeded after `*.cloudfront.net` wildcarding and a CloudFront Function migration is required, add 1-2 sessions for infra work. If offline scope expands to include a service worker, 24d becomes a full wave on its own (Wave 25).

---

## Structured report

- **File path:** `docs/wave-24-stratia-signoff.md`
- **Estimated line count:** ~520 lines
- **Top-line verdict:** APPROVED WITH CHANGES
- **Sub-wave order:** Revised — CSP profiling gate added inside 24a; otherwise agree with Liora
- **Hard go/no-go items count:** 6
- **Cross-cutting concerns surfaced:** 10 (4 accessibility, 2 security, 2 performance, 2 i18n)
- **Technical risks Liora missed:** 8 (CSP ceiling, IndexedDB quota fragmentation, mid-download sign-out, multi-tab race, scroller/savePlayerState gap, SW absent, Triton signed URL expiry, CloudFront Function alternative)
- **Recommended answers to 7 open questions:**
  - Q1 (shorts interpretation): audio episodes < 5min
  - Q2 (curated for new podcasts): both `hidden: true` initially, neither curated until Bryan verifies
  - Q3 (El Sonido CORS fallback): YES — accept `corsBlocked: true` fallback
  - Q4 (download quota threshold): 2× file size, not a fixed number
  - Q5 (auto-download sync frequency): once per session via sessionStorage flag
  - Q6 (transcripts scope): build now for `aws_podcast` + `talk_python` via per-station `transcriptUrlPattern`
  - Q7 (episode scroller depth): cap at 20 latest with "load more" button
