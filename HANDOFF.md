# cloud del norte — handoff plan

**date:** 2026-05-11  
**branch:** main  
**last commit:** aec2cfba test(meetings): FP-012 test coverage  
**deploy:** verified 2026-05-11 20:43 UTC — all three targets (clouddelnorte.org, auth.clouddelnorte.org, awsug.clouddelnorte.org)

---

## completed 2026-05-11 session — friction-point sprint (16/19 shipped)

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

### also landed this session

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

## priority queue (next session)

### p0 — dkim cnames (unblocks signups)

SSO expired during 2026-05-11 session — Stratia dispatch blocked on Bryan's interactive `aws sso login`. DKIM CNAMEs resolving in Route53 but SES still shows FAILED (stale poll). Once SES auto-verifies, switch Cognito to DEVELOPER email mode.

monitoring window for #150 bucket deletion expires 2026-05-12.

**what's needed:**
1. `aws sso login --profile aerospaceug-admin`
2. verify SES DKIM status: `aws sesv2 get-email-identity --email-identity clouddelnorte.org --region us-west-2 --profile aerospaceug-admin`
3. if still FAILED: re-check 3 DKIM CNAMEs in Route53 zone Z045487217Y9179MTBU2Q
4. once SUCCESS: switch cognito user pool email config to `EmailSendingAccount=DEVELOPER`

### p1 — FP-019 admin force-refresh tool

design doc: docs/behavioral-logic-map/design-fp-019-admin-refresh.md  
implementation scope: admin Lambda + UI button to force token refresh for a specific user. eliminates out-of-band "please re-login" communication after group approval.

### p2 — exploratory test via chrome-devtools MCP

validate the 16 FPs shipped this session against live site:
- signup flow (FP-001 + FP-002 + FP-004 + FP-007)
- session-expired modal (FP-011 + FP-015)
- pending-approval banner + nav filtering (FP-003 + FP-016 + FP-017)
- Jitsi messaging (FP-009 + FP-013)
- admin nav hidden for non-moderators (FP-014)

### p3 — #150 bucket deletion

48h monitoring window expired 2026-05-12. pending SSO refresh to execute deletion of awsaerospace.org bucket.

### p4 — cognito DEVELOPER email mode

switch once DKIM verifies. then request SES production access (out of sandbox).

---

## remaining backlog

### friction points

| fp | sev | status | notes |
|----|-----|--------|-------|
| FP-005 | S3 | ACCEPTED | sessionStorage cleared on tab close — every new tab = full login. acceptable trade-off. |
| FP-006 | S3 | ACCEPTED | MFA every session — no remember-device. security trade-off for casual users. |
| FP-019 | S3 | DESIGNED-NOT-IMPLEMENTED | admin force-refresh tool. design doc at docs/behavioral-logic-map/design-fp-019-admin-refresh.md |

### open creative/ux items

- a2: login page full ux rethink — quick-fix shipped (glass card opacity/blur), full rethink still open. three design alternatives researched: postcard, command console, desert entry.
- c2: add AWS LATAM podcast RSS feed to streams
- e2: podcast player icon redesign — custom SVG play/pause, seek ±15s, next episode
- k4: headphones-over-microphone composite icon for podcast mode
- l: animated records rethink — "waveform disc" concept for podcasts (waveform bars partially address this)

### deploy cost-aggregator lambda + cross-account iam

files ready in `infra/lambda/cost-aggregator/`, `infra/iam/`, `infra/eventbridge/`. needs Bryan's SSO for deployment.

### dependabot alerts

five total. stale branches (`flatted-3.4.2`, `picomatch-2.3.2`) need closing and re-running against current package.json.

---

## infrastructure dependencies

### heraldstack-agent-identity (terraform)

- repo: chasko-labs/heraldstack-agent-identity
- provides: agent email identity, SES inbound email → S3, IAM role for Cognito admin ops
- agent email pattern: `heraldstack+cloud-del-norte-website-{version}@clouddelnorte.org`
- SES inbound: s3://heraldstack-agent-mail/inbound/
- IAM role: scoped to cognito pool us-west-2_cyPQF4F3r
- SSM params: /heraldstack/identity/cloud-del-norte-website/*
- cognito service account: heraldstack@clouddelnorte.org (sub: e8716360-c081-708a-1211-3234508e71d2, groups: members + moderators)
- cognito service account password: AWS Secrets Manager `cloud-del-norte/heraldstack-cognito-pw-nuPFyW` (account 170473530355)

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
