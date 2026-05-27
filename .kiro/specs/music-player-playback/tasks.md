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

- [ ] **1b.1 Identify re-render trigger on awsug pages**
 - Read-only investigation. No fixes applied here.
 - Targets: `src/sites/awsug/**`, any `AuthContext` / `useAuth` / auth-polling effects, `PendingApprovalBanner` or equivalent banners conditionally mounted on auth state, `useEffect` hooks in ancestors of `<PersistentPlayer />` that update state on a timer or auth event.
 - Output: ranked suspect list with `file:line`, brief explanation per suspect of why it could re-render the subtree containing the play button.
 - Dispatched to: `ghost-stratia-code-mapper`.

### Iteration 1c — Apply narrow fix

- [ ] **1c.1 Apply re-render guard to highest-ranked suspect**
 - Touch only the file(s) named in 1b.1 ranking.
 - **Do not** modify `src/components/persistent-player/**` (frozen).
 - **Do not** modify `src/lib/streams*.ts` (frozen).
 - **Do not** modify CSP (`infra/cloudfront-security-headers.*.json`) — not in suspect set.
 - Fix shape options (engineer chooses based on root cause):
   - Stable initial value to skip the post-mount state churn.
   - Hoist or memoize the effect that triggers the re-render.
   - Move the re-rendering ancestor to a sibling of the player slot so its updates don't replace the player subtree.
   - Remove the unnecessary state update if it has no UX effect on awsug.
 - Dispatched to: `ghost-tarn-cdn-react-coder`.

### Iteration 1d — Verify

- [ ] **1d.0 Adapt harness, push branch, wait for preview deploy**
 - Add a `--base-url` flag to `tests/device-farm/music-player-diagnostic.py` so the harness can target a non-production URL. Default keeps the current production URL list so existing callers don't break.
 - Commit on the same `spec/music-player-playback` branch as the fix.
 - Push `spec/music-player-playback` to trigger Woodpecker `deploy-dev-awsug` job. The preview lands at `https://dev.clouddelnorte.org/awsug-preview/`.
 - Poll Woodpecker pipeline status (DUTIES.md curl-with-token pattern) until the preview deploy completes.

- [ ] **1d.1 Device Farm smoke test (KEXP × awsug-preview only)**
 - Run `python3 tests/device-farm/music-player-diagnostic.py --base-url https://dev.clouddelnorte.org/awsug-preview/ --stations kexp --subdomains https://dev.clouddelnorte.org/awsug-preview/`
 - DoD checks (all must pass):
   - [ ] `audio.readyState >= 2` AND `audio.paused == false` within 5s of click on the preview.
   - [ ] No new console errors introduced.
   - [ ] No StaleElementReferenceException on play button.
   - [ ] `git diff src/components/persistent-player/` is empty (Property 6).
 - If any DoD check fails: STOP. Update `bugfix.md` with new findings. Do not open PR.

- [ ] **1d.2 Iteration 1 retrospective (forward-looking)**
 - Append to this file: which component was the actual re-render trigger, what guard was applied, why the smaller alternatives were ruled out, what feeds back into the streams architecture.

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
