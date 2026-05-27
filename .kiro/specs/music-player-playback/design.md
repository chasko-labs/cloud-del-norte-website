# design: music-player-playback

## Root Cause: awsug re-render race (LOCKED — Iteration 1 corrected probe)

The play button on `awsug.clouddelnorte.org` is mounted, located by Selenium, then its DOM node is replaced by an ancestor component re-render before the click resolves. This produces `StaleElementReferenceException` deterministically and prevents `audio.play()` from being invoked from a real user gesture. The defect is specific to the awsug page tree's render cadence — `clouddelnorte.org` does not reproduce.

The bug as originally written ("player does not play on production across all subdomains") was a coarse description. The corrected-probe Iteration 1 sweep narrowed it:
- `clouddelnorte.org`: passes (likely side-effect fix from PR #361 reachability probe correction).
- `awsug.clouddelnorte.org`: fails — re-render race.
- `auth.clouddelnorte.org`: out of scope — `body.cdn-auth-subdomain { display:none !important }` on `.cdn-player-slot` intentionally hides the player. The Selenium failure on auth is the probe locating a hidden element; not a defect.

Fix family is locked. Spike phase is over. Iteration 1 (in this revised framing) is the smallest viable awsug-only walking skeleton.

## What We Know

- All 21 streams alive at source (PR #361 audit).
- CSP includes media-src, connect-src, img-src for all stream domains, podcast feeds, album art (PR #362 + d2a679c3).
- streams-reachability.ts corsBlocked→fail bug fixed (PR #361). **Frozen for this fix.**
- Curated pool non-empty: kexp, ksfr, talking-serverless, aws-podcast, aws-bites, rust-in-production (plus 4 wave-26b additions).
- WebGL context exhaustion was a Fiona symptom, not a player symptom — separate code path.

### Iteration 0 captures (probe was defective — see Iteration 1 corrected results below)

- Iteration 0 (2026-05-27) reported `30/30 fail — autoplay policy / hydration race`. Evidence later invalidated — `AUDIO_STATE_JS` IIFE was missing the leading `return`, so `execute_script` propagated `undefined` and Python coerced it to `{}`. All Iteration 0 audio-state evidence (preClickAudio / samples / postClickAudio) was vacuous.
- The Iteration 0 click-attempt outcomes (TimeoutException / StaleElementReferenceException on awsug/auth) ARE real Selenium-level signals, unaffected by the probe defect.

### Iteration 1 corrected-probe captures (2026-05-27, commit f6d95b7b)

| Q | clouddelnorte.org | awsug.clouddelnorte.org | auth.clouddelnorte.org |
|---|-------------------|--------------------------|-------------------------|
| Q1 clicked? | **Yes** | **No** (StaleElementReferenceException) | **No** (StaleElementReferenceException — but player is intentionally hidden) |
| Q2 readyState | **4** | 0 | 0 |
| Q3 paused | **false** | true | true |
| Q4 audio.error | null | null | null |
| Q5 cdn-stream-playing | **Yes** | No | No |
| Q9 stream 200 | Yes | No | No |
| Verdict | **PASS** | **FAIL — re-render race** | **OUT OF SCOPE — hidden** |

- KEXP × clouddelnorte.org plays end-to-end on current production. No source change required there.
- KEXP × awsug fails with `StaleElementReferenceException` on the play button — the button's DOM node is located, then replaced before click resolves.
- KEXP × auth shows the same Selenium symptom, but the player is intentionally hidden on auth via `body.cdn-auth-subdomain { display:none !important }` on `.cdn-player-slot`. The probe is locating a `display:none` element; this is not a defect.

## What We Will Learn (next investigation step — code-mapping, not spike)

Spike phase is over. Next investigation step is static: identify which ancestor component on awsug pages triggers the re-render that stales the play button. Targets to inspect:

- `src/sites/awsug/` — page tree, layouts, providers.
- Any `AuthContext`, `useAuth`, auth-polling, or session-refresh effects active on awsug subdomain.
- `PendingApprovalBanner` or any component conditionally mounted/unmounted on awsug auth state changes.
- `useEffect` hooks in ancestors of `<PersistentPlayer />` that update state on a timer or auth event.

Output: ranked suspect list with `file:line`, no code changes. Drives Iteration 1 fix selection.

## Hypotheses (Locked — Iteration 1 corrected probe)

1. **LOCKED — H1: awsug re-render race.** An ancestor component on the awsug page tree (likely an auth-context provider, polling effect, or banner) updates state shortly after hydration and re-renders the subtree containing `<PersistentPlayer />`. The play button's DOM node is replaced. Selenium's locate-then-click sequence fails because the located element is no longer in the document. A real human click would also race this re-render but might survive it occasionally; Device Farm's reduced-motion / 2-core profile makes the race deterministically lose. **Evidence**: `clouddelnorte.org` (which has no equivalent ancestor re-render) passes; `awsug` fails with `StaleElementReferenceException` on every cell. Stream URL returns 200 + CORS `*`. No console autoplay/CORS/CSP errors.
2. ~~**RETIRED — Browser autoplay policy / hydration race**~~ — The autoplay-policy half was a broken-probe artifact (`AUDIO_STATE_JS` returned `undefined`, coerced to `{}`). The hydration-race half was directionally correct only as a coarse description and is replaced by the more specific re-render-race hypothesis above. The corrected probe shows no `NotAllowedError`, no autoplay-blocked symptom on any subdomain.
3. ~~**Ruled out: CORS preflight on Icecast/Shoutcast streams**~~ — KEXP stream returns `Access-Control-Allow-Origin: *`. No CORS errors in browser console. Stream loads successfully in performance log.
4. ~~**Ruled out: MIME type mismatch**~~ — `mimeType: audio/aac` is correct. No decode errors, no HAVE_NOTHING with network activity.
5. ~~**Ruled out: Rate-limited connection**~~ — All streams returned HTTP 200. No 429, no retry-after header.
6. ~~**Ruled out: CSP blocking media**~~ — CSP violations in console are `img-src` only (archive.org album art). No `media-src` or `connect-src` violations for stream URLs.

## Walking Skeleton

**Iteration 1 walking skeleton: KEXP × awsug.clouddelnorte.org only.**

Smallest end-to-end fix: KEXP plays on awsug with `audio.paused == false` and `readyState >= 2` within 5s of click. Once that's green in production, broadening (other curated stations on awsug) is a separate iteration. `clouddelnorte.org` already passes; do not re-target it. `auth.clouddelnorte.org` is hidden by design; do not re-target it.

## Architecture Touch Points (probable, narrow per re-render-race finding)

- `src/sites/awsug/**` — the awsug page tree, including its layout and any auth/banner components. **Primary suspect zone.**
- Any auth-context provider mounted on awsug: `AuthContext`, `useAuth`, session-polling effects, login-state subscribers.
- `PendingApprovalBanner` or equivalent — components that mount/unmount on auth-state transitions.
- The fix is a render-stability guard (e.g., gate the conditional state update behind a stable initial value, hoist the effect, memoize the subtree, or remove the unnecessary post-mount state churn). **The exact change depends on the code-mapper findings.**
- `src/components/persistent-player/index.tsx` — **DO NOT modify**. Player internals (audio element, play/pause/next handlers) are frozen for this fix.
- `src/lib/streams.ts`, `src/lib/streams-order.ts`, `src/lib/streams-reachability.ts` — **frozen.**
- `infra/cloudfront-security-headers.{main,awsug,auth}.json` — **not in suspect set.** No CSP changes.
- `tests/devicefarm/music-player-diagnostic.py` — existing harness, used for verification only.

## Out of Scope (frozen)

- Fiona, BabylonJS, WebGL budget.
- Footer, weather card, version color.
- streams-reachability.ts logic.
- CSP wildcard structure (no consolidation reversal).
- `src/components/persistent-player/**` — player internals not in scope for this fix.
- `auth.clouddelnorte.org` — player intentionally hidden via `body.cdn-auth-subdomain { display:none !important }` on `.cdn-player-slot`. If product later wants the player on auth, that is a new spec, not a defect.
- `clouddelnorte.org` — already passing; only verified for regression.

## Properties to Test

These are the regression and outcome guards. They do not predict the fix shape.

### Property 1: bug is reproducible on awsug (validates the defect exists)

```
Pre-fix: ∀ Device Farm Chrome run against awsug.clouddelnorte.org
WHEN initial page load + click play (KEXP curated initial)
THE Selenium capture SHALL record StaleElementReferenceException on the play button
OR audio.readyState SHALL remain 0 after 5s with paused == true
```

### Property 2: KEXP plays on awsug (walking skeleton outcome)

```
Post-Iteration-1: subdomain = awsug.clouddelnorte.org, station = kexp
WHEN page load + click play
THE audio.readyState SHALL reach >= 2 AND audio.paused SHALL become false within 5 seconds
AND body.cdn-stream-playing SHALL be set
AND no StaleElementReferenceException SHALL occur on the play button
```

### Property 3: clouddelnorte.org regression guard

```
Post-Iteration-1: subdomain = clouddelnorte.org, station = kexp
WHEN page load + click play
Property 2 SHALL hold (already passing pre-fix; must continue to pass post-fix)
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

### Property 6: regression — persistent-player internals unchanged

```
diff(src/components/persistent-player/**) SHALL be empty
```

## Open Questions

- Which specific component on the awsug page tree triggers the post-mount re-render that stales the play button? Code-mapper investigation pending.

## Iteration 0 Retrospective

What surprised: the Iteration 0 evidence was not what it claimed to be. The probe (`AUDIO_STATE_JS` IIFE) was missing the leading `return`, so `execute_script` propagated `undefined` and the Python capture coerced it to `{}`. The "30/30 fail" classification was a probe artifact, not a runtime fact.

What was salvageable: the Selenium-level click-attempt outcomes (TimeoutException / StaleElementReferenceException on awsug/auth) ARE real signals, unaffected by the JS probe defect. The corrected Iteration 1 probe confirmed `clouddelnorte.org` plays correctly and isolated the defect to `awsug` with re-render-race symptoms. The auth subdomain failure was reframed as out-of-scope once the intentional `display:none` on `.cdn-player-slot` was identified.

What feeds forward: never trust an `execute_script` capture without verifying the wrapper returns. Probe-correctness is a first-class iteration deliverable, not assumed infrastructure.

## Iteration 1 Retrospective

(See `tasks.md` Iteration 1 section for the corrected-probe retrospective shipped as commit f6d95b7b. The walking-skeleton TSX guard was never applied because `clouddelnorte.org` did not reproduce — fix family pivoted to awsug re-render race.)
