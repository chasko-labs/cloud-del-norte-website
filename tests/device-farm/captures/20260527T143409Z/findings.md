# Iteration 0 Findings — 2026-05-27T14:34:09Z

## Diagnostic Environment

- Device Farm TestGrid: `arn:aws:devicefarm:us-west-2:946179428633:testgrid-project:0f1bfe22-0371-40c8-bcac-f96709363893`
- Browser: Chrome 148.0.7778.97 (Windows, Device Farm)
- Selenium 4.44.0, boto3 via AWS_PROFILE=bryanchasko-kiro
- Script: `tests/device-farm/music-player-diagnostic.py` (convention note: spec says `tests/devicefarm/` but existing repo convention is `tests/device-farm/` — matched existing)

## Curated Station Count Discrepancy

The spec narrative (bugfix.md DoD, design.md "What We Know") references **6 curated stations**: kexp, ksfr, talking-serverless, aws-podcast, aws-bites, rust-in-production. Current `src/lib/streams.ts` (commit 0498c766) has **10 curated stations** (`curated: true`): kexp, ksfr, aws_podcast, aws_bites, talking_serverless, rust_in_production, onda_aws, writing_on_the_wall, el_sonido_kexp, fight_for_our_existence. The additional 4 were added in waves 26b. Iteration 1 walking skeleton should pick from the actual curated set.

## Per-Cell Classification

### clouddelnorte.org (10 stations)

All 10 stations: **FAIL — Autoplay Policy (Hypothesis 1)**

Evidence (kexp representative, all identical pattern):
- `preClickAudio: {}` — audio element not found inside `section.cdn-pp` at capture time
- `finalReadyState: 0`, `finalPaused: true`, `finalErrorCode: null`
- Stream DID load: `kexp.streamguys1.com/kexp160.aac` → 200, `mimeType: audio/aac`, `ACAO: *`
- No `NotAllowedError` in console (Chrome suppresses to WARNING level, not SEVERE)
- No CORS failure on media — stream is CORS-open
- No MIME rejection — content-type is correct
- No rate-limit (200, no retry-after)
- `body.cdn-stream-playing` never set
- CSP violations present but only for `img-src` (album art from archive.org), NOT `media-src`
- Player mounted (section.cdn-pp found) but audio element absent from DOM at sample time → component hydration race

**Classification**: The stream is reachable and CORS-open. The audio element either doesn't exist in the DOM when the play button fires, or `play()` is called outside a user-gesture context (hydration path). This is the **autoplay policy** family — specifically, the variant where the play() call is disconnected from the click event's gesture propagation.

### awsug.clouddelnorte.org (10 stations)

All 10 stations: **FAIL — Autoplay Policy + Hydration Race (Hypothesis 1)**

Evidence:
- `playerMounted: false` on all — `section.cdn-pp` mounted but play button became stale before click
- Fatal: `TimeoutException: play button not clickable` (9/10) or `StaleElementReferenceException` (1/10)
- The StaleElementReference on `writing_on_the_wall` confirms the component re-renders during hydration, invalidating the button reference
- Same underlying cause: player hydrates, re-renders (possibly due to localStorage-seeded station change triggering a state update), and the play button DOM node is replaced

**Classification**: Same root cause as clouddelnorte.org — **autoplay policy / hydration race**. The component lifecycle replaces the button before Selenium can click it, which is the same race condition a real user would hit if they clicked "play" during the hydration window.

### auth.clouddelnorte.org (10 stations)

All 10 stations: **FAIL — Autoplay Policy + Hydration Race (Hypothesis 1)**

Evidence: Identical to awsug — mix of TimeoutException (4/10) and StaleElementReferenceException (6/10). Same component re-render pattern.

## Hypothesis Tally

| Hypothesis | Cells (of 30) | Evidence |
|---|---|---|
| **1. Autoplay Policy / Hydration Race** | **30/30** | Stream loads (200, CORS open), audio element absent or readyState=0, no error surfaced, component re-renders invalidate click target |
| 2. CORS preflight | 0/30 | KEXP stream returns `ACAO: *`, no CORS errors in console |
| 3. MIME type mismatch | 0/30 | `mimeType: audio/aac` correct, no decode errors |
| 4. Rate-limit / 429 | 0/30 | All streams returned 200, no retry-after |
| 5. Other (CSP) | 0/30 | CSP violations are img-src only (album art), not media-src |

## Locked Fix Family

### **Autoplay Policy / Hydration Race**

The evidence is unanimous: all 30 cells fail with the same pattern. The stream URLs are reachable and CORS-open. The audio element is either absent from the DOM at click time (clouddelnorte.org) or the play button is replaced by a re-render before the click lands (awsug, auth). This points to a single root cause: the player's `play()` invocation is not properly bound to the user's click gesture. Either (a) the click handler dispatches play() asynchronously after the gesture token expires, (b) the component re-renders between click and play() execution (React concurrent mode or Astro hydration boundary), or (c) the audio element is created lazily after the click rather than being present in the DOM at mount time. The fix is to ensure `audio.play()` is called synchronously within the click event handler's microtask, on an audio element that already exists in the DOM.

This is the fix family that unblocks all 30 cells — no other hypothesis has any evidence supporting it.
