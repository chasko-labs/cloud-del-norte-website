# bugfix: music-player-playback

## Context

After PR #360, #361, and #362 (Fiona stability, streams audit, CSP consolidation, WebGL budget), the persistent music player still does not play KEXP or several other curated streams when the user clicks play. No code-level bug has been identified. CSP headers on CloudFront include all stream domains. All 21 streams were audited as alive at source. The defect surfaces only at production runtime.

## Current Behavior (Defect)

```
WHEN a user opens https://clouddelnorte.org and clicks play on the persistent music player while the curated initial station (KEXP) is selected
THEN the audio element does not transition to a playing state and no audible output begins

WHEN a user clicks "next" to rotate through curated stations
THEN at least one curated station fails to begin playing — identical symptom

WHEN the same stream URLs are played in a separate browser tab outside the app
THEN those streams do play, confirming the defect is in-app, not at source
```

## Expected Behavior (Correct)

```
WHEN a user clicks play on a curated station
THE SYSTEM SHALL transition the audio element to a playing state within 5 seconds, begin audible output, and set body.cdn-stream-playing

WHEN a curated station fails reachability or returns a media error
THE SYSTEM SHALL surface a user-visible error indicator and auto-skip via goNext() within the existing 3-skip cap

WHEN the user is on awsug.clouddelnorte.org or auth.clouddelnorte.org
THE SYSTEM SHALL play streams identically — the player is shared across subdomains via the same chunk
```

## Unchanged Behavior (Regression Prevention)

```
WHEN PR #360 fixes are in effect
THE SYSTEM SHALL CONTINUE TO render Fiona smoothly with no scroll lag, dark mode toggle keeps Fiona, background shows dunes/stars/mountains

WHEN PR #362 WebGL budget is in effect (MAX_ACTIVE_SCENES = 2)
THE SYSTEM SHALL CONTINUE TO prevent "Too many active WebGL contexts" cascade

WHEN PR #361 streams + footer fixes are in effect
THE SYSTEM SHALL CONTINUE TO honor: curated:true on rust-in-production, corsBlocked→fail bug fix, footer version color readable, weather card compact layout, all 21 streams unhidden

WHEN a user navigates between subdomains
THE SYSTEM SHALL CONTINUE TO preserve player state per existing persistence model

WHEN a user is on a low-tier device (BabylonGate tier="medium" or below)
THE SYSTEM SHALL CONTINUE TO honor the WebGL gate; player playback is independent of WebGL state and SHALL function regardless

WHEN CSP is in effect (PR #362 consolidated wildcards, 1783-char limit)
THE SYSTEM SHALL CONTINUE TO load all stream domains; CSP SHALL NOT be re-widened during this fix
```

## Definition of Done

This bugfix is DONE when ALL of the following are true on production:

- [ ] At least one curated station plays end-to-end on all three subdomains, captured by Selenium with `audio.paused == false` and `readyState >= 2` within 5s of click.
- [ ] All six curated stations (kexp, ksfr, talking-serverless, aws-podcast, aws-bites, rust-in-production) play, OR each non-playing station has a documented per-stream defect filed as a separate issue with reproduction.
- [ ] Fiona screenshot diff against pre-fix baseline shows no regression (PR #360 baseline preserved).
- [ ] CSP header diff shows no widening; total length ≤ 1783 chars.
- [ ] No Bryan-tested verification — every step gated by Device Farm Selenium capture.
- [ ] PR merged through the standard chain (auditor → orin → deploy).
- [ ] Retrospective committed to spec: what hypothesis matched, what surprised, what feeds back into the streams architecture.

## Constraints

- Bryan does not test manually. All verification runs through Device Farm Selenium against production. TestGrid project: `arn:aws:devicefarm:us-west-2:946179428633:testgrid-project:0f1bfe22-0371-40c8-bcac-f96709363893`.
- Device Farm is Windows Chrome with 2 cores, reduced motion enabled. WebGL may not be available — BabylonGate tier="medium" blocks Fiona's 3D canvas there. Expected, not part of this bug.
- Fix must hold across clouddelnorte.org, awsug.clouddelnorte.org, auth.clouddelnorte.org.
- No CSP widening. If a stream domain is missing from CSP, document it and add only that domain.

## Out of Scope (Backlog Hygiene)

These belong in separate specs:

- Architectural overhaul of dual BabylonJS instance problem.
- Woodpecker deploy silent-failure (file as ops issue if not already filed).
- qrcode.react type error requiring `npm ci` first.

## Iteration 1 Findings — Corrected Probe (2026-05-27)

1. **Probe defect resolved.** The `return ` prepend on AUDIO_STATE_JS makes execute_script propagate the IIFE return value. Iteration 0 captures' `preClickAudio: {}` / `samples: [{}, ...]` artifacts were the result of `None or {}` Python coercion, not real audio-state measurements. The Iteration 0 `30/30 fail — autoplay policy / hydration race` classification was therefore not evidence-grounded.

2. **Iteration 1 baseline (KEXP × clouddelnorte.org), corrected probe:**

| Q# | Question | Result |
|----|----------|--------|
| Q1 | clicked == true? | **Yes** |
| Q2 | final readyState (0–4)? | **4** |
| Q3 | final paused (true/false)? | **false** |
| Q4 | final audio.error? | **null** |
| Q5 | 'cdn-stream-playing' in bodyClasses? | **Yes** (from sample 2 onward) |
| Q6 | blockedButtonPresent? | **No** |
| Q7 | preClickAudio.src empty/populated? | **empty** (src loaded on click) |
| Q8 | console mentions autoplay/NotAllowedError? | **No** |
| Q9 | kexp.streamguys1.com/kexp160.aac status 200? | **Yes** |

Verdict: **PASS**. KEXP plays successfully on current production code (commit at tip of `fix/awsug-rsvp-mount-wave-64`).

3. **(B) Hypothesis — side-effect fix.** The PO audited git log for player-touching commits between bug-report date and the Iteration 1 probe run. Five commits land in the window. PR #361 (reachability probe fix — corrected the corsBlocked→fail bug in streams-reachability.ts and unhid recovered streams) is the leading candidate to have side-effect-fixed clouddelnorte.org. The bug as originally described ("persistent music player does not transition to playing state on click for several curated stations on production") cannot reproduce on Device Farm Chrome 148 against current main on clouddelnorte.org.

4. **awsug.clouddelnorte.org / auth.clouddelnorte.org — corrected probe results:**

| Q# | awsug.clouddelnorte.org | auth.clouddelnorte.org |
|----|-------------------------|------------------------|
| Q1 | **false** (StaleElementReferenceException) | **false** (StaleElementReferenceException) |
| Q2 | 0 | 0 |
| Q3 | true | true |
| Q4 | null | null |
| Q5 | No | No |
| Q6 | No | No |
| Q7 | empty | empty |
| Q8 | No (CORS error on weather API only) | No |
| Q9 | No | No |

Per-cell verdicts: **awsug: FAIL — StaleElementReferenceException on play button (DOM/lifecycle)**. **auth: FAIL — StaleElementReferenceException on play button (DOM/lifecycle)**.

5. **Decision matrix:**
   - Both awsug + auth FAIL: Iteration 2 narrows to the failing subdomain(s). The failure category (StaleElementReferenceException) determines the new fix family: **DOM/lifecycle** — the play button element is located but goes stale before click, consistent with a component re-render during or after hydration on these subdomains. Iteration 0's `autoplay policy / hydration race` family is **RETIRED** — not the same root cause (the "hydration race" part was coincidentally directionally correct for awsug/auth, but the "autoplay policy" part was a broken-probe artifact).

6. **What does NOT change regardless of awsug/auth result:** the probe correctness fix is a standalone correctness improvement (committed as f6d95b7b). The Iteration 0 captures should be treated as data of unknown integrity for audio state, but the click-attempt outcomes (TimeoutException / StaleElementReferenceException on awsug/auth) ARE real Selenium-level signals not affected by the probe defect.
