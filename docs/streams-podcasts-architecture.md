# streams + podcasts architecture

Living technical documentation for cloud del norte's radio + podcast subsystem. Covers data model, discovery, metadata, CSP, deployment, and health monitoring as of 2026-05-18 (post-Wave 23).

---

## subdomain map

| subdomain | distribution id | s3 bucket | response-headers-policy | notes |
|---|---|---|---|---|
| `clouddelnorte.org` | `ECC3LP1BL2CZS` | `clouddelnorte.org` | `95055f76-9d40-424a-9453-b82edc124680` | primary public-facing site |
| `awsug.clouddelnorte.org` | `E2QLAWFVIT1AR8` | `awsug.clouddelnorte.org` | `ef81b3a7-9f54-4871-9d45-0864456d843b` | Speakeasy / signed-in members area |
| `auth.clouddelnorte.org` | `ECQ44FO9MBTCY` | `auth.clouddelnorte.org` | `6e5c7c27-39d3-4a6e-8a89-58a70396c5ed` | Cognito auth flow + redirect target |
| `dev.clouddelnorte.org` | `EEHVTUEQ97V0X` | `dev.clouddelnorte.org` | (none attached) | dev/staging — no CSP enforcement |

`scripts/deploy-manual.sh <main\|auth\|awsug\|dev>` deploys frontend bundles. `scripts/sync-cloudfront-headers.sh <main\|auth\|awsug\|all>` syncs CSP from `infra/cloudfront-security-headers.<sub>.json`. **dev is intentionally outside the sync-headers script** — it has no CSP attached, so app code runs without CSP enforcement there.

---

## data model

### `StreamDef` (src/lib/streams.ts)

Single discriminated-union shape covering both radio (`type: "radio"` default) and podcast (`type: "podcast"`) entries.

| field | required | shape | purpose |
|---|---|---|---|
| `key` | yes | string | stable identifier for sessionStorage continuity, lookups |
| `url` | yes | string | primary playback URL. For podcasts, the latest known mp3 (overridden at runtime by RSS-fetched enclosure). For radio, the icecast/Zeno mount. |
| `label` | yes | string | display name in the player |
| `type` | no | `"radio"\|"podcast"` | defaults `"radio"`. Drives RSS-fetch behavior + UI affordances |
| `rssFeedUrl` | podcasts | string | RSS feed for episode title + enclosure refresh |
| `metaUrl` | optional | string | now-playing endpoint (icecast `status-json.xsl`, NPR Composer widget, Zeno SSE) |
| `metaFormat` | optional | `"json"\|"sse"` | defaults `"json"`. `"sse"` opens an EventSource (Zeno) |
| `colors` | yes | `StationColors` | per-station brand palette with light/dark mode contrast overrides |
| `donateUrl` | optional | string | surfaces "donate to <key>" mini button when present |
| `scheduleUrl` | optional | string | weekly grid link |
| `location` | yes | `StreamLocation` | city/region/country for "streaming from …" line |
| `fallbackUrls` | optional | `readonly string[]` | tried in order on primary failure |
| `metaFallback` | optional | `StreamMetaFallback` | href + en/es labels when nowPlaying is empty (Shoutcast CORS-blocked, Zeno placeholder, etc.) |
| `hidden` | optional | `true` | excludes from carousel + shuffle. Use for temporarily-broken stations. |
| `curated` | optional | `true` | guarantees position 0 in shuffle when set on at least one entry. Reachability probe is skipped (trusted). |
| `corsBlocked` | optional | `true` | feed URL is CORS-blocked; runtime fetch skipped, build-time podcast-episodes.json used instead |
| `parseMeta` | optional | `(data: unknown) => string \| null` | parses `metaUrl` response into "song — artist" string |
| `parseMetaRich` | optional | `(data: unknown) => RichMeta \| null` | extended extraction (artwork, program, listeners, dj comment) |

### `RichMeta`

```ts
interface RichMeta {
  title: string | null;       // canonical "song — artist" (back-compat with parseMeta)
  artworkUrl?: string;        // KEXP image_uri, NPR Composer album art when widget_config allows
  programName?: string;       // currently-airing show name (NPR Composer onNow.program.name)
  programLink?: string;       // linkable program page
  listeners?: number;         // live count from icecast source.listeners
  djComment?: string;         // KEXP plays.comment (RIP / show notes)
}
```

### `StreamLocation`

```ts
interface StreamLocation {
  city: string;     // "Las Cruces", "Ciudad de México"
  region: string;   // "New Mexico", "Ciudad de México" (CDMX), "Jalisco"
  country: string;  // "USA", "México" (with accent), "global", "Ireland", etc.
}
```

`formatLocation()` collapses `city === region` to just the city (CDMX rendering).

---

## discovery

### `shuffleOnce` (src/lib/streams-order.ts)

Module-scope Fisher-Yates shuffle of all non-hidden STREAMS, run once per page load. Both `KruxPlayer` (feed page) and `PersistentPlayer` (bottom dock) import the same module instance and see the same per-session order.

After shuffle, **position 0 is guaranteed to come from the curated subset** (Bryan's known-good list — currently `kexp`, `ksfr`, `aws_podcast`, `aws_bites`, `talking_serverless`, `onda_aws`). If at least one curated entry exists, a random one is swapped into position 0.

Per-station lookup uses `key`, not array index, so sessionStorage continuity survives the shuffle. Reload the page to reshuffle.

### why curated matters

- Position 0 is the user's first impression. We trust curated entries to play reliably and to be representative.
- Non-curated entries are still discoverable via skip — but only if the user knows to skip. Wave 22 added auto-advance on persistent failure (2s grace), so a broken station no longer traps the user.
- Future: a station-picker grid UI would reduce dependence on `curated` for discoverability.

---

## metadata extraction patterns

### icecast `status-json.xsl` (krux, ibero_909, radio_unam_961)

Standard Icecast stats endpoint. `source` may be a single object or array (multi-mount servers).

```ts
parseMeta(data) {
  const d = data as { icestats?: { source?: { title?: string } | Array<{ title?: string }> } };
  const src = d?.icestats?.source;
  const s = Array.isArray(src) ? src[0] : src;
  return s?.title ?? null;
}
```

`parseMetaRich` adds `listeners` count from `source.listeners`.

### NPR Composer widget (ksfr, kutx)

Each station has a widget id. Endpoint: `https://api.composer.nprstations.org/v1/widget/<id>/now?format=json`. Shape: `onNow.song.{trackName, artistName}` for tracks, `onNow.program.{name, program_link}` for talk shows / between-track airbreaks.

### Zeno.fm SSE (formerly radio_udg_lagos — now hidden)

Server-Sent Events at `https://api.zeno.fm/mounts/metadata/subscribe/<mount>`. EventSource API. Each event payload `{mount, streamTitle}`. `streamTitle` of `" - "` is treated as null (placeholder during DJ feeds).

**Note:** the Zeno mount `8hage4z92hhvv` started returning HTTP 401 on 2026-05-17. Mount expired/revoked. Station hidden until a working URL is found.

### Shoutcast `/stats?json=1` (concepto_radial)

CORS-blocked. `metaUrl` is omitted; `metaFallback` points at the station's own podcast catalog as a substitute affordance.

### RSS podcast feeds

`type: "podcast"` entries fetch `rssFeedUrl` at station-change. Latest episode `<item>` parsed for `<title>` + `<enclosure url>`. The enclosure URL becomes the audio src (overrides hardcoded `url` field). For CORS-blocked feeds (`rust_in_production`), build-time `public/data/podcast-episodes.json` is the fallback display string.

---

## frontend consumers

### `src/components/persistent-player/index.tsx`

The bottom-dock player. Single station at a time. Skip buttons advance forward/backward through the shuffled order.

State:
- `audioRef.current` — the bare `<audio>` element
- `streamHealth: "ok" | "retrying" | "failed"` — UI surfaces per state
- `nowPlaying` — current parseMeta string
- `rssAudioUrl` — overrides station.url when RSS-fetched enclosure differs

Health monitor effect:
- `error` / `stalled` events trigger a debounce (`STREAM_ERROR_THRESHOLD_MS = 5000`)
- After threshold, surface "retrying" state + fire one auto-retry per `fallbackUrls` entry (delay `STREAM_AUTO_RETRY_MS = 3000`)
- After exhausting retries, set `streamHealth = "failed"`
- (Wave 22) When `streamHealth === "failed"`, auto-skip via `onSkipStation(1)` after 2000ms grace + i18n label "station unavailable, advancing…"

`hasConnectedRef` ensures initial buffering events don't trigger the error UI — the timer only arms after the stream has fired `playing` or `canplaythrough` at least once.

### `src/sites/awsug/app.tsx` (Speakeasy)

Filters `STREAMS.filter((s) => !s.hidden)` for the visible list. Shows `player.stationLabel` + `visibleStreams.length` count.

### `src/pages/feed/` (KruxPlayer + episode viz)

Station carousel + audio-reactive visuals. Imports the same shuffled `STREAMS` instance. Audio band visuals (bass/mid/treble/flux/centroid) drive the dune scene + UI elements per `docs/design-system/audio-band-map.md`.

---

## CSP architecture

### the 1784-char hard limit

CloudFront response-headers-policy enforces a 1784-character ceiling on the `Content-Security-Policy` field. Exceeding the limit returns `TooLongCSPInResponseHeadersPolicy` from `update-response-headers-policy`.

Current main CSP: 1640 chars (post Wave 23 trim). 144-char headroom.

### per-subdomain CSP files

| file | distribution |
|---|---|
| `infra/cloudfront-security-headers.main.json` | clouddelnorte.org |
| `infra/cloudfront-security-headers.awsug.json` | awsug.clouddelnorte.org |
| `infra/cloudfront-security-headers.auth.json` | auth.clouddelnorte.org |
| `infra/cloudfront-security-headers.json` | (legacy / unused at distribution level) |

### sync mechanism

`scripts/sync-cloudfront-headers.sh <main\|auth\|awsug\|all>` reads the JSON file, fetches the live policy via `aws cloudfront get-response-headers-policy`, merges `SecurityHeadersConfig` + `CustomHeadersConfig`, then calls `update-response-headers-policy` with the ETag. Drift detection is built in.

Required env: `AWS_PROFILE=aerospaceug-admin`.

### connect-src vs media-src

- **connect-src** is for `fetch()` / `XMLHttpRequest` / `EventSource` — used by parseMeta endpoints, RSS feeds, Cognito auth, Twitch GraphQL, ipinfo, weather, etc.
- **media-src** is for `<audio>` / `<video>` element src URLs — used by stream URLs and podcast mp3 enclosures.

Adding a new station typically requires the station's host in **both** directives if the host serves both metadata + audio (icecast `status-json.xsl` + the audio mount).

### worked example: Radio UNAM 96.1 add (Wave 23)

- Stream URL `https://tv.radiohosting.online:9484/stream` (audio) + status-json.xsl (meta) → both at same host.
- Added `https://tv.radiohosting.online:9484` to connect-src + media-src in 3 JSON files (legacy + main + awsug).
- That alone would have pushed CSP from 1788 → 1833 chars (over limit).
- To free space: removed 4 dead origins from hidden stations (`api.zeno.fm`, `stream.zeno.fm`, `developers.podcast.go-aws.com`, `aws-podcast.s3.amazonaws.com`).
- Net: 1640 chars after trim. 144-char headroom.

### CSP for dev subdomain

dev.clouddelnorte.org has **no response-headers-policy attached**. App code runs without CSP enforcement there. This is intentional for staging/testing but means dev can't catch CSP regressions before they ship to production. Wave-25 candidate: attach a CSP to dev that mirrors main.

---

## build-time data pipeline

### `scripts/fetch-feeds.mjs`

Runs at build time. Fetches each non-hidden podcast `rssFeedUrl`, parses latest item `<title>` + `<itunes:subtitle>`, writes `public/data/podcast-episodes.json` keyed by station `key`:

```json
{
  "rustacean_station": {
    "title": "Hopp with Costa Alexoglou and Iason Paraskevopoulos",
    "subtitle": "Allen Wyma talks with Costa Alexoglou…",
    "display": "Hopp with Costa Alexoglou and Iason Paraskevopoulos — Allen Wyma talks with…"
  },
  …
}
```

### runtime fallback for CORS-blocked feeds

`useEffect` in PersistentPlayer fetches `/data/podcast-episodes.json` once on mount. When `streamDef.corsBlocked` is true OR the runtime RSS fetch throws, the cached `display` string is used instead. Audio plays from the hardcoded `url` field; only the title text is degraded.

### feeds.json (separate)

`public/data/feeds.json` is generated from `src/pages/feed/feeds-data.ts` for the feed page card grid. Always shows as transient dirty post-build — never commit it.

---

## stream health monitoring (Wave 23)

### `scripts/probe-stream-health.mjs`

Iterates STREAMS via lightweight regex parse of `streams.ts`, HEAD-checks each non-hidden URL with 8s timeout, reports:

```
probing 14 active streams (1 hidden) ...
  OK  200   kexp                           https://kexp.streamguys1.com/kexp160.aac
  OK  200   radio_unam_961                 https://tv.radiohosting.online:9484/stream
  …
  FAIL 400  krux                           https://kruxstream.nmsu.edu/KRUX
13/14 streams healthy
```

Exits non-zero on any failure.

### `.github/workflows/stream-health.yml`

Mondays 14:00 UTC cron + manual `workflow_dispatch`. On failure, opens an issue tagged `bug` + `stream-health` with a link to the run logs.

### known limitation: HEAD vs GET

Some Icecast servers (KRUX) reject HEAD requests with 400 — false-negative. Real test: `curl -X GET -r '0-1024' <url>` works fine. **Fix queued for Wave 24a:** switch the probe to ranged-GET.

---

## resilience patterns shipped (Waves 20–23)

| pattern | wave | location |
|---|---|---|
| localStorage draft (per-type, debounced 500ms) | 20 | `src/hooks/useFeedbackDraft.ts` |
| Detailed error mapping (429 / 5xx / TypeError / AbortError) | 20 | `src/components/feedback-form/index.tsx` |
| AbortSignal.timeout(15000) | 20 | feedback-form fetch |
| Auth-aware reporter labels | 20 | `infra/lambda/feedback/index.mjs` |
| Software-WebGL detection (skip Babylon on SwiftShader) | 21 | `src/lib/render-capability.ts` |
| Page Visibility API (pause render loop on hidden) | 21 | `src/hooks/usePageVisibility.ts` + scene bootstrappers |
| Auto-advance on persistent stream failure | 22 | `src/components/persistent-player/index.tsx` |
| CSP drift detection in deploy flow | 22 | `scripts/sync-cloudfront-headers.sh` |
| Synthetic stream-health monitoring (weekly cron) | 23 | `scripts/probe-stream-health.mjs` + `.github/workflows/stream-health.yml` |

---

## ops runbooks

- `docs/runbooks/csp-change.md` — CSP edit + sync procedure
- `docs/runbooks/deploy-manual.md` — deploy-manual.sh usage per subdomain
- `docs/runbooks/deploy-procedure.md` — full release flow
- `docs/runbooks/diagnostic-first.md` — diagnostic-before-dispatch discipline

---

## what's NOT here yet (Wave 24 candidates)

Per `docs/wave-24-design.md`:

- 3 new podcasts (Writing on the Wall, El Sonido by KEXP, The Fight for Our Existence)
- Loading state UI between Play and Stop (connecting/retrying/failed spinner with ARIA live region)
- Episode scroller with sort-to-oldest
- Transcript row for podcasts that publish them
- Offline downloads (IndexedDB) for signed-in users
- Speakeasy auto-download preferences
- Carousel of shorts on feed page
- Probe HEAD→GET fix
