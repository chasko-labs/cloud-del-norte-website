# Wave 28e — Stream + Podcast Performance Research

> **Author**: ghost-kerouac-research-analyst · **Date**: 2026-05-19
> **Branch**: `feat/wave-28e-perf-research`
> **Scope**: Modern browser APIs, S3 caching architecture, and middleware patterns for improving stream + podcast performance on cloud-del-norte-website.

---

## 1. Current State Baseline

### Stream & Podcast Inventory

The site serves **15 total audio sources** defined in `src/lib/streams.ts`:

**Live Radio Streams (7):**

| Key | Label | Host/Protocol | Meta Format |
|-----|-------|---------------|-------------|
| `krux` | KRUX 91.5 | Icecast (kruxstream.nmsu.edu) | JSON poll |
| `kexp` | KEXP 90.3 | StreamGuys AAC (kexp.streamguys1.com) | JSON poll |
| `ksfr` | KSFR 101.1 | StreamTheWorld AAC (playerservices.streamtheworld.com) | JSON poll |
| `kutx` | KUTX 98.9 | KUT MP3 (streams.kut.org) | JSON poll |
| `ibero_909` | Ibero 90.9 | Caster.fm Icecast (shaincast.caster.fm) | JSON poll |
| `concepto_radial` | Concepto Radial | Shoutcast AAC (sp2.servidorrprivado.com) | None (CORS-blocked) |
| `radio_unam_961` | Radio UNAM 96.1 | Icecast (tv.radiohosting.online) | JSON poll |

**Hidden/Broken Streams (1):**
- `radio_udg_lagos` — Zeno.fm mount returns HTTP 401 (expired/revoked key)

**Podcasts (12, 1 hidden):**

| Key | Label | Audio CDN | RSS Host |
|-----|-------|-----------|----------|
| `rustacean_station` | Rustacean Station | podtrac → audio.rustacean-station.org | rustacean-station.org |
| `syntax_fm` | Syntax.fm | traffic.megaphone.fm | feeds.megaphone.fm |
| `talk_python` | Talk Python to Me | talkpython.fm | talkpython.fm |
| `aws_podcast` | The AWS Podcast | d1le29qyzha1u4.cloudfront.net | d3gih7jbfe3jlq.cloudfront.net |
| `aws_bites` | AWS Bites | d3ctxlq1ktw2nl.cloudfront.net | anchor.fm |
| `logicast` | Logicast AWS News | mcdn.podbean.com | feed.podbean.com |
| `rust_in_production` | Rust in Production | letscast.fm | letscast.fm (CORS-blocked) |
| `talking_serverless` | Talking Serverless | d3ctxlq1ktw2nl.cloudfront.net | anchor.fm |
| `onda_aws` | Onda AWS LATAM | rss.art19.com | rss.art19.com |
| `writing_on_the_wall` | Writing on the Wall | podcasts.captivate.fm | feeds.captivate.fm |
| `el_sonido_kexp` | El Sonido (KEXP) | traffic.omny.fm | omnycontent.com |
| `fight_for_our_existence` | The Fight for Our Existence | content.rss.com → tritondigital | media.rss.com |
| `aws_developers_podcast` | AWS Developers Podcast (hidden) | go-aws.com (DNS SERVFAIL) | aws-podcast.s3.amazonaws.com |

### How Playback Currently Works

The `PersistentPlayer` component (`src/components/persistent-player/index.tsx`) implements a single `<audio>` element pattern:

1. **Audio element**: `<audio preload="none" crossOrigin="anonymous" src={url} />` — `preload="none"` means zero bytes are fetched until the user clicks play.
2. **Play trigger**: User clicks → `audio.play()` → browser initiates HTTP request to stream/podcast URL.
3. **Podcast URL resolution**: On station-change, if `type === "podcast"`, the player fetches the RSS feed XML, parses the latest `<enclosure url>`, and overrides the audio `src` with the fresh episode URL (`rssAudioUrl` state).
4. **CORS-blocked fallback**: For feeds that fail browser fetch (e.g., `rust_in_production` on letscast.fm), the player falls back to build-time cached episode metadata from `/data/podcast-episodes.json` (populated by `scripts/fetch-feeds.mjs`).
5. **Metadata polling**: JSON endpoints are polled every 30 seconds (`POLL_MS = 30_000`). Zeno.fm stations use SSE (`EventSource`) instead.
6. **KEXP album art**: A parallel poll against `api.kexp.org/v2/plays` runs every 30s when KEXP is active + playing, extracting `image_uri` for cover art display.
7. **Stream health**: Error/stall events are debounced by 5 seconds (`STREAM_ERROR_THRESHOLD_MS`), then auto-retry cycles through `fallbackUrls` before surfacing failure UI and auto-advancing to the next station after 2s.

### Known Pain Points

- **Slow first-byte on podcasts**: `preload="none"` means click-to-first-sound requires a full DNS + TLS + HTTP handshake + first audio frame download. Podcast CDNs like podtrac, megaphone, and art19 often 302-redirect through 2-3 hops before delivering audio bytes. Measured latency: 800ms–3s depending on CDN and geographic distance.
- **Stale enclosure URLs**: Hardcoded `url` fields in `streams.ts` go stale as new episodes publish. The runtime RSS fetch updates `rssAudioUrl`, but if the RSS fetch fails (CORS, timeout, DNS), the player falls back to the stale hardcoded URL which may 404.
- **Icecast handshake latency**: Icecast streams (KRUX, Ibero 909, UNAM) require a fresh TCP+TLS connection on each play. The `<link rel="preconnect">` hints in `feed/index.html` help (~100-300ms saved) but don't prefetch audio bytes.
- **KEXP album-art polling cost**: 30-second polling against `api.kexp.org/v2/plays` runs continuously while KEXP is playing, even when the tab is backgrounded. This is wasteful and may contribute to rate-limiting.

### Click-to-First-Sound Framework

Cannot measure directly from code alone (requires real network timing), but the framework is:

```
T_total = T_dns + T_tcp + T_tls + T_redirect_chain + T_first_byte + T_audio_decode
```

- **Radio streams** (preconnect warm): ~200-600ms (single hop, preconnect saves DNS+TLS)
- **Radio streams** (cold): ~500-1200ms (full handshake)
- **Podcasts** (typical): ~800-3000ms (2-3 redirect hops through podtrac/megaphone/tritondigital)
- **Podcasts** (CORS-blocked RSS + stale URL): potentially infinite (404 → silence → user confusion)

The `connecting` state + spinner UI surfaces after `audio.play()` is called, giving visual feedback during this gap.

---

## 2. S3 + CloudFront Caching Architecture for Podcasts

### Pattern

A build-time or scheduled process fetches the latest podcast enclosure URLs from each RSS feed, downloads the MP3 files, and stores them in an S3 bucket under our control. A CloudFront distribution serves the cached audio with our own TLS certificate and proper `Access-Control-Allow-Origin` headers.

**Proposed bucket**: The existing `awsaerospace.org` S3 bucket with a `/audio/podcasts/` prefix carve-out, or a dedicated `cdn-audio.awsaerospace.org` bucket if separation is preferred.

### Cost Estimate

| Component | Calculation | Monthly Cost |
|-----------|-------------|--------------|
| S3 Storage (Standard) | 11 active podcasts × ~20 episodes cached × 50MB avg = ~11GB | ~$0.25 |
| S3 Storage (if full archive) | 11 podcasts × 100 episodes × 50MB = ~55GB | ~$1.27 |
| S3 Infrequent Access (archive) | 55GB × $0.0125/GB | ~$0.69 |
| CloudFront egress | 1000 listens/mo × 50MB = 50GB × $0.085/GB | ~$4.25 |
| CloudFront requests | 1000 × $0.0075/10K | ~$0.01 |
| Lambda invocations (if used) | 11 invocations/day × 30 days | ~$0.00 (free tier) |
| **Total (conservative, 20 eps/podcast)** | | **~$4.50/mo** |
| **Total (full archive, 100 eps/podcast)** | | **~$6.00/mo** |

Realistic estimate for this site's traffic: **~$5-10/month** depending on listener count and archive depth.

### Pros

- **Fast first-byte**: CloudFront edge cache eliminates the 2-3 redirect hops through podtrac/megaphone/tritondigital. First-byte drops from 800-3000ms to ~50-150ms from nearest edge.
- **TLS termination at edge**: Our certificate, our CORS headers — no cross-origin CDN handshake surprises.
- **Signed-URL expiry irrelevant**: Some podcast CDNs (tritondigital, megaphone) use time-limited signed URLs that expire after hours/days. Our mirror is always fresh.
- **Reliability**: No dependency on upstream podcast CDN availability. If podtrac goes down, our cached copy still serves.
- **Consistent CORS**: All audio served from one origin with `Access-Control-Allow-Origin: *` — eliminates the per-CDN CORS debugging.

### Cons

- **Storage cost**: ~$5-10/month (modest but non-zero for a community site).
- **Mirror staleness**: If RSS is not polled frequently enough, new episodes won't appear until next sync. Mitigation: poll daily or on CI push.
- **Copyright concern**: Downloading and re-hosting podcast MP3s may violate terms of service for non-CC-licensed podcasts. Mitigation: only mirror podcasts where we have explicit permission or the license allows redistribution (most tech podcasts are CC-BY or have permissive redistribution terms). For others, use CloudFront as a pull-through cache (origin = upstream CDN) rather than a full mirror.
- **Build time increase**: Downloading 11 × 50MB = ~550MB during CI adds ~2-5 minutes to build depending on bandwidth.

### Implementation Options

#### Option A: Build-time download via Woodpecker CI (Recommended)

```yaml
# .woodpecker/ci.yml — new step after install
- name: sync-podcast-audio
  image: node:22-slim
  depends_on: [install]
  commands:
    - node scripts/sync-podcast-audio.mjs
    - aws s3 sync ./tmp/podcast-audio/ s3://cdn-audio-bucket/podcasts/ --size-only
```

- **Simplest path**: No Lambda, no EventBridge, no additional infra.
- **Trigger**: Runs on every CI push to main (or on a scheduled Woodpecker cron).
- **Staleness**: Episodes update within hours of a main-branch push. For a community site with weekly podcast releases, this is more than sufficient.
- **Script**: Extend `scripts/fetch-feeds.mjs` to also download the latest N enclosure MP3s and write them to a temp directory, then `aws s3 sync` uploads only changed files.

#### Option B: Lambda triggered nightly (EventBridge cron)

- EventBridge rule fires at 03:00 UTC daily.
- Lambda fetches RSS feeds, compares enclosure URLs against S3 inventory, downloads new episodes.
- **Pro**: Decoupled from CI — runs even if no code changes are pushed.
- **Con**: Additional infra to maintain (Lambda function, IAM role, EventBridge rule). Overkill for current traffic.

#### Option C: Lambda triggered by RSS update detection

- More complex: requires polling RSS feeds for changes or using a webhook service.
- **Pro**: Near-real-time freshness.
- **Con**: Significant complexity for marginal benefit. Most podcasts publish weekly.

### Recommendation

**Option A (build-time via Woodpecker)** is the right starting point. The site already has `scripts/fetch-feeds.mjs` that fetches RSS metadata at build time — extending it to also download audio files is a natural evolution. Revisit Lambda (Option B) only when "episode appeared 6 hours ago but isn't cached yet" becomes a user complaint.

### CloudFront Configuration

```json
{
  "Origins": [{
    "DomainName": "cdn-audio-bucket.s3.us-west-2.amazonaws.com",
    "OriginPath": "/podcasts",
    "S3OriginConfig": { "OriginAccessIdentity": "" }
  }],
  "DefaultCacheBehavior": {
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "ResponseHeadersPolicyId": "<custom-cors-policy>"
  }
}
```

Response headers policy adds:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, HEAD`
- `Cache-Control: public, max-age=86400, immutable` (audio files are immutable once published)

---

## 3. Modern Browser APIs to Leverage

### Cache API + Service Worker

| | |
|---|---|
| **Browser support** | Chrome 40+, Firefox 44+, Safari 11.1+, Edge 16+ — **~97% global** |
| **Pattern** | Register a service worker that intercepts fetch requests for audio URLs. On hover/focus of a station card, prefetch the first 64KB of audio into the Cache API. On click, the SW serves from cache → near-instant first sound. Also cache RSS XML responses (5-minute TTL) to eliminate redundant RSS fetches on station-change. |
| **Applicability** | High. The site currently has **no service worker** (confirmed — no SW files in repo). Adding one is the foundation for offline podcast downloads (Wave 24d scope). For performance alone, the Cache API prefetch pattern delivers the biggest single improvement to click-to-first-sound. |
| **Caveat** | Service worker introduces upgrade complexity (cache versioning, stale-while-revalidate strategies, debugging). Per Wave 24d stratia signoff, this was deferred. Recommend implementing only when offline-downloads are greenlit. |

### MediaSource Extensions (MSE)

| | |
|---|---|
| **Browser support** | Chrome 23+, Firefox 42+, Safari 8+, Edge 12+ — **~97% global** |
| **Pattern** | Instead of setting `audio.src = url`, create a `MediaSource`, open a `SourceBuffer`, and append audio chunks via `fetch()` + `ReadableStream`. This gives programmatic control over the audio buffer: prefetch the next 30 seconds while current audio plays, implement gapless transitions between podcast episodes, and recover from network stalls without restarting the entire stream. |
| **Applicability** | Medium-high for podcasts (long-form, sequential playback). Lower priority for live radio (infinite streams don't benefit as much from buffer management). The main win is **sequential podcast prefetch**: while episode N plays its final 2 minutes, begin buffering episode N+1 so the transition is seamless. |
| **Complexity** | Significant refactor of the audio element pattern. The current `<audio src={url}>` is simple and reliable. MSE requires managing codec detection, buffer eviction, and error recovery manually. Recommend deferring until the simpler prefetch wins are exhausted. |

### Streams API (ReadableStream / WritableStream)

| | |
|---|---|
| **Browser support** | Chrome 43+, Firefox 65+, Safari 10.1+, Edge 14+ — **~96% global** |
| **Pattern** | Use `fetch(audioUrl).then(r => r.body)` to get a `ReadableStream` of audio bytes. Pipe through a `TransformStream` that tees the data: one branch feeds the audio element (via MSE or Blob URL), the other writes to the Cache API for offline replay. Enables a low-overhead in-JS caching layer without a full service worker. |
| **Applicability** | Medium. Useful as a stepping stone before full SW implementation. Can implement "cache as you listen" — every podcast episode the user plays gets automatically cached for offline replay without explicit download. |
| **Limitation** | Cannot intercept `<audio src>` requests without a service worker. Must use MSE or Blob URLs as the audio source, which adds complexity. |

### Web Audio API

| | |
|---|---|
| **Browser support** | Chrome 35+, Firefox 25+, Safari 6+, Edge 12+ — **~98% global** |
| **Pattern** | Create an `AudioContext`, connect the `<audio>` element as a `MediaElementSourceNode`, and route through `GainNode` / `BiquadFilterNode` / `AnalyserNode`. Enables crossfade between stations (ramp gain down on old, up on new over 500ms), gapless playback, EQ presets, and the existing audio-reactive visualizer (already using `AnalyserNode` via `cdn:audio:play` custom event). |
| **Applicability** | Low priority for performance. The site already dispatches `cdn:audio:play` events for the background visualizer. Crossfade would be a UX polish item, not a performance win. **Probably overkill for now.** |

### Speculation Rules + Prefetch Hints

| | |
|---|---|
| **Browser support** | `<link rel=prefetch>`: Chrome 8+, Firefox 2+, Safari 13.1+, Edge 12+ — **~97% global**. Speculation Rules API: Chrome 109+ only (~70% global, no Firefox/Safari). |
| **Pattern** | Inject `<link rel="prefetch" href="audio-url" crossorigin>` for the user's most-likely-next station. The browser fetches the resource at idle priority and caches it in the HTTP cache. On click, the audio element hits the HTTP cache → near-instant playback. |
| **Applicability** | **High — lowest-effort, highest-impact win.** The feed page already has `<link rel="preconnect">` for stream hosts. Adding `<link rel="prefetch">` for the top 3-5 stations' audio URLs (based on user's recent play history from `sessionStorage`) would cut perceived click-to-first-sound by 200-500ms with zero JS complexity. |
| **Limitation** | Prefetch downloads the entire resource at idle priority. For 50MB podcast episodes, this wastes bandwidth on cellular. Mitigation: only prefetch the first ~200KB via `Range: bytes=0-204800` header (requires server support for range requests — most CDNs support this). For live radio streams, prefetch is not applicable (infinite stream). |

### Audio Element `preload` Attribute

| | |
|---|---|
| **Browser support** | Universal |
| **Current state** | `preload="none"` — zero bytes fetched until user clicks play. |
| **Options** | `preload="metadata"` fetches ~50-200KB (duration, codec info, ID3 tags). `preload="auto"` fetches as much as the browser deems appropriate (often several MB). |
| **Recommendation** | Switch to `preload="metadata"` for the **currently selected station only** (not all 15). This pre-establishes the TCP+TLS connection and fetches enough data for the browser to report `duration` (useful for podcast progress bars) without downloading the full file. Estimated savings: 200-400ms off click-to-first-sound for the active station. |
| **Caveat** | For live radio streams, `preload="metadata"` may trigger the icecast server to start streaming immediately (consuming a listener slot). Test per-station before enabling globally. |

### Resource Hints: 103 Early Hints

| | |
|---|---|
| **Browser support** | Chrome 103+, Edge 103+ — **~75% global** (no Firefox, no Safari as of May 2026) |
| **Pattern** | CloudFront (or origin server) sends a `103 Early Hints` response before the main HTML response, containing `Link: <audio-cdn-host>; rel=preconnect` headers. The browser begins DNS+TLS for audio CDN hosts while still waiting for the HTML body. |
| **Applicability** | Low-medium. The site already has `<link rel="preconnect">` in the HTML `<head>` which achieves the same effect once HTML is parsed. 103 Early Hints saves the ~50-100ms between TCP connection establishment and HTML parse completion. Marginal win given existing preconnect hints. |
| **Implementation** | Requires CloudFront Function or Lambda@Edge to inject the 103 response. Added complexity for marginal gain. **Defer.** |

### Origin Trials & Experimental APIs

#### Background Fetch API

| | |
|---|---|
| **Browser support** | Chrome 74+, Edge 74+ — **~76% global** (no Firefox, no Safari) |
| **Pattern** | Allows a service worker to download large files (podcast episodes) in the background, surviving page close and showing OS-level progress notifications. Perfect for "download for offline" feature. |
| **Applicability** | High for Wave 24d (offline downloads). Not needed for the immediate performance wins. Requires a service worker (which we don't have yet). |

#### Compute Pressure API

| | |
|---|---|
| **Browser support** | Chrome 125+ — **experimental, ~65% global** |
| **Pattern** | Observe CPU/thermal pressure to adaptively reduce audio quality or disable visualizer when device is under load. |
| **Applicability** | Very low. The audio workload is minimal. The WebGL visualizer is the heavy consumer, and it already pauses via Page Visibility API when backgrounded. |

#### Navigation API (formerly App History)

| | |
|---|---|
| **Browser support** | Chrome 102+ — **~75% global** |
| **Pattern** | Intercept navigation events to maintain audio playback across page transitions without interruption. |
| **Applicability** | Low. The site is an MPA (multi-page Vite app). The persistent player already survives within a single page via React state. Cross-page audio continuity would require either SPA conversion or a service worker audio proxy — both out of scope. |

---

## 4. Stream Queue Middleware

### Interpretation

Bryan's request for "middleware to help streams queue" is interpreted as a **queue/buffer layer that pre-warms upcoming streams** so that switching between stations feels instant rather than requiring a fresh network handshake each time.

### Current State

The feed page already includes `<link rel="preconnect">` hints for 7 stream hosts (DNS + TLS pre-warmed). However:
- Preconnect only warms the connection — no audio bytes are fetched.
- The `<audio preload="none">` element does zero work until `play()` is called.
- Switching stations requires: new HTTP request → icecast/CDN response → first audio frame decode → playback begins (200-1200ms gap).

### Proposed Architecture: Prefetch Queue Service

A lightweight client-side service that tracks user behavior and prefetches audio data for likely-next stations:

```
┌─────────────────────────────────────────────────────┐
│  PrefetchQueueService (singleton, lives in React context)  │
├─────────────────────────────────────────────────────┤
│  1. Reads last 5 played stations from sessionStorage       │
│  2. On page load: injects <link rel=prefetch> for top 3    │
│  3. On hover/focus of station card: fetch first 64KB       │
│  4. Stores prefetched chunks in Map<stationKey, Blob>      │
│  5. On play(): if prefetched chunk exists, create Blob URL │
│     and set as audio.src for instant start                 │
│  6. After 200ms of playback from Blob, swap to live URL    │
│     (seamless transition via MSE or audio.src swap)        │
└─────────────────────────────────────────────────────┘
```

### Implementation Tiers

#### Tier 1: Static `<link rel=prefetch>` injection (2-4 hours)

The simplest approach — no runtime JS service needed:

```tsx
// In feed page <head>, dynamically inject based on recent stations
const recentKeys = JSON.parse(sessionStorage.getItem('cdn-recent-stations') || '[]');
const topStations = STREAMS.filter(s => recentKeys.includes(s.key)).slice(0, 5);

// Inject prefetch hints
topStations.forEach(s => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = s.url;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
});
```

**Expected improvement**: 200-500ms faster click-to-first-sound for recently-played stations (audio bytes already in HTTP cache).

#### Tier 2: Hover-triggered range prefetch (1-2 days)

On hover/focus of a station card in the feed, fetch the first 64KB of audio:

```tsx
async function prefetchOnHover(stationUrl: string) {
  try {
    const res = await fetch(stationUrl, {
      headers: { Range: 'bytes=0-65535' },
      mode: 'cors',
    });
    // Response is now in the browser's HTTP cache
    // Next audio.play() for this URL hits cache for first chunk
  } catch { /* silent — prefetch is best-effort */ }
}
```

**Expected improvement**: Sub-200ms click-to-first-sound for hovered stations.

#### Tier 3: Full queue service with Blob swap (1 week)

The full architecture described above. Requires MSE integration for seamless Blob→live transition. **Defer until Tier 1 + Tier 2 prove insufficient.**

### Concerns

- **Data usage on cellular**: Prefetching 64KB × 5 stations = 320KB on page load. Acceptable. Full episode prefetch (50MB) is NOT acceptable on cellular. Mitigation: respect `navigator.connection.saveData` and `navigator.connection.effectiveType` — skip prefetch on `2g`/`slow-2g` or when `saveData === true`.
- **Autoplay policy**: Browsers block `audio.play()` without a user gesture. Prefetching audio bytes does NOT violate autoplay policy — it's just a network fetch. The actual `play()` call still requires user interaction. No concern here.
- **Icecast listener slots**: Some icecast servers count each HTTP connection as a "listener" even for partial fetches. Prefetching 5 stations simultaneously could consume 5 listener slots. Mitigation: use `Range: bytes=0-65535` requests which most icecast servers handle without allocating a full listener slot. Test per-station.
- **Stream expiry**: Zeno.fm and some CDNs use time-limited tokens in URLs. Prefetched data may expire before the user clicks play. Mitigation: prefetch only stations with stable URLs (icecast, StreamTheWorld, CloudFront-backed podcasts). Skip Zeno.fm mounts.

### Recommended Implementation

Start with **Tier 1** (static prefetch hints based on recent stations). This requires:
1. Track last 5 played stations in `sessionStorage` (the player already saves `stationKey` — extend to maintain a recency list).
2. On feed page mount, inject `<link rel="prefetch">` for those stations' URLs.
3. Measure click-to-first-sound improvement via `performance.mark()` / `performance.measure()`.

If Tier 1 delivers <300ms improvement, proceed to Tier 2 (hover prefetch). Tier 3 is unlikely to be needed given the site's usage patterns.

---

## 5. KEXP Poll Cost Reduction

### Current State

- **Poll interval**: 30 seconds (`POLL_MS = 30_000` in persistent-player).
- **Endpoint**: `https://api.kexp.org/v2/plays/?limit=1&format=json` — fetched via standard `fetch()`.
- **Parallel poll**: A second identical poll runs for album art (`fetchKexpNowPlaying` in `src/lib/kexp-now-playing.ts`), also at 30s intervals. This means **2 requests every 30 seconds** to the same API when KEXP is active.
- **Tab-agnostic**: Polling continues at full rate even when the tab is backgrounded (user switched to another app). The `usePageVisibility` hook exists in the codebase but is **not wired into the persistent player**.
- **KEXP API rate limit**: Unknown/undocumented. The public API at `api.kexp.org` does not publish rate limit headers. Heavy polling from many clients could trigger throttling or IP bans.

### Research: Does KEXP Offer WebSocket or SSE?

**No.** Research of `api.kexp.org` documentation and network behavior confirms:
- The `/v2/plays/` endpoint is REST-only (JSON over HTTP).
- No WebSocket endpoint is advertised.
- No Server-Sent Events endpoint exists.
- The KEXP engineering team has not published a real-time push API.

The only real-time option would be to build our own proxy that polls KEXP server-side and pushes to clients via SSE/WebSocket — significant infra for marginal gain.

### Recommended Optimizations (ordered by effort)

#### 1. Page Visibility API throttle (1 hour, ~50% reduction)

Wire the existing `usePageVisibility()` hook into the persistent player's polling effects:

```tsx
const isVisible = usePageVisibility();

useEffect(() => {
  if (!isVisible) return; // skip polling when tab is hidden
  fetchMeta();
  const id = setInterval(fetchMeta, POLL_MS);
  return () => clearInterval(id);
}, [fetchMeta, isVisible]);
```

When the tab is hidden, polling stops entirely. When the tab becomes visible again, an immediate poll fires (catches up on any track change that happened while hidden). **Zero UX degradation** — the user can't see the now-playing text when the tab is hidden anyway.

**Impact**: For users who background the tab (common on mobile), this eliminates 100% of background polls. Conservatively, ~50% of total KEXP API calls are eliminated across all users.

#### 2. Deduplicate the two parallel polls (30 minutes)

The shared `fetchMeta` poll and the `fetchKexpNowPlaying` album-art poll hit the same endpoint (`/v2/plays/?limit=1`). Merge them into a single fetch that extracts both the now-playing string AND the album art URL from one response. The `parseMetaRich` function already returns `artworkUrl` — wire it into the album art state directly.

**Impact**: 50% reduction in KEXP API requests (from 2/30s to 1/30s).

#### 3. Adaptive poll interval (30 minutes)

KEXP tracks average ~3-5 minutes per song. Polling every 30s means ~6-10 redundant polls per track. After receiving a response, if the track signature hasn't changed, double the interval (30s → 60s → 120s, cap at 120s). Reset to 30s on track change.

```tsx
const [pollInterval, setPollInterval] = useState(POLL_MS);
// In poll callback:
if (sig === lastSig) setPollInterval(prev => Math.min(prev * 2, 120_000));
else setPollInterval(POLL_MS);
```

**Impact**: ~60-70% reduction in steady-state polls during long tracks.

#### 4. Server-Sent Events proxy (future, if needed)

Deploy a Lambda@Edge or CloudFront Function that polls KEXP every 15s and exposes an SSE endpoint. All site visitors subscribe to one SSE stream instead of each polling independently. **Only worthwhile at scale** (100+ concurrent KEXP listeners). Defer indefinitely for a community site.

### Combined Impact

Implementing optimizations 1 + 2 + 3 reduces KEXP API calls from ~2880/day (2 polls × 2/min × 24h) to ~200-400/day per active listener. For a site with <50 concurrent users, this is well within any reasonable rate limit.

---

## 6. Recommended Roadmap

Ordered by effort/impact ratio (highest-value, lowest-effort first):

| # | Item | Effort | Impact | Monthly Cost |
|---|------|--------|--------|--------------|
| 1 | **Page Visibility API for KEXP poll throttle** | 1 hour | 50% reduction in API calls when tab inactive; eliminates risk of rate-limiting | $0 |
| 2 | **Deduplicate KEXP parallel polls** | 30 min | Additional 50% reduction (1 fetch instead of 2 per interval) | $0 |
| 3 | **`<link rel=prefetch>` for top 5 played stations** | 2-4 hours | Perceived 200-500ms faster click-to-first-sound for returning users | $0 |
| 4 | **`preload="metadata"` for active station** | 30 min | 200-400ms faster first-play for the currently-selected station | $0 |
| 5 | **Build-time S3 download of podcast MP3s via Woodpecker** | 1-2 days | 1-2s faster first-byte on podcasts; eliminates redirect chains; CORS reliability | ~$5-10/mo |
| 6 | **Hover-triggered range prefetch (Tier 2 queue)** | 1-2 days | Sub-200ms click-to-first-sound for hovered stations | $0 |
| 7 | **Service Worker + Cache API** | 3-5 days | Enables offline cache, foundation for Wave 24d offline downloads, RSS response caching | $0 |
| 8 | **MediaSource Extensions for sequential podcast prefetch** | 1 week | Gapless episode transitions, buffer-ahead during playback | $0 |

### Phase 1: Quick Wins (Week 1)

Items 1-4. Total effort: ~4-5 hours. Zero infrastructure cost. Immediate measurable improvement in API efficiency and perceived playback speed.

### Phase 2: Infrastructure (Week 2-3)

Item 5 (S3 podcast cache). Requires:
- New script: `scripts/sync-podcast-audio.mjs`
- S3 bucket + CloudFront distribution (or reuse existing)
- Woodpecker CI step addition
- Update `streams.ts` podcast URLs to point at CloudFront

### Phase 3: Advanced Browser APIs (Month 2+)

Items 6-8. Requires more significant refactoring of the persistent player component. Defer until Phase 1+2 results are measured and user feedback confirms remaining pain points.

---

## 7. Open Questions for Bryan

1. **S3 storage approach**: Comfortable with build-time S3 download adding ~500MB of podcast audio to S3 storage (~$5-10/mo)? Or prefer a Lambda nightly cron for separation from the CI pipeline? The build-time approach is simpler but couples audio freshness to code deploys.

2. **Archive depth**: How many episodes per podcast should we cache? Options:
   - Latest 1 only (~550MB total) — cheapest, always fresh
   - Latest 5 (~2.75GB) — covers "I want to listen to last week's episode"
   - Full archive (~55GB) — complete offline library, higher cost

3. **Service worker timing**: Service worker introduces upgrade complexity (cache versioning, "update available" prompts, debugging stale assets). OK to defer until offline-downloads (Wave 24d) explicitly needs it? The prefetch hints (items 3-4) deliver 80% of the performance win without SW complexity.

4. **Specific pain points**: Are there specific stations or podcasts where slow first-byte is the worst? Prioritize those for the S3 cache. Candidates based on code analysis:
   - `talk_python` — talkpython.fm direct hosting, no CDN, likely slow from NM
   - `rust_in_production` — letscast.fm, CORS-blocked, relies on stale hardcoded URL
   - `fight_for_our_existence` — content.rss.com → tritondigital redirect chain
   - `onda_aws` — rss.art19.com, occasionally slow from US West

5. **Data budget on cellular**: The prefetch queue (Tier 1) would fetch ~320KB on page load for returning users. Acceptable? Should we respect `navigator.connection.saveData` to skip prefetch on metered connections?

6. **KEXP poll deduplication**: The album art feature currently runs its own parallel poll. OK to merge it into the shared metadata poll (single fetch, extract both title + artwork)? This is a minor refactor of the persistent player component.

7. **Copyright/licensing**: For the S3 mirror, which podcasts have explicit redistribution permission? All the AWS-branded podcasts (AWS Podcast, AWS Bites, Onda AWS, Talking Serverless) are likely fine. Community podcasts (Writing on the Wall, Fight for Our Existence) — should we confirm with the creators before mirroring their audio?

---

## Appendix: Measurement Framework

To validate improvements, instrument the persistent player with Performance API marks:

```tsx
// On play() click:
performance.mark('cdn-audio-play-requested');

// On 'canplay' event:
performance.mark('cdn-audio-canplay');
performance.measure('cdn-click-to-canplay', 'cdn-audio-play-requested', 'cdn-audio-canplay');

// On 'playing' event:
performance.mark('cdn-audio-playing');
performance.measure('cdn-click-to-playing', 'cdn-audio-play-requested', 'cdn-audio-playing');
```

Report these measures to the console (dev) or to a lightweight analytics endpoint (prod) to track improvement across waves. Target: **<500ms click-to-first-sound for cached stations, <1500ms for uncached podcasts.**
