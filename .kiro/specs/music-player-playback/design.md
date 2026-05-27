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

## What We Will Learn (Iteration 0 spike)

Per curated station, on production:

- audio element state on click: readyState, networkState, error.code, error.message
- console output (all levels) including any autoplay-policy messages
- network HAR for the stream URL and any preflight
- body class state including body.cdn-stream-playing presence
- whether the same station succeeds OR fails identically across all three subdomains

## Hypotheses (Ranked, NOT Locked)

1. **Browser autoplay policy** — Chrome blocks audio.play() without fresh user gesture. Symptom: silent fail OR NotAllowedError DOMException.
2. **CORS preflight on Icecast/Shoutcast streams** — server CORS conflicts with HTML5 audio CORS handling. Symptom: stream loads but won't decode.
3. **MIME type mismatch** — audio element rejects unknown content-type. Symptom: HAVE_NOTHING readyState, no progress events.
4. **Rate-limited connection** — KEXP-class streams may rate-limit. Symptom: 429 or connection reset.
5. **Other** — anything the spike surfaces that isn't above.

These are starting points for the spike, not a decision tree to march down without evidence.

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
