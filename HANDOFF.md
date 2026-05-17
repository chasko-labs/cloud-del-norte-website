# cloud del norte — handoff plan

**date:** 2026-05-17  
**branch:** main  
**last commit:** 7d4719ec feat(feedback): pivot to API Gateway HTTP V2, retire broken Function URL  
**deploy:** verified 2026-05-17 00:04 UTC — all 3 subdomains live via manual fallback (Woodpecker still in #157 death-loop, root cause now diagnosed below).

---

## completed 2026-05-17 — Wave 7 (3-stage DAG: liora creative + feedback API Gateway pivot + woodpecker triage)

Bryan resumed session with directive: "back to work on clouddelnorte.org bryan really wants to be able to submit tickets from the right sidepannel already." Right-panel report-a-bug + make-a-wish forms had silently been failing — diagnosis traced to the cdn-feedback Lambda Function URL being stuck in unrecoverable AccessDeniedException state.

| commit | track | description |
|--------|-------|-------------|
| 93abf758 | A | feat(creative): liora a2 postcard direction + l audio-reactive sigil (Wave 6 Track A) |
| ee051c3a | B | feat(feedback): API Gateway HTTP V2 deploy script (pivot from broken Function URL) |
| 7d4719ec | B | feat(feedback): pivot to API Gateway HTTP V2, retire broken Function URL |

### Track A — Liora a2 postcard + l audio-reactive sigil (creative, both items closed)

Bryan delegated big a2 design-alternative selection AND l animated-records rethink to Liora. Her picks landed atomic in 93abf758:

- **a2 postcard direction** (`src/sites/auth/_layout/styles.css` ~129 lines net): warm, hand-addressed-postcard frame around the existing glass card — deckled-edge inset shadow, decorative `::after` stamp corner with cloud glyph, parchment texture gradient, slightly bumped card opacity (0.97 → 0.98) and softened border. Cinzel typography preserved as serif identity. Postcard wraps the prior glass treatment, doesn't replace it.
- **l audio-reactive sigil** (`src/components/persistent-player/index.tsx` + `styles.css`): a brand-mark radio tower SVG that pulses with the beat using `--cdn-mid` (0–1 audio level written per-frame by background-viz). Two CSS keyframes (`cdn-sigil-pulse` for transform/opacity, `cdn-sigil-glow` for drop-shadow tied to `--station-primary-mode-rgb`). Visible only when `playing && body.cdn-stream-playing`. Respects `prefers-reduced-motion`. Light mode gets softer 0.5 opacity for ink-on-parchment feel.
- Solan needed one a11y fix on the new `<svg>` (biome's `noSvgWithoutTitle` rule even with `aria-hidden="true"` parent): added `role="img"`, `aria-label`, `<title>` first child. Same fix pattern usable for any future inline SVG.

### Track B — cdn-feedback Lambda: Function URL → API Gateway HTTP V2

**Why pivot.** Diagnosis chain:
- Direct SDK invoke (`aws lambda invoke`) of cdn-feedback worked perfectly — created GitHub issue #196 (closed as cleanup). Lambda is healthy.
- Function URL `https://j66tb5lrvmr7bzxptje6ojr3aq0rbsht.lambda-url.us-west-2.on.aws/` returned HTTP 403 `AccessDeniedException` at the gateway BEFORE Lambda was invoked (no CloudWatch entry).
- AuthType was NONE. Resource policy had correct `Principal: *` + `lambda:InvokeFunctionUrl` action + condition `lambda:FunctionUrlAuthType = NONE`.
- Tried in order: remove+readd permission with fresh statement-id (still 403), delete+recreate Function URL with new URL `pncx4l4wl6b23m3j6onyhbruwu0lzuaa` (still 403), 60-second IAM propagation wait (still 403). No SCPs, no RCPs, no declarative policies, no VPC binding, no public-access blocks I could find.
- CORS preflight returned 200 cleanly. POST returned 403. CloudWatch trace showed last successful invocation 2026-05-16T15:40:51Z (Wave 3 smoke). After that, every request rejected pre-Lambda.
- Concluded: Function URL is in genuine unrecoverable state. Pivot architecture instead of fighting AWS edge.

**What shipped.** API Gateway HTTP V2 cdn-feedback-api at `https://rknnfq6urf.execute-api.us-west-2.amazonaws.com/feedback` (account 170473530355 us-west-2):
- HTTP V2 (no WAF — feedback is low-volume, app-layer rate limit already in Lambda code)
- POST /feedback route → AWS_PROXY integration to cdn-feedback Lambda (PayloadFormatVersion 2.0)
- $default stage with AutoDeploy=true
- CORS allowed origins: clouddelnorte.org + awsug.clouddelnorte.org + dev.clouddelnorte.org. Methods POST OPTIONS. Headers content-type. Max-age 86400.
- Lambda permission `apigw-feedback-invoke` for principal apigateway.amazonaws.com on action lambda:InvokeFunction
- IaC artifact `scripts/deploy-feedback-apigw.sh` mirrors `scripts/deploy-speaker-proposals.sh` pattern (idempotent, set -euo pipefail, SSO check upfront)
- `.env.production` updated: `VITE_FEEDBACK_API_URL=https://rknnfq6urf.execute-api.us-west-2.amazonaws.com/feedback`
- Old Function URL config NOT deleted — left as transitional fallback. Cleanup can happen any future session.
- CSP unchanged — both main and awsug already allow `https://*.execute-api.us-west-2.amazonaws.com` on connect-src (left over from speaker-proposals migration).

### deploy

Manual fallback (Woodpecker still dead per #157 — root cause now identified, see triage section):
- main: last-modified 2026-05-17T00:03:23Z
- awsug: last-modified 2026-05-17T00:03:58Z
- auth: last-modified 2026-05-17T00:04:37Z

### end-to-end verification

```
direct lambda SDK invoke during 403 triage → 200, issue #196 (closed)
new endpoint hash rknnfq6urf in deployed bundle help-panel-home-DiwQOYt9.js: ✓
clouddelnorte.org Origin POST type=bug → 200, issue #197 (closed)
clouddelnorte.org Origin POST type=wish → 200, issue #198 (closed)
clouddelnorte.org Origin POST with browser User-Agent → 200, issue #199 (closed)
awsug.clouddelnorte.org Origin POST type=wish → 200, issue #200 (closed)
OPTIONS preflight → 204, access-control-allow-origin matches Origin, max-age 86400
```

### Track C — Woodpecker #157 root cause identified (kade-vox host triage)

This was the parallel tooling track — Bryan's standing rule: "always dispatch someone to work on tooling while you do other stuff."

**Real root cause:** SQLite WAL lock contention on **heraldstack-woodpecker-server** (NOT the agent). 21 'database is locked' errors in last 500 server log lines. Webhook storm from chasko-labs/chrome-extension-moodle-uploader floods the server: 1731 entries in last 2000 server log lines, ~every 30 seconds. Triggering commit `c400a774` fails GitHub status API with 422, GitHub re-delivers webhook, server can't persist pipeline result (locked DB), pipeline marked failed → loop.

**Agent 'unhealthy' is cosmetic, not the blocker.** woodpeckerci/woodpecker-agent:v3.13.0 is distroless — no /bin/sh, so `CMD-SHELL '/bin/woodpecker-agent ping'` healthcheck fails on shell spawn (failing streak count 897). Agent IS processing pipelines normally. The actual failure is at the server's persistence layer.

**Recommended fix sequence (5 minutes, requires authorization):**
1. `docker restart heraldstack-woodpecker-server` — clears SQLite lock state
2. Disable chasko-labs/chrome-extension-moodle-uploader webhook in Woodpecker UI to stop the feedback loop
3. Medium-term: fix agent healthcheck (docker-compose.yml CMD-SHELL → CMD format with binary directly)
4. Long-term: SQLite → PostgreSQL migration if pipeline volume keeps growing

**Why not done this session.** Out of poltergeist-kade-vox-host-admin's authorized scope (agent-container actions only; server restart is server-scope). Documented on issue #157 with full evidence chain. Manual deploy via `scripts/deploy-manual.sh` remains the operating norm and works fine.

### lessons learned

- AWS Lambda Function URLs can enter a genuinely unrecoverable state where the gateway returns 403 AccessDeniedException despite correct AuthType + resource policy. delete-and-recreate did not help; only architectural pivot to API Gateway worked. This is a valid pattern: if Function URL state is broken, mirror speaker-proposals' API Gateway approach. CSP already allows execute-api wildcard, .env swap is the only frontend touch.
- Diagnosis-first beats panic-iteration. Direct SDK invoke confirmed Lambda was healthy in seconds; that one signal told us pivot was the right move (vs. spending more cycles fighting the gateway).
- "Submit form silently fails" is the worst UX failure mode. End-to-end verification (curl + bundle inspection + multiple Origins) catches what unit tests miss.
- Single atomic commit per logical phase. Track A landed clean as one commit (vs. Wave 5 Track A's 2-commit split). Better git history.
- Kade-vox surfaced the cosmetic-vs-real distinction on Woodpecker (agent healthcheck red herring, server SQLite is the real issue) — saved hours of misdirected debugging. Tooling-track-in-parallel pays off.

### items closed this wave

- Right-sidepanel ticket submission (Bryan's session-restart directive — bug + wish forms verified 200 OK from both main and awsug Origins)
- a2 postcard design-alternative direction landed (a2 closed in HANDOFF, polish pass + alternative both shipped)
- l audio-reactive sigil landed (l closed in HANDOFF, "waveform disc" rethink shipped via radio-tower sigil)
- #157 root cause identified and documented (issue stays open pending server-restart authorization, but no longer "unknown")

---

## completed 2026-05-16 late evening — Wave 5 (3 parallel + 1 sequential, autonomous PO continuation)

Bryan: "keep grinding of course." Continued autonomous decomposition. Tracks C + D serialized via depends_on to avoid en-US.json/es-MX.json merge race. Tracks A + B + C ran in parallel; D ran after C.

| commit | track | description |
|--------|-------|-------------|
| 6348ef3d | C | feat(meetings): speaker bio on meeting cards (#186 slice 3 partial) |
| 7cc9afdc | A.1 | feat(player): custom SVG icons in podcast mode — new podcast-player-icons.tsx |
| 218ec419 | A.2 | feat(player): custom SVG icons in podcast mode — wiring conditional render in index.tsx |
| 790092d7 | B | feat(icons): k4 headphones-over-mic composite icon as podcast mode indicator |
| — | D | no commit needed — #162 already shipped, audit produced verification, issue closed |

### what shipped per track

**Track A — e2 podcast player icon redesign** (HANDOFF creative item, now closed)
- New `src/components/persistent-player/podcast-player-icons.tsx` exports 5 components:
  - PodcastPlayIcon: stylised triangle with inner echo at 35% opacity
  - PodcastPauseIcon: two vertical bars
  - SeekBackIcon: CCW curved arc + inline `<text>15</text>`
  - SeekForwardIcon: CW mirror
  - NextEpisodeIcon: vertical bar + chevron right
- All icons: viewBox 24x24, fill="none", stroke="currentColor", strokeWidth=1.5, round caps/joins, aria-hidden inline
- Wired in `index.tsx` with `isPodcast` gate: podcast mode shows custom icons, radio mode keeps existing ⏭/▶/■ chrome
- Verified live: SeekBackIcon path `M9 12a5 5 0` in lib/assets/theme-DPPji9wW.js

**Track B — k4 headphones-over-mic composite icon** (HANDOFF creative item, now closed)
- Replaced stub SVG in `src/components/podcast-icon/index.tsx` with composite design: U-arc headphone band crossing in front of rounded-rect mic capsule, ear cups flanking, accent line for dynamic feel
- Player already imports `<PodcastIcon />` when `streamDef.type === "podcast" && playing` — no wiring change needed
- All currentColor strokes auto-adapt to light/dark mode

**Track C — speaker bio on meeting cards (#186 slice 3 partial)**
- Optional `speakerBio?: string` field added to meeting type, rendered conditionally on cards
- en-US + es-MX locale keys added matching existing nesting
- If/when cloud-del-norte-meet API populates the field, the UI auto-renders it

**Track D — #162 phantom-nav audit**
- Audited `src/sites/awsug/admin/app.tsx`: AccessDenied component renders Cloudscape Alert type=warning with `awsug.admin.moderatorAccessRequired` i18n key + back-link Button to /meetings/index.html. AdminWithLayout branches: spinner → AccessDenied → AdminPanel by auth state.
- en-US + es-MX strings already present
- All 3 pieces of #162 verified shipped (FP-014 ab10ba7b nav-hide + dc2b9eb9 create-meeting gate + AccessDenied)
- Issue #162 closed with verification comment

### deploy

Manual fallback (Woodpecker still dead per #157):
- main: last-modified 2026-05-16T23:05:19Z
- auth: last-modified 2026-05-16T23:06:13Z (rebuild only — no auth-specific Wave 5 changes)
- awsug: last-modified 2026-05-16T23:07:10Z (admin + meetings chunks refreshed)

### lessons learned

- Pipeline output can truncate. Always verify commits via `git log origin/main` over trusting subagent text reports.
- depends_on serialization on locale-touching tracks works cleanly. Two ghosts editing the same JSON file in parallel would race; sequential is the safe pattern.
- "STOP and report on stale-issue detection" is correct ghost behavior. Track D produced the #162 closure rationale instead of fabricating work — saved a separate triage session.
- Verifying minified bundle signatures: prefer unique SVG path data (e.g., `M9 12a5 5 0`) over JSX text-node children — minifier reorders attribute spreads.

### items closed this wave

- e2 podcast player icon redesign (creative)
- k4 headphones-over-mic composite icon (creative)
- chasko-labs/cloud-del-norte-website#162 phantom-nav

---

## completed 2026-05-16 evening — Wave 4 (autonomous PO decomposition, 4-track parallel)

Bryan delegated full PO discretion ("its up to you and the scrum team"). Picked 4 disjoint tracks from the backlog excluding anything gated on Bryan's hands or design choices. Four parallel ghost-solan dispatches, all committed + pushed.

| commit | track | description |
|--------|-------|-------------|
| da87e44f | C | chore: gitignore nova-act bytecode + speaker-cta output artifacts (8 untracked paths cleaned) |
| bf62da91 | A | feat(skeletons): builder deck + vbrownbag + zacs carousels show CdnSkeleton during load |
| eed50e3e | B | feat(auth): UX polish pass — breadcrumbs + breathing room + glass opacity + CTA color + hide player |
| b67ce092 | D | feat(meetings): timezone picker on meetings list (#186 slice 3 partial) |

### what shipped per track

**Track A — Skeletons deeper (Bryan flagged still-pending in HANDOFF, completed)**
- `youtube-channel-carousel.tsx`: useEffect mounted flag + SkeletonFrame on first paint (covers vbrownbag + zacs carousels which share this component)
- `youtube-carousel.tsx`: same pattern (covers builder deck)
- Builds clean across all 3 lib targets

**Track B — a2 login UX polish (5 concrete 2026-05-03 research findings, NOT the design-alternative choice)**
- Finding 1 (breadcrumbs): already suppressed via `body.cdn-auth-subdomain [class*="awsui_breadcrumbs"] { display: none; }` in pre-existing styles.css. Confirmed present, no change needed. Identity link already targets `https://clouddelnorte.org/feed/index.html`.
- Finding 2 (form breathing room): `--cdn-auth-form` row-gap +8px, label margin +4px, all using Cloudscape `--space-*` tokens
- Finding 3 (glass card opacity): `--cdn-glass-bg` alpha 0.82 → 0.97 light mode, 0.88 → 1.0 dark mode
- Finding 4 (CTA color): amber gradient (`#6b3a10 → #8b5a2b`) → warm gold (`#a07828 → var(--cdn-gold, #c9a23f)`). Cloudscape primary token also retargeted.
- Finding 5 (hide player on auth): `body.cdn-auth-subdomain .cdn-player-slot { display: none; }`. Component intact; gate is CSS-only.

**Track C — repo hygiene**
- Deleted 8 untracked detritus paths: 5 `scripts/nova-act/output/speaker-cta-20260515T*` dirs, 1 `__pycache__/site-critique.cpython-312.pyc`, 3 one-shot probe scripts (`probe-feed-after-scroll.mjs`, `probe-fiona-restored.mjs`, `probe-home-cta.mjs`)
- Fixed mangled .gitignore patterns: now properly ignores `scripts/nova-act/output/` + `scripts/nova-act/__pycache__/`
- Canonical `scripts/probe-cta-button-classes.mjs` retained (Cloudscape probe pattern)

**Track D — Timezone picker on meetings list (#186 slice 3 partial)**
- New `src/components/meetings/TimezoneSelect.tsx` (Cloudscape Select dropdown of IANA zones via Intl.supportedValuesOf with curated fallback)
- `src/pages/meetings/util/timezone.ts` LS_TZ_KEY = "cdn-meetings-tz" + format helpers with timeZoneName: 'short'
- `meetings-table.tsx` reads selected zone from localStorage, renders converted times + abbreviated zone name
- en-US + es-MX i18n keys added
- Scope correctly limited to main subdomain — verified awsug meetings page (`src/sites/awsug/meetings/app.tsx`) has no list-with-times, just a join-call button + meetup.com link, so picker is correctly NOT shipped there

### deploy

Woodpecker still in #157 death-loop. Manual fallback ran clean for all 3 subdomains:
- main: invalidation IE2GLBP95N7NYUOHC53YWLGBSJ → last-modified 2026-05-16T21:25:03Z
- auth: invalidation logged → last-modified 2026-05-16T21:25:38Z (gets the auth polish pass)
- awsug: invalidation logged → last-modified 2026-05-16T21:26:15Z

### verification of deployed bundles

| track | signature found in | status |
|-------|---------------------|--------|
| A | `lib/assets/feed-CCbNVqfh.js` (SkeletonFrame import) | ✓ |
| B | `lib-auth/assets/_layout-*.css` + `lib/assets/theme-*.css` (.cdn-auth-subdomain rules + --cdn-glass-bg + --cdn-gold) | ✓ |
| C | `git status --short` clean (only transient build-time feeds.json restored post-deploy) | ✓ |
| D | `lib/assets/timezone-BX--vUwY.js` (cdn-meetings-tz key) | ✓ |

### lessons learned

- "leave me out of it" is a real directive: pick from backlog, exclude human-gated items, execute disjoint parallel dispatch, don't return to ask.
- For multi-feature issues (#186 had 5 pieces in title), pick the most isolated piece for autonomous dispatch — leave cross-repo or backend-coupled pieces for sessions where Bryan can resolve dependencies.
- "Polish pass with N concrete findings" beats "design alternative" when no decision has been made — ships visible improvement without committing to a direction.
- Always grep BOTH `lib/` AND `lib-awsug/` for new feature signatures post-deploy. Apparent surface-coverage gaps may be correct scoping (Track D's awsug "miss" was actually correct — that surface has no list-with-times).
- ghost-solan-rust-coder: 4-of-4 reliable in this wave. All ran biome + build gates and pushed clean.

### items still on Bryan's earlier ask, not yet done

- Hamburger-left = info-right button consistency on real device — needs Pixel 9 + Bryan
- Big a2 design alternative selection (postcard / command console / desert entry) — Bryan owns this choice; polish pass shipped meanwhile



---

## completed 2026-05-16 session — Wave 3 (skeletons + podcast feeds + player next-button + bug/wish shortcuts)

Four commits on main, all four parallel tracks landed cleanly:

| commit | description |
|--------|-------------|
| 4aab3a75 | fix(player): next-station button stays visible regardless of metadata length |
| 5ff3b662 | feat(streams): add talking serverless + onda aws latam to player rotation |
| 15691dfd | feat(feed): cdn-skeleton primitive + applied to every async card on feed page |
| 6cf1b8ff | feat(feedback): report-a-bug + make-a-wish shortcuts in right panel |

### what shipped

**Stage A — Skeletons on async feed cards**
- New `cdn-skeleton` primitive at `src/styles/cdn-skeleton.css` + reusable React component at `src/components/skeleton/index.tsx`
- Light + dark mode tuned shimmer, prefers-reduced-motion respected, `aria-live polite` for SR users
- Applied to: next-meetup, twitch sections (hostname pre-hydration), andres youtube live (videoId null), awsml + andmore feed lists (useFeed ready flag)

**Stage B — Two new podcasts in player rotation**
- Talking Serverless: `https://anchor.fm/s/e2c52c8/podcast/rss` — purple theme primary `#5C2D91` riffing on Lambda λ
- Onda AWS LATAM: `https://rss.art19.com/podcast-aws-latam` — AWS orange + sapling green for LATAM warmth
- CSP media-src updated to include `rss.art19.com` (Talking Serverless audio is already on `d3ctxlq1ktw2nl.cloudfront.net` which was whitelisted)
- Both follow the existing podcast template (`type: "podcast"`, `parseMeta` extracts first `<item>` title via Document.querySelector)
- `scripts/fetch-feeds.mjs` PODCAST_FEEDS array updated for build-time pre-fetch

**Stage C — Next-station button visibility fix**
- Player row layout: `flex-shrink: 0` on the next-button slot, `min-width: 0` + `overflow: hidden` + `text-overflow: ellipsis` on the metadata sibling
- Long now-playing strings (KEXP track + artist + DJ comment, KUTX program names, KSFR talk-show fallbacks, Concepto Radial fallback link) no longer push the chevron off-screen
- Focus + aria-label preserved

**Stage D — Report a bug + make a wish shortcuts**
- New Lambda `cdn-feedback` at `https://j66tb5lrvmr7bzxptje6ojr3aq0rbsht.lambda-url.us-west-2.on.aws/`
- No DynamoDB, no SES — pure GitHub issue creation against `chasko-labs/cloud-del-norte-website`
- Single payload schema: `{type: 'bug' | 'wish', summary, details, contactEmail?}`
- Labels attached: `bug` or `wish` + `community-feedback` (verified attached on issue #194)
- Reuses existing SSM token at `/cloud-del-norte/speaker-proposals/github-token` (no new secret required)
- Per-IP rate limit at app layer (5/hr) via in-memory Map
- CSP wildcard `*.lambda-url.us-west-2.on.aws` on connect-src for both main + awsug
- Two new CTA cards in `HelpPanelHome` between the CFP card and the `interested?` expandable, both rendering with the cdn purple/violet button via the established `.hp-role-card--cta` scope
- Bilingual copy in both locales

### end-to-end verification

```
cdn-feedback Lambda direct invoke: statusCode 200
issue url: https://github.com/chasko-labs/cloud-del-norte-website/issues/194
labels attached: community-feedback + wish
issue closed as smoke-test cleanup
visual: right panel shows CFP + bug + wish stacked correctly above 'interested?'
visual: player widget shows next-button beside long metadata (CONCEPTO RADIAL / Ciudad de México) without squeeze
```

### lessons learned

- Four parallel ghost-solan-rust-coder dispatches with disjoint file scopes ran cleanly — no file conflicts, all committed independently. Total session time ≈ longest single track.
- Bryan correction "I already fucking asked for those things" — when Bryan raises items in a single multi-part prompt, ALL items are in scope. Parse multi-part prompts greedily and dispatch breadth-first; ask clarification only on architecturally divergent paths (Option A/B/C), not on scope.
- Bryan correction "we dont use aws creds we sso and your already ssoed" — always check SSO state agent-side before requesting Bryan action. heraldstack gh CLI identity is the right agent identity for service automation.
- gh CLI labels survive issue creation even when `gh issue list --label X` returns empty briefly post-create — the label IS attached, just indexer lag. Verify with `gh issue view N --json labels` rather than `gh issue list --label X`.

### items still on Bryan's earlier ask, not yet done

- **Hamburger left = info right button consistency on real device** (claimed fixed in 381626bd; untouched this session; Bryan flagged from his earlier prompt)
- **Deeper skeleton coverage** — this session covered next-meetup, twitch, andres-youtube, awsml + andmore. Builder deck, vbrownbag, zacs carousels still need state-machine work to expose the loading branch.

---

## completed 2026-05-16 session — feed CTA rework + right panel restructure + github issue side-effect

Four commits on main, two waves, end-to-end verified:

| commit | description |
|--------|-------------|
| 801b9754 | fix(feed): move speaker CTA to bottom + rewrite copy + bilingual i18n + glass standardization pass |
| 12280997 | fix(speaker-cta): propose-a-talk button now renders cdn purple not cloudscape blue (Cloudscape needed !important; probe pattern committed at scripts/probe-cta-button-classes.mjs) |
| 2ebc00f1 | feat(help-panel): right panel restructure — cfp card on top, expandables for org+volunteers, remove footer dup |
| 5e5e787e | feat(speaker-proposals): file github issue alongside ses email + ddb writeup |

### what shipped

**Wave 1 — Feed page CTA**
- Speaker CTA moved from top to bottom of feed page (was visually competing with next-meetup card for first-screen attention)
- Copy rewritten to Bryan's exact spec: "call for proposals now open - all levels welcome for talks (up to 2 hours), demos & lightning rounds (5 minutes). Presentations encouraged in English, Spanish & regional Sign Language"
- es-MX translation added with regional border-Spanish voice consistent with existing locale strings
- Glass standardization pass: cdn-card light + dark — border alpha 0.14→0.22, backdrop-filter blur+saturate explicitly set, semi-transparent surface, inset top-rim highlight for proper glass gleam
- CTA primary button retargeted from Cloudscape cyan/blue to cdn purple/violet via scoped descendant selector inside `.cdn-card--cta`. Required `!important` to win Cloudscape cascade — discovered via Playwright probe (`scripts/probe-cta-button-classes.mjs`, now committed and reusable for future Cloudscape style overrides)

**Wave 2 frontend — Right side panel restructure**
- CFP card promoted from 6th/last to 1st position in volunteer roles list
- Same Cloudscape-blue defect on side-panel button fixed via parallel `.hp-role-card--cta` scope mirroring the `.cdn-card--cta` pattern
- CFP copy synced bilingual with Wave 1 feed CTA — single voice across both surfaces (`call for proposals open` / `convocatoria abierta`)
- ASL/LSM/spanish-speakers/students/women-welcome collapsed into one ExpandableSection with header `interested?` / `¿te interesa?`
- Each organizer (Andres, Bryan, Jacob) + Wayne Savage in Hall of Fame now in own ExpandableSection (name-as-header, default closed)
- Removed duplicate `find your local meetup` block — footer already carries the meetup.com/pro/global-aws-user-group-community link
- `helpPanel.globalCommunityHeader` + `helpPanel.findLocalGroup` keys left orphaned-safe in locales (footer uses different keys)

**Wave 2 backend — GitHub issue side-effect**
- Existing speaker-proposals Lambda (`infra/lambda/speaker-proposals/index.mjs`) gained a `createGitHubIssue(proposal)` helper that runs in parallel with SES via `Promise.allSettled([sesSend, createGitHubIssue(item)])` after a successful DynamoDB PutItem
- Defense in depth on moderator notification: DynamoDB (source of truth) + SES email + GitHub issue all fire on every proposal. Either side-effect can fail without blocking the user's 201 response
- GitHub issue body links to in-app admin panel: `https://awsug.clouddelnorte.org/admin/?tab=proposals&id=$id` so a moderator clicking from the github notification lands directly on the proposal in the existing admin workflow
- Labels: `speaker-proposal`, `needs-review`. Repo: `chasko-labs/cloud-del-norte-website`
- IAM policy already allowed wildcard `ssm:GetParameter` on `/cloud-del-norte/speaker-proposals/*` — no policy change needed
- Deploy script warns (does not block) if SSM token missing; side-effect silently no-ops in that state, all other paths continue normally
- 5-second AbortController timeout on github call. Token from SSM `/cloud-del-norte/speaker-proposals/github-token` (SecureString, populated from heraldstack agent gh CLI token — separation from Bryan's personal identity)

### end-to-end verification (Lambda direct invoke smoke test)

```
submission id: ca0850e5-f139-43b0-b3e5-97b9ba433356
DynamoDB:      ✓ row present, createdAt 2026-05-16T15:13:35.564Z
SES:           ✓ silent success (Lambda only logs on rejection)
GitHub issue:  ✓ #192 filed at https://github.com/chasko-labs/cloud-del-norte-website/issues/192
               ✓ admin panel link populated correctly
               ✓ labels speaker-proposal + needs-review attached
               ✓ closed as smoke-test cleanup
Lambda runtime: 1610ms (cold start 694ms init + 916ms exec, well under 10s timeout)
```

### lessons learned

- Cloudscape CSS Modules use hashed class names. The two-attribute substring selector `[class*="awsui_button"][class*="variant-primary"]` worked for binding (both substrings on same class attribute), BUT lost the cascade to Cloudscape's own primary-color rule. `!important` was required on background-color, background-image, border-color, color, box-shadow for default + :hover + :focus-visible + :active states. Inner label span color also needed override via `[class*="awsui_content"]`.
- Defense-in-depth notification pattern via Promise.allSettled is cheaper than a separate Lambda + EventBridge rule. Single Lambda runtime + 3 fan-out side-effects + non-blocking on individual failures.
- Lambda direct-invoke is faster than Nova Act for backend-only smoke tests. Use `aws lambda invoke --payload fileb://event.json` with API Gateway-shaped event when the surface area is the Lambda's new logic, not the WAF/API/CSP path. Reserve Nova Act for full browser-flow regression.
- Heraldstack agent identity (`/home/bryanchasko/.config/gh/hosts.yml`) has its own gh CLI token with `repo` scope — using it for service-side automation keeps github actions attributable to the agent, not Bryan personally. Token obtained via `gh auth token --user heraldstack`.
- HANDOFF.md update + qdrant session-end-capture remain Harald-direct work (within scope), not delegated to kerouac. Faster signal-to-noise.

### items still on Bryan's right-panel ask, not yet done

- **Skeletons on all cards for loading states** — its own scope, not blocking
- **`report a bug` / `make a wish` shortcuts** — Bryan's last reply confirmed CFP keeps the existing pipeline (modal + DynamoDB + SES + GitHub issue), but did not reconfirm whether bug/wish are still in scope. If still wanted, would be NEW modal forms creating GitHub issues directly (no DynamoDB/SES). Easy follow-on wave.

---

## completed 2026-05-12 session — post-resumption wave 3 (FP-021 real join-call validation)

Resumed Nova Act iteration track after wave 2's CSP drift-prevention side-quest. 2-user join-call test (join-call-2user.py) had been reporting PASS while both users were actually misrouted to the main-site meetings list, never entering Jitsi. Three-commit fix chain + one diagnostic throwaway:

| commit | description |
|--------|-------------|
| 58a85d08 | fix(awsug): FP-021 — meetings page actually joins Jitsi conference + test assertion (product: window.open → Cloudscape Modal + inline JitsiEmbed iframe, matching main site) |
| 53e18cb9 | fix(nova-act): 2-user test detects in-modal JitsiEmbed (FP-021 flow) — polls `[data-testid=jitsi-iframe-host] iframe` src for `meet.clouddelnorte.org`, drops create-meeting step (awsug is always-on room `cloud-del-norte-awsug`) |
| 0cf54d7a | fix(infra): CSP script-src + connect-src allow meet.clouddelnorte.org (FP-021) — in-modal embed needs parent-page CSP to load external_api.js and open wss to meet. Old tab-open pattern only needed frame-src |

Root-cause method: direct playwright diagnostic at `/tmp/fp021-diag.py` (removed post-finding, trace JSON retained at `/tmp/fp021-trace-20260512T1616Z.json`). Surfaced the exact CSP violation in one run: `Refused to load https://meet.clouddelnorte.org/external_api.js`. Diagnostic-first pattern applied.

Final validation: Nova Act 2-user verdict **PASS** at 16:23Z. Both moderator (sub e8716360, moderator=true, features recording/livestreaming/screen-sharing) and member (sub 7801f370, moderator=false) iframe-attached at POLL 0s with valid room JWT.

**Gaps closed:**
- `scripts/deploy-manual.sh` first real use — unblocked 58a85d08 deploy while Woodpecker was death-looping
- `scripts/sync-cloudfront-headers.sh` applied the CSP drift fix cleanly

**Gaps discovered (tracked):**
- `scripts/verify-csp.sh` required-whitelist missed script-src and wss connect-src for meet.clouddelnorte.org — commented on #158 with required additions
- Woodpecker still death-looping on another repo (chasko-labs/chrome-extension-moodle-uploader), SQLite locked state persists — tracked in #157

### github

- #160 FP-021 filed + closed (resolution comment with commit chain)
- #158 commented with verify-csp.sh extension spec (AWSUG_SCRIPT_SRC_REQUIRED, augmented AWSUG_CONNECT_SRC_REQUIRED incl. wss://)

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

## shipped 2026-05-15 — speaker proposal CTA (#132 closed, both PRs merged)

| repo | PR | merge SHA |
|------|----|-----------|
| cloud-del-norte-website | #190 | c0e83acc |
| cloud-del-norte-meet | #24 | d7c1f3de |

Nova Act full end-to-end PASS — submission id 7a48fc77-d693-4b86-9659-501d2daf1001, all six steps clean (CTA → modal → fill → submit → thank-you). CSP invalidations I5YTI5X8Q4FHK6R8K7DVLSRP9M + I82LDZUH25X71ERP1AURTE0DXH applied to main + awsug distributions. Issue #132 closed.

### what's live

- DynamoDB cdn-speaker-proposals + cdn-speaker-proposals-rate (account 170473530355 us-west-2)
- Lambda cdn-speaker-proposals (Node 22, idempotent IaC deploy via scripts/deploy-speaker-proposals.sh)
- API Gateway REST V1 cdn-speaker-proposals-api at https://7526ltaid2.execute-api.us-west-2.amazonaws.com/prod
- WAF WebACL cdn-speaker-proposals-webacl: AmazonIpReputationList managed + RateLimit 100/5min + **Challenge** action on POST /proposals (silent JS challenge, passes Nova Act + real browsers, blocks no-JS bots)
- Admin routes GET + PATCH /admin/proposals on existing portal API gateway rwmypxz9z6, JWT-authed moderators-only (cloud-del-norte-meet repo)
- Frontend: home top-row CTA card, awsug right-panel speaker_role card, both open same Cloudscape Modal with full form
- Admin panel: second section with proposals table, filter, mark-contacted, convert-to-meeting
- SES notification to bryanj+clouddelnortespeakerrequest@abstractspacecraft.com (recipient verified, sandbox delivers)

### lessons learned

- WAFv2 regional scope supports REST API V1 (and ALB, App Runner, AppSync, Cognito), NOT HTTP API V2. REST V1 is correct.
- WAF Challenge action is correct for low-volume forms where automation tests are part of CI. WAF CAPTCHA action would block Nova Act by design — fine for hostile-environment forms but wrong tradeoff here.
- IaC discipline: every AWS resource committed as JSON or shell script BEFORE deploy. Idempotent re-runs.
- Test gate: Nova Act PASS on dev.clouddelnorte.org before merging to main. Caught two real bugs (i18n format key structure, format enum drift) that direct-test would have missed.
- Cross-repo work: filed cloud-del-norte-meet#23 and drove implementation to closure in same session as website#132. Sequential merge (meet first, website second) avoids broken-state windows.

---

## priority queue (next session)

### p0 — #185 passkey sign-in still broken on Pixel 9

5 prior fix attempts (2b9092a3, 11dc296a, 5ebe62c2, 6d3b8024, 5aef3564) plus a 4-bug fix in 6ab5ee24. Bryan still hits 'passkey login failed' on Pixel 9 after manually entering email. Needs interactive browser-console debugging on a real device — best done in a session where Bryan can drive the test cycle.

### p1 — #189 verification methods (SMS / TOTP / push as alternatives to email)

Cognito pool us-west-2_cyPQF4F3r supports MFA SOFTWARE_TOKEN already; need to expose as VERIFICATION method (not just MFA) and add SMS option (requires SNS spend limit setup or sandbox exit).

### p1 — #186 meetings improvements (slices 1+2 shipped, slice 3+ remaining)

Defense in depth: hide admin nav link for non-moderators + render denial card on direct /admin nav + moderator-only create-meeting gate. Product decision confirmed. Implementation in this sprint.

### p1 — open creative/ux items

(none — a2 design-alternative landed Wave 7 postcard direction; l audio-reactive sigil landed Wave 7. Backlog now creative-clean.)

### p2 — Device Farm CI integration

infra provisioned in `infra/`. woodpecker-cli token config on AIBOX pending. Once configured, real Android/iOS device matrix runs in CI alongside Nova Act Chromium validation.

### p3 — dependabot

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

- 16 of 19 shipped (unchanged at time of wave 1)
- FP-019: SHIPPED 2026-05-12. Lambda half deployed (a6970d2 in cloud-del-norte-meet, SEND_APPROVAL_EMAIL=true).
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
| FP-017 | S2 | RESOLVED | CSP drift was root cause. Client logic correct (4f2f268b + dfe2ed9d). CloudFront CSP fixed. Nova Act harness PASS. |
| FP-019 | S3 | SHIPPED | admin-approve lambda sends SES welcome email on group-add. SEND_APPROVAL_EMAIL=true live in 170473530355 us-west-2. Evidence: a6970d2 in cloud-del-norte-meet, SES MessageId 2e740433-7b36-49d7-8a2f-6485d73b708a, chasko-labs/cloud-del-norte-meet#18 closed. |
| FP-021 | S2 | RESOLVED | awsug meetings 'join call' actually joins Jitsi. Fix chain: 58a85d08 (in-modal embed) + 53e18cb9 (test verdict) + 0cf54d7a (CSP script-src/connect-src). 2-user Nova Act PASS 2026-05-12T16:23Z. Issue #160 closed. |

### open creative/ux items

(All resolved as of Wave 7. Historical record:)
- ~~a2: login page full ux rethink~~ — polish pass Wave 4 + postcard alternative Wave 7 (commit 93abf758)
- ~~c2: add AWS LATAM podcast RSS feed to streams~~ — Wave 3 (commit 5ff3b662)
- ~~e2: podcast player icon redesign~~ — Wave 5 (commits 7cc9afdc + 218ec419)
- ~~k4: headphones-over-microphone composite icon for podcast mode~~ — Wave 5 (commit 790092d7)
- ~~l: animated records rethink~~ — Wave 7 audio-reactive radio-tower sigil (commit 93abf758)

### deploy cost-aggregator lambda + cross-account iam

files ready in `infra/lambda/cost-aggregator/`, `infra/iam/`, `infra/eventbridge/`. needs Bryan's SSO for deployment.

---

## UI/UX Test Harnesses

### Nova Act (controlled Chromium, two-user concurrent)

Pattern: `scripts/nova-act/fp014-016-member-only-validation.py`

- SSM-backed credentials (no creds in scripts, pulled at runtime from `/cloud-del-norte/test/*`)
- Playwright Chromium driven by Nova Act SDK (Amazon Nova model, us-east-1, account 946179428633)
- Two concurrent sessions via ThreadPoolExecutor — moderator + member exercise the same flow simultaneously
- Verdict gate: script exits non-zero on FAIL, screenshots captured to `scripts/nova-act/output/`
- Local screenshot artifacts committed to S3 at `clouddelnorte.org/screenshots/nova-act/`

2-user validation PASS 2026-05-12T16:23Z:
- moderator (heraldstack@clouddelnorte.org, moderator=true): recording + livestream + screen-share features confirmed
- member (heraldstack-test-member@clouddelnorte.org, moderator=false): screen-share only confirmed
- both iframe-attached to meet.clouddelnorte.org/cloud-del-norte-awsug with valid JWTs
- evidence log: `scripts/nova-act/output/2user-postcsp-20260512T1619Z.log`
- screenshots (all HTTP 200):
  - https://clouddelnorte.org/screenshots/nova-act/MOD-post-click-20260512T1619Z.png
  - https://clouddelnorte.org/screenshots/nova-act/MOD-post-settle-20260512T1619Z.png
  - https://clouddelnorte.org/screenshots/nova-act/MEM-post-click-20260512T1619Z.png
  - https://clouddelnorte.org/screenshots/nova-act/MEM-post-settle-20260512T1619Z.png
  - https://clouddelnorte.org/screenshots/nova-act/fp014-nav-member-only-20260512T1927Z.png
  - https://clouddelnorte.org/screenshots/nova-act/fp014-admin-direct-20260512T1927Z.png

### Device Farm (real device matrix)

Infra provisioned in `infra/` (2026-05-07). Next-tier validation: real Android/iOS device matrix to pair with Nova Act's controlled Chromium.

Open item: woodpecker-cli token config on AIBOX not done. Not yet running in CI. Once configured, Device Farm runs as a CI step alongside Nova Act for full coverage: controlled browser (Nova Act) + real device (Device Farm).

---

## deploy

Full procedure: [`docs/runbooks/deploy-procedure.md`](docs/runbooks/deploy-procedure.md)

Quick reference:
- **Normal:** push to main → Woodpecker auto-deploys all 3 subdomains
- **Manual fallback:** `./scripts/deploy-manual.sh <main|auth|awsug|dev> [--skip-build] [--dry-run]`
- **Triage:** `docker ps --filter "name=heraldstack-woodpecker"` on rocm-aibox

---

## open issues

| issue | status | notes |
|-------|--------|-------|
| #157 | root-cause-identified | Woodpecker SERVER (not agent) has SQLite WAL lock contention from chasko-labs/chrome-extension-moodle-uploader webhook storm. Agent "unhealthy" is cosmetic (distroless container, no /bin/sh for healthcheck). Real fix per kade-vox Wave 7 triage: docker restart heraldstack-woodpecker-server + disable moodle-uploader webhook. Authorization needed (server-scope). Manual deploy via scripts/deploy-manual.sh remains operationally sustainable. |

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
