# bugfix: music-player-playback

## Context

After PR #360, #361, and #362 (Fiona stability, streams audit, CSP consolidation, WebGL budget), the persistent music player did not play KEXP or several other curated streams when the user clicked play.

**Iteration 1 corrected-probe findings (2026-05-27) narrowed scope:**
- `clouddelnorte.org`: **PASS** — KEXP plays end-to-end (readyState=4, paused=false, body.cdn-stream-playing set). Likely side-effect fix from PR #361 reachability probe correction.
- `awsug.clouddelnorte.org`: **FAIL** — StaleElementReferenceException on play button. The button's DOM node is replaced by a component re-render between Selenium's locate and click. This is the locked target.
- `auth.clouddelnorte.org`: **OUT OF SCOPE** — the player is intentionally hidden on the auth subdomain via `body.cdn-auth-subdomain { display:none !important }` on `.cdn-player-slot`. The Selenium failure on auth is the probe locating a hidden element; not a defect.

**Locked fix family:** `awsug re-render race` — DOM/lifecycle. The play button is mounted, located by Selenium, then re-rendered (replaced) by an ancestor state update before the click resolves.

**Retired family:** "Browser autoplay policy / hydration race" — the autoplay-policy half was a broken-probe artifact; the hydration-race half was directionally correct only as a coarse description and is replaced by the more specific `re-render race`.

## Current Behavior (Defect — narrowed to awsug)

```
WHEN a user opens https://awsug.clouddelnorte.org and clicks play on the persistent music player while the curated initial station (KEXP) is selected
THEN the play button's DOM node is replaced (component re-render) between locate and click, and the click never lands on a stable element — audio does not transition to a playing state

WHEN the same user opens https://clouddelnorte.org and performs the same action
THEN audio plays correctly (readyState reaches 4, paused becomes false, body.cdn-stream-playing is set) — no fix needed for this subdomain

WHEN the user is on https://auth.clouddelnorte.org
THEN the player is intentionally hidden via body.cdn-auth-subdomain { display:none !important } on .cdn-player-slot — out of scope
```

## Expected Behavior (Correct)

```
WHEN a user clicks play on KEXP (curated initial station) on awsug.clouddelnorte.org
THE SYSTEM SHALL keep the play button's DOM node stable across hydration and any post-mount re-renders, allow the click to land, and transition the audio element to a playing state within 5 seconds, setting body.cdn-stream-playing

WHEN a curated station fails reachability or returns a media error on awsug
THE SYSTEM SHALL surface a user-visible error indicator and auto-skip via goNext() within the existing 3-skip cap

WHEN the user is on clouddelnorte.org
THE SYSTEM SHALL CONTINUE TO play streams as it does today (no regression from the awsug fix)
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

- [ ] KEXP plays end-to-end on `awsug.clouddelnorte.org`, captured by Selenium with `audio.paused == false` and `readyState >= 2` within 5s of click.
- [ ] No new console errors introduced by the fix on awsug.
- [ ] Only the components named in the locked re-render-race fix family are modified — persistent-player internals are NOT touched.
- [ ] `clouddelnorte.org` continues to PASS the same probe (no regression on the already-working subdomain).
- [ ] `auth.clouddelnorte.org` confirmed still hidden (`.cdn-player-slot` has `display: none`); no probe attempt against it.
- [ ] Fiona screenshot diff against pre-fix baseline shows no regression (PR #360 baseline preserved).
- [ ] CSP header diff shows no widening; total length ≤ 1783 chars.
- [ ] No Bryan-tested verification — every step gated by Device Farm Selenium capture.
- [ ] PR merged through the standard chain (auditor → orin → deploy.sh from haunting source). Bryan is not a step.
- [ ] Iteration 1 retrospective committed to `tasks.md`: which component triggered the re-render, what guard was applied, what feeds back into the streams architecture.

## Constraints

- Bryan does not test manually. All verification runs through Device Farm Selenium against production. TestGrid project: `arn:aws:devicefarm:us-west-2:946179428633:testgrid-project:0f1bfe22-0371-40c8-bcac-f96709363893`.
- Device Farm is Windows Chrome with 2 cores, reduced motion enabled. WebGL may not be available — BabylonGate tier="medium" blocks Fiona's 3D canvas there. Expected, not part of this bug.
- Fix scope is `awsug.clouddelnorte.org` only. `clouddelnorte.org` already passes; `auth.clouddelnorte.org` is intentionally hidden.
- No CSP widening. CSP is not in the suspect set for this fix family.
- No `streams-reachability.ts` changes — frozen.
- Do not touch `persistent-player` internals (audio element, play/pause/next handlers). The fix lives in the awsug page tree (ancestors of `<PersistentPlayer />`), not in the player itself.
- Do not MERGE until Iteration 1 DoD passes; push to branch is part of the verification chain (preview deploy is the test target). The "do not push" form of this rule was retired on 2026-05-27 once the structural reality became clear: the Device Farm harness only tests deployed sites, and the branch-push preview deploy (`dev.clouddelnorte.org/awsug-preview/`) exists for exactly this verification. Push to a non-`main` branch is reversible; the gate that matters is auditor → orin → main → `deploy.sh`.

## Out of Scope (Backlog Hygiene)

These belong in separate specs:

- Architectural overhaul of dual BabylonJS instance problem.
- Woodpecker deploy silent-failure (file as ops issue if not already filed).
- qrcode.react type error requiring `npm ci` first.
- `auth.clouddelnorte.org` player visibility — intentionally hidden via `body.cdn-auth-subdomain { display:none !important }` on `.cdn-player-slot`. If product later wants the player on auth, that is a new spec, not a defect.
- `clouddelnorte.org` — already passing post-PR-#361 side-effect; no change required here.
- Per-station defects on stations beyond KEXP — each is a separate spec/issue if surfaced after Iteration 1 PASS on KEXP × awsug.

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
