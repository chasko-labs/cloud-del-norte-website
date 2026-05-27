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

## Iteration 1 — Walking Skeleton (smallest viable fix, ≤ 1 working session)

**Goal:** ONE curated station playing on ONE subdomain in production.

- [ ] **1.1 Apply narrow fix**
 - Touch only the file(s) needed for the locked fix family.
 - Reference table for narrow fixes by family:

| Family | Narrow change |
|---|---|
| Autoplay policy | Audit auto-play paths firing before user gesture; ensure first play() is from real click. Add user-gesture-bound retry on NotAllowedError only. |
| CORS / crossOrigin | Toggle/remove `crossOrigin="anonymous"` to match the failing station's server policy. Per-stream override in `src/lib/streams.ts` if needed. |
| MIME type | Add `mimeType` field to `StreamDef`; emit `<source type="...">` from definition. Populate via `scripts/fetch-feeds.mjs` if derivable. |
| Rate-limit / 429 | Extend `streams-reachability.ts` cache to include 429 with backoff. Confirm semantics still match PR #361 corsBlocked→fail fix. |
| CSP narrow add | Add ONLY the missing domain to the relevant directive in `infra/cloudfront-security-headers.{main,awsug,auth}.json`. Run `scripts/verify-csp.sh`. |

- [ ] **1.2 Verify Property 2 (walking skeleton)**
 - Re-run Selenium against production after deploy.
 - Confirm at least one curated station plays on at least one subdomain.
 - If false: STOP. Do not broaden. Return to Iteration 0 with new findings.

- [ ] **1.3 Iteration 1 retrospective**
 - Update spec: did the fix family hold? Was the change narrow enough?
 - One paragraph: what's needed to broaden in Iteration 2.

**Iteration 1 DoD:** Property 2 PASS in production. Spec updated.

## Iteration 2 — Broaden (all stations, all subdomains)

**Goal:** Property 3 — all curated stations play on all three subdomains, OR per-station defects are documented as separate issues.

- [ ] **2.1 Re-run diagnostic across all stations × subdomains**
 - Same Selenium script.
 - Identify which stations still fail.

- [ ] **2.2 Apply per-station broadening**
 - For each still-failing station: confirm same fix family, apply per-stream override if needed, OR file a separate issue and remove from curated.
 - If a different fix family surfaces, file a separate spec — do not absorb into this one.

- [ ] **2.3 Verify Property 3, 4, 5**
 - Property 3: all curated play (or excluded with issue filed).
 - Property 4: Fiona screenshot diff against PR #360 baseline.
 - Property 5: CSP diff shows no widening, length ≤ 1783.

- [ ] **2.4 Iteration 2 retrospective**
 - Update spec: which stations needed per-stream config, what patterns emerged.

**Iteration 2 DoD:** all three properties PASS. Spec updated.

## Iteration 3 — Land

- [ ] **3.1 Open PR**
 - Title: `fix(player): music playback on production [<finding-class>]`
 - Body: link findings.md, captures, before/after Selenium, screenshots.

- [ ] **3.2 Merge through standard chain**
 - Auditor reviews → orin posts verdict → squash-merge → deploy.

- [ ] **3.3 Post-deploy verification on main**
 - Re-run Selenium against deployed main. All curated stations playing.

- [ ] **3.4 Final retrospective**
 - Append to spec: what was the actual cause, what didn't we expect, what feeds into streams architecture work going forward.
 - File any out-of-scope items surfaced (architectural BabylonJS overhaul, ops issues) as separate issues.

**Iteration 3 DoD:** all DoD checkboxes in `bugfix.md` checked. PR merged. Production verified via Device Farm.

## Cross-Cutting

- **Feedback loop**: every iteration ends with a retrospective task that updates the spec. No skipping.
- **Stop conditions**: any iteration that fails its DoD returns to the previous iteration with new evidence — no marching forward on a broken assumption.
- **Backlog hygiene**: items surfaced but out of scope go to separate issues immediately, not into this spec.

## Iteration 1 Retrospective

**What we predicted:** Walking skeleton would apply a hydration guard to src/components/persistent-player/index.tsx, fixing KEXP × clouddelnorte.org and unblocking Iteration 2 broadening.

**What we found:**
1. The Iteration 0 probe was defective — missing `return ` made execute_script's wrapper propagate `undefined` and the Python fallback coerced to `{}`. All Iteration 0 audio-state evidence (preClickAudio / samples / postClickAudio) was vacuous.
2. With the corrected probe, KEXP × clouddelnorte.org PASSES Property 2 on current main without any source change.
3. Most likely cause of bug-report → today resolution: side-effect fix from PR #361 (reachability probe fix) and four other player-touching commits in the window.
4. awsug/auth corrected-probe results: both FAIL — StaleElementReferenceException on play button (DOM/lifecycle category).

**Decision:** Pivot Iteration 2 to the failing subdomain(s) awsug + auth with new fix family: DOM/lifecycle (play button goes stale between locate and click due to component re-render during hydration on auth-subdomain pages).

**Probe correctness fix shipped:** commit f6d95b7b.

**No source-component change in Iteration 1.** Walking-skeleton TSX guard never applied because the bug did not reproduce on the walking-skeleton target.
