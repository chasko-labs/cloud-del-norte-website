# cloud del norte — handoff plan

**date:** 2026-05-12  
**branch:** main  
**last commit:** 51c09cb9 test(nova-act): fix 2-user join-call flow  
**deploy:** verified 2026-05-12 00:31 UTC — all three targets (clouddelnorte.org, auth.clouddelnorte.org, awsug.clouddelnorte.org)

---

## completed 2026-05-12 session — post-resumption wave 2 (FP-017 root-cause + CSP fix)

### root-cause discovery

FP-017 (stale token groups after admin approval) was listed as shipped via 185c785b. Nova Act validation on 2026-05-12 surfaced it as FAIL. Three fix commits attempted — all had correct client logic:

| commit | approach |
|--------|----------|
| 185c785b | hook without Hub subscription |
| 4f2f268b | hook with Hub subscription listener |
| dfe2ed9d | force-reload on pending→member transition |

Deep diagnostics revealed the real root cause: **CloudFront response-headers-policy CSP `connect-src` was missing `cloud-del-norte.auth.us-west-2.amazoncognito.com`**. Every `refreshTokens()` fetch to `/oauth2/token` was silently blocked at the CSP layer. The repo file `infra/cloudfront-security-headers.json` had the correct directive — live CloudFront had drifted from it.

### infra fix applied

| item | value |
|------|-------|
| policy ID | ef81b3a7-9f54-4871-9d45-0864456d843b |
| ETag after update | E3UN6WX5RRO2AG |
| invalidation | I83PQYL9Y171I0WSZ21TQDXW7H |
| validation | Nova Act confirmed reload fires ~37s post-approval. Session ended INCONCLUSIVE (harness didn't survive reload — separate test-infra issue, dispatched). |

### commits to keep

| commit | description |
|--------|-------------|
| 4f2f268b | fix(awsug): FP-017 — Hub subscription listener for token refresh |
| dfe2ed9d | fix(awsug): FP-017 — force-reload on pending→member transition |
| TBD (solan) | infra: reconcile cloudfront-security-headers.json CSP with live policy |

### lessons learned

CSP drift between repo (`infra/cloudfront-security-headers.json`) and live CloudFront caused three false-failure cycles. Repo must be source of truth, applied via automation — not manually edited on CloudFront console.

---

## priority queue (next session)

### p0 — FP-017 harness re-confirmation

Nova Act reload-survival fix dispatched. Once harness passes full cycle (pending→approved→reload→nav-update), FP-017 is fully closed.

### p1 — FP-019 Lambda half (cdk deploy)

commit 58a13c4 in cloud-del-norte-meet. Needs `cdk deploy` by Bryan (DKIM now SUCCESS or still pending — check first).

### p2 — watch DKIM flip to SUCCESS

poll: `aws sesv2 get-email-identity --email-identity clouddelnorte.org --region us-west-2 --profile aerospaceug-admin`

once DkimStatus = SUCCESS:
1. dispatch to cloud-del-norte-meet repo → implement FP-019 Lambda half (admin-update-user + SES.SendEmail + feature flag per design doc section 4.1)
2. switch Cognito pool email mode to DEVELOPER with noreply@clouddelnorte.org
3. request SES production access (exit sandbox)

### p3 — exploratory test with member-only user

use chrome-devtools MCP against live site, logged in as cdn-member-only-test@clouddelnorte.org (member-only, not moderator):
- validate FP-014: admin nav hidden from non-moderators
- validate FP-016: pending-user nav filtering
- prior tests couldn't cover these — all test users were moderators

### p4 — open creative/ux items (unchanged)

- a2: login page full ux rethink
- c2: add AWS LATAM podcast RSS feed
- e2: podcast player icon redesign
- k4: headphones-over-microphone composite icon
- l: animated records rethink — "waveform disc" concept

### p5 — dependabot

0 open alerts (all 4 closed last session).

---

## completed 2026-05-12 session — post-resumption wave 1 (FP-019 UI half + nova act + infra) (archive)

### commits landed

| commit | description |
|--------|-------------|
| e8750570 | feat(awsug,admin): FP-019 — display approved user email in success toast (UI half; Lambda+SES half in cloud-del-norte-meet repo, blocked on DKIM) |
| 51c09cb9 | test(nova-act): fix 2-user join-call flow — use in-app JWT exchange not direct meet nav (moderator + member both reach Jitsi via join-call button + JWT token exchange) |
| ab10ba7b | fix(awsug): FP-014 actually hide admin nav from non-moderators — confirms isMod gate present in navigation.tsx (triage false alarm resolved) |
| b5c299e1 | test(nova-act): fix start-meeting prompt (superseded by 51c09cb9) |
| 6a7e26b2 | test(nova-act): 2-user join-call validation for 16 FPs (superseded by 51c09cb9) |

### infra state changes

| item | status | details |
|------|--------|---------|
| DKIM (clouddelnorte.org, us-west-2, acct 211125425201) | PENDING | flipped from FAILED→PENDING via `verify-domain-dkim` + `verify-domain-identity` nudges. root cause: SES stuck on stale HOST_NOT_FOUND from 2026-05-10T19:48Z. DNS correct (all 3 CNAMEs resolve via 8.8.8.8). SES will re-poll → SUCCESS within hours. |
| bucket #150 + epic #144 | CLOSED | orin dispatch, GitHub comments posted. awsaerospace.org S3 returns 404/NoSuchBucket. CloudFront ECC3LP1BL2CZS serves from S3-clouddelnorte-org. zero Route53 aliases remain. migration done. |
| cognito test user (member-only) | CREATED | cdn-member-only-test@clouddelnorte.org, sub c8b16350-1091-703f-5ed9-1ed91a6bf9d2, groups=members ONLY. pw in SSM /cloud-del-norte/test/member-only-user-password (acct 170473530355, us-west-2). fills gap: existing test users are all moderators, can't validate FP-014/FP-016. |

### friction point status

- 16 of 19 shipped (unchanged)
- FP-019: DESIGNED + UI-HALF-SHIPPED. Lambda half blocked on DKIM SUCCESS.
- FP-014: triage false alarm resolved — confirmed shipped in ab10ba7b.

---

## completed 2026-05-11 session — friction-point sprint (16/19 shipped) (archive)

source registry: docs/behavioral-logic-map/friction-points.md

### s1 — critical (2/2 cleared)

| fp | commit | description |
|----|--------|-------------|
| FP-001 | 9b018a39 | MFA help text, app store links, support contact on MFA_SETUP screen |
| FP-002 | e110d311 | MFA abandonment escape path — cancel/back doesn't lock account |

### s2 — high (9/9 cleared)

| fp | commit | description |
|----|--------|-------------|
| FP-003 | 185c785b | pending-approval banner with "admin will review" context + ETA |
| FP-009 | 447ccc12 | Jitsi cold-start "meeting room is starting up" messaging |
| FP-010 | 96d38531 | pending-user join attempt — explains WHY 403 + what to do |
| FP-011 | 07ea8af9 | session-expired modal with re-login button + returnTo preserved |
| FP-013 | 447ccc12 | Jitsi unreachable error state with retry button |
| FP-014 | 96d38531 | phantom navigation — admin nav hidden for non-moderators |
| FP-015 | 07ea8af9 | silent auth failure → session-expired modal with re-login flow |
| FP-016 | 96d38531 | nav filtering for pending users — hide inaccessible items |
| FP-017 | 185c785b | stale token groups — silent 60s refresh poll picks up approval |

### s3 — medium (4/7 cleared)

| fp | commit | description |
|----|--------|-------------|
| FP-004 | e110d311 | password policy shown before first attempt (not only on failure) |
| FP-007 | 96d38531 | signup wizard state persisted — tab close doesn't lose progress |
| FP-012 | aec2cfba | camera/mic denial — test coverage added (impl in 13a694a1) |
| FP-018 | 9b018a39 | admin denial copy fixed — "moderator access" not "member approval" |

### s4 — low (1/1 cleared)

| fp | commit | description |
|----|--------|-------------|
| FP-008 | e110d311 | "sign in with passkey" translated via i18n t() function |

### also landed that session

- 433fcf1b docs: behavioral logic map — mental models, decision trees, friction registry (12 files, 1738 insertions)

---

## completed 2026-05-10 session (archive)

- b3599c90 side panel footer bleed fix (a1)
- ca3c5ad7 podcast resume position (d1, PR #152)
- d98f96d1 bucket migration awsaerospace.org → clouddelnorte.org
- 095261f6 lazy-load video embeds
- e4e9a55e costs page hidden from prod
- 19ef9a62 hamburger jump fix + stars skeleton + #fff→cream
- 85c891ab fast-xml-builder security dep (PR #141)
- dad164e6 tactile button press feedback (e1)
- 6fec7b46 Alfa Slab One typography (h3)
- b7e37013 treble dampening — bass/mid dominate (j1)
- 0c5394b6 chromatic aberration on name scroll (i1)
- c4feb83b waveform freeze-frame bars (e1)
- ee9ae468 LED beat-sync via cdn-beat-bank classes (h1)
- a170f8e6 photosensitivity fix + skip button overflow (g1, b1)
- 685405e2 dancer icon (k1)
- c2de7cd7 podcast icon (k2)
- 1e5811a2 radio tower on franklin (k3)

---

## completed 2026-05-08 session (archive)

token refresh fix, nav cleanup, CSS fixes (player overflow, footer, speakeasy neon), liora frame error logging, costs tab + lambda backend, SES domain verification started, git reconciled, nova act working on aibox.

---

## remaining backlog

### friction points

| fp | sev | status | notes |
|----|-----|--------|-------|
| FP-005 | S3 | ACCEPTED | sessionStorage cleared on tab close — every new tab = full login. acceptable trade-off. |
| FP-006 | S3 | ACCEPTED | MFA every session — no remember-device. security trade-off for casual users. |
| FP-017 | S2 | RESOLVED (pending harness re-confirmation) | CSP drift was root cause. Client logic correct (4f2f268b + dfe2ed9d). Live CloudFront CSP fixed. Harness re-run needed. |
| FP-019 | S3 | DESIGNED + UI-HALF-SHIPPED | UI toast in e8750570. Lambda half: 58a13c4 in cloud-del-norte-meet, needs cdk deploy by Bryan. |

### open creative/ux items

- a2: login page full ux rethink — quick-fix shipped (glass card opacity/blur), full rethink still open. three design alternatives researched: postcard, command console, desert entry.
- c2: add AWS LATAM podcast RSS feed to streams
- e2: podcast player icon redesign — custom SVG play/pause, seek ±15s, next episode
- k4: headphones-over-microphone composite icon for podcast mode
- l: animated records rethink — "waveform disc" concept for podcasts (waveform bars partially address this)

### deploy cost-aggregator lambda + cross-account iam

files ready in `infra/lambda/cost-aggregator/`, `infra/iam/`, `infra/eventbridge/`. needs Bryan's SSO for deployment.

---

## infrastructure dependencies

### heraldstack-agent-identity (terraform)

- repo: chasko-labs/heraldstack-agent-identity
- provides: agent email identity, SES inbound email → S3, IAM role for Cognito admin ops
- agent email pattern: `heraldstack+cloud-del-norte-website-{version}@clouddelnorte.org`
- SES inbound: s3://heraldstack-agent-mail/inbound/
- IAM role: scoped to cognito pool us-west-2_cyPQF4F3r
- SSM params: /heraldstack/identity/cloud-del-norte-website/*

### cognito test users (user pool us-west-2_cyPQF4F3r, account 170473530355)

two tiers of test identity:

| tier | users | groups | password location |
|------|-------|--------|-------------------|
| moderators | heraldstack@clouddelnorte.org (sub e8716360-c081-708a-1211-3234508e71d2), bryanj+clouddelnorte@abstractspacecraft.com, smoketest | members + moderators | Secrets Manager `cloud-del-norte/heraldstack-cognito-pw-nuPFyW`, SSM `/cloud-del-norte/test/smoketest-user-password` |
| members-only | cdn-member-only-test@clouddelnorte.org (sub c8b16350-1091-703f-5ed9-1ed91a6bf9d2) | members | SSM `/cloud-del-norte/test/member-only-user-password` |

members-only tier created 2026-05-12 for FP-014/FP-016 nav-filter validation. email in SSM `/cloud-del-norte/test/member-only-user-email`.

---

## appendix — ux research findings

### login page critique (2026-05-03)

see section a2 above for summary. three design alternatives: postcard, command console, desert entry.

detailed findings:
- breadcrumbs on a login page distract rather than orient — remove or replace with top-left logo link
- cloudscape form labels feel institutional — softer placeholder text, more vertical breathing room
- glass card on animated 3D creates cognitive overload — increase card opacity or add dark scrim
- amber CTA reads as "caution" not "let's go" — consider warm gold or brand secondary
- player slot adds a third focal point during auth — optionally hide on auth pages

### podcast + music player patterns (2026-05-03)

- resume-position: `HTMLMediaElement.currentTime` + `localStorage`. standard since 2015.
- long title: marquee scroll preserves control real estate. apply only when `scrollWidth > clientWidth`.
- tactile buttons: `transform: scale(0.94)` on `:active` + overshoot easing. 60ms duration.
- visual interest without audio reactivity: circular time-ring progress + waveform freeze-frame bars + state-transition animation.
- episode-art badge: 40×40px circular image anchored in transparent-left zone. fallback to station brand color.

### franklin mountains tower reference (2026-05-03)

- north franklin mountain peak: 7,192 ft — anchor point for the k3 icon
- ridge composition: precambrian, billion-year-old sedimentary/igneous mix — weathered, fractured, jagged silhouette
- FCC antenna database confirms transmitter infrastructure on the mountains
- icon style: viewBox 24×24 or 32×32, right-leaning jagged ridge, skinny vertical mast at peak, 3-4 horizontal crossbars, blinking light at tip (0.5 Hz CSS opacity pulse)
