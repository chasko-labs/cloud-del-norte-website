# tasks: music-player-playback

Iterations, not phases. Each iteration ships value or learning. Each ends with a retrospective task that updates the spec before the next iteration begins.

## Iteration 0 — Spike (timeboxed, ≤ 1 working session)

**Goal:** capture evidence sufficient to lock the fix family. No production code changes.

- [ ] **0.1 Author Selenium diagnostic script**
 - File: `tests/device-farm/music-player-diagnostic.py`
 - Read first: `scripts/probe-cta-button-classes.mjs` (Playwright probe pattern), any existing `tests/device-farm/` examples.
 - Boto3 + Selenium, TestGrid project ARN `arn:aws:devicefarm:us-west-2:946179428633:testgrid-project:0f1bfe22-0371-40c8-bcac-f96709363893`.
 - Auth: `AWS_PROFILE=bryanchasko-kiro` (SSO active) or Roles Anywhere via `/workload.crt` if running in CI.
 - Per-station capture: console (all levels), network HAR, audio state via `driver.execute_script`, body class list, performance entries.
 - Output: `tests/device-farm/captures/<timestamp>/<station>.{json,har}`.

- [ ] **0.2 Run against all three subdomains**
 - Run script against `clouddelnorte.org`, `awsug.clouddelnorte.org`, `auth.clouddelnorte.org`.
 - Captures committed (no secrets — Selenium runs unauthenticated).

- [ ] **0.3 Findings classification**
 - File: `tests/device-farm/captures/<timestamp>/findings.md`
 - Per station + subdomain: which hypothesis matches, or "other" with description.
 - Lock the fix family for Iteration 1 here. If multiple families surface, pick the one that unblocks the most stations.

- [ ] **0.4 Iteration 0 retrospective**
 - Update `design.md` "What We Know" section with confirmed evidence.
 - Update `design.md` "Hypotheses" — promote matched, demote ruled-out.
 - One paragraph in spec: what surprised, what to do differently in Iteration 1.

**Iteration 0 DoD:** findings.md committed. Fix family locked. design.md updated.

## Iteration 1 — Walking Skeleton: KEXP × awsug.clouddelnorte.org

**Goal:** KEXP plays end-to-end on `awsug.clouddelnorte.org`. `clouddelnorte.org` continues to pass (regression guard). `auth.clouddelnorte.org` is out of scope (intentionally hidden via CSS).

**Locked fix family:** awsug re-render race — the play button's DOM node is replaced by an ancestor component re-render between Selenium's locate and click on awsug. `clouddelnorte.org` does not exhibit this. See `design.md` H1 (LOCKED).

### Iteration 1a — Probe-correction sweep (DONE — historical, do not re-run)

- [x] **1a.1 Probe correctness fix** — commit `f6d95b7b`. Added leading `return` to `AUDIO_STATE_JS` IIFE so `execute_script` propagates the IIFE return value. Iteration 0's `30/30 fail — autoplay policy / hydration race` classification was a probe artifact.
- [x] **1a.2 Corrected-probe sweep** — KEXP × clouddelnorte.org PASS (readyState=4, paused=false). KEXP × awsug FAIL (StaleElementReferenceException). KEXP × auth FAIL (player intentionally hidden — out of scope).
- [x] **1a.3 Pivot fix family** — original autoplay/hydration race RETIRED. New family LOCKED: awsug re-render race. Spec narrowed to awsug only.

### Iteration 1b — Code-mapping (NEXT, no source changes)

- [x] **1b.1 Identify re-render trigger on awsug pages**
 - Read-only investigation. No fixes applied here.
 - Targets: `src/sites/awsug/**`, any `AuthContext` / `useAuth` / auth-polling effects, `PendingApprovalBanner` or equivalent banners conditionally mounted on auth state, `useEffect` hooks in ancestors of `<PersistentPlayer />` that update state on a timer or auth event.
 - Output: ranked suspect list with `file:line`, brief explanation per suspect of why it could re-render the subtree containing the play button.
 - Dispatched to: `ghost-stratia-code-mapper`. Result: Rank 1 (HIGH) `useGroupMembership → tryRefresh → sessionStorage write → AuthContext onStorage → setState → AuthProvider subtree re-render → play button DOM replaced`.

### Iteration 1c — Apply narrow fix

- [x] **1c.1 Apply re-render guard to highest-ranked suspect**
 - Touch only the file(s) named in 1b.1 ranking.
 - **Do not** modify `src/components/persistent-player/**` (frozen).
 - **Do not** modify `src/lib/streams*.ts` (frozen).
 - **Do not** modify CSP (`infra/cloudfront-security-headers.*.json`) — not in suspect set.
 - Fix shape options (engineer chooses based on root cause):
   - Stable initial value to skip the post-mount state churn.
   - Hoist or memoize the effect that triggers the re-render.
   - Move the re-rendering ancestor to a sibling of the player slot so its updates don't replace the player subtree.
   - Remove the unnecessary state update if it has no UX effect on awsug.
 - Dispatched to: `ghost-tarn-cdn-react-coder`. Result: idempotent `setState` in `src/contexts/auth-context.tsx` (commit `bbc95540`) — `refresh()` now compares prev/next user-facing claims and skips the re-render on no-op refresh.

### Iteration 1d — Verify

- [x] **1d.0 Adapt harness, push branch, wait for preview deploy**
 - Add a `--base-url` flag to `tests/device-farm/music-player-diagnostic.py` so the harness can target a non-production URL. Default keeps the current production URL list so existing callers don't break. **Done — commit `2e622cd3` (ghost-hcom-python-coder).**
 - Commit on the same `spec/music-player-playback` branch as the fix.
 - Push `spec/music-player-playback` to trigger Woodpecker `deploy-dev-awsug` job. The preview lands at `https://dev.clouddelnorte.org/awsug-preview/`. **Done — branch `fix/awsug-rerender-race` (mirrors spec branch) pushed; Woodpecker pipeline `#1785` triggered manually after webhook delay; deploy-dev-awsug succeeded.**
 - Poll Woodpecker pipeline status (DUTIES.md curl-with-token pattern) until the preview deploy completes. **Done.**

- [x] **1d.1 Device Farm smoke test (KEXP × awsug-preview only)**
 - Run `python3 tests/device-farm/music-player-diagnostic.py --base-url https://dev.clouddelnorte.org/awsug-preview/ --stations kexp --subdomains https://dev.clouddelnorte.org/awsug-preview/`
 - DoD checks (all must pass):
   - [x] `audio.readyState >= 2` AND `audio.paused == false` within 5s of click on the preview. **PASS — readyState=4 by sample 1 (~500ms).**
   - [x] No new console errors introduced. **PASS — zero SEVERE messages.**
   - [x] No StaleElementReferenceException on play button. **PASS — clicked=true, fatal=null.**
   - [x] `git diff src/components/persistent-player/` is empty (Property 6). **PASS.**
 - Capture: `tests/device-farm/captures/20260527T190456Z/`
      (captured during the fix/awsug-rerender-race iteration, since
      squash-merged to main separately; see git history).

- [x] **1d.2 Iteration 1 retrospective (forward-looking)**
 - Append to this file: which component was the actual re-render trigger, what guard was applied, why the smaller alternatives were ruled out, what feeds back into the streams architecture.

## Iteration 1 Retrospective (live record)

### What we predicted

A walking-skeleton fix in the awsug page tree (likely `useGroupMembership`, `PendingApprovalBanner`, or an `AuthContext` ancestor) would stabilize the play button DOM node across hydration so Selenium and real users could land the click.

### What we found (code-mapper, HIGH confidence)

The chain was:

```
useGroupMembership() mount useEffect (only mounted in awsug/_layout via PendingApprovalBanner)
  → void tryRefresh() — synchronous, no defer
    → refreshTokens() writes 'cdn.*' keys to sessionStorage
      → AuthContext onStorage listener fires
        → setState(readState())  ← OFFENDER: fired even when claims unchanged
          → AuthProvider subtree re-renders
            → play button DOM node replaced
              → Selenium StaleElementReferenceException; real users lose the click
```

awsug-specific because `useGroupMembership` is only called from `PendingApprovalBanner`, which is only mounted in `src/sites/awsug/_layout/index.tsx`. clouddelnorte.org doesn't reproduce; auth subdomain hides the player by design.

### What we shipped

Single-file fix at `src/contexts/auth-context.tsx` (commit `bbc95540`):

The `refresh()` callback now uses functional setState. It compares user-facing fields (`isAuthenticated`, `sub`, `email`, `name`, `groups`, `isModerator`) between previous and next state. If all match, it returns the previous reference and React skips the re-render. A no-op token refresh (same claims, different JWT string) no longer churns the AuthProvider subtree.

Why this shape (option 3) over the others the coder considered:

- Option 1 — defer `tryRefresh()`: shifts the race window but doesn't eliminate it; brittle.
- Option 2 — skip self-triggered storage events: doesn't address the root cause; React still re-renders on real cross-frame writes that don't change claims.
- Option 4 — skip mount-time refresh: changes the auth/banner contract (banner relies on a fresh refresh to learn group membership transitions).
- Option 5 — wrap `<PersistentPlayer />` in `React.memo`: more code, only protects this one consumer; `persistent-player/**` is frozen anyway.

Two new tests in `src/contexts/__tests__/auth-context.test.tsx` prove no-churn on same claims and re-render on different claims. All 1012 vitest tests pass. Lint clean. Typecheck clean.

`git diff src/components/persistent-player/` empty, `git diff src/lib/streams*.ts` empty, `git diff infra/` empty (Properties 5 + 6 hold).

### How we verified — harness adaptation + preview deploy

`tests/device-farm/music-player-diagnostic.py` originally hardcoded production subdomain URLs. To verify the candidate fix BEFORE merging to main, we added a `--base-url` flag (commit `2e622cd3`) so the harness can target a single arbitrary URL. Default behavior unchanged; flag is mutually exclusive with `--subdomains`.

Push to `fix/awsug-rerender-race` triggered (manually, via Woodpecker API — webhook auto-trigger was stuck) Woodpecker pipeline `#1785`, which deployed the build to `dev.clouddelnorte.org/awsug-preview/`. The harness was then run with `--base-url https://dev.clouddelnorte.org/awsug-preview/ --stations kexp`.

Capture: `tests/device-farm/captures/20260527T190456Z/` (captured during the fix/awsug-rerender-race iteration, since squash-merged to main separately; see git history). Result: `property2Pass: true`. Sample 1 (~500ms post-click) showed `readyState=4` and `paused=false`. No `StaleElementReferenceException`. No new SEVERE console messages. KEXP stream 200/audio-aac/ACAO=*.

### Constraint amendment (live)

`bugfix.md` Constraints: "Do not push the branch until Iteration 1 DoD passes" → "Do not MERGE until Iteration 1 DoD passes; push to branch is part of the verification chain (preview deploy is the test target)." Reason: the harness only tests deployed sites; the branch-push preview deploy exists for exactly this verification. The merge gate (auditor → orin → main → `deploy.sh`) is what protects production.

### Production parity check (post-merge — TODO)

Per the amended constraint and the path 1 sequence we picked: after merge, re-run the harness against `https://awsug.clouddelnorte.org` (production, no `--base-url`) as a preview-vs-prod parity check.

- If preview-PASS and production-PASS: close the iteration. Move on to broader station coverage in a separate spec.
- If preview-PASS but production-FAIL: that's a cache parity defect, not a fix defect. Revert immediately; file a parity issue. Do NOT retro-blame the AuthContext fix or absorb the parity issue into this spec.

### Feed-forward (streams architecture + future Device Farm specs)

- **Future Device Farm specs MUST bake `--base-url` in from authorship.** The harness should treat the production subdomain list as a default and the preview/feature URL as a first-class CLI input. The chicken-and-egg we hit ("don't push until DoD passes" vs "harness only tests deployed sites") is structural, not specific to this fix; every new diagnostic harness should accept a target URL.
- **`AuthContext.refresh()` is now idempotent on no-op refreshes.** Future code in `src/contexts/auth-context.tsx` that `setState`s should keep this property: spurious re-renders break consumers of the AuthProvider subtree silently.
- **awsug page tree hydration cadence is the suspect zone for similar bugs.** If another awsug component reports a "DOM node disappears between locate and click" symptom, the first place to look is post-mount `setState` chains rooted in `AuthContext`, `useGroupMembership`, or `PendingApprovalBanner`.
- **Iteration 1's Iteration 0 ghost lingers.** The Iteration 0 probe defect (missing `return` in `AUDIO_STATE_JS`) cost a full investigation cycle. Probe correctness should be a first-class deliverable of any new diagnostic spec, not assumed infrastructure.

### Status

PR #398 (`fix/awsug-rerender-race` → `main`): OPEN, awaiting auditor review. Iteration 1d.0, 1d.1, 1d.2 complete. Iteration 2 (Land) starts on auditor verdict.

**Iteration 1 DoD:** Property 2 (KEXP × awsug PASS) + Property 3 (clouddelnorte.org regression PASS) + Property 6 (persistent-player diff empty). Spec updated.

## Iteration 2 — Land

- [ ] **2.1 Open PR**
 - Title: `fix(player): guard awsug re-render race on play button (Iteration 1 — KEXP walking skeleton)`
 - Body: link Iteration 1 captures, before/after Selenium evidence, code-mapper suspect ranking, applied fix rationale.
 - Dispatched to: `ghost-orin-ci-cd`.

- [ ] **2.2 Merge through standard chain**
 - Auditor reviews → orin posts verdict → squash-merge → `deploy.sh` from haunting source. Bryan is not a step.

- [ ] **2.3 Post-deploy verification on main**
 - Re-run `tests/device-farm/music-player-diagnostic.py` against deployed main.
 - KEXP × awsug PASS confirmed in production.

- [ ] **2.4 Final retrospective**
 - Append to this file: actual root cause, what didn't we expect, what feeds into streams architecture going forward.
 - File any out-of-scope items surfaced (broadening to other stations on awsug, architectural BabylonJS overhaul, ops issues) as separate issues.

**Iteration 2 DoD:** all DoD checkboxes in `bugfix.md` checked. PR merged. Production verified via Device Farm. Branch retired.

## Cross-Cutting

- **Feedback loop**: every iteration ends with a retrospective task that updates the spec. No skipping.
- **Stop conditions**: any iteration that fails its DoD returns to the previous iteration with new evidence — no marching forward on a broken assumption. If Iteration 1d fails, do NOT push the branch; surface findings to product owner.
- **Backlog hygiene**: items surfaced but out of scope go to separate issues immediately, not into this spec. Specifically: broadening to non-KEXP stations on awsug, any auth.clouddelnorte.org player work, dual-BabylonJS overhaul.

## Iteration 1 (original, retired) — Walking Skeleton on clouddelnorte.org

**Status:** RETIRED. Subsumed into Iteration 1a above. The walking-skeleton TSX guard was never applied because `clouddelnorte.org` did not reproduce the bug under corrected probe — KEXP plays there without source change.

**What we predicted:** Walking skeleton would apply a hydration guard to `src/components/persistent-player/index.tsx`, fixing KEXP × clouddelnorte.org and unblocking broader rollout.

**What we found:**
1. The Iteration 0 probe was defective — missing `return ` made `execute_script`'s wrapper propagate `undefined` and the Python fallback coerced to `{}`. All Iteration 0 audio-state evidence (preClickAudio / samples / postClickAudio) was vacuous.
2. With the corrected probe, KEXP × clouddelnorte.org PASSES Property 2 on current main without any source change.
3. Most likely cause of bug-report → today resolution on clouddelnorte.org: side-effect fix from PR #361 (reachability probe fix) and four other player-touching commits in the window.
4. awsug/auth corrected-probe results: awsug FAIL — re-render race; auth FAIL — but the player is intentionally hidden via CSS, so this is not a defect.

**Decision:** Pivot active iteration to KEXP × awsug walking skeleton (re-render race fix family). Drop auth from scope. Use clouddelnorte.org as a regression guard only.

**Probe correctness fix shipped:** commit `f6d95b7b`.

**No source-component change shipped in this iteration.**

## Iteration 3 — Production subdomain classification (LOCKED hypothesis — SUPERSEDED, see Corrected Hypothesis)

> **Original LOCKED hypothesis (struck through; preserved for retrospective integrity):**
>
> ~~`awsug.clouddelnorte.org` is misclassified at runtime as an auth subdomain. The `cdn-auth-subdomain` body class is applied (likely via a hostname check in the auth context provider or shell layout), which triggers `display: none` on `.cdn-player-slot` via the auth-subdomain CSS rule. The player mounts visible briefly, then is hidden once the classification resolves. Selenium clicks land on a hidden element and time out.~~
>
> ~~**Evidence:**~~
>
> - ~~`preClickAudio.bodyClasses == ["cdn-nav-open", "cdn-auth-subdomain"]` on `awsug.clouddelnorte.org`.~~
> - ~~`preClickAudio.playerMounted == true` (player mounts visible).~~
> - ~~`postClickAudio.audioPresent == false, playerMounted == false` (player vanished by post-click capture).~~
> - ~~`fatal: TimeoutException: play button not clickable`.~~
> - ~~`finalReadyState: 0`.~~
> - ~~Preview at `dev.clouddelnorte.org/awsug-preview/` does NOT reproduce because hostname-keyed auth detection never fires on a path-based subroute.~~
>
> **Why struck:** Sub-task 3.2 code-mapper sweep (read-only filesystem + live-bundle inspection) disproved the hostname-keyed-classifier premise. There is no hostname classifier for `cdn-auth-subdomain` anywhere in the codebase. The class is applied unconditionally by `AuthLayout`'s `useEffect` at `src/sites/auth/_layout/index.tsx:88`, which is reached on `awsug.*` only because awsug's `requireAuth()` (`src/sites/awsug/_shared/auth.ts:234`) redirects unauthenticated visitors to `auth.clouddelnorte.org/login/`. The harness's body-class observation is on the auth page after redirect, not on awsug. The capture's `subdomain` field reflects the harness *input*, not the post-redirect URL — a silent corruption that hid the redirect from iteration 2 analysis.
>
> **Disproof:** `.kiro/specs/music-player-playback/iter3-3.2-codemap.md`.

### Corrected hypothesis (post sub-task 3.2)

`AwsugLayout` (`src/sites/awsug/_layout/index.tsx:108`) renders `<Shell hidePlayer ...>`, which suppresses the persistent player on `awsug.clouddelnorte.org` for **every** visitor — including authenticated ones. Bryan confirmed product intent: the music player should play on `awsug.clouddelnorte.org` for authenticated users. The `hidePlayer` prop is the regression. Removing it from `AwsugLayout` restores the player on awsug for authenticated users.

The original Device Farm parity defect (`#399`) was real but inverted: the parity gap was not "preview wrong, prod right" or "prod wrong, preview right" symmetrically — it was that `hidePlayer` was suppressing the player on awsug while preview happened to be path-based and rendered without that suppression chain. The fix converges preview and prod on the player being visible and functional for logged-in users.

**Authenticated prod parity verification on `awsug.clouddelnorte.org`** is gated on harness authentication. Sub-task 3.6 investigates trivial-vs-non-trivial implementation lift before deciding whether to ship parity verification this iteration or defer it to a follow-up.

### 3.1 Re-confirm hypothesis with a fresh prod capture (no fix on main yet)

Run the harness against three targets, compare body classes:

- `awsug.clouddelnorte.org` — `cdn-auth-subdomain` expected PRESENT.
- `clouddelnorte.org` — `cdn-auth-subdomain` expected ABSENT.
- `dev.clouddelnorte.org/awsug-preview/` — `cdn-auth-subdomain` expected ABSENT (path-based subroute, no hostname trigger).

If the class distribution matches the hypothesis: confirmed. If not: revise hypothesis before proceeding.

Dispatched to: cdn-PO direct (no ghost — read-only Device Farm runs).

### 3.1 Evidence (DONE)

**Captured:** 2026-05-27T22:17:51Z (run 1: kexp × awsug.clouddelnorte.org + clouddelnorte.org) and 2026-05-27T22:19:45Z (run 2: kexp × dev.clouddelnorte.org/awsug-preview/).

**Path:** `tests/device-farm/captures/iter3-step3.1-20260527T221751Z/` (run1-awsug-and-root, run2-dev-preview subdirs).

**Body-class observations confirm the LOCKED hypothesis:**

| Site                                          | `cdn-auth-subdomain`? | `property2Pass` | Outcome                                                                  |
|-----------------------------------------------|-----------------------|-----------------|--------------------------------------------------------------------------|
| `awsug.clouddelnorte.org`                     | YES                   | false           | `TimeoutException`, click never fired, player UNMOUNTED post-click       |
| `clouddelnorte.org`                           | NO                    | true            | `finalReadyState=4`, `cdn-stream-playing` added post-click               |
| `dev.clouddelnorte.org/awsug-preview/`        | NO                    | true            | `finalReadyState=4`, `cdn-stream-playing` added post-click               |

The hostname-keyed auth-classification logic correctly excludes the path-based dev preview but incorrectly includes `awsug.*`. Proceeding to sub-task 3.2 code-mapper sweep.

### 3.2 Code-mapper sweep — read-only (DONE)

Identify every file that adds or removes `cdn-auth-subdomain` to/from `document.body`. Targets included:

- `src/contexts/`
- `src/layouts/shell/`
- `src/sites/auth/`
- Any hostname-detection utility.

Sub-task 3.2 was attempted twice via `ghost-stratia-code-mapper` (both runs failed: tool-selection loop on `introspect`, then cancelled). cdn-PO completed the read-only sweep directly. Result is the codemap doc at `.kiro/specs/music-player-playback/iter3-3.2-codemap.md`.

**Findings (summary; full table in the codemap):**

- Six files reference `cdn-auth-subdomain`. Single WRITE site is `src/sites/auth/_layout/index.tsx:88`, an unconditional `useEffect` on `AuthLayout` mount. No hostname classifier exists.
- `AuthLayout` is imported only by files under `src/sites/auth/`. No `src/sites/awsug/` file imports it.
- Across all 14 chunks preloaded by `awsug.clouddelnorte.org/index.html`, only one chunk (`_layout-Cz7GLcax.js`) contains the string `cdn-auth-subdomain`, and only as a `classList.contains(...)` READ from persistent-player. Zero WRITE occurrences in any deployed awsug chunk.
- Awsug's `requireAuth()` at `src/sites/awsug/_shared/auth.ts:234` redirects unauthenticated visitors to `https://auth.clouddelnorte.org/login/index.html?return_to=...`. The harness has no Cognito tokens, so it is redirected. The harness's `bodyClasses` observation occurs on the auth page after redirect.
- Independent intent confirmation: `AwsugLayout` (`src/sites/awsug/_layout/index.tsx:108`) renders `<Shell hidePlayer ...>`, which suppresses the persistent player on awsug for every visitor. Bryan confirmed this is a regression — the player should play on awsug for authenticated users.

### 3.3 Fix — restore the player on awsug

Remove the `hidePlayer` prop from the `<Shell hidePlayer ...>` render at `src/sites/awsug/_layout/index.tsx:108`. Single-prop deletion. No other change in this fix.

**Branch:** `fix/awsug-restore-player` (any `fix/*` name works; required for the `deploy.yml` branch whitelist that triggers the dev pipeline).

**Verification (local, ghost-side):** if a vitest test exists for `src/sites/awsug/_layout/`, run it; it must still pass. Otherwise the gate is the preview verify at sub-task 3.4.

**Out-of-scope for this fix:** any AuthContext idempotent-setState change from `bbc95540`; any frozen-path edit; any CSP widening. `AwsugLayout` itself is permitted (not in the frozen list).

Dispatched to: `ghost-tarn-cdn-react-coder`.

### 3.4 Verify on preview

Pushing `fix/awsug-restore-player` triggers the dev pipeline. After dev deploy completes, run the harness against `https://dev.clouddelnorte.org/awsug-preview/` with the kexp station, single capture:

```
AWS_PROFILE=bryanchasko-kiro python3 tests/device-farm/music-player-diagnostic.py \
  --stations kexp --base-url https://dev.clouddelnorte.org/awsug-preview/
```

**Definition of done** (same gates as iteration 1 preview verify):

- `property2Pass == true`
- `finalReadyState >= 2`
- `finalPaused == false`
- No `StaleElementReferenceException`
- Zero new SEVERE console messages relative to iteration 1d's preview baseline

Dispatched to: cdn-PO direct.

### 3.5 Open PR — standard merge chain

Open PR from `fix/awsug-restore-player` to `main`.

- **Auditor:** `ghost-stratia-haunting-auditor` reviews against the corrected spec triple (this `tasks.md`, `bugfix.md`, `iter3-3.2-codemap.md`).
- **On APPROVE:** `ghost-orin-ci-cd` squash-merges to `main`, deletes the branch, then runs `deploy.sh` from haunting source.

The `spec/music-player-playback` branch stays open through 3.7 (retrospective lands on the spec branch, not on `main`).

### 3.6 Production parity check (investigation first, then branch)

Authenticated prod parity verification on `https://awsug.clouddelnorte.org` requires the harness to pass `requireAuth()`. Investigation pass first, read-only, by cdn-PO directly:

**(a) Identify auth state.** Read `src/sites/awsug/_shared/auth.ts` and `src/contexts/auth-context.tsx`. Document which `sessionStorage` and `localStorage` keys `requireAuth()` and `AuthContext` check (the iter3-3.2-codemap.md sweep already shows the awsug `_shared/auth.ts` keys: `cdn.idToken`, `cdn.accessToken`, `cdn.refreshToken`, `cdn.expiresAt`, `cdn.loginState` — verify against `auth-context.tsx`).

**(b) Determine the dev-preview bypass.** Why does `dev.clouddelnorte.org/awsug-preview/` not enforce `requireAuth()` in sub-task 3.1? Possible mechanisms: path-based subroute serves a different bundle that lacks `requireAuth()`; dev-only flag short-circuits the check; cached token from a prior session persists in storage; redirect target on dev points somewhere that does not mount `AuthLayout`. Document the actual mechanism in 3.6 notes appended to this section.

**(c) Estimate harness-auth lift.**

- **Trivial:** inject a pre-issued session token into `sessionStorage` (and any `localStorage` keys identified in (a)) before the harness drives Selenium to the URL.
- **Non-trivial:** full Cognito Secure Remote Password (SRP) flow, browser-based login automation, app-client-secret rotation, or anything that requires the harness to perform the OIDC code exchange.

**Branch:**

- **If trivial:** dispatch `ghost-hcom-python-coder` to add an authenticated-session path to `tests/device-farm/music-player-diagnostic.py` as a new flag (e.g. `--session-token` or `--session-token-file`). Run prod parity:

  ```
  AWS_PROFILE=bryanchasko-kiro python3 tests/device-farm/music-player-diagnostic.py \
    --stations kexp --subdomains https://awsug.clouddelnorte.org \
    --session-token-file <path>
  ```

  Same definition of done as the preview verify (3.4 gates).

- **If non-trivial:** defer authenticated prod parity to a follow-up. File a tracking issue on `chasko-labs/cloud-del-norte-website` titled `harness: device-farm music-player-diagnostic.py needs authenticated-session support for awsug.* prod parity` with a one-paragraph gap statement and the `iter3-3.2-codemap.md` reference. Document the deferral in 3.7. The fix still ships; prod parity becomes a known gap with an explicit follow-up issue.

If 3.6 surfaces a finding outside this directive (e.g., dev preview's bypass mechanism is a security gap, not just a divergence), stop and surface to cdn-anchor.

### 3.6 Notes (post-investigation)

**(a) Auth keys used by `requireAuth()` and `AuthContext`.** Five sessionStorage keys, no localStorage anywhere in the auth flow:

- `cdn.idToken` — Cognito ID token (JWT with `email`, `name`, `sub`, `cognito:groups` claims).
- `cdn.accessToken` — Cognito access token.
- `cdn.refreshToken` — Cognito refresh token.
- `cdn.expiresAt` — JS millisecond expiry; `getIdToken()` returns null when `Date.now() >= expiresAt`.
- `cdn.loginState` — PKCE in-flight verifier + returnTo (only present during a redirect-in-progress).

The same five keys are referenced by four auth implementations: `src/lib/auth.ts`, `src/lib/cognito.ts`, `src/lib/rsvp.ts`, and `src/sites/awsug/_shared/auth.ts`. All point at the same Cognito user pool and app client (`57eikmt418ea6vti2f6h0pl74r`). `AuthContext` (`src/contexts/auth-context.tsx`) imports `getIdToken` from `src/lib/auth.ts`; it does NOT redirect on missing token, it returns `emptyState()`. The redirect to `auth.clouddelnorte.org/login/` is fired by `requireAuth()` in `src/sites/awsug/_shared/auth.ts:234` and `src/lib/auth.ts`'s equivalent. All auth state is sessionStorage-scoped (origin-bound). The only `localStorage` reference in `auth-context.tsx` is a code comment about deferred BroadcastChannel/localStorage logout broadcast (RC-6 limitation).

**(b) Why `dev.clouddelnorte.org/awsug-preview/` does not enforce `requireAuth`.** It does not serve the awsug build at all. It serves the homepage feed (`src/pages/feed/`) via CloudFront SPA fallback to `/index.html`.

Verified mechanism:

- `.woodpecker/deploy.yml:199-235` (`deploy-dev` step) runs on push to non-main branches and syncs `lib/` (the homepage clouddelnorte.org build) to `S3_BUCKET_DEV`. There is no `deploy-dev-awsug` step. `lib-awsug/` is never synced to `dev.clouddelnorte.org`.
- Live HTML compare:
  - `dev.clouddelnorte.org/awsug-preview/` → entrypoint `feed-DZtPxxnG.js`, title `AWS UG Cloud Del Norte`, streams preconnect, FionaSection scaffold. This is `src/pages/feed/index.html`.
  - `awsug.clouddelnorte.org/` → entrypoint `index-CBoImrQ2.js`, title `Cloud Del Norte — Members`, vendor-cloudscape-shell + `_layout` + `rsvp` chunks. This is `src/sites/awsug/index.html`.
- The path `/awsug-preview/` does not exist on the dev S3 bucket. CloudFront's SPA fallback rule (configured for `dev.clouddelnorte.org`) returns the bucket's `index.html` for unknown paths, which is `src/pages/feed/index.html`.
- The homepage feed (`src/pages/feed/app.tsx`) does NOT call `requireAuth`, mounts `<Shell ...>` without `hidePlayer`, and renders the persistent player normally.

**Implication.** The iter-1 preview verify that "passed" against `dev.clouddelnorte.org/awsug-preview/` was exercising the homepage feed, not the awsug build. The same is true for the iter-3.4 preview verify just now. Both produced a green signal for code that was never actually run. The fix (`hidePlayer` deletion in `AwsugLayout`) is on prod main and deployed to the awsug S3 bucket via the `deploy-awsug` step, but the dev path-based subroute is structurally incapable of verifying it. Sub-task 3.7.b issue (ii) tracks this divergence formally.

**(c) Harness-auth lift estimate — TRIVIAL.** Cognito hosted-UI uses standard OAuth 2.0 Authorization Code + PKCE (see `src/sites/awsug/_shared/auth.ts:165-227`). The hosted-UI endpoint is `https://cloud-del-norte.auth.us-west-2.amazoncognito.com`. The token-refresh endpoint (`/oauth2/token` with `grant_type=refresh_token`) returns fresh `id_token` + `access_token` + `expires_in` without any browser interaction. The Cognito app client `57eikmt418ea6vti2f6h0pl74r` is a public client (no secret) that supports the refresh-token grant.

Implementation plan:

1. Add `--refresh-token-file <path>` flag to `tests/device-farm/music-player-diagnostic.py`.
2. On harness start, read the file, POST to Cognito's `/oauth2/token` with `grant_type=refresh_token` + `client_id` + `refresh_token`. Parse the response: `id_token`, `access_token`, `expires_in`.
3. Decode the `id_token` JWT to read `exp` (or compute `Date.now() + expires_in*1000`).
4. Before navigating to the auth-gated target, navigate to a lightweight same-origin path on the target host, run `driver.execute_script` to inject the four sessionStorage keys, then navigate to the real target. `requireAuth()` finds the tokens, returns `AuthState`, no redirect.
5. Awsug app mounts. Player slot is visible (post-fix). Harness clicks. Same DoD gates as preview verify.

Estimated lift: ~50-80 lines of Python additions to `music-player-diagnostic.py`. No frozen-path edits, no AuthContext touch, no Cognito app-client-secret rotation. Refresh tokens have a long TTL (Cognito default 30 days), so Bryan provides the refresh_token once and rotates only when it expires.

**Decision: TRIVIAL. Dispatching `ghost-hcom-python-coder` for the harness-auth flag implementation, then running prod parity against `awsug.clouddelnorte.org` with the new flag.**

### 3.7 Iteration 3 retrospective + close #399

Append a retrospective entry to this file under `## Iteration 3 Retrospective` capturing:

- Corrected diagnosis (`hidePlayer` regression; not hostname misclassification).
- Reference to `iter3-3.2-codemap.md` as the disproof of the original LOCKED hypothesis.
- Fix-path summary (single-prop deletion in `AwsugLayout`).
- Prod-parity outcome — verified with authenticated harness (3.6 trivial path), or deferred with the follow-up issue number from 3.6 non-trivial path.
- The two independent follow-up issues filed in 3.7.b.

Close `chasko-labs/cloud-del-norte-website#399` with the **inverted-parity reframe**: the parity gap was real but inverted. The bug was not "preview wrong, prod right" or "prod wrong, preview right" symmetrically — it was that `hidePlayer` was suppressing the player on awsug while preview happened to be path-based and rendered without that suppression chain. The fix converges preview and prod on the player being visible and functional for logged-in users. Cross-reference `iter3-3.2-codemap.md` from the close comment.

### 3.7.b Independent follow-up issues — file regardless of 3.6 outcome

Filed on `chasko-labs/cloud-del-norte-website` by `ghost-orin-ci-cd` as a single dispatch:

- **(i)** `harness: device-farm capture subdomain field reflects input URL, not post-redirect final URL`. Cite this iteration's misdiagnosis as the cost of the silent corruption — the iter-2 prod capture's `subdomain == "awsug.clouddelnorte.org"` masked the redirect to `auth.clouddelnorte.org/login/`, leading to a hostname-classifier hypothesis that did not match reality. Reference `iter3-3.2-codemap.md`. Suggested fix: capture `driver.current_url` after page load and after click, store as `preClickUrl` and `postClickUrl` in the JSON.
- **(ii)** `auth: dev awsug-preview path-based subroute bypasses requireAuth — divergence from prod`. Either harden dev to enforce `requireAuth()` on `awsug-preview/` paths, or document the divergence as intentional in a steering note. Cite the codemap finding and the prod-vs-preview capture comparison from sub-task 3.1.

### Out of scope for Iteration 3

The original AuthContext re-render race fix from `bbc95540` is **NOT** included in this iteration. That fix was correct for the iter-1-observed defect (StaleElementReferenceException on a re-rendering button), but the iter-1 prod baseline was misread — at the time, the play button WAS visible enough to locate, then the re-render race added staleness on top of an already-broken visibility regime.

Whether the AuthContext fix should re-land at all depends on what Iteration 3 finds:

- If the subdomain-classification fix alone makes prod pass: the AuthContext idempotent-setState change is a separate cleanup PR with its own review. Do NOT auto-include it in Iteration 3.
- If the subdomain-classification fix does not fully resolve prod: re-evaluate whether the AuthContext fix is still needed, in a follow-up iteration with its own evidence base.

### Constraints (carried forward)

- Code authorship is ghost-only (PreToolHook blocks PO writes; spec doc authorship by cdn-PO is permitted by directive when explicitly authorized).
- Frozen paths (must not be modified): `src/components/persistent-player/**`, `src/lib/streams*.ts`, `infra/cloudfront-security-headers.*.json`, Fiona/BabylonJS/WebGL/footer/weather components, `streams-reachability.ts`.
- Iteration 3 IS permitted to touch `src/sites/awsug/_layout/` (for the `hidePlayer` deletion), `src/contexts/`, `src/layouts/shell/`, `src/sites/auth/` (read-only this iteration), and hostname-detection utilities (frozen list does not cover these).
- No CSP widening.
- `auth.clouddelnorte.org` remains out of scope (intentionally hidden via display:none, as designed).
- The AuthContext idempotent-setState change from `bbc95540` is OUT of scope for iteration 3.
- `--base-url` flag is on main from PR #400; no harness restoration needed during iter-3.
- Spec-discipline addendum filed at `BryanChasko/haunting-kiro-cli#1158`; iter-3 references both that issue and `chasko-labs/cloud-del-norte-website#399`.


---

## Iteration 3 Retrospective

Iteration 3 closed on Path B: ship the fix on its merits, defer the automated prod parity run to a tracked follow-up.

### Corrected diagnosis

The original LOCKED hypothesis ("hostname misclassification on awsug.clouddelnorte.org causes the persistent player's hostname check to misfire") was disproved at sub-task 3.2. The real regression was a `hidePlayer` prop on `AwsugLayout` (`src/sites/awsug/_layout/index.tsx`), suppressing the player slot in the shell wrapper. The hostname-classifier code path does not exist anywhere in the deployed bundles; the only reference to `cdn-auth-subdomain` is a `classList.contains()` READ inside the persistent player component, and that READ never sees the class because no WRITE site exists outside `AuthLayout` (which only mounts when an unauthenticated user is redirected to `auth.clouddelnorte.org/login/`).

Reference: `.kiro/specs/music-player-playback/iter3-3.2-codemap.md`.

### Fix-path summary

Single-prop deletion: removed `hidePlayer` prop from the `<Shell ...>` invocation in `src/sites/awsug/_layout/index.tsx`. Implemented in PR #401 (`fix(awsug): restore persistent player — remove hidePlayer`), merged to `main` at `c990cdb7` on 2026-05-28T02:14:55Z. No frozen-path edits, no CSP changes, no AuthContext touch.

### Important caveat — preview gate has been a structural false signal

Sub-task 3.4's preview-PASS against `dev.clouddelnorte.org/awsug-preview/` was structurally a non-test. The dev preview URL serves the homepage feed bundle (`src/pages/feed/`, entry `feed-DZtPxxnG.js`) via CloudFront SPA fallback to `/index.html`, NOT the awsug build (`src/sites/awsug/`, entry `index-CBoImrQ2.js`). The deploy.yml's `deploy-dev` step syncs only `lib/` (homepage) to the dev S3 bucket; `lib-awsug/` is never synced to dev. The `/awsug-preview/` path does not exist on dev S3 — CloudFront returns the bucket's `index.html`.

Iterations 1, 2, and 3 of this spec all ran a preview-verify against this URL and called it PASS. None of those runs exercised the awsug build. The `hidePlayer` fix in PR #401 was merged on the strength of a green preview signal that came from a different bundle entirely. The fix happens to be correct (verifiable by any logged-in member visiting `awsug.clouddelnorte.org/`), but the preview gate played no role in catching the regression OR validating the fix.

The dev preview gate has been a false signal for three iterations of this spec. Tracked formally in `chasko-labs/cloud-del-norte-website#404`.

### Parity status

**Deferred.** The fix is shipped on prod awsug as of `c990cdb7`. Manual verification by any logged-in member visiting `awsug.clouddelnorte.org/` is observable but not yet performed. The automated path landed in PR #402 (`harness(awsug): add --refresh-token-file for authenticated prod parity`, merged at `cab18639` on 2026-05-28T03:39:26Z), which implements Cognito refresh-token grant + sessionStorage injection. The deferred automated run is tracked in `chasko-labs/cloud-del-norte-website#405`.

### Operational note — Roles Anywhere profile

Mid-iteration, the Roles Anywhere profile `kiro-device-farm` (cert under `~/.config/hs-secret/heraldstack-cdn.rocm-aibox.heraldstack.local.{crt,key}`, role `arn:aws:iam::946179428633:role/heraldstack-cdn-device-farm`) was verified working. Future Device Farm runs from `rocm-aibox` use `AWS_PROFILE=kiro-device-farm` instead of `bryanchasko-kiro`. This bypasses the boto3 single-sign-on token-refresh failure mode that bit this iteration twice.

### Follow-up issues filed (sub-task 3.7.b)

- `chasko-labs/cloud-del-norte-website#403` — `harness: device-farm capture subdomain field reflects input URL, not post-redirect final URL`. Silent-corruption defect that masked the redirect-to-auth path during iterations 1 and 2 and led to two iterations of misdiagnosis.
- `chasko-labs/cloud-del-norte-website#404` — `test-infra: dev.clouddelnorte.org/awsug-preview/ serves feed bundle via CloudFront SPA fallback — preview verify gate has been a false signal for three iterations`. Reframed from a benign auth-bypass note to the structural finding it actually is.
- `chasko-labs/cloud-del-norte-website#405` — `harness: deferred automated parity run for awsug.clouddelnorte.org via --refresh-token-file`. Tracks the Path A run that Path B defers. References PR #402 as the implementation.

### Cross-references

- `chasko-labs/cloud-del-norte-website#399` — original parity defect filing; closed at iter-3.7 with the inverted-parity reframe.
- `chasko-labs/cloud-del-norte-website#400` — `--base-url` flag harness restoration (merged on main earlier in iter-3).
- `chasko-labs/cloud-del-norte-website#401` — iter-3 fix PR, squash-merged at `c990cdb7`.
- `chasko-labs/cloud-del-norte-website#402` — harness `--refresh-token-file` flag, squash-merged at `cab18639`.
- `BryanChasko/haunting-kiro-cli#1158` — spec-discipline addendum.
- `.kiro/specs/music-player-playback/iter3-3.2-codemap.md` — disproof of the original LOCKED hypothesis + corrected hostname-classifier audit.
