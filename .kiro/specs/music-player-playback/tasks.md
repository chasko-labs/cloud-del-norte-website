# tasks: music-player-playback

Iterations, not phases. Each iteration ships value or learning. Each ends with a retrospective task that updates the spec before the next iteration begins.

## Iteration 0 — Spike (timeboxed, ≤ 1 working session)

**Goal:** capture evidence sufficient to lock the fix family. No production code changes.

- [ ] **0.1 Author Selenium diagnostic script**
 - File: `tests/devicefarm/music-player-diagnostic.py`
 - Read first: `scripts/probe-cta-button-classes.mjs` (Playwright probe pattern), any existing `tests/devicefarm/` examples.
 - Boto3 + Selenium, TestGrid project ARN `arn:aws:devicefarm:us-west-2:946179428633:testgrid-project:0f1bfe22-0371-40c8-bcac-f96709363893`.
 - Auth: `AWS_PROFILE=bryanchasko-kiro` (SSO active) or Roles Anywhere via `/workload.crt` if running in CI.
 - Per-station capture: console (all levels), network HAR, audio state via `driver.execute_script`, body class list, performance entries.
 - Output: `tests/devicefarm/captures/<timestamp>/<station>.{json,har}`.

- [ ] **0.2 Run against all three subdomains**
 - Run script against `clouddelnorte.org`, `awsug.clouddelnorte.org`, `auth.clouddelnorte.org`.
 - Captures committed (no secrets — Selenium runs unauthenticated).

- [ ] **0.3 Findings classification**
 - File: `tests/devicefarm/captures/<timestamp>/findings.md`
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
 - Capture: `tests/device-farm/captures/20260527T190456Z/`.

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

Capture: `tests/device-farm/captures/20260527T190456Z/`. Result: `property2Pass: true`. Sample 1 (~500ms post-click) showed `readyState=4` and `paused=false`. No `StaleElementReferenceException`. No new SEVERE console messages. KEXP stream 200/audio-aac/ACAO=*.

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
 - Re-run `tests/devicefarm/music-player-diagnostic.py` against deployed main.
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

## Iteration 3 — Production subdomain classification (LOCKED hypothesis)

**Hypothesis:** `awsug.clouddelnorte.org` is misclassified at runtime as an auth subdomain. The `cdn-auth-subdomain` body class is applied (likely via a hostname check in the auth context provider or shell layout), which triggers `display: none` on `.cdn-player-slot` via the auth-subdomain CSS rule. The player mounts visible briefly, then is hidden once the classification resolves. Selenium clicks land on a hidden element and time out.

**Evidence backing this hypothesis** (capture `tests/device-farm/captures/20260527T193124Z/` from iteration 2 prod parity check, preserved as untracked artifact on operator filesystem):

- `preClickAudio.bodyClasses == ["cdn-nav-open", "cdn-auth-subdomain"]` on `awsug.clouddelnorte.org`.
- `preClickAudio.playerMounted == true` (player mounts visible).
- `postClickAudio.audioPresent == false, playerMounted == false` (player vanished by post-click capture).
- `fatal: TimeoutException: play button not clickable` (Selenium's wait failed `is_displayed() && is_enabled()`).
- `finalReadyState: 0` (audio never loaded; click never fired).
- Preview at `dev.clouddelnorte.org/awsug-preview/` does NOT reproduce because hostname-keyed auth detection never fires on a path-based subroute.

### 3.1 Re-confirm hypothesis with a fresh prod capture (no fix on main yet)

Run the harness against three targets, compare body classes:

- `awsug.clouddelnorte.org` — `cdn-auth-subdomain` expected PRESENT.
- `clouddelnorte.org` — `cdn-auth-subdomain` expected ABSENT.
- `dev.clouddelnorte.org/awsug-preview/` — `cdn-auth-subdomain` expected ABSENT (path-based subroute, no hostname trigger).

If the class distribution matches the hypothesis: confirmed. If not: revise hypothesis before proceeding.

Dispatched to: cdn-PO direct (no ghost — read-only Device Farm runs).

### 3.2 Code-mapper sweep — read-only

Identify every file that adds or removes `cdn-auth-subdomain` to/from `document.body`. Targets:

- `src/contexts/`
- `src/layouts/shell/`
- `src/sites/auth/`
- Any hostname-detection utility (likely `src/lib/` or `src/utils/`).

Report: file path, line number, exact code, conditional logic that drives the class application.

Dispatched to: ghost-stratia-code-mapper.

### 3.3 Fix the classification

`awsug.*` should NOT receive `cdn-auth-subdomain`. Likely a one-line check that needs to whitelist `awsug.*` alongside `clouddelnorte.org` (or, equivalently, narrow the auth-detection match to `auth.*` only).

Dispatched to: ghost-tarn-cdn-react-coder.

### 3.4 Verify on preview

Run the Device Farm harness against `dev.clouddelnorte.org/awsug-preview/` using the `--base-url` flag (restored to main in #400):

```
AWS_PROFILE=bryanchasko-kiro python3 tests/device-farm/music-player-diagnostic.py   --stations kexp --base-url https://dev.clouddelnorte.org/awsug-preview/
```

DoD per `bugfix.md`: `readyState >= 2`, `paused == false` within 5s, no `StaleElementReferenceException`, no new SEVERE console messages.

### 3.5 Open PR — standard chain

Auditor (ghost-stratia-haunting-auditor) → orin (ghost-orin-ci-cd) merge → deploy.sh from haunting source.

### 3.6 Production parity check

Run the harness against `awsug.clouddelnorte.org` (no `--base-url`, default subdomain list filtered to awsug):

```
AWS_PROFILE=bryanchasko-kiro python3 tests/device-farm/music-player-diagnostic.py   --stations kexp --subdomains https://awsug.clouddelnorte.org
```

If prod parity passes: iteration 3 closes successfully.
If prod parity fails: stop, classify, surface to cdn-anchor. Do not march forward.

### 3.7 Iteration 3 retrospective + close #399

Append retrospective entry to this file under `## Iteration 3 Retrospective`. Close `chasko-labs/cloud-del-norte-website#399` with the iter-3 fix commit referenced.

### Out of scope for Iteration 3

The original AuthContext re-render race fix from `bbc95540` is **NOT** included in this iteration. That fix was correct for the iter-1-observed defect (StaleElementReferenceException on a re-rendering button), but the iter-1 prod baseline was misread — at the time, the play button WAS visible enough to locate, then the re-render race added staleness on top of an already-broken visibility regime.

Whether the AuthContext fix should re-land at all depends on what Iteration 3 finds:

- If the subdomain-classification fix alone makes prod pass: the AuthContext idempotent-setState change is a separate cleanup PR with its own review. Do NOT auto-include it in Iteration 3.
- If the subdomain-classification fix does not fully resolve prod: re-evaluate whether the AuthContext fix is still needed, in a follow-up iteration with its own evidence base.

### Constraints (carried forward)

- Code authorship is ghost-only (PreToolHook blocks PO writes).
- Frozen paths (must not be modified): `src/components/persistent-player/**`, `src/lib/streams*.ts`, `infra/cloudfront-security-headers.*.json`, Fiona/BabylonJS/WebGL/footer/weather components, `streams-reachability.ts`.
- Iteration 3 IS permitted to touch `src/contexts/`, `src/layouts/shell/`, `src/sites/auth/`, and hostname-detection utilities (frozen list does not cover these).
- No CSP widening.
- `auth.clouddelnorte.org` remains out of scope (intentionally hidden via display:none, as designed).
- `--base-url` flag is on main from PR #400; no harness restoration needed during iter-3.
- Spec-discipline addendum filed at `BryanChasko/haunting-kiro-cli#1158`; iter-3 references both that issue and `chasko-labs/cloud-del-norte-website#399`.
