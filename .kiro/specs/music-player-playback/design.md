# design: music-player-playback

## Root Cause: UNKNOWN — diagnostic-first

PRs #361 and #362 eliminated the static-analysis hypotheses. The bug surfaces only at runtime. Root cause requires live capture.

This design is deliberately incomplete. It commits to the smallest investigation that produces a fix path, not to a fix family chosen up front. The first iteration is a spike. The fix family is locked only after the spike returns evidence.

## What We Know

- All 21 streams alive at source (PR #361 audit).
- CSP includes media-src, connect-src, img-src for all stream domains, podcast feeds, album art (PR #362 + d2a679c3).
- streams-reachability.ts corsBlocked→fail bug fixed (PR #361).
- Curated pool non-empty: kexp, ksfr, talking-serverless, aws-podcast, aws-bites, rust-in-production.
- WebGL context exhaustion was a Fiona symptom, not a player symptom — separate code path.
- **Iteration 0 capture (2026-05-27)**: kexp stream on clouddelnorte.org returns HTTP 200, `mimeType: audio/aac`, `Access-Control-Allow-Origin: *` — stream is reachable and CORS-open from Device Farm Chrome 148.
- **Iteration 0 capture**: `preClickAudio: {}` on clouddelnorte.org — audio element not present in `section.cdn-pp` DOM at the time the play button is clicked. `readyState` stays 0 for the full 8s sample window.
- **Iteration 0 capture**: On awsug/auth subdomains, play button becomes stale (StaleElementReferenceException) or times out — component re-renders during hydration, replacing the button DOM node before click lands.
- **Iteration 0 capture**: No `NotAllowedError` in console, no CORS errors on media, no MIME rejection, no 429/rate-limit. CSP violations are img-src only (archive.org album art), not media-src.
- **Iteration 0 capture**: 10 curated stations (not 6 as spec narrative states) — onda_aws, writing_on_the_wall, el_sonido_kexp, fight_for_our_existence added in waves 26b.
- **Iteration 0 capture**: All 30 cells (10 stations × 3 subdomains) fail identically — the defect is uniform, not per-station.

## What We Will Learn (Iteration 0 spike)

Per curated station, on production:

- audio element state on click: readyState, networkState, error.code, error.message
- console output (all levels) including any autoplay-policy messages
- network HAR for the stream URL and any preflight
- body class state including body.cdn-stream-playing presence
- whether the same station succeeds OR fails identically across all three subdomains

## Hypotheses (Ranked — Locked after Iteration 0)

1. **LOCKED: Browser autoplay policy / hydration race** — The audio element is either absent from the DOM at click time, or play() is called outside the user gesture's microtask window. Chrome silently rejects the play() promise without surfacing NotAllowedError when the gesture token has expired. Component re-renders (Astro hydration or React state update from localStorage seed) replace the audio element or button between mount and click. **Evidence**: all 30 cells show readyState=0, audio element absent, stream reachable (200, CORS open), no error surfaced. StaleElementReferenceException on awsug/auth confirms DOM replacement during hydration.
2. ~~**Ruled out: CORS preflight on Icecast/Shoutcast streams**~~ — KEXP stream returns `Access-Control-Allow-Origin: *`. No CORS errors in browser console. Stream loads successfully in performance log.
3. ~~**Ruled out: MIME type mismatch**~~ — `mimeType: audio/aac` is correct. No decode errors, no HAVE_NOTHING with network activity.
4. ~~**Ruled out: Rate-limited connection**~~ — All streams returned HTTP 200. No 429, no retry-after header.
5. ~~**Ruled out: CSP blocking media**~~ — CSP violations in console are `img-src` only (archive.org album art). No `media-src` or `connect-src` violations for stream URLs.

## Walking Skeleton

Smallest end-to-end fix: ONE curated station playing on ONE subdomain. Once that's green in production, broaden to all six stations on all three subdomains. Don't ship a 6-station fix that breaks one of them — ship the one-station fix, then broaden.

## Architecture Touch Points (probable, narrow per finding)

- `src/components/persistent-player/index.tsx` — main player, audio element, play/pause/next handlers.
- `src/lib/streams.ts` — stream definitions, MIME hints if added.
- `src/lib/streams-order.ts` — curated rotation.
- `src/lib/streams-reachability.ts` — DO NOT change reachability semantics in this fix.
- `infra/cloudfront-security-headers.{main,awsug,auth}.json` — CSP, only if spike says CSP block on a specific domain.
- `tests/devicefarm/music-player.spec.py` — new Selenium spec, lives in repo for replay.

## Out of Scope (frozen)

- Fiona, BabylonJS, WebGL budget.
- Footer, weather card, version color.
- streams-reachability.ts logic.
- CSP wildcard structure (no consolidation reversal).

## Properties to Test

These are the regression and outcome guards. They do not predict the fix shape.

### Property 1: bug is reproducible (validates the defect exists)

```
Pre-fix: ∀ browser ∈ {Device Farm Chrome}, ∀ station ∈ curated
WHEN initial page load + click play
THE Selenium capture SHALL record at least one symptom from {NotAllowedError, CORS error, MIME error, network error, audio.error.code != null, audio.readyState == 0 after 5s}
```

### Property 2: at least one station plays (walking skeleton outcome)

```
Post-Iteration-1: ∃ station ∈ curated, ∃ subdomain ∈ {clouddelnorte.org, awsug, auth}
WHEN page load + click play
THE audio.readyState SHALL reach >= 2 AND audio.paused SHALL become false within 5 seconds
AND body.cdn-stream-playing SHALL be set
```

### Property 3: all curated stations play, all subdomains (full DoD outcome)

```
Post-final: ∀ station ∈ curated, ∀ subdomain
WHEN page load + click play
Property 2 SHALL hold
OR the failing station has an issue filed with reproduction and is excluded from curated for now
```

### Property 4: regression — Fiona unaffected

```
Fiona screenshot SHALL match PR #360 baseline within visual-diff tolerance
```

### Property 5: regression — CSP unchanged or strictly narrower

```
diff(cloudfront-security-headers.*.json before/after) SHALL contain no widening
AND CSP header total length SHALL remain ≤ 1783 characters
```

## Open Questions

None blocking. Spike answers everything before fix selection.

## Iteration 0 Retrospective

What surprised: the defect is not a network/CORS/CSP issue at all — the stream loads successfully with a 200 and CORS `*`. The audio element simply isn't in the DOM when the play button fires, or the component re-renders (hydration boundary) between mount and click, replacing the button and audio nodes. This is a pure client-side lifecycle bug, not a transport bug. The uniformity across all 30 cells (10 stations × 3 subdomains) means a single narrow fix in the player's click→play() path will unblock everything. The smallest viable Iteration 1 fix: ensure the `<audio>` element exists in the DOM at mount time (not lazily created), and that the play button's click handler calls `audio.play()` synchronously within the event handler microtask — no awaiting state updates, no re-render between click and play(). Watch in Iteration 1 verification: confirm `readyState >= 2` within 5s on at least one station, and confirm the StaleElementReference pattern disappears (button stable across hydration).
