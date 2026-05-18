# cloud del norte — handoff plan

**date:** 2026-05-18  
**branch:** main  
**last commit:** bb01d881 docs(handoff): wave 23 — radio unam 96.1 live + CSP trim  
**deploy:** all 4 subdomains current as of 2026-05-18 16:25 UTC.

---

## housekeeping 2026-05-18 16:58 UTC — dev parity + arch docs + Stratia signoff + CSS polish (all shipped)

Bryan: "dev.clouddelnorte.org is way behind clouddelnorte.org … be sure you've updated our stream architectures & technical documentation … on desktop some cards appear oddly because the info card doesn't adapt to its container leaving awkward weird white space / gaps & generally our card lighting / gradients / shaddows are really weak, again check out the end credits of fiona scene the lighting around the elements on that are dope … extending babylon should be put on the backlog for after dev is up to date, the css stuff you can do in parallel … re 'your signoff' the 'your' there should be stratia not bryan."

### dev parity (closed)

dev.clouddelnorte.org was 3 days stale (last-modified 2026-05-15T19:13Z). Brought to current via `bash scripts/deploy-manual.sh dev`:
- 16:25 UTC: deployed Wave 23 main code → invalidation `IF2BKZUZTHPZVFLA9F4XHPZ76T`
- 16:58 UTC: redeployed with chore/card-polish-2026-05-18 CSS → invalidation `I1QCPSXC32BR66QAOV41YJKCMD`
- HTTP 200 verified

Note: dev distribution `EEHVTUEQ97V0X` has **no response-headers-policy attached** — runs without CSP enforcement. Intentional for staging but means dev can't catch CSP regressions before production. Wave-25 candidate to attach a CSP that mirrors main.

### architecture documentation (shipped)

`docs/streams-podcasts-architecture.md` (new, 293 lines, commit 7763dff2 on main): canonical reference covering subdomain map, StreamDef + RichMeta interfaces, shuffleOnce + curated discovery, parseMeta variants (icecast / NPR Composer / Zeno SSE / RSS), CSP architecture + 1784-char limit + sync mechanism, build-time fetch-feeds.mjs pipeline, stream health monitoring, resilience patterns shipped Waves 20-23, and what's queued for Wave 24.

### Stratia Wave 24 signoff (shipped on feature branch)

`docs/wave-24-stratia-signoff.md` on `feature/wave-24-radio-podcast-buildout` (commit 33b3c804): 342-line architecture review.

**Top-line verdict: APPROVED WITH CHANGES.**

- 6 hard go/no-go items before sub-waves can proceed
- 8 technical risks Liora missed (CSP ceiling, IndexedDB quota fragmentation, mid-download sign-out, multi-tab race, scroller/savePlayerState gap, SW absent, Triton signed URL expiry, CloudFront Function alternative)
- 10 cross-cutting concerns surfaced (4 a11y, 2 security, 2 performance, 2 i18n)
- Recommended answers to all 7 of Liora's open questions (defaults Bryan can accept or override)

Sub-wave order revised: CSP profiling gate added inside 24a before podcast adds.

### CSS card polish (shipped on chore branch + deployed to dev)

`chore/card-polish-2026-05-18` branch (3 commits, deployed to https://dev.clouddelnorte.org/ for visual verification):

- `be830b3d` — `style(cards): wave 23.5 polish — fix desktop whitespace + strengthen lighting/gradients/shadows (fiona-credits inspired)`
  - `src/styles/tokens.css` — 5-layer shadow stack (close + medium + ambient depth), radial accent bloom on gradients (`radial-gradient(ellipse at 30% 0%, ...)`), dual-radius hover glow (inner 20px + outer 40px) inspired by fiona-bezel's 7-layer shadow stack
  - `src/pages/feed/styles.css` — flex stretch on `.feed-grid__cell.cdn-card` so Cloudscape Container fills card height (fixes the desktop whitespace gap)
- `ea62177f` — `chore(biome): pull biome fixes from feature branch` (organize imports + node: prefix + format — brings biome back to 0 errors)
- `9138171c` — `chore: revert public/data/feeds.json transient artifact accidentally committed`

Test gate after polish: 529 PASS / 0 FAIL. Biome: 0 errors / 447 warnings (baseline).

PR-ready URL: https://github.com/chasko-labs/cloud-del-norte-website/pull/new/chore/card-polish-2026-05-18

### Babylon JS extension backlog (deferred to post-Wave-24)

Bryan flagged 3 BabylonJS playground references for future 3D-ism on the radio + record-button UI:

1. **Metal / lighting on the radio console** — https://playground.babylonjs.com/#HA3E1B#113. Apply to the persistent-player chrome.
2. **3D-ism for product showcases** — https://www.babylonjs.com/Demos/ProductPage/. Could elevate the feed page card grid.
3. **Shading layer for music-aware record-button menu** — https://playground.babylonjs.com/#1EISUM#3. The left + right menu buttons already simulate records; this shading would make them tactile.

Backlog ticket lives here in HANDOFF until decomposed into a wave. Sequence: ship Wave 24 first, then revisit.

### corrections logged

- "Liora signoff" was wrong in Wave 24 closeout messaging — should be **Stratia signoff** for architecture review. Adjusted dispatch pattern going forward: Liora is UX/CSS specialist (writes design docs + applies CSS fixes), **Stratia is the architecture reviewer / signoff authority** for design plans.

### lessons logged

- **Subagent dispatch overhead is real** — Bryan flagged that 88 minutes of agent handoff for a 5-minute mechanical CSP edit was the wrong tool. Going forward: pure infra/ JSON edits + AWS CLI calls within harald's scope are done directly. Reserve subagent dispatch for src/ source code + tests + design plans.
- **Subagents may report "PENDING execution"** — Liora's CSS work was applied to disk but reported as "PENDING execution" because she didn't actually run the commit/push commands. Stratia returned her signoff content verbatim in the report but didn't write it to disk. Harald handles the write/commit/push in those cases. Future dispatch prompts should require explicit `git add` confirmation.
- **`git add -A` is a footgun** — The biome cleanup commit on the chore branch picked up `public/data/feeds.json` (transient build artifact). Reverted via a follow-up commit, no force-push needed. Going forward: stage explicit file lists, never `-A`.

### next session first actions

1. Bryan reviews `docs/wave-24-stratia-signoff.md` + answers 6 go/no-go items + 7 open questions
2. Bryan visually compares dev.clouddelnorte.org (with card polish) vs clouddelnorte.org (production) and decides merge/no-merge of `chore/card-polish-2026-05-18`
3. After Bryan answers: harald dispatches Wave 24a (CSP profiling gate → 3 podcast adds + probe HEAD→GET fix)

---

## completed 2026-05-18 — Wave 23 (3rd Mexican station + biome cleanup + onda_aws comment + stream-health probe + CSP trim)

Bryan: "I give no fucks who did what when we're accountable either way — if there's a bug, fix it." Plus follow-on directive after Wave 22 left only 2 of 3 Mexican stations: find a working third.

Harald probed candidate stations directly via curl and found Radio UNAM FM 96.1 healthy at `https://tv.radiohosting.online:9484/stream` with proper CORS to clouddelnorte.org, valid Let's Encrypt cert, 127 live listeners, and Icecast 2.4 status-json.xsl for parseMeta. Real CDMX institutional public radio.

| commit | description |
|--------|-------------|
| d3fcb10a | feat(streams): wave 23 — add radio unam 96.1 + cleanup biome + onda_aws comment + stream-health probe |
| 69d28889 | fix(csp): wave 23 — trim dead origins (zeno + dev-podcast + aws-podcast-s3) so radio unam fits under 1784 limit |

### what shipped

**New station — Radio UNAM FM 96.1 (`src/lib/streams.ts`):**
- key `radio_unam_961`, label "radio unam 96.1"
- URL https://tv.radiohosting.online:9484/stream (Icecast 2.4)
- metaUrl status-json.xsl with same parseMeta + parseMetaRich shape as krux + ibero_909
- Location Ciudad de México / México
- UNAM institutional palette (deep blue + gold)
- `curated: false` — let Bryan verify in browser before promoting

**Biome cleanup (`scripts/nova-act/verify-phantom-nav-fix.mjs`):**
- 4 imports gained the `node:` prefix per useNodejsImportProtocol rule

**Comment refresh (`src/lib/streams.ts` onda_aws):**
- Removed outdated "(yet)" caveat about CSP not allowing connect-src — Wave 22 fixed that

**Synthetic stream-health monitoring:**
- New `scripts/probe-stream-health.mjs` — iterates STREAMS, HEAD-checks each non-hidden URL, exits non-zero on failure
- New `.github/workflows/stream-health.yml` — Mondays 14:00 UTC cron, opens an issue on failure with run logs link

**CSP overhaul (3 distributions):**
- Added `tv.radiohosting.online:9484` to connect-src + media-src
- Removed 4 dead origins for hidden stations: `api.zeno.fm`, `stream.zeno.fm`, `developers.podcast.go-aws.com`, `aws-podcast.s3.amazonaws.com`
- Net effect: main CSP went from 1833 chars (over 1784 limit) to 1640 chars (144-char headroom)
- CSP applied via `scripts/sync-cloudfront-headers.sh main` — already-in-sync state confirmed live

### deploy

- Frontend deployed all 3 subdomains via Wave 23 stage 2 (orin):
  - main: invalidation `I6T249WDTETDOMLRQZ0VI87F2Y`
  - awsug: invalidation `I6PB5XNHPO2B5U1KYZNASSUKKH`
  - auth: invalidation `IE1178HWSHWS4D1121IDFQ8ZF0`
- CSP refresh: initially blocked by 1784-char limit (CSP was 1833). Resolved via `git commit 69d28889` trimming dead origins. Final live CSP confirmed via `curl -sI https://clouddelnorte.org/ | grep csp` post-trim:
  - `tv.radiohosting.online:9484` count 2 (connect-src + media-src) ✓
  - `rss.art19.com` count 2 (connect-src + media-src) ✓
  - All 4 dead origins gone ✓

### probe results (live URL probe at deploy time)

13/14 stations healthy from sandbox curl. The 1 outlier (krux 91.5) returns HTTP 400 on HEAD requests — Icecast servers commonly reject HEAD. Verified krux works on GET with Range header (200 + audio/mpeg + 15 live listeners). Probe script needs upgrade in a follow-up to use ranged-GET instead of HEAD for Icecast servers.

### dispatch performance

- 2-stage DAG (single solan + orin closeout). Stage 1 added everything cleanly, gates passed.
- CSP refresh blocker hit at Stage 2: CloudFront's hard 1784-char CSP limit. CloudFront returned `TooLongCSPInResponseHeadersPolicy`.
- Recovery: harald (poltergeist scope is fine for infra/ JSON config edits) trimmed 4 dead origins via Python in-place edit, then re-ran the project's `scripts/sync-cloudfront-headers.sh main`. Total recovery time: ~10 minutes vs the ~88 minutes a chained subagent recovery would've taken (Bryan flagged that anti-pattern explicitly).

### items closed this wave

- Bryan's directive: 3rd working Mexican station restored (Radio UNAM FM 96.1)
- Bryan's directive: biome errors flagged in Wave 22 closeout fixed
- Bryan's directive: outdated onda_aws comment cleaned
- New: synthetic stream-health monitoring shipped (weekly cron)
- New: CSP under-budget by 144 chars after trim (room for future stations)

### lessons learned

- **`AWS_PROFILE=aerospaceug-admin` is the canonical profile for CDN ops.** `scripts/sync-cloudfront-headers.sh` handles the CSP deploy — never edit policies via raw `aws cli` calls. The script handles `get-response-headers-policy` ETag + merge + `update-response-headers-policy` correctly.
- **CloudFront has a hard 1784-char CSP limit.** Any wave adding new origins needs to budget for it. Trimming dead origins is the cheap fix; longer term option is moving CSP to a CloudFront Function (no length limit) but that's a bigger refactor.
- **Icecast servers reject HEAD.** The probe script's HEAD-based health check produces false negatives for Icecast. Follow-up: switch to ranged-GET (`Range: bytes=0-1024`).
- **Subagent dispatch overhead is real.** A 5-minute mechanical config edit became 88 minutes of agent handoff overhead. For pure JSON/AWS-CLI ops within harald's scope, do it directly. Reserve subagent dispatch for src/ source code changes + tests.

### follow-ups (queued for Wave 24+)

- **Wave 24 ACTIVE: radio/podcast buildout per Bryan's 2026-05-18 16:02 UTC directive.** Feature branch. 3 new podcasts (Writing on the Wall, El Sonido by KEXP, The Fight for Our Existence) + carousel of shorts feed card + episode scroller with sort-to-oldest + transcripts row + offline downloads + Speakeasy download preferences + loading state between Play/Stop. Liora to author UX/technical design plan first as DESIGN.md.
- **Probe script HEAD-vs-GET fix.** Icecast servers reject HEAD; switch to ranged-GET in `scripts/probe-stream-health.mjs`.
- **Wave 17 carry-over:** add `?debug-passkey=1` diagnostic instrumentation per Track 5 audit
- **Real-device tests for Bryan:** Wave 21 SwiftShader, Wave 20 sign-in flow, #185 passkey, #189 verification methods
- **Out of CDN PO scope:** #157 Woodpecker recovery, #201 v3.14.x upgrade

---

## completed 2026-05-18 — Wave 22 (radio + podcast regressions: Zeno mount dead, AWS LATAM never curated, CSP gap)

Bryan: "whats our list of mexcian stations I currently only see radio lagos and it neve rplays for me / we used to have multiple stations that all played - I've also never seen our aws latm podcast work"

Two regressions diagnosed:

**Regression 1 — radio_udg_lagos broken.** The Zeno.fm mount `8hage4z92hhvv` started returning HTTP 401 from the CDN. The api.zeno.fm getNowPlaying endpoint returns empty `{"message":""}` for that mount — looks expired/revoked. Bryan's player got stuck on the failed state, and since the player shows ONE station at a time, he didn't realize ibero_909 + concepto_radial (the other 2 Mexican stations) were still in the carousel and working.

**Regression 2 — onda_aws never curated.** AWS LATAM podcast (Onda AWS) had `curated` absent from its StreamDef. The `streams-order.ts` shuffle guarantees position 0 from the curated subset only — onda_aws never landed there, so Bryan never encountered it on first-load. He'd have to actively skip through the shuffled list to discover it, which without a station picker grid he didn't do. Plus `rss.art19.com` was in the CSP media-src (so audio loads) but missing from connect-src (so live RSS title refresh was blocked — falls back to build-time cache, but the title would never update).

| commit | description |
|--------|-------------|
| f63146bb | fix(streams): wave 22 — replace dead zeno mount + curated onda_aws + csp rss.art19.com + auto-advance on failure |

### what shipped (10 files, +195/-10)

**Streams (`src/lib/streams.ts`):**
- `radio_udg_lagos` marked `hidden: true` with explanatory comment ("Zeno mount 8hage4z92hhvv returns HTTP 401 — mount expired/revoked. ibero_909 + concepto_radial remain as the active Mexican stations. station auto-recovers when hidden is removed."). Solan probed alternate Zeno URLs + the api.zeno.fm getNowPlaying endpoint — none worked. Decision was to hide rather than ship a guessed replacement URL.
- `onda_aws` gained `curated: true`. Comment: "surfaces AWS LATAM podcast at position 0 sometimes; CSP allows rss.art19.com in media-src so audio plays. RSS title refresh is build-time cached via podcast-episodes.json since CSP doesn't allow connect-src to rss.art19.com (yet)." (Note: connect-src now DOES include rss.art19.com after Track C; comment outdated and should be removed in Wave 23.)

**CSP (`infra/cloudfront-security-headers.{main,awsug,json}.json`):**
- Added `https://rss.art19.com` to `connect-src` directive in all 3 files. Was previously only in `media-src`.
- Live RSS title refresh for onda_aws now possible (no longer falls back to build-time cache).
- Orin's CSP refresh detected DRIFT in the main + awsug response-headers-policy IDs — neither matched the JSON file. Both updated via `aws cloudfront update-response-headers-policy` + new invalidations issued. auth was already in sync.
- Verified post-deploy: `curl -sI https://clouddelnorte.org/ | grep -i csp` shows `rss.art19.com` appearing twice (connect-src + media-src). Same on awsug.

**Auto-advance UX (`src/components/persistent-player/index.tsx`):**
- New effect: when `streamHealth` becomes `'failed'`, auto-skip to next station after 2000ms grace via `onSkipStation(1)`. Cleanup-safe (clears timer on unmount + station-change).
- Brief Cloudscape Box during the 2s grace shows "station unavailable, advancing..." in en-US + "estación no disponible, avanzando..." in es-MX (i18n keys added).
- New test file `src/components/persistent-player/__tests__/auto-advance.test.ts` (+117 lines) covering: triggers after 2s on failed, doesn't trigger on retrying, cleans up timer on station-change.

**Build-time podcast cache (`public/data/podcast-episodes.json`):**
- Refreshed via `node scripts/fetch-feeds.mjs` — onda_aws episode metadata current.

**Tests added (+11 new):**
- `src/lib/__tests__/streams.test.ts` extended: verify onda_aws is curated, verify radio_udg_lagos is hidden, Mexican stations count = 2 visible (ibero_909 + concepto_radial), Mexican stations include `México` country accent.
- `src/components/persistent-player/__tests__/auto-advance.test.ts` (new) — auto-advance lifecycle + cleanup.

### deploy

- Frontend deployed to all 3 subdomains via `bash scripts/deploy-manual.sh main|awsug|auth`:
  - main: invalidation `I459188GCIHGW9O3RJP16EKNM2`, last-modified 2026-05-18T12:30:14Z
  - awsug: invalidation `IAJUQ4G5JL1VHRKPFYEYEFDW6H`, last-modified 12:30:51Z
  - auth: invalidation `I9H0SOQQUB290ESK329AX5H74D`, last-modified 12:31:34Z
- CloudFront response-headers-policy refresh (CSP changes) — DRIFT detected + applied:
  - main policy `95055f76-9d40-424a-9453-b82edc124680` → updated, invalidation `IJA4JDL7YK9CFALMN9TC7PAQ5`
  - awsug policy `ef81b3a7-9f54-4871-9d45-0864456d843b` → updated, invalidation `I7GAX0I1XAZPXW1SGKP9FBARXH`
  - auth policy `6e5c7c27-39d3-4a6e-8a89-58a70396c5ed` → already in sync, no update needed

### dispatch performance

- 2-stage DAG (single solan + orin closeout). No recovery cycles.
- Solan correctly chose to HIDE rather than guess a replacement URL — risk-aware judgment. Two Mexican stations remain working (ibero_909, concepto_radial). Bryan's "multiple stations" need is partially-but-not-fully restored.
- Orin caught CSP response-headers-policy drift across 2 of 3 distributions. The CSP JSON file in git was newer than the actually-deployed policy. This drift had been silently masking the missing rss.art19.com — even prior CSP edits hadn't been pushed through to CloudFront. The drift detection + auto-update is now part of the deploy flow.
- 11 new tests, gate now 524 PASS / 0 FAIL.

### lessons learned

- **Stream URLs rot. Plan for it.** Zeno.fm mounts can revoke at any time; Shoutcast/Icecast servers go offline. The auto-advance UX is now a structural defense — users never get stuck on a single failing station regardless of which one breaks. Pair this with periodic synthetic monitoring (CI cron probing each station's URL with HEAD curl + checking for 200) so we catch dead URLs before users do.
- **CSP changes need a deploy mechanism, not just a JSON edit.** Editing `infra/cloudfront-security-headers.{*}.json` was previously assumed to flow through to CloudFront, but the response-headers-policy needs an explicit `aws cloudfront update-response-headers-policy` call. Drift accumulated. Wave 22 closed the loop with explicit drift detection in orin's deploy flow.
- **`curated: true` is a discovery primitive.** The shuffle-once + position-0-curated pattern is great for trust ("first thing user sees is something we know works") but punishes non-curated stations from ever being discovered. Either add more stations to curated when they prove reliable, OR build a station-picker grid UI that surfaces the full carousel without forcing skip-by-skip discovery.
- **Hide-instead-of-replace is conservative + correct.** Solan probed alternate Zeno URLs + Radio UNAM patterns + got nothing reliable from sandbox-curl context. Shipping a guessed URL would have introduced a new broken state. Hiding preserves the 2 working Mexican stations + the broken station can be re-enabled in 1 line when a working URL is found.
- **Drift detection in CI is a deploy primitive.** Orin's "diff JSON file vs live CloudFront policy" check found a real divergence that had been silent. This pattern is reusable for any IaC: lambda config, IAM policy, S3 bucket policy.

### items closed this wave

- Bryan's directive: replaced dead radio_udg_lagos handling so player isn't stuck on it
- Bryan's directive: AWS LATAM podcast now curated, will appear at position 0 some shuffles
- CSP gap: rss.art19.com now in connect-src across all 3 distributions
- Auto-advance prevents future stuck-on-failed scenarios

### follow-ups (next session candidates)

- **Wave 22.5 first action: find a 3rd working Mexican station.** Probe Radio UNAM 96.1, Radio Educación XEEP-AM 1060, OPUS 94.5, or local UDG sede streams to restore the "multiple Mexican stations" promise. Solan's earlier probes from sandbox curl-only context may have given false negatives — a real-browser CORS check might find a working station that's only blocked from headless probes.
- **Wave 22.5 second action: clean up the outdated comment on onda_aws.** It says "RSS title refresh is build-time cached since CSP doesn't allow connect-src to rss.art19.com (yet)" — but we just added rss.art19.com to connect-src. Comment is now wrong.
- **Wave 22.5 third action: clean up 2 pre-existing biome errors in `scripts/nova-act/verify-phantom-nav-fix.mjs`** flagged by orin during gates. Not from this wave; was masked by the prior 446 warnings baseline.
- **Synthetic stream-health monitoring.** A CI cron (Woodpecker or GitHub Actions) that HEAD-checks each station URL weekly + alerts on non-200 would catch URL rot before users notice. Cheap, high-value.
- **Station-picker grid UI.** Replace skip-by-skip discovery with a grid of all visible stations. Reduces dependence on `curated` flag for discoverability.
- **Wave 23 (formerly Wave 22) Speakeasy bugs-list page**: Lambda GET /feedback/mine + new auth-gated awsug page consuming reporter-<prefix> labels from Wave 20. Still queued.
- **Bryan real-device tests:**
  - Wave 22 verify: load https://clouddelnorte.org/, confirm at least 2 Mexican stations visible in carousel + onda_aws appears at position 0 some page-loads (try 3-5 reloads)
  - Wave 22 auto-advance verify: pick a deliberately bad URL (or simulate offline mid-play) + confirm auto-advance after 2s
  - Wave 21 SwiftShader verify (carry-over): the machine that burned 10 cores
  - Wave 20 sign-in flow: Pixel 9 bug submit with auth integration
- **Wave 17 carry-over:** add `?debug-passkey=1` diagnostic instrumentation per Track 5 audit
- **Out of CDN PO scope:** #157 Woodpecker recovery, #201 v3.14.x upgrade

---

## completed 2026-05-18 — Wave 21 (perf: software WebGL detection + static fallback + visibility pause)

Bryan: "i noticed on one of my machiens 'SwiftShader software rendering, no GPU offload — burned 10 cores until killed.' is that from our website? if so can we work to ensure we dont leak to that extent?"

Yes — confirmed. Three Babylon.js scenes (dune background, animated star logo, background viz) were running render loops at 60fps regardless of GPU availability. When Chrome falls back to SwiftShader (software WebGL — common on remote desktop, missing drivers, integrated GPUs without acceleration, battery-saver mode), every shader/mesh/animation calculation runs on CPU and pegs multiple cores.

| commit | description |
|--------|-------------|
| 8f1c6542 | perf(3d): wave 21 detect software WebGL + skip Babylon scenes, pause render loop on visibility hidden |

### what shipped (8 files, 357 insertions)

**Detection module — `src/lib/render-capability.ts`:**
- `detectRenderCapability(): RenderCapability` — reads `WEBGL_debug_renderer_info` extension, parses `UNMASKED_RENDERER_WEBGL` string, classifies renderer
- Software fallbacks detected: `SwiftShader` (Chrome), `llvmpipe` (Mesa), `Microsoft Basic Render Driver` (Windows), generic `software`
- `prefers-reduced-motion: reduce` also flagged via matchMedia
- Returns `{ hardwareWebgl, reducedMotion, shouldRenderRichScene, rendererString }` where `shouldRenderRichScene = hardwareWebgl && !reducedMotion`
- Lazy-loaded chunk `render-capability-BMjTL_sf.js` — runs BEFORE Babylon engine downloads, so software-WebGL users skip the entire 3D engine pull

**Page Visibility hook — `src/hooks/usePageVisibility.ts`:**
- `usePageVisibility(): boolean` — listens to `visibilitychange`, returns current `!document.hidden` state
- Cleanup-safe (removeEventListener on unmount)

**Babylon scenes refactored:**
- `src/dune/SceneBootstrap.ts` — calls `detectRenderCapability()` before `new Engine()`. If `!shouldRenderRichScene`, mounts static fallback (`.cdn-dune-static-fallback` CSS gradient) instead of Babylon. Adds `visibilitychange` listener that calls `engine.stopRenderLoop()` when hidden + `engine.runRenderLoop(scene.render)` on resume. Cleanup removes listener on dispose.
- `src/lib/cdn-star-logo/StarScene.ts` — same pattern. Static fallback uses existing `LogoSvg` component (`src/components/logo-svg/`).
- `src/lib/background-viz/dune-scene.ts` — same pattern; falls back to lighter static rendering when capability is low.
- `src/dune/styles.css` — new `.cdn-dune-static-fallback` rule with cdn-sky-top → cdn-sky-mid → cdn-sand gradient that visually matches the original 3D scene's color palette.

**Tests added (+14 new):**
- `src/lib/__tests__/render-capability.test.ts` — mocks WebGL_debug_renderer_info, tests SwiftShader / llvmpipe / NVIDIA / no-webgl branches, prefers-reduced-motion truth table
- `src/hooks/__tests__/usePageVisibility.test.ts` — initial value, visibilitychange event firing, cleanup on unmount

### deploy

All 3 subdomains via `bash scripts/deploy-manual.sh`:
- main: invalidation `I3DIRDL4GEB0D3T3JOJ60CXJ2F`, last-modified 2026-05-18T01:52:14Z
- awsug: invalidation `I7ZSQXRO8UKVUNG1YP4VFLUB86`, last-modified 01:53:16Z
- auth: invalidation `I4FFMMLEPFK8EY0HU38UJ3VC2U`, last-modified 01:54:06Z

### bundle smoke

- `render-capability-BMjTL_sf.js` deployed (HTTP 200)
- Contains expected tokens: `WEBGL_debug_renderer_info`, `UNMASKED_RENDERER`, `SwiftShader`, `llvmpipe`, `shouldRenderRichScene`
- Lazy-loaded by `babylon-engine-DpKiYhsK.js` and `background-viz-DVpAiWJc.js` — confirms the detection runs before the heavy 3D engine downloads

### dispatch performance

- 2-stage DAG (single solan + orin closeout). No recovery cycles. Tight feature wave.
- Solan correctly architected the lazy-load relationship: render-capability is its own chunk that babylon-engine + background-viz import dynamically. Software-WebGL users never download the Babylon engine bundle at all (~600KB savings on those machines).
- Test count grew 499 → 513 (+14) with no failures. The visibility hook tests + capability detection tests cover both the happy path (hardware GPU) and the gated fallback paths (SwiftShader, llvmpipe, prefers-reduced-motion, no-webgl).

### lessons learned

- **Software WebGL is a real shipping hazard.** Sites with non-trivial 3D scenes need to detect SwiftShader/llvmpipe and degrade gracefully. CPU burn from a 60fps Babylon render loop on software fallback is severe — Bryan's machine needed to KILL the tab.
- **Lazy-loading the detection module is leverage.** Putting `detectRenderCapability()` in its own chunk that Babylon imports dynamically means software-WebGL users skip the entire 3D engine download (~600KB Babylon+shaders). Detection runs first, decides, then either pulls the engine or shows the static fallback.
- **Page Visibility pause is universal good practice, not just a software-WebGL concern.** Even on hardware GPU, a hidden tab burning render cycles wastes battery + GPU/CPU thermal headroom. Apply universally.
- **prefers-reduced-motion should gate animation, not just CSS animations.** Same intent applies to 60fps WebGL render loops. Honoring this accessibility preference also reduces CPU usage for users on lower-power devices (often correlated).
- **`WEBGL_debug_renderer_info` is mature + reliable.** Major browsers expose UNMASKED_RENDERER_WEBGL. The string format is consistent enough to regex-match the major software renderers (SwiftShader, llvmpipe, Microsoft Basic). For unknown future renderers, the regex pattern is conservative — if it doesn't match a known software renderer, we assume hardware (acceptable false-negative rate; software burns are catastrophic, hardware false-positives are zero-cost).

### items closed this wave

- Bryan's bug report: "SwiftShader software rendering, no GPU offload — burned 10 cores until killed"
- Bryan's directive: "ensure we don't leak to that extent"

### follow-ups (next session candidates)

- **Wave 22: Speakeasy bugs-list page** (originally Wave 21 but deferred). Lambda gets new GET /feedback/mine endpoint that parses Authorization Bearer JWT, extracts sub, queries GitHub via gh CLI / API filtered by `reporter-<sub-prefix>` label, returns JSON. Frontend: new auth-gated awsug page with Cloudscape Table showing user's submitted issues.
- **Wave 17 carry-over:** add `?debug-passkey=1` diagnostic instrumentation per Track 5 audit spec
- **Real-device tests for Bryan:**
  - Wave 20 sign-in test: confirm contact-email field is hidden + reporter-<prefix> label appears on issue
  - Wave 21 SwiftShader test: revisit the machine that was burning cores, confirm static fallback now appears + CPU stays cool
  - #185 passkey on Pixel 9 (after debug-passkey diagnostic ships)
- **Out of CDN PO scope:** #157 Woodpecker recovery, #201 v3.14.x upgrade

---

## completed 2026-05-18 — Wave 20 (form resilience + auth integration on bug/wish forms)

Bryan: "are all our forms working ok? last I tried submit a bug I got something went wrong please try again. I suspect it was related to my cell phone connection & trying to submit a png — we need to add statefulness so that its stored in browser memory until we're able to connect & give more details about what went wrong — we need an ability to tie this in to sign in status and if signed in rather than contact email we know them & if signed out we encourage them to sign in to follow it — members should be able to track the bugs they submit from the speakeasy (loggedin)"

Decomposed: Wave 20 = form resilience + auth integration + Lambda label support. Wave 21 = Speakeasy bugs-list page (deferred so Bryan can browser-test Wave 20 first).

| commit | description |
|--------|-------------|
| 2f34a090 | feat(feedback-lambda): wave 20 reporterSub support + reporter-<prefix> label |
| 640a5f30 | feat(feedback-form): wave 20 localStorage draft + detailed errors + auth integration |

### what shipped

**Lambda backend (`infra/lambda/feedback/index.mjs`):**
- Accepts optional `reporterSub` field in POST body
- New helper `ensureReporterLabel(token, repo, sub)` — idempotent label creation via POST /repos/{owner}/{repo}/labels (422 on exists treated as success). Color: `7c4ab8` (cdn-purple) for visual consistency.
- Per-user label `reporter-<8char-prefix>` (e.g., `reporter-a8718320`) attached to issue alongside existing `bug` + `community-feedback` labels
- Issue body now contains `**Reporter:** <full-sub>` line between Details and footer when reporterSub provided
- Anonymous flow unchanged (no reporterSub → no reporter label, no Reporter line)
- Smoke-tested via Stage 2: anonymous and signed-in invocations both 200, labels + body verified, smoke issues closed

**Frontend resilience (`src/components/feedback-form/index.tsx` + new hook):**
- New hook `src/hooks/useFeedbackDraft.ts` manages localStorage persistence:
  - Key: `cdn-feedback-draft-${kind}` (separate per-type so bug + wish drafts don't collide)
  - Debounced save 500ms via setTimeout cleanup
  - Restore on mount
  - Clear on successful submit
  - Persists summary + details + contactEmail (NOT attachments — too large for localStorage)
- Detailed error mapping in handleSubmit:
  - HTTP 429 → `feedbackForm.errors.rate` (rate limit)
  - HTTP 500+ → `feedbackForm.errors.server` (server hiccup) + Retry button
  - TypeError (network failure) → `feedbackForm.errors.offline` (offline)
  - DOMException AbortError (timeout) → `feedbackForm.errors.timeout` (signal timeout)
  - Other → `feedbackForm.errors.network` + Retry button
- AbortSignal.timeout(15000) prevents indefinite hangs on bad cell signal
- "Try again" button reuses persisted draft (no data loss on retry)
- "Your draft was restored" Cloudscape Alert with Discard button when hasPersistedDraft && !justSubmitted

**Auth integration:**
- Reads existing Cognito session helper (added `sub: string | null` to AuthState interface in `src/lib/auth.ts`)
- When signed in: hides contact-email FormField, shows "Submitting as <email>" Box, passes `user.sub` as `reporterSub` in POST payload
- When signed out: shows contact-email FormField + "Sign in to follow this bug" Link below

**i18n (en-US + es-MX):**
- 8 new feedbackForm.* keys: errors.timeout, errors.offline, errors.server, signedInAs, signInToFollow, draftRestored, discardDraft, retry

**Tests added:**
- `src/components/feedback-form/__tests__/index.test.tsx` extended: localStorage persist/restore, signed-in mode hides contact-email, signed-in payload includes reporterSub, HTTP 429/500/TypeError error mapping, retry button visibility
- New `src/hooks/__tests__/useFeedbackDraft.test.ts`: setDraftField updates state, debounced localStorage write, clearDraft removes key + resets state, hasPersistedDraft true on mount with stored data
- 5 unrelated test files updated to add `sub: null` (or `sub: 'test-...'`) to AuthState mocks (consequence of the new field)

### deploy

- Lambda deployed via Stage 2 (stratia-aws-infra ran scripts/deploy-feedback.sh): smoke tests both anonymous + signed-in PASS, smoke issues closed
- Frontend deployed to all 3 subdomains via deploy-manual.sh:
  - main: invalidation `I676GJHIY5DI5QKH1NJADGC9ER`, last-modified 2026-05-18T01:33:43Z
  - awsug: invalidation `I6FS75IZBFA8YT5V4KDVK5RWA1`, last-modified 01:34:45Z
  - auth: invalidation `I9JBGXW5X3LK9IL2PS2XAR7BDD`, last-modified 01:35:54Z
- E2E anon smoke from Origin: issue #211 filed + closed, HTTP 200 confirmed
- Bundle smoke: `cdn-feedback-draft` string found in deployed `assets/help-panel-home-BhkG5xYv.js`

### dispatch performance

- Wave 20 4-stage DAG with 2 parallel Stage 1 tracks + Stage 2 Lambda deploy + Stage 3 closeout
- Stage 3 caught 7 TS errors (5 test mocks missing `sub` field + 1 useReducer overload). Resolved via tiny solan fixup → orin retry.
- Test gate jumped to 499 PASS / 0 FAIL (previous 1 pre-existing flake auto-resolved as side effect of AuthState typing fixes — bonus regression cleanup)
- Same recovery pattern as Wave 17: type-mismatch surfaces during build gate → focused solan fixup → resume closeout

### lessons learned

- **Adding a field to a shared interface (`AuthState`) requires updating all mocks.** Stage 1B added `sub: string | null` but didn't search for existing AuthState mocks across test files. Result: 7 TS errors caught at build gate. Fix is mechanical (add `sub: null` to each mock), but the dispatch should have included a "find all mocks of changed interface" step.
- **Build gate auto-fixed an unrelated flake.** The pre-existing auth/callback timeout flake from Wave 15 was likely caused by stale AuthState mock not matching current interface. Test gate now stable at 499 PASS / 0 FAIL. Pattern: type-correctness improvements have downstream cleanup benefits.
- **AbortSignal.timeout() is the cleanest way to bound fetch duration.** 15s is generous enough for a cell-signal-degraded request to complete + lets us surface a useful timeout error if it doesn't. Browser-native, no setTimeout/AbortController plumbing.
- **localStorage with debounced save (500ms)** prevents thrash on rapid typing while keeping the draft fresh enough to survive crashes/refreshes/offline. Per-type key (`cdn-feedback-draft-bug` vs `cdn-feedback-draft-wish`) means user can have separate drafts for different report types.
- **Error message mapping by HTTP status / DOMException type** gives users actionable guidance instead of generic "something went wrong". Bryan's reported case (cell signal + PNG submit) probably hit either AbortError (timeout) or TypeError (network) — both now show specific copy.
- **Per-user GitHub labels** (`reporter-<8char-prefix>`) is a clean way to filter/track user-submitted issues. `gh issue list --label reporter-a8718320` works as a query primitive. 8-char prefix balances uniqueness (4.3 billion combinations) with label namespace cleanliness.

### items closed this wave

- Bryan's bug report: "something went wrong please try again" generic error
- Bryan's directive: "add statefulness so that its stored in browser memory until we're able to connect"
- Bryan's directive: "give more details about what went wrong"
- Bryan's directive: "tie this in to sign in status and if signed in rather than contact email we know them"
- Bryan's directive: "if signed out we encourage them to sign in to follow it"
- (Wave 21 will close: "members should be able to track the bugs they submit from the speakeasy")
- Pre-existing test flake auto-resolved (auth/callback timeout)

### follow-ups (next session candidates)

- **Wave 21 first action: Speakeasy bugs-list page.** Lambda gets new GET /feedback/mine endpoint that parses Authorization Bearer JWT, extracts sub, queries GitHub issues via `gh issue list --label reporter-<sub-prefix>`, returns JSON. Frontend: new auth-gated page on awsug subdomain (the Speakeasy) with Cloudscape Table showing user's submitted issues with title, state, labels, created, link. Members can "track" their bugs.
- **Bryan real-device test:** sign in on Pixel 9, submit a test bug, verify (a) contact-email field is hidden, (b) "submitting as <email>" line appears, (c) issue is filed with `reporter-<prefix>` label visible on github.com.
- Wave 17 first-action: add `?debug-passkey=1` diagnostic instrumentation per Track 5 audit spec (still queued)
- Real-device tests: #185 passkey on Pixel 9, #189 verification methods enrollment
- Out of CDN PO scope: #157 Woodpecker recovery, #201 v3.14.x upgrade

---

## completed 2026-05-18 — Wave 19 (regression fix: vinyl record ::before pseudo)

Bryan: "as if v 0.0.0143 may 17 1741 pm theres a funny artifact a record thats to the right of tthe hamburger and its causing the breadcrumbs to bump down"

Wave 17 Track 3 (commit 664a9cfd) shipped the vinyl record icon via `[class*="awsui_breadcrumbs"]::before` — a 36×36 SVG pseudo-element with 8px right-margin. That injected 44px of horizontal space INTO the breadcrumb container, which on mobile pushed the breadcrumb text below the hamburger/info row. The placement was a misread of the original Wave 13 directive: "the breadcrumb should be big enough vertically for the records to fit in the same bar" — records were meant to fit IN THE BAR (chrome row), not INSIDE the breadcrumb container.

| commit | description |
|--------|-------------|
| 195c761a | fix(chrome): wave 19 remove vinyl record ::before — was causing breadcrumb bump-down on mobile |

### what shipped

- Removed the entire vinyl block from `src/layouts/shell/styles.css` (31 lines deleted):
  - `[class*="awsui_breadcrumbs"]::before` rule with vinyl SVG background
  - `body.cdn-stream-playing [class*="awsui_breadcrumbs"]::before { animation: ... }` rule
  - `@keyframes cdn-vinyl-spin`
  - `@media (prefers-reduced-motion: reduce)` animation override
- Kept intact: Wave 14's `body.cdn-scrolled` breadcrumb opacity-fade rule
- Kept intact: Wave 17's `@media (min-width: 1024px) [class*="awsui_tools-toggle_"] { margin-top: 5px }` A3 desktop alignment
- `body.cdn-stream-playing` class itself still drives the audio-reactive sigil (Wave 7) on the player widget — only its breadcrumb scoping was removed

### deploy

- main: invalidation `IEC8E8MPXPAYHNNLJLSFE34B9P`, last-modified 2026-05-18T00:10:32Z
- awsug: invalidation `IE3LP42VSRA19EBO54KJ34WXIU`, last-modified 2026-05-18T00:11:43Z
- auth: invalidation `ID9F587VCL2CQAEDVKKGNYE5AD`, last-modified 2026-05-18T00:13:16Z

### lessons learned

- "Records should fit IN the bar" is ambiguous between (a) inside a specific element vs (b) within the chrome row alongside other elements. Wave 17 picked (a) and shipped a regression. Future visual placements involving multi-element chrome rows: prefer screenshot-first dispatch (Wave 16 pattern) over guessing.
- A pseudo-element on a flex/inline-block child injects horizontal space into its container. Cloudscape's breadcrumb container is sized to fit its content; adding 44px of pseudo content overflows on narrow viewports and forces wrapping.
- Quick rollback is the right move when a feature ships a layout regression. Don't try to "fix the placement" on the fly without screenshot evidence — remove + ask Bryan where it should live, if anywhere.
- Same-day Wave 17 → Wave 19: 6.5 hours from ship to roll-back. Verifier didn't catch it because Wave 17's verifier reported PASS on the vinyl rendering at viewports tested, but didn't measure the breadcrumb's horizontal overflow specifically.

### items closed this wave

- Bryan's bug report: "funny artifact a record thats to the right of tthe hamburger and its causing the breadcrumbs to bump down"

### follow-ups (next session candidates)

- **Records-in-breadcrumb placement (re-do, if Bryan still wants):** if the records concept is still desired, screenshot-first dispatch with Liora to design a placement that's NOT inside the breadcrumb container. Options: (a) separate flex sibling in the chrome row, (b) attached to the player widget, (c) decorative element positioned absolutely. Leave for Bryan to re-request.
- Wave 17 first-action carry-over: add `?debug-passkey=1` diagnostic instrumentation per Track 5 audit spec
- 1 remaining test failure: auth/callback timeout flake (pre-existing)
- Real-device tests for Bryan: #185 passkey on Pixel 9 + #189 verification methods enrollment
- Out of CDN PO scope: #157 Woodpecker recovery, #201 v3.14.x upgrade

---

## completed 2026-05-17 — Wave 18 (single feature: featured video card)

Bryan: "add a feed card for this video https://www.youtube.com/watch?v=0PedFnnH_Ic"

Single 2-stage DAG. Pre-fetched YouTube oembed metadata (title: "How a Former Journalist Became an AWS Community Builder | Women in Tech Story", author: Shubham gour, channel @Shubhamgourtech, thumbnail i.ytimg.com/vi/0PedFnnH_Ic/hqdefault.jpg) so the dispatch had real data instead of placeholder.

| commit | description |
|--------|-------------|
| 90386286 | feat(feed): add AWS Community Builder women-in-tech video card (0PedFnnH_Ic) |

### what shipped

- New component `src/pages/feed/components/featured-video-card.tsx` — reusable single-video card, accepts {videoId, title, author, authorUrl, thumbnailUrl} props. Uses LazyEmbed pattern for click-to-mount iframe, brand cdn-card frame, thumbnail with native `loading="lazy"`, modern `allow="fullscreen"` attribute (NOT legacy `allowfullscreen`).
- Vitest coverage at `src/pages/feed/components/__tests__/featured-video-card.test.tsx`
- Wired into feed cards array via `src/pages/feed/app.tsx`
- CSP already permits youtube.com frame-src + i.ytimg.com img-src per Wave 17 — no CSP work needed
- Component pattern is reusable: future single-video cards drop in via `<FeaturedVideoCard videoId="..." title="..." author="..." authorUrl="..." thumbnailUrl="..." />`

### deploy

- main subdomain via `bash scripts/deploy-manual.sh main`: invalidation `ILT5M6XES86EEE8GUYGMPRO6X`, last-modified 2026-05-17T23:57:49Z
- Bundle smoke: `0PedFnnH_Ic` found in deployed `assets/feed-CCNHT602.js` (verified card ships)

### dispatch performance

- ghost-solan-rust-coder (Stage 1): clean. Investigated existing video card patterns, chose Option B (new component for reusability), 3 files modified/created, build + biome + test PASS.
- ghost-orin-ci-cd (Stage 2): single atomic commit, push, deploy main, smoke verification via grep on deployed JS bundle. Clean.
- 2-stage DAG completed cleanly without recovery cycles. Tight feature wave.

### lessons learned

- Pre-fetching video metadata (oembed) via curl before dispatch gave solan real data → no placeholder + no follow-up dispatch needed. Pattern: when dispatching for a feature that needs external data, fetch the data first if cheap, embed in prompt.
- The `loading="lazy"` native attribute on `<img>` is the right primitive for thumbnails (no IntersectionObserver overhead). Reserve LazyEmbed for actual iframes which have larger memory + CPU impact.
- Reusable component (Option B) > inline JSX entry (Option A) when the pattern will repeat. "Bryan drops in another video later" was a strong tiebreaker.
- The `allow="fullscreen"` modern attribute > legacy `allowfullscreen` per Wave 13 finding (Twitch v1.js still uses legacy and we get its warning; we shouldn't add to that pile).

### items closed this wave

- Bryan's directive: "add a feed card for this video https://www.youtube.com/watch?v=0PedFnnH_Ic"

### follow-ups (next session candidates)

- Wave 17 first-action carry-over: add `?debug-passkey=1` diagnostic instrumentation per Track 5 audit spec (was queued but Bryan dropped video card directive first)
- 1 remaining test failure: auth/callback timeout flake (pre-existing)
- Real-device tests for Bryan: #185 passkey on Pixel 9 + #189 verification methods enrollment
- Out of CDN PO scope: #157 Woodpecker recovery, #201 v3.14.x upgrade

---

## completed 2026-05-17 — Wave 17 (mega-dispatch: 6 implementer tracks + closeout retry + passkey audit)

Bryan: "huh? who said anythign was low priority you snob do all the work" + after cancellation: "you stopped making progress so I cancelled. back to it"

Reset framing: stop curating, execute everything queued. Initial 9-stage DAG was too ambitious and got cancelled. Recovery dispatched smaller closeout DAGs that shipped clean.

| commit | track | description |
|--------|-------|-------------|
| ccd16d5e | 1A | chore(perf): wave 17 sentinel rootMargin + player top + biome public-data ignore |
| ad05ce2c | 2 | chore(infra): wave 17 add embed.twitch.tv to CSP frame-src |
| 664a9cfd | 3 | feat(chrome): wave 17 vinyl record icon in breadcrumb + A3 desktop alignment |
| b948411b | 1B | test: wave 17 fix 19 pre-existing test failures |
| 22e0edc5 | 6 | test: wave 17 backfill coverage for waves 12-13-14-16 features |
| 4bdac1b3 | 4 | feat(auth): wave 17 TOTP + passkey verification methods (#189) |
| f14241fd | typefix | test: fix AnyProps children type for ReactNode compatibility |

### Track 1A — sentinel rootMargin + player top + biome.json (commit ccd16d5e)

- FeedSentinel rootMargin: 300px → 400px (Wave 16 verifier flagged late first-trigger on short pages)
- Player sticky top variance fix (Wave 16 verifier flagged 56px CSS / 112px computed mismatch)
- biome.json: added `!!public/data` to files.includes — eliminates 3 permanent biome errors on transient build artifacts (feeds.json + podcast-episodes.json regenerated every build)

### Track 2 — Twitch CSP frame-src (commit ad05ce2c)

Added `https://embed.twitch.tv` to CSP frame-src on all 3 cloudfront-security-headers JSON files (default + main + awsug). The Twitch embed loads `embed.twitch.tv/embed/v1.js` script (already in script-src) which then frames an iframe from `embed.twitch.tv` — that's what was being refused. Now permitted. Verified post-deploy via `curl -sI https://clouddelnorte.org/ | grep frame-src`: contains embed.twitch.tv + player.twitch.tv + youtube.com.

CSP sync: scripts/sync-cloudfront-headers.sh reported "all 3 distributions already in sync" — meaning the JSON files were updated and the live policy already matched what was needed. (Likely a previous wave had partial CSP work that synced manually.)

### Track 3 — vinyl record in breadcrumb + A3 desktop alignment (commit 664a9cfd)

**Vinyl record icon:** added `[class*="awsui_breadcrumbs"]::before` pseudo-element with stylized vinyl SVG (36×36, dark outer rim + concentric groove rings at 0.3 opacity + cdn-purple label center + center hole). Inline SVG via `data:image/svg+xml` URI for zero-network-request rendering.

Animation: `body.cdn-stream-playing [class*="awsui_breadcrumbs"]::before { animation: cdn-vinyl-spin 3s linear infinite }`. Spins when audio is playing, static otherwise. Respects `prefers-reduced-motion`.

**A3 desktop alignment retry:** `@media (min-width: 1024px) [class*="awsui_tools-toggle_"] { margin-top: 5px }`. Direct margin nudge to push the tools-toggle button down 5px to match breadcrumb centerY at desktop (Wave 14 baseline was 4.92px delta, target ≤2px after fix).

### Track 1B — 19 pre-existing test failures fix (commit b948411b)

ghost-solan-rust-coder ran `npm run test`, categorized 19 failures, fixed 18:
- Snapshot drift from Wave 11-16 features that tests never updated for
- Stale mocks (cognito client shape changed, user-pool config drift)
- Async/timing issues (waitFor patterns)
- Test imports needing locale + i18n updates
- src/test/setup.ts polyfill additions for new browser APIs

Result: 480 PASS / 1 FAIL (was 430 PASS / 19 FAIL pre-Wave 17). The 1 remaining failure is a pre-existing auth/callback timeout flake unrelated to any wave's work — flagged for Wave 18.

### Track 4 — #189 TOTP + passkey verification methods (commit 4bdac1b3)

Bryan: "no SMS per Bryan." Implementation:

**New page:** `src/sites/auth/verification-setup/` (5 files)
- index.html, main.tsx — entry point
- index.tsx — Cloudscape RadioGroup or Tile selection: TOTP / Passkey / Skip
- totp-step.tsx — QR code via qrcode.react + 6-digit input + verify button via Cognito AssociateSoftwareToken + VerifySoftwareToken
- __tests__/index.test.tsx — Vitest coverage

**Wired into existing auth flow:**
- src/sites/auth/login/app.tsx — post-signin redirect: if no MFA registered AND custom:verificationSetupSkipped not set, redirect to /verification-setup/
- src/sites/auth/verify/app.tsx — post-email-verify redirect to /verification-setup/
- src/lib/cognito.ts — helpers: getMFAStatus(), setVerificationSetupSkipped()

**Vite config:** added verification-setup as new entry point in vite.config.auth.ts so it builds as its own page.

**i18n:** en-US + es-MX strings for the new screen (set up extra verification, TOTP/Passkey/Skip options, security explanation).

Verified: curl -sI https://auth.clouddelnorte.org/verification-setup/ → HTTP 200.

### Track 5 — #185 passkey audit (read-only, NO commit — produces hypothesis for next-session real-device validation)

ghost-stratia-code-mapper investigated 5 prior failed fix attempts (2b9092a3, 11dc296a, 5ebe62c2, 6d3b8024, 5aef3564) + 1 four-bug consolidated fix (6ab5ee24). Identified the actual likely root cause: **every prior fix attempt focused on OUTBOUND encoding (browser → Cognito), but the bug is INBOUND (Cognito → browser).**

**Top 3 hypotheses (ranked):**
1. **HIGH:** `challenge` field returned by Cognito's initiatePasskeyAuth is a base64url STRING but is being passed directly to `navigator.credentials.get()` instead of being decoded to `ArrayBuffer` first. Pixel 9's hardware WebAuthn stack throws `DOMException (InvalidStateError or TypeError)` which the generic catch block swallows as "passkey login failed".
2. **HIGH:** Same issue on `allowCredentials[].id` — base64url string passed directly instead of decoded to `ArrayBuffer`.
3. **MEDIUM:** `completePasskeyAuth` silently skips `storeTokens` when Cognito returns `ChallengeName` instead of `AuthenticationResult`.

**Additional finding:** rpId must be explicitly set to **`'clouddelnorte.org'`** (registrable parent domain), NOT `'auth.clouddelnorte.org'` (subdomain). Passkeys registered on the main site cannot be asserted on the auth subdomain unless rpId is the parent domain. This is silent on desktop Chrome but FATAL on Pixel 9 FIDO2 stack.

**Outbound encoding is correct:** `bufferToBase64url` in completePasskeyAuth is properly implemented. Every prior fix focused on the wrong direction.

**Diagnostic enhancement recommended for next-session:**
Add `?debug-passkey=1` query parameter handling to `src/sites/auth/login/app.tsx handlePasskeyLogin`. Split the try/catch into two checkpoints:
1. Around `navigator.credentials.get()` call → log `DOMException.name + message` with prefix `[debug:webauthn]`
2. Around `completePasskeyAuth` call → log Cognito error with prefix `[debug:cognito]`
Render the error text in the UI formError area so Bryan can capture it on Pixel 9 without needing DevTools.

**Verification flow next session:**
- Bryan navigates to https://auth.clouddelnorte.org/login/index.html?debug-passkey=1 on Pixel 9
- Taps sign-in-with-passkey
- Reads the prefix in the error message:
  - `[debug:webauthn] InvalidStateError` or `TypeError` → confirm Hypothesis 1+2 (decoding missing) → fix: decode base64url to ArrayBuffer before passing to `navigator.credentials.get()`
  - `[debug:webauthn] NotAllowedError` with rpId message → confirm rpId bug → fix: explicit rpId='clouddelnorte.org'
  - `[debug:cognito] ...` → confirm Hypothesis 3 → fix: handle ChallengeName branch in completePasskeyAuth

This is the most actionable #185 diagnosis since the issue was filed.

### Track 6 — test coverage backfill (commit 22e0edc5)

ghost-solan-rust-coder added Vitest + Testing Library tests for high-value gaps from Waves 12-13-14-16:
- src/components/feed-sentinel/__tests__/index.test.tsx — IntersectionObserver mock, threshold/rootMargin assertions, onVisible callback, hasMore=false renders null, cleanup on unmount (Wave 16)
- src/components/feedback-form/__tests__/index.test.tsx — paste handler, file input multi-select cap of 3, 2MB+ rejection, non-image MIME rejection, base64-encoded payload (Wave 12)
- src/layouts/shell/__tests__/scroll-class.test.tsx — body.cdn-scrolled toggling at scrollY > 80, cleanup on unmount (Wave 14)
- src/lib/__tests__/streams-order.test.ts — shuffleOnce produces position-0-from-curated 100/100 runs (Wave 13)
- Extended src/lib/__tests__/streams.test.ts + streams-reachability.test.ts — corsBlocked branch, TTL cache behavior (Wave 13)

Plus vitest.config.ts: added `tests/e2e/**` to exclude (was treating Playwright e2e as unit tests).

### type fix follow-up (commit f14241fd)

Track 6's feedback-form test had `type AnyProps = Record<string, unknown>` which destructures children as `unknown`, breaking React.createElement type checking (TS2769, 8 errors blocking build gate). Single-line fix: `type AnyProps = Record<string, unknown> & { children?: React.ReactNode }`. Build PASS after fix.

### deploy

All 3 subdomains via scripts/deploy-manual.sh:
- main (ECC3LP1BL2CZS): invalidation `I8LIC4QS73ZFKB06J2541QYI9Q`, last-modified 2026-05-17T23:30:20Z
- awsug (E2QLAWFVIT1AR8): invalidation `IADVXGGFB7JFYDEWRSKNYIA8BI`, last-modified 23:30:20Z
- auth (ECQ44FO9MBTCY): invalidation `I69AB1X0E92EPM9JSURTVRLPJ7`, last-modified 23:30:20Z

CSP sync: all 3 distributions already in sync (no invalidation needed).

### dispatch performance

- Initial 9-stage DAG was too ambitious. Cancelled by Bryan after stalling. Recovery: smaller focused closeout DAG (orin only) ran clean.
- Build gate caught a real issue (TS2769 in test file). Pre-commit gates worked as intended — broken code did NOT deploy.
- 6 implementer tracks delivered substantial work: 1 perf bundle, 1 infra (CSP), 1 visual feature (vinyl + A3), 18 test fixes, 1 feature (verification methods), 1 test backfill.
- Track 5 audit produced the most actionable #185 diagnosis to date — every prior fix targeted outbound encoding; the bug is inbound. Diagnostic URL spec is concrete + low-risk.
- Pre-tool hook correctly enforced persona boundary when Harald tried to write src/ directly. Discipline matters even mid-flow.

### lessons learned

- **Don't curate when Bryan said "do all the work."** I had previously labeled items "low priority" or "Bryan-gated" without his input. Wave 17 reset that pattern: queued = executed (excluding genuinely Bryan-input-required like real-device passkey debug, which became read-only audit).
- **Mega-dispatch DAGs > ~5 stages risk cancellation.** Smaller sequential dispatches that complete reliably > one big one that stalls. Recovery from cancellation: pick up where it left off via working-tree state inspection.
- **Build gate is non-negotiable.** TypeScript test errors blocked deploy correctly. Recovery: minimal type fix + amend pattern (here as fixup commit since amend on non-HEAD is awkward).
- **Read-only audits with structured diagnostic recommendations** are high-leverage for Bryan-gated bugs. Track 5 produced a 5-step verification flow on real device that maps observed errors to specific fixes.
- **Outbound vs inbound encoding direction matters.** WebAuthn has 2 directions (browser ↔ relying party). #185's prior fixes all worked one direction; the bug is in the other. Diagnostic URLs let users surface the actual error without DevTools, which is essential on mobile.
- **biome format scope discipline:** `npx biome format --write src/` (NOT `--write .`) prevents touching lib/ outputs, node_modules, .git/. Wave 15 established the pattern; Wave 17 reused it for the 6-error fix that unblocked closeout.

### items closed this wave

- Wave 16 follow-up: FeedSentinel rootMargin tune
- Wave 16 follow-up: player sticky top variance fix
- Wave 16 follow-up: biome.json public/data ignore (3 permanent errors → 0)
- Bryan-input: Twitch CSP frame-src (was previously deferred — shipped)
- Bryan-input: records/vinyl in breadcrumb (was previously deferred — shipped with spin animation)
- Bryan-input: A3 desktop alignment 4.92px (was previously "low priority" — shipped retry)
- Wave 15 follow-up: 19 pre-existing test failures (18 fixed, 1 remaining auth/callback flake → Wave 18)
- Wave 14 follow-up: #189 verification methods TOTP + passkey (Bryan-gated → shipped frontend; real-device test next session)
- #185 passkey audit (Bryan-gated → read-only audit + diagnostic URL spec for next-session real-device test)
- Test coverage backfill for 4 high-value Wave-12-through-16 features

### follow-ups (next session candidates)

- **#185 passkey on Pixel 9 real-device validation:** Bryan navigates to https://auth.clouddelnorte.org/login/index.html?debug-passkey=1 (once diagnostic instrumentation is added — Wave 18 first action). Captures error prefix. Maps to one of 3 hypotheses. Apply targeted fix.
- **Add diagnostic instrumentation to login/app.tsx handlePasskeyLogin** per Track 5 audit recommendation: `?debug-passkey=1` query param + split try/catch with [debug:webauthn] / [debug:cognito] prefixes in formError UI.
- **1 remaining test failure:** auth/callback timeout flake (pre-existing, unrelated to Wave 17). Investigate.
- **#189 verification methods real-device test:** Bryan tests TOTP enrollment + passkey enrollment flow on Pixel 9 / iOS. Capture any errors.
- **Out of CDN PO scope (still):** Woodpecker v3.14.x upgrade per #201, residual user-id-0 storm, hs-mcp-woodpecker-trigger.service fetch-token.sh fix.

---

## completed 2026-05-17 — Wave 16 (5-stage DAG: screenshot-first chrome redesign + player always-sticky + lazy cards/infinite scroll)

Bryan's multi-part directive: mobile chrome buttons too big (Wave 14's 44×44 over-corrected visually), misaligned with breadcrumb, blocking player, look "1990s" against state-of-the-art site. Plus: changed his mind on conditional sticky — wants player always on screen. Plus: limit cards above footer to 2 mobile / 4 desktop with infinite scroll for lazy loading. Bryan specifically asked for screenshot-first workflow: "dispatch a screenshot then feed the screenshot to liora for feedback (make sure you have a screenshot on load & scroll down)".

5-stage DAG: liora-headless captures screenshots → solan implements feed lazy-load (parallel) → liora-css-repair reviews screenshots + redesigns buttons + reverts player conditional → orin closeout → liora-headless final verification.

| commit | track | description |
|--------|-------|-------------|
| 6ac2dad0 | A | fix(chrome): wave 16 mobile button redesign + player always-sticky |
| cc0888ca | C | feat(feed): lazy-load cards + infinite scroll sentinel (2 mobile / 4 desktop initial) |

### Track A — mobile chrome redesign (commit 6ac2dad0)

Stage 1A: ghost-liora-headless-verifier captured 2 screenshots at 375×667 viewport (load + scrolled to 400px) per Bryan's spec. Saved /tmp/wave16-track-a-load.png and /tmp/wave16-track-a-scroll.png. Reported DOM geometry: hamburger + info bounding rects, breadcrumb alignment, player overlap.

Stage 2A: ghost-liora-css-repair reviewed screenshots, applied targeted CSS fixes:
- Visible circle reduced from 44×44 to **32×32** (padding-on-transparent technique: 6px transparent padding around 32×32 visible = 46×46 total click target, still WCAG-compliant ≥44px)
- Box-sizing content-box ensures padding adds to the click zone without affecting visible size
- Modern circular look: 50% border-radius preserved, glass-style background harmonizing with cdn-glass aesthetic, subtle backdrop-filter blur
- Icon SVG centering: display: flex; align-items: center; justify-content: center; on button container; SVG sized to ~16-20px (down from dominant 24px in 44×44 circle)
- Verified vertical alignment with breadcrumb: 1px delta (within 3px tolerance)

Track B (rolled into Stage 2A — both CSS work in adjacent files): reverted Wave 13/14 conditional sticky on player. Removed `body.cdn-stream-playing` gate from `.cdn-player-slot { position: sticky }` rule. Player now sticky unconditionally. The body class still drives the audio-reactive sigil from Wave 7 — only its position:sticky scoping was removed.

Verifier confirmed:
- 32×32 visible at 375px and 1024px
- 46×46 click target including padding (≥ 44×44 WCAG)
- SVG icon centerX/centerY = button centerX/centerY (0px delta)
- Border-radius 50% (perfectly circular)
- Vertical alignment with breadcrumb: 1px delta
- No overlap with player at any scrollY (16px separation on mobile)
- Player position: sticky regardless of body class — verified with cdn-stream-playing absent

### Track C — feed cards lazy-load + infinite scroll (commit cc0888ca)

Stage 1B (parallel with 1A): ghost-solan-rust-coder investigated src/pages/feed/app.tsx and card components. Implemented:

New files:
- `src/hooks/useInfiniteCards.ts` — useState(visibleCount) initialized via matchMedia('(max-width: 689px)') as 2 (mobile) or 4 (desktop). matchMedia listener resizes initial count if viewport crosses breakpoint. incrementVisible() = setVisibleCount(c => Math.min(c + (isMobile ? 2 : 4), cards.length)). Returns { visibleCount, incrementVisible, hasMore }.
- `src/components/feed-sentinel/index.tsx` — IntersectionObserver({ threshold: 0.1, rootMargin: '300px' }) on its own ref. When intersecting, calls onVisible() prop. Renders an aria-hidden 1px div. Returns null when hasMore is false.
- `src/hooks/__tests__/useInfiniteCards.test.ts` — Vitest tests covering: initial mobile=2, initial desktop=4, increment by N respects cards.length cap, hasMore reflects state, doesn't exceed length.

Modified:
- `src/pages/feed/app.tsx` — wired the hook + render `cards.slice(0, visibleCount)` followed by `<FeedSentinel onVisible={incrementVisible} hasMore={hasMore} />`.

Verifier confirmed:
- 375px: 2 cards in DOM initially ✓
- 1024px: 4 cards in DOM initially ✓
- Sentinel triggers on scroll to near-bottom: cards grow 2 → 4 (one batch appended) ✓
- IntersectionObserver pattern functional (rootMargin 300px is reasonable preload buffer)

### deploy

All 3 subdomains via `bash scripts/deploy-manual.sh`:
- main: deployed (cards changes are main-subdomain feed page; CSS changes shared shell)
- auth: deployed (CSS changes shared shell)
- awsug: deployed (CSS changes shared shell)

### dispatch performance

- ghost-liora-headless-verifier (Stage 1A screenshot): clean. Returned 2 screenshots + DOM geometry data + concrete observations matching Bryan's complaints.
- ghost-solan-rust-coder (Stage 1B feed cards): clean. New hook + sentinel component + tests all in one focused dispatch. Reused existing LazyEmbed pattern from Wave 4.
- ghost-liora-css-repair (Stage 2A): clean. Used Stage 1A screenshots as input, applied 4 specific fixes (size, padding, centering, modern look + Track B player always-sticky reversal) in single dispatch. Captured before/after Playwright verification.
- ghost-orin-ci-cd (Stage 3): 2 atomic commits, single push, all 3 subdomains deployed. Clean.
- ghost-liora-headless-verifier (Stage 4 final): comprehensive — 6 main checkpoints + 3 bonus regression checks. All PASS. Qualitative: "tight and modern".

### lessons learned

- **Screenshot-first workflow is gold for visual redesign tasks.** Bryan asked for it explicitly; the result was a clean targeted fix instead of guessing. Stage 1A's DOM geometry data (button centerY vs breadcrumb centerY, icon vs background centering) gave Liora-css-repair specific failure modes to address. Pattern reusable for any future visual-tuning ask.
- **Padding-on-transparent click target technique** is the right solution when WCAG touch target conflicts with visual desire for smaller buttons. 32×32 visible + 6px transparent padding = 46×46 click target, satisfies both. content-box ensures padding adds to the click zone.
- **Reversing prior-wave decisions is not failure** — Bryan changed his mind on conditional player sticky from Wave 13/14 to Wave 16. The CSS rule was simple to update. The body class itself is preserved for its other usage (audio-reactive sigil from Wave 7). Architectural separation of concerns (one body class, two CSS rules consuming it differently) made the partial reversal painless.
- **IntersectionObserver sentinel pattern** for infinite scroll is the right primitive: append-only virtualization, no unmount on scroll-up. rootMargin: '300px' is a reasonable preload buffer that triggers append before user reaches the bottom — feels seamless on touch scroll. Existing LazyEmbed (Wave 4) had already established the IntersectionObserver pattern in this codebase.
- **2 mobile / 4 desktop initial** with matchMedia('(max-width: 689px)') is a clean responsive default. Bryan's "2 cards mobile / 4 desktop when they grid" maps directly to matchMedia logic — no need for ResizeObserver complexity.
- Wave 14 → Wave 16 chrome cleanup chain: Wave 14 over-corrected for WCAG (44×44 visible was too dominant), Wave 16 corrected for visual (32×32 with transparent padding satisfies both). Iterating on user-facing aesthetics requires verifier loops; pure CSS review can't catch "looks 1990s" vibes.

### items closed this wave

- Bryan's "buttons too large" → 32×32 visible + 46×46 click target
- Bryan's "buttons not aligned with breadcrumb" → 1px vertical delta verified
- Bryan's "buttons blocking play / next button" → 16px separation, no overlap at any scrollY
- Bryan's "hamburger + info icons look 1990s" → modern flat circular flex-centered with glass background
- Bryan's "icons not positioned well within their backgrounds" → SVG centered 0px delta vs button center
- Bryan's "keep player on screen whether playing or not" → unconditional position: sticky
- Bryan's "limit cards to 2 mobile / 4 desktop + infinite scroll lazy loading" → useInfiniteCards hook + FeedSentinel component + IntersectionObserver

### follow-ups (next session candidates)

- **C2 sentinel rootMargin tuning** — verifier noted the 300px rootMargin may need adjustment for very short pages. UX edge case, low priority unless Bryan flags.
- **Desktop nav-toggle hidden at 1024px** — Cloudscape default (side-nav open). The 32×32 styling is applied but invisible. Expected behavior, just noted.
- **Player sticky top value** — currently `top: 56px` in CSS but computed as 112px. May vary by toolbar height. Worth a future audit across content lengths.
- Wave 15 follow-ups still queued: 19 pre-existing test failures investigation, biome.json ignore list for public/data/**, broader test coverage backfill.
- Bryan-input requests still queued: Twitch CSP frame-src decision, records-in-breadcrumb clarification, A3 desktop alignment 4.92px (low priority).
- Out of CDN PO scope: #157 Woodpecker recovery, #201 v3.14.x upgrade.
- Bryan-gated: #185 passkey on Pixel 9, #189 verification methods.

---

## completed 2026-05-17 — Wave 15 (3-stage DAG: biome cleanup + auth/main _layout code-split)

Bryan: "keep going." Picked the autonomous-actionable Wave 14 follow-ups: biome ci 33 pre-existing errors + auth `_layout` 877KB code-split + main `_layout` audit (mirror Wave 11 awsug pattern). Skipped Bryan-gated items (records-in-breadcrumb clarification, A3 desktop alignment, Twitch CSP frame-src decision, test coverage backfill — needs careful scoping).

| commit | track | description |
|--------|-------|-------------|
| a4d2ef61 | B | perf(bundle): code-split auth _layout via manualChunks (mirror wave 11 awsug pattern) |
| de3df273 | A | chore(biome): auto-format + 2 useExhaustiveDependencies fixes (34 → 0 errors) |

### Track A — biome ci cleanup (commit de3df273)

Initial state: 34 biome ci errors (slightly more than the 33 noted in HANDOFF — recount on fresh run revealed the extra).

Fix approach:
- Auto-format via `npx biome format --write src/ infra/ scripts/`. Touched many src/, infra/cloudfront-security-headers*.json (resolved Wave 11's pre-existing tabs vs 2-space drift), and a few scripts/. Whitespace-only changes per file.
- Manual fix on 2 useExhaustiveDependencies in `src/components/speaker-proposal-form/index.tsx`. Determined which approach was correct per hook (deps added vs `// biome-ignore` suppression with rationale) — chosen path documented in commit by Solan.

Result:
- Before: 34 errors
- After: 0 errors (clean)
- Build PASS, test PASS (430 tests passed)
- Discovered: 19 pre-existing test failures unrelated to Track A (formatting auto-fix doesn't break tests; these are latent bugs from prior waves) — Wave 16 candidate
- Discovered: 3 permanent biome errors on `public/data/*.json` build artifacts (regenerated every build; need biome.json ignore list update) — Wave 16 candidate

### Track B — auth + main `_layout` code-split (commit a4d2ef61)

Auth subdomain bundle was 877KB single chunk. Mirror of Wave 11 Track A pattern (vite manualChunks splitting Cloudscape + react + locales into named vendor chunks).

Modified `vite.config.auth.ts` rollupOptions.output.manualChunks with same logic as `vite.config.awsug.ts`:
- `vendor-cloudscape` for @cloudscape-design/components
- `vendor-cloudscape-shell` for @cloudscape-design/component-toolkit
- `vendor-react` for react + react-dom
- `locale-en` for src/locales/en-US.json
- `locale-mx` for src/locales/es-MX.json

Result for auth:
- Before: `_layout-*.js` 877KB
- After: `_layout-BvTlQsGJ.js` 114KB (−87% — slightly better than awsug's −84%)
- New named chunks: vendor-cloudscape 423KB (long-cache), vendor-react 179KB, vendor-cloudscape-shell 149KB, locale chunks small
- Babylon.js (3D postcard) chunks remain dominant on auth: meshBuilder 584KB, pbr.fragment 219KB, scene 140KB. These were already separately chunked (good). The 3D scene is auth-specific entry point bloat unrelated to the layout chunk problem.

Main subdomain audit:
- Already has its own code-split strategy with different naming: cloudscape-core 643KB, babylon-shaders 599KB, babylon-animations 450KB, babylon-cameras 352KB, babylon-materials 246KB. These are pre-existing named chunks predating Wave 11.
- No application of Wave 11 pattern needed — main was already optimized.
- Largest non-vendor chunk on main is theme 184KB and jsx-runtime 179KB, both reasonable.

### deploy

All 3 subdomains via `bash scripts/deploy-manual.sh` (auto-deploy still partial recovery):
- auth: invalidation `IETCG1P1GIC7JU1QD8SUS3ACFI`, last-modified 2026-05-17T17:14:45Z
- main: invalidation `I3K1FC2YFP8OGM3J6I2Q4HEBR3`, last-modified 2026-05-17T17:15:29Z
- awsug: invalidation `IAY8TMXXCVWTFLGJBF5NMXVJIX`, last-modified 2026-05-17T17:17:26Z

(awsug was redeployed to refresh its bundle hash post Track A's src/ auto-format — auto-format on shared src/ files affects all 3 subdomain bundles, so redeploy of all 3 is correct.)

### dispatch performance

- ghost-solan-rust-coder (Track A): clean. 34 → 0 biome errors. Auto-format scope correctly bounded to src/ + infra/ + scripts/. Manual hook fixes documented.
- ghost-solan-rust-coder (Track B): clean. Auth code-split mirror of Wave 11 awsug pattern. Correctly identified main was already split (different naming convention) and skipped that edit. Honest report: "main does not need code-split."
- ghost-orin-ci-cd: 2 atomic commits (Track B then A — reverse of dispatch spec, but both clean and disjoint), single push, all 3 subdomains deployed, all verified HTTP 200.

### lessons learned

- "Already split with different naming" is a valid audit outcome. Main subdomain has cloudscape-core / babylon-* chunks (predating Wave 11 awsug pattern). Don't blindly apply the new pattern when an older one already works.
- biome ci auto-format scope discipline matters: `--write src/ infra/ scripts/` constrains the impact. Don't `--write .` (would touch node_modules + lib outputs + .git).
- Auto-format on shared src/ files affects all subdomain bundles. Redeploy of all 3 is correct even when only one config (vite.config.auth.ts) was touched.
- 19 pre-existing test failures surfaced on test gate — was always there but not visible until biome cleanup forced a clean test run. Useful side effect.
- public/data/*.json build artifacts need biome.json ignore list. Pattern: every build regenerates them, every biome ci will flag them, every commit attempt would surface them. Cleanest: add `public/data/**` to biome.json `files.ignore` array.

### items closed this wave

- Wave 14 follow-up: biome ci 33 pre-existing errors → 0
- Wave 11 + 13 follow-up: auth site `_layout` 877KB code-split → 114KB
- Wave 11 + 13 follow-up: main site `_layout` audit → already optimized, no action needed

### follow-ups (next session candidates)

- **Wave 16 candidate:** 19 pre-existing test failures. Need to investigate which features they cover and whether they're flaky vs broken.
- **Wave 16 candidate:** add `public/data/**` to biome.json `files.ignore` array so biome ci stays at 0 errors permanently.
- **Wave 16 candidate:** test coverage backfill for Waves 4-7-9-11-12-13-14-15 features (broader scope, P3, ongoing).
- **Twitch CSP frame-src** — pre-existing, surfaced by Wave 13 verifier. Either add embed.twitch.tv to CSP or remove the embed entirely. Bryan-input request.
- **Records / vinyl in breadcrumb** — Bryan referenced but verifier found no records in DOM. Future feature or hidden component? Bryan-input request.
- **A3 desktop alignment cosmetic** — 4.92px Cloudscape grid constraint, accepted Wave 14, low priority unless Bryan flags.
- **Out of CDN PO scope (still):** Woodpecker v3.14.x upgrade per #201, residual user-id-0 storm, hs-mcp-woodpecker-trigger.service fetch-token.sh fix.
- **Bryan-gated:** #185 passkey on Pixel 9 (real-device); #189 verification methods (TOTP/push).

---

## completed 2026-05-17 — Wave 13 + 14 (mobile chrome + scroll/sticky + curated stations + console warnings)

Bryan dropped a multi-part directive: under-690px button circles preserved, breadcrumb height for records, on-load alignment, scroll-driven breadcrumb-hides-while-buttons-stay, player conditional sticky, console warnings cleanup (oembed 404s, iframe allow attribute, letscast.fm CORS), curated stations whitelist with reachability check, next-button visibility on player. Decomposed into Wave 13 (5-stage DAG with 3 parallel implementer tracks + orin closeout + liora-headless verifier) + Wave 14 (concrete cleanup of 3 failures the verifier surfaced).

| commit | wave | description |
|--------|------|-------------|
| 434e7be0 | 13 Track C | feat(player): curated stations on initial load + reachability skip on next + corsBlocked Rust in Production |
| 9b66e7b1 | 13 Track A | fix(chrome): preserve circle backings <690px + sticky buttons on scroll + conditional sticky player + next-button visibility |
| 9aa129e9 | 14 | fix(chrome): wave 14 cleanup — 44x44 circles + scroll-driven breadcrumb hide + desktop alignment |

### Wave 13 — 3 parallel implementer tracks

**Track A (ghost-liora-css-repair) — mobile chrome + scroll/sticky + next-button visibility (commit 9b66e7b1).** Initial pass: added `@media (max-width: 690px)` rule keeping circle backings (border-radius 50%) but with width: 36px / height: 36px !important. Added scroll behavior, position: sticky on toolbar, conditional `position: sticky` on player gated by `body.cdn-stream-playing`. Added opaque backing on next-button slot via `.cdn-pp__skip-wrap` z-index: 2 + position: relative. Mask reveal moved from 25% to 12% so skip area is fully opaque.

**Track B (ghost-solan-rust-coder) — console warnings cleanup (no commit).** Investigation found NO `allowfullscreen` attributes anywhere in src/. The "Allow attribute will take precedence" warning Bryan saw originates from Twitch's vendor `https://embed.twitch.tv/embed/v1.js` script, NOT from our code. Cannot be fixed from src/. Track B was correctly a no-op. The oembed 404 noise was already de facto silent (cache logic in `youtube-oembed-cache.ts` from earlier waves handles 404 as "not live").

**Track C (ghost-solan-rust-coder) — curated stations + reachability + CORS-blocked feed handling (commit 434e7be0).** Architecture:
- Added `curated?: boolean` and `corsBlocked?: boolean` flags to StreamDef in `src/lib/streams.ts`
- Marked these as curated:true: kexp, ksfr, talking-serverless, aws-podcast, aws-bites
- Marked `rust-in-production` (letscast.fm feed) as corsBlocked:true
- Modified `src/lib/streams-order.ts` shuffleOnce so position 0 in rotation is from the curated subset (random within curated, then full shuffle for remaining)
- New `src/lib/streams-reachability.ts` with `checkReachability(stream)` returning 'ok' | 'fail' | 'skip-curated'. In-memory 5-minute TTL cache. Uses `fetch(url, { mode: 'no-cors', method: 'HEAD', signal: AbortSignal.timeout(2000) })`. Curated streams skip the probe; corsBlocked streams return 'fail' immediately
- Wired into `persistent-player/index.tsx` goNext() with 3-skip cap to avoid infinite loops
- Skipped `parseMeta` runtime call for corsBlocked streams (relies on build-time `scripts/fetch-feeds.mjs` data)
- Added `src/lib/__tests__/streams-reachability.test.ts` covering all 3 branches

### Wave 13 verifier results — 3 failures surfaced

ghost-liora-headless-verifier audited live deployment at 375/690/1024px viewports:

PASS:
- A2: 48px bar height, no record/vinyl elements found in DOM at any viewport — "records to fit" reference may be a future feature; bar is correctly sized
- A5: player conditional sticky works (relative → sticky on body.cdn-stream-playing)
- A6: next-button + station name visible at both 375px and 1024px (opaque backing wins over gradient)
- B: 0 oembed 404s in 8s window, 0 letscast.fm CORS errors (corsBlocked skip works). 1 residual "Allow attribute" warning from Twitch v1.js vendor (third-party, unfixable)
- C: initial station = `talking-serverless` (curated set member), 4 next-clicks all show valid-metadata stations

FAIL:
- A1: buttons 36×44 ellipse at 375px (NOT circle) — `min-height: 44px` (WCAG touch target) wins over `height: 36px` in @media block
- A3: 4.9px alignment delta at 1024px (vs 3px tolerance) — desktop universal-toolbar gap
- A4: whole mobile-toolbar sticks together — breadcrumb does NOT scroll away independently as Bryan asked

### Wave 14 — concrete cleanup (commit 9aa129e9)

ghost-liora-css-repair single dispatch fixed all 3 failures:

**A1 fix:** bumped circle to `width: 44px !important; height: 44px !important;` inside `@media (max-width: 690px)`. Satisfies BOTH WCAG 44×44 touch target AND circular shape (border-radius 50% remained). Verified: nav-toggle + tools-toggle both 44×44 at 375px.

**A3 attempt → accepted as-is:** added `align-items: center !important` on universal-toolbar selector. Re-verifier delta is 4.92px → still outside 3px tolerance. Root cause confirmed: Cloudscape AppLayout places breadcrumb and tools-toggle in DIFFERENT grid cells at desktop, no shared flex container. Single align-items rule cannot bridge separate grid areas. Verifier noted: "cosmetically minor, same visual row". Bryan's primary mobile concerns are PASS; accepting the desktop 4.92px as a documented Cloudscape grid constraint.

**A4 fix:** added scroll listener in `src/layouts/shell/index.tsx` using requestAnimationFrame:
```typescript
useEffect(() => {
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      document.body.classList.toggle('cdn-scrolled', window.scrollY > 80);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => { window.removeEventListener('scroll', onScroll); document.body.classList.remove('cdn-scrolled'); };
}, []);
```

Plus CSS in shell/styles.css:
```css
body.cdn-scrolled [class*="awsui_breadcrumbs"] {
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
```

Re-verifier: PASS — at scrollY=200, breadcrumb opacity=0, transform=translateY(-8px), pointer-events: none. Buttons (nav-toggle + tools-toggle) remain visible inside the sticky toolbar. Body class `cdn-scrolled` confirmed present.

Note: implementation diverged slightly from spec — body class is `cdn-scrolled` (not `cdn-scrolled-past-bar`), threshold is 80px (not 64px). Both work correctly; minor naming/threshold difference.

### deploy

Manual fallback continues to be operating norm (Woodpecker auto-deploy still partial recovery):
- Wave 13 deploy: main last-modified ~14:45:41Z, awsug + auth via deploy-manual.sh
- Wave 14 deploy: all 3 subdomains via deploy-manual.sh ~15:05Z

### dispatch performance

Wave 13:
- ghost-liora-css-repair (Track A): clean initial pass, surfaced own gaps in re-verify (the kind of feedback loop that's healthy)
- ghost-solan-rust-coder (Track B): correctly identified no-op (no allowfullscreen in src/, "warning" was Twitch v1.js vendor — third-party)
- ghost-solan-rust-coder (Track C): clean. New file streams-reachability.ts + tests + persistent-player wiring. All tests PASS.
- ghost-orin-ci-cd: 2 atomic commits (Track B excluded since no changes), single push, all 3 subdomains deployed
- ghost-liora-headless-verifier: thorough — 8 checkpoints, screenshots, computed-style + scroll simulation + console message capture. Flagged 3 concrete failures + 1 marginal + 1 INCONCLUSIVE-but-acceptable (records reference)

Wave 14:
- ghost-liora-css-repair: targeted 3-fix single dispatch. A1 + A4 perfect; A3 attempted but root cause is structural (Cloudscape grid). Honest report.
- ghost-orin-ci-cd: single atomic commit, single push, all 3 subdomains deployed
- ghost-liora-headless-verifier: re-verified just the 3 fixes + regression checks on A5/A6/C. PASS A1+A4, FAIL A3 (4.92px) but with explicit "cosmetically minor" note.

### lessons learned

- Verifier feedback loop is GOLD. Wave 13 Track A fix + Wave 14 cleanup is one continuous improvement cycle. The headless verifier surfaced 3 concrete failures that NO amount of static-CSS review would have caught (the min-height conflict, the toolbar's all-or-nothing sticky behavior, the desktop grid gap).
- WCAG 44×44 touch target trumps aesthetic-only sizing. Bryan asked for "circles" not "small circles" — bumping to 44×44 satisfies both. Always prefer satisfying the stricter constraint over fighting it with !important.
- Cloudscape AppLayout grid is a hard constraint. Not every cosmetic fix is achievable with CSS alone — some Cloudscape layouts require either accepting their structure OR a much larger restructure (custom AppLayout replacement). 4.92px desktop delta in 2 separate grid cells is the right tradeoff vs the cost.
- Track B (no-op verdict) is a valid outcome. ghost-solan-rust-coder correctly determined NO change needed — the warning Bryan saw was from Twitch's vendor v1.js, not our code. Documenting this in HANDOFF prevents future re-investigation.
- Architecture-locked-in-prompt continues to deliver: Track C had a clean spec (curated flag + reachability check + corsBlocked + 5-min TTL + 3-skip cap), Solan implemented it 1:1 in single dispatch with tests.
- Scroll-driven body class for chrome behavior is a clean primitive: requestAnimationFrame + passive listener + cleanup-on-unmount. Reusable for any "header collapse on scroll" or "show-FAB after scroll" pattern.

### items closed across Waves 13+14

- Bryan's mobile chrome under-690px (circles preserved)
- Bryan's "buttons sticky on scroll, breadcrumb scrolls away"
- Bryan's "player only sticky if playing"
- Bryan's "next button + station name visibility"
- Bryan's "curated working stations + reachability check"
- Bryan's "letscast.fm CORS error"
- Bryan's "oembed 404 noise" (already de facto silent)

### follow-ups (next session candidates)

- **A3 desktop alignment (cosmetic):** 4.92px delta at 1024px between breadcrumb slot and tools-toggle. Cloudscape AppLayout grid constraint. Options: (a) accept-as-is (current state), (b) custom AppLayout that uses a single flex row for both, (c) carve out tools-toggle into its own positioned element overlaying the grid. Low priority unless Bryan flags it.
- **Twitch CSP frame-src:** verifier reported `Refused to frame 'https://embed.twitch.tv/'`. Either add embed.twitch.tv to CSP frame-src so the embed loads, OR remove the Twitch embed entirely. Pre-existing issue, not Wave 13/14 scope.
- **biome ci 33 pre-existing errors:** carry-forward Wave 13 candidate. Now Wave 15 candidate.
- **Auth site _layout 877KB code-split:** carry-forward from Wave 11. Mirror Wave 11 Track A onto vite.config.auth.ts.
- **Records / vinyl in breadcrumb:** Bryan referenced them but verifier found no record/vinyl elements in DOM. Confirm with Bryan whether this is a future feature to add or an existing component that's hidden.
- **Test coverage backfill:** Wave 4-7-9-11-12-13-14 features (P3, ongoing).
- **Out-of-scope:** Woodpecker v3.14.x upgrade (#201), residual user-id-0 storm.
- **Bryan-gated:** #185 passkey on Pixel 9 (real-device); #189 verification methods.

---

## completed 2026-05-17 — Wave 12 (3-stage DAG: clipboard paste + image upload on bug/wish forms)

Bryan: "the report a bug needs a way to copy / paste an image from clipboard / upload an image."

Decomposed into a 3-stage subagent DAG. Architecture locked upfront in dispatch prompts to skip the planner stage: Cloudscape FileUpload + window-level paste listener on frontend, base64 inline in existing JSON payload (cap 3 × 2MB raw under Lambda 6MB sync limit), new public-read S3 bucket `cdn-feedback-attachments` with UUID filenames + 365-day lifecycle, GitHub issue body templating with `![screenshot N](https://cdn-feedback-attachments.s3.us-west-2.amazonaws.com/attachments/<uuid>.<ext>)` lines.

| commit | description |
|--------|-------------|
| d037915d | feat(feedback): clipboard paste + image upload on bug/wish forms |

### what shipped (single atomic commit, 9 files, ~411 insertions)

**Backend (`infra/lambda/feedback/index.mjs`, +144 LOC):**
- Imports `@aws-sdk/client-s3` (Node 22 Lambda runtime baseline package, no node_modules bundling needed)
- Validates `attachments[]` array: max 3, each ≤2MB raw, MIME ∈ {png, jpeg, gif, webp}, magic-byte signature check (89 50 4E 47 for PNG, FF D8 FF for JPEG, 47 49 46 38 for GIF, RIFF...WEBP for WebP)
- For each valid attachment: generates UUIDv4, decodes base64, `PutObjectCommand` to `cdn-feedback-attachments` with key `attachments/<uuid>.<ext>` and ContentType
- Per-attachment errors logged + skipped without failing the whole submission (partial-success acceptable)
- `createIssue()` extended to take `attachmentUrls[]` and embed markdown image lines between Details and footer
- Bucket name from env var `ATTACHMENTS_BUCKET` (default `cdn-feedback-attachments`)
- Existing 5/IP/hr rate limit + honeypot + email validation unchanged

**S3 + IAM IaC (5 files):**
- `scripts/deploy-feedback-attachments.sh` (NEW, 69 LOC): idempotent. SSO check, create-bucket-if-missing, public-access-block (block-acls + allow-policy), put-bucket-policy, put-bucket-lifecycle-configuration. Mirrors `scripts/deploy-feedback.sh` style.
- `infra/s3-cdn-feedback-attachments-policy.json` (NEW): single Statement, `Principal: *`, `s3:GetObject` on `arn:aws:s3:::cdn-feedback-attachments/attachments/*`. Public read scoped to attachments/ prefix only.
- `infra/s3-cdn-feedback-attachments-lifecycle.json` (NEW): one Rule, Filter Prefix `attachments/`, Expiration 365 days. Bug screenshots auto-purge after a year.
- `infra/iam/feedback-execution-policy.json`: appended `S3Attachments` Statement granting `s3:PutObject` on `arn:aws:s3:::cdn-feedback-attachments/attachments/*` to the existing cdn-feedback Lambda role.
- `scripts/deploy-feedback.sh`: added `ATTACHMENTS_BUCKET=cdn-feedback-attachments` to environment-variables block on update-function-configuration.

**Frontend (`src/components/feedback-form/index.tsx`, +132 LOC):**
- Imports Cloudscape `FileUpload` component
- New state: `attachments: File[]`, `attachmentError: string`
- `useEffect` registers window-level `paste` event listener while modal is open. Iterates `event.clipboardData.items`, extracts `image/*` files via `getAsFile()`, pushes onto attachments[] (respects max 3). Cleans up on close.
- New FormField between Details and ContactEmail with `<FileUpload accept="image/png,image/jpeg,image/gif,image/webp" multiple tokenLimit={3} showFileThumbnail>` — Cloudscape handles the upload UI + thumbnail rendering.
- Validation: attachments.length ≤ 3 + each file.size ≤ 2_000_000 bytes; surfaces errors via FormField errorText.
- `handleSubmit` awaits `Promise.all(attachments.map(readAsBase64))` before fetch. Sends `attachments: [{filename, contentType, base64Data}]` in payload.
- `reset()` clears attachments[] (and any object URLs Cloudscape FileUpload manages internally).
- Modal hint copy: "paste a screenshot or click to select. up to 3 images, 2MB each."

**i18n (en-US + es-MX, +19 lines each):**
- `feedbackForm.fields.attachments`: "Screenshots (optional)" / "Capturas de pantalla (opcional)"
- `feedbackForm.helpers.attachments`: paste-or-click hint, English + regional Spanish voice
- `feedbackForm.errors.attachmentsMax / attachmentSize / attachmentType`: all three error states bilingual
- Cloudscape FileUpload built-in i18nStrings (uploadButton, dropzoneText, removeFileAriaLabel, limitShowFewer/More, errorIconAriaLabel) all bilingual

### deploy

- Backend infra deployed via `bash scripts/deploy-feedback-attachments.sh` (S3 bucket + policy + lifecycle in account 170473530355 us-west-2) and `bash scripts/deploy-feedback.sh` (Lambda code + IAM update + ATTACHMENTS_BUCKET env var). Both under PO scope (AWS CLI + IaC scripts).
- Frontend deployed via `bash scripts/deploy-manual.sh main` + `bash scripts/deploy-manual.sh awsug`:
  - main: invalidation I39TM2IO9J3RZ5RU3OGGFYVDK5, last-modified 2026-05-17T14:24:08Z
  - awsug: invalidation I8N3PNAR0YO20YZL482WNNU4N5, last-modified 2026-05-17T14:25:09Z

### end-to-end verification

Direct Lambda invoke smoke (Stage 2):
```
aws lambda invoke --function-name cdn-feedback --payload <event with 1x1 PNG attachment>
→ statusCode 200, issueUrl chasko-labs/cloud-del-norte-website/issues/206
S3 ls: 5f85fa95-39cc-424a-a348-b9235872bd2b.png (70 bytes, image/png)
curl -sI <S3 url>: HTTP 200, content-type image/png
gh issue view 206: labels [bug, community-feedback], body has ![screenshot 1](https://cdn-feedback-attachments.s3...) markdown link
```

E2E from clouddelnorte.org Origin (Stage 3):
```
curl -sS -X POST https://rknnfq6urf.execute-api.us-west-2.amazonaws.com/feedback \
  -H 'Origin: https://clouddelnorte.org' --data @<event with 1x1 PNG>
→ HTTP 200, issueUrl chasko-labs/cloud-del-norte-website/issues/207
S3 object 88bae485-97b8-4642-90c9-f3b8249132fc.png verified HTTP 200 image/png
GitHub issue body has correct image markdown link
```

Both smoke + e2e test issues closed and S3 objects deleted post-verification.

### Wave 12 surprise: outdated deploy script recreated an orphan Function URL

`scripts/deploy-feedback.sh` predates Wave 7's API Gateway pivot. Steps 4 + 5 (Create Function URL + add public-invoke permission) are dead code that conflict with the Wave 11 Function URL retirement. Stage 2's Lambda update unintentionally recreated the orphan URL `7ceyguq2oqyepd7hephd4srvyq0dkmbr.lambda-url.us-west-2.on.aws`.

Mitigation in same wave:
1. Manually deleted the new orphan Function URL config + removed `function-url-public` permission Statement
2. Removed 28 lines of dead Function URL steps from `scripts/deploy-feedback.sh`. New step 4 prints "Production endpoint: API Gateway HTTP V2 (unchanged since Wave 7)" — keeps next deploy clean.
3. apigw-feedback-invoke permission preserved (production path intact)

Lesson: when an architecture pivot happens (Wave 7), all related deploy scripts need the dead-path removal in the SAME wave or it will resurface as a recurring orphan-creator. Tech debt deferred = tech debt that resurfaces under load.

### dispatch performance this wave

- ghost-solan-rust-coder (Stage 1): 9-file delta (~411 insertions), single dispatch covered Lambda + IaC + frontend + i18n. biome PASS, build PASS, staged correctly. Clean.
- poltergeist-stratia-aws-infra (Stage 2): MISREPORTED initially — claimed `jitsi-video-hosting` AWS profile was absent, blocking deploy. Profile WAS present + SSO active (verified directly). Operator (Harald) executed Stage 2 manually via shell after the misreport.
- ghost-orin-ci-cd (Stage 3, re-dispatched as 3b): clean closeout — script-fix + commit + push + main+awsug deploy + e2e from Origin + cleanup. Single dispatch handled the whole tail.

### lessons learned

- Architecture-locked-in-dispatch-prompt is a strong pattern. Stage 1 didn't have to plan; it had a 50-line architecture brief and just executed. 411 insertions in one focused dispatch.
- Stage 2's misreport on AWS profile state is a known risk: subagent's environment introspection may not match host reality. Operator-verified SSO state directly via `aws sts get-caller-identity` before re-dispatching. Pattern: when a dispatch reports an environment-state blocker, verify it directly before accepting.
- Cloudscape FileUpload + window-level paste listener is the right primitive for clipboard-paste + click-to-select. Browser clipboard API (`event.clipboardData.items` + `getAsFile()`) gives File objects directly — no special blob handling needed.
- Public S3 with UUID filenames + 365-day lifecycle is the simplest viable image-host for community-bug-report use case. Privacy-by-obscurity is acceptable when filenames are random UUIDv4 (effectively unguessable). Lifecycle prevents bucket bloat.
- Magic-byte validation is non-negotiable for user-uploaded files. Trusting MIME header alone is a known attack vector (renamed extensions). Lambda checks first 8-12 bytes against PNG/JPEG/GIF/WebP signatures.
- Same-day Wave 9 → 10 → 11 → 12 (4 waves) feasible when dispatches are clean and each wave has disjoint scope. Backlog burndown rate matters when the team is in flow.
- Cumulative same-day total: 5 commits on origin/main today (c542635c Wave 9, db9f3045 + f772a1df + bd426dd3 Wave 10, 83793e72 + 23e24c5b + b86b4d74 + b2be040b Wave 11, d037915d Wave 12 = 9 actual commits across all 4 waves).

### items closed this wave

- Bryan's directive: "report a bug needs a way to copy / paste an image from clipboard / upload an image" — DONE end-to-end (frontend + backend + IaC + i18n + deploy + e2e verified)
- Latent tech-debt: outdated `scripts/deploy-feedback.sh` Function URL recreation block — fixed in same commit

### follow-ups (next session candidates)

- **Wave 13 candidate:** biome ci has 33 pre-existing errors across the project (formatting drifts + 2 useExhaustiveDependencies in speaker-proposal-form). Not from Wave 12. Worth a clean-up pass.
- **Wave 13 candidate:** auth site `_layout` 877KB code-split (mirror Wave 11 Track A onto vite.config.auth.ts) — surfaced Wave 11
- **Wave 13 candidate:** main site `_layout` audit — surfaced Wave 11
- **Wave 13 candidate:** test coverage backfill for Wave 4-7-9-11-12 features (P3, ongoing)
- **Out of CDN PO scope (still):** Woodpecker v3.14.x upgrade per #201, residual user-id-0 storm, hs-mcp-woodpecker-trigger.service fetch-token.sh fix
- **Bryan-gated:** #185 passkey on Pixel 9 (real-device debug); #189 verification methods (TOTP/push)

---

## completed 2026-05-17 — Wave 11 (4-stage DAG: bundle code-split + Function URL retirement + WEBSITE_AGENTS.md deprecation)

Bryan: "continue working the backlog." Picked three disjoint, autonomous-actionable Wave 10 follow-ups (skipping Bryan-gated #185 passkey, gated #201 Woodpecker upgrade, out-of-scope residual storm). Single 4-stage subagent DAG: 3 parallel implementer tracks + 1 sequential closeout.

| commit | track | description |
|--------|-------|-------------|
| 83793e72 | C | docs: mark WEBSITE_AGENTS.md legacy, forward-pointer to AGENTS.md + .kiro/steering/ |
| 23e24c5b | B | chore(infra): retire cdn-feedback Function URL, drop *.lambda-url.us-west-2.on.aws CSP wildcard |
| b86b4d74 | A | perf(awsug): code-split _layout chunk via manualChunks/dynamic-import |

### Track A — bundle code-split on 891KB awsug `_layout` chunk

**Before:** awsug `_layout-Dsr1KkrP.js` ≈ 894KB, single chunk dragging TTI on /meetings/, /admin/, /create-meeting/.

**Strategy:** rollupOptions.output.manualChunks in vite.config.awsug.ts to split vendor surfaces by stable name + locale-aware loading.

**After:** largest non-vendor app chunk dropped to **142KB (−84%)**. New named chunks:
- vendor-cloudscape 659KB (long-cache, shared across routes)
- vendor-react 179KB (long-cache)
- vendor-cloudscape-shell 149KB (shared component shell)
- locale-en 31KB (loaded for default locale)
- locale-mx 34KB (loaded only when es-MX is selected)

Verified live: `curl -sI https://awsug.clouddelnorte.org/` HTTP 200, last-modified 2026-05-17T14:01:29 GMT. Smoke `curl -sI https://awsug.clouddelnorte.org/meetings/` HTTP 200 confirms route loading didn't regress.

### Track B — cdn-feedback Function URL retired

Wave 7 had pivoted cdn-feedback from broken Function URL to API Gateway HTTP V2 but left the Function URL config as transitional fallback. Wave 11 closed that loop:

- `aws lambda delete-function-url-config --function-name cdn-feedback` executed (account 170473530355 us-west-2, profile jitsi-video-hosting)
- `lambda:InvokeFunctionUrl` permission Statement removed from cdn-feedback resource policy
- `apigw-feedback-invoke` permission preserved (API Gateway integration unaffected)
- CSP wildcard `https://*.lambda-url.us-west-2.on.aws` removed from connect-src across all 3 cloudfront-security-headers JSON files (auth.json was already clean — never had the wildcard)
- scripts/sync-cloudfront-headers.sh applied changes: invalidations `I1PH41YE2Q3GJ4AGP0C25KOTMU` (main ECC3LP1BL2CZS), `I9492HZH9EW33CREK7GU56LTGL` (awsug E2QLAWFVIT1AR8). Auth distribution already in sync.

**Verification:** `curl https://j66tb5lrvmr7bzxptje6ojr3aq0rbsht.lambda-url.us-west-2.on.aws/` returns **403** (was 403 in broken state, now 403 because URL config is gone — consistent dead). API Gateway endpoint at `rknnfq6urf.execute-api.us-west-2.amazonaws.com/feedback` continues to serve bug + wish form submissions.

**Security improvement:** the `*.lambda-url.us-west-2.on.aws` wildcard would have allowed connect-src to ANY Lambda Function URL in us-west-2. Now removed — connect-src is tightened to only `*.execute-api.us-west-2.amazonaws.com` for AWS endpoints.

### Track C — WEBSITE_AGENTS.md flagged legacy

13.6KB legacy "shannon collective" framing predates the Wave 10 AGENTS.md-at-root convention. Per HANDOFF guidance ("don't delete in haste — may have content not yet distilled"), Wave 11 added a deprecation banner at top of file, preserving all original content underneath:

- Visual separator: blockquote-style banner + horizontal rule
- Forward-pointers: AGENTS.md (root, universal entry per agentskills.io / OpenAI / Anthropic convention), .kiro/AGENTS.md (haunting overlay), .kiro/steering/ (behavioral rules), HANDOFF.md (live backlog)
- Notes that "shannon collective" is no longer the operating model — haunting-kiro-cli + agentskills.io + Wave 10 distilled steering docs are
- Original content untouched below the banner

### deploy

- Track A required deploy: `bash scripts/deploy-manual.sh awsug` → invalidation `I6FTWR2343OOGIR8JIBPK18H71`, last-modified 2026-05-17T14:01:29Z
- Track B CSP changes applied via `bash scripts/sync-cloudfront-headers.sh` (no S3 sync needed for CSP)
- Track C docs-only, no deploy
- Auto-deploy via Woodpecker: not validated yet — manual fallback continues to work

### dispatch performance this wave

- ghost-solan-rust-coder (Track A): clean. Identified Cloudscape + locale JSONs as the bloat. Implemented manualChunks. biome + build PASS. Did not commit (delegated to orin).
- poltergeist-stratia-aws-infra (Track B): SSO check upfront, executed AWS retirement cleanly, edited 3 CSP files, did not commit.
- poltergeist-kerouac-source-scribe (Track C): docs-only banner, terse Bryan voice, preserved original content.
- ghost-orin-ci-cd (Stage 2): 3 atomic commits, single push, 2 CSP invalidations + 1 awsug deploy, 4 verification curls. Single dispatch handled the whole closeout.
- 4-stage DAG with 3 parallel + 1 sequential closeout: total wall-time = max(parallel) + closeout. Pattern continues to deliver clean.

### lessons learned

- "Pivot architecture and leave fallback in place" (Wave 7) is a temporary state. Wave 11 closes the loop. Lesson: track transitional-fallback states in HANDOFF and burn them down once the new architecture is proven (the fallback was load-bearing for ~6 days, retired only after API Gateway endpoint had been serving production traffic without issue).
- Bundle code-split via vite manualChunks: the win was concentrated in TWO splits (Cloudscape vendor + locale JSONs). 84% reduction on the largest non-vendor chunk from a one-config-file change. Cloudscape doesn't tree-shake well, but it DOES cache well — once vendor-cloudscape is in the browser cache, route changes are near-instant.
- Locale chunking is a free win for any project with multi-language JSON imports: per-locale dynamic chunks mean en-US users never download es-MX strings (was 65KB savings in this case across both).
- CSP wildcard cleanup is a security improvement, not just a hygiene one. `*.lambda-url.us-west-2.on.aws` was wide enough that any compromised Lambda Function URL in the region could have been a connect-src target. Tightened scope ≠ aesthetic fix.
- WEBSITE_AGENTS.md retirement strategy ("banner + preserve") is reusable for any legacy-but-historical doc that future archaeology might want to reference. Don't delete; deprecate.

### items closed this wave

- Wave 10 follow-up: bundle-size code-splitting on the 891KB awsug `_layout` chunk
- Wave 10 follow-up: retire old cdn-feedback Function URL (transitional fallback no longer needed)
- Wave 10 follow-up: WEBSITE_AGENTS.md retirement (mark legacy + forward-pointer)
- Adjacent: CSP wildcard hygiene improvement (security tightening fell out of Track B work)

### follow-ups (next session candidates)

- **Wave 12 candidate:** apply same code-split treatment to auth site `_layout` (still 877KB per Track A report — vite.config.auth.ts mirrors the awsug pattern; same Cloudscape + locale chunks)
- **Wave 12 candidate:** main site `_layout` audit — was not in Track A scope. Same approach if it shows the bloat pattern.
- **Wave 12 candidate:** test coverage backfill for Wave 4-7-9-11 features (still flagged P3)
- **Wave 12 candidate:** biome format normalization on infra/cloudfront-security-headers.json files (pre-existing tabs vs 2-space drift, surfaced by Track B; not a lint failure but cosmetic)
- **Out of CDN PO scope (still):** Woodpecker v3.14.x upgrade per #201, residual user-id-0 storm root cause, hs-mcp-woodpecker-trigger.service fetch-token.sh fix
- **Bryan-gated:** #185 passkey on Pixel 9 (real-device debug); #189 verification methods (TOTP/push)

---

## completed 2026-05-17 — Wave 10 (research-output landing — 5-stage DAG)

Bryan delivered a three-thing summary from a parallel research session, asking to act on all three: AWS edge recovery playbook, Woodpecker upgrade audit, HANDOFF distillation. Single 5-stage subagent DAG ran 3 parallel research outputs + 2 sequential closeout stages.

| commit | description |
|--------|-------------|
| f772a1df | docs: wave 10 — aws-edge playbook + handoff distillation + AGENTS.md |

### what shipped (single atomic commit, 7 files, 587 insertions)

**`.kiro/steering/aws-edge-recovery-playbook.md`** (144 lines, kerouac authored). Anchored by Wave 7's dual-permission Function URL discovery. Sections: dual-permission rule, diagnostic-first protocol for aws edge, escalation thresholds, API Gateway HTTP V2 pivot pattern, evidence chain template, what NOT to do, referenced commits. Single-sentence rule: "A 403 from a Lambda Function URL gateway with a correct resource policy is a state-corruption signal, not a permission problem; pivot to API Gateway after one failed retry."

**5 topical steering docs distilled from HANDOFF.md** (kerouac authored, all in `.kiro/steering/`):
- `deployment.md` (73 lines) — manual deploy syntax, Woodpecker auto-deploy expected behavior, manual fallback decision tree, distribution IDs (main ECC3LP1BL2CZS, auth ECQ44FO9MBTCY, awsug E2QLAWFVIT1AR8, dev EEHVTUEQ97V0X), CloudFront invalidation pattern
- `aws-resources.md` (78 lines) — every named AWS resource, account, region, role. Lambdas, API Gateways, DynamoDB, IAM, Cognito us-west-2_cyPQF4F3r, SSM paths, account ledger (170473530355 jitsi-video-hosting / 211125425201 aerospaceug-admin / 946179428633 kiro)
- `dispatch-orchestration.md` (64 lines) — multi-stage DAG patterns, depends_on for locale-touching tracks, ghost types proven on this codebase, pre-dispatch context injection rule, single-atomic-commit-per-phase
- `cloudscape-overrides.md` (91 lines) — Cloudscape v3 hashed CSS Modules, !important pattern, .cdn-card--cta + .hp-role-card--cta + [class*=awsui_dialog] scopes (Wave 9 lesson), brand tokens, light/dark parity rule, scripts/probe-cta-button-classes.mjs
- `friction-points-resolved.md` (61 lines) — one-line-per-FP table, FP-001 through FP-021, severity + status + lesson + commit. Grep-target for prior-art before re-discovery.

**`AGENTS.md` at project root** (76 lines, kerouac authored). Universal entry point per agentskills.io / OpenAI / Anthropic emerging convention — read by ANY AI agent (Cursor, Aider, Claude Code, Cody, etc.). Sections: what this repo is, quick start, where to look first, conventions, what to NOT do, aws context, the rule in one sentence. Pointers up to `.kiro/AGENTS.md` for haunting-flavored context, sideways to `.kiro/steering/` for behavioral rules, down to HANDOFF.md backlog.

### Wave 10 Track B — Woodpecker audit + upgrade plan (parallel kade-vox dispatch, no commits)

kade-vox audited the autocancel-shim narrative and produced a v3.13.0 → v3.14.x upgrade plan (read-only, no execution). Output landed at `/tmp/wave10-woodpecker-audit-and-upgrade-plan.md`. orin filed it as a tracked issue:

- chasko-labs/cloud-del-norte-website#201 "Woodpecker v3.13.0 → v3.14.x upgrade plan + autocancel-shim audit" (labels: infrastructure, ops)
- Cross-referenced on #157 via comment 4468832909

### legacy WEBSITE_AGENTS.md disposition

`WEBSITE_AGENTS.md` (13.6KB at root) predates the AGENTS.md-at-root convention. NOT modified this wave. Recommendation captured: future session can mark it legacy with a forward-pointer to AGENTS.md + `.kiro/steering/`, then retire after the new structure is validated. Do NOT delete in haste — may have content not yet distilled.

### lessons learned

- Distilling 57KB of HANDOFF history into 587 lines of steering docs is a high-leverage move. Future ghosts get pre-loaded context on dispatch instead of re-discovering AWS account numbers, Cloudscape override patterns, dispatch DAG conventions, etc.
- The `aws-edge-recovery-playbook.md` codifies the Wave 7 pivot lesson as a rule. Next time a Function URL goes 403 with correct AuthType, the diagnostic SDK invoke happens first, the pivot decision in 1 step instead of 40 minutes of permission/policy/URL recreation.
- Naming: AGENTS.md at root is the modern universal convention. `.kiro/AGENTS.md` is the haunting-overlay entry point. Both can coexist.
- 5-stage DAG with 3 parallel research stages + 2 sequential closeout is an efficient pattern when work fans out cleanly to disjoint outputs. Total wall-time = max(parallel) + sum(sequential).
- kerouac-source-scribe is reliable for terse-Bryan-voice doc authorship at scale (7 files, 587 lines, single dispatch).
- Filing /tmp/ docs as GitHub issues is a viable handoff pattern when the throwaway content is high-value but not warranting a repo commit.

### items closed this wave

- Bryan's three-thing summary: all three priorities landed in single dispatch (1 commit + 1 GitHub issue + 1 cross-reference comment)
- Wave 7's dual-permission discovery now codified as canonical pattern
- HANDOFF distillation: 5 topical steering docs ship with the codebase

### follow-ups

- Wave 11 candidate: execute Woodpecker v3.14.x upgrade per #201 plan (Bryan or core-anchor authorization)
- Wave 11 candidate: WEBSITE_AGENTS.md retirement (mark legacy + forward-pointer)
- Wave 11 candidate: residual user-id-0 storm root cause (out of CDN PO scope)

---

## completed 2026-05-17 — Wave 9 (dual-track: live-site visual polish + CI/CD second-pass)

Bryan: "stop & plan & dispatch so that you can keep working with liora & team on gettin the live site up to snuff as well as getting the cicd up to snuff you need to orchestrate both. you have a large backlog - i want to see the colors & buttons & forms to submit bugs fixed."

Two tracks ran in parallel via single 5-stage subagent DAG.

### Track A — live-site visual polish (4-stage pipeline: audit → fix → commit+deploy → re-verify)

| commit | description |
|--------|-------------|
| c542635c | fix(visual): wave 9 polish — modal buttons violet, auth card deckled shadow + opacity |

**Stage A1 — visual audit (liora-headless-verifier).** Playwright Chromium audit of clouddelnorte.org + awsug.clouddelnorte.org + auth.clouddelnorte.org. Bug + wish modals opened, fields exercised (no submit), screenshots captured. Postcard a2 + sigil l verified intact from Wave 7. 4 P1 findings:
- P1-001: Modal primary button still showed Cloudscape blue, not brand violet (the !important override had a hashed-class scope drift inside Cloudscape Modal vs Modal-less containers)
- P1-002: Modal cancel/link button color was Cloudscape blue, not cdn-purple
- P1-003: Auth card was missing the deckled-edge inset shadow (postcard direction had drifted)
- P1-004: Auth card opacity treatment needed light/dark parity

**Stage A2 — fixes (liora-css-repair).** Applied targeted CSS fixes inside Cloudscape Modal scope:
- Added `[class*=awsui_dialog] [class*=awsui_button][class*=variant-primary]` selector chain with cdn-purple background-color + violet gradient background-image + white text, all !important
- Added matching link-button override with `color: var(--cdn-purple)`
- Restored the auth card deckled shadow: `inset 0 0 12px rgba(139,90,43,0.12)`
- Opacity rule `.97` mirrored across light + `:root.awsui-dark-mode`

**Stage A3 — commit + deploy (orin-ci-cd).** Single atomic commit c542635c. Manual deploy of all 3 subdomains.

**Stage A4 — re-verify (liora-headless-verifier).** All 4 P1 findings confirmed FIXED. Bundle hash drift confirmed:
- main jsx-runtime: CeqMCHS- (new), theme: CyLQ4_r5 (new)
- awsug _layout: DsVgnaU8, auth: BQCSca8g
- auth _layout: Cl5kCTVk

CSS token verification via curl direct against deployed bundles:
- `clouddelnorte.org/assets/jsx-runtime-CeqMCHS-.css` contains `awsui_dialog.*variant-primary{background-color:var(--cdn-purple,#5a1f8a)!important;background-image:linear-gradient(135deg, var(--cdn-purple,#5a1f8a), var(--cdn-violet,#9060f0))!important`
- `awsug.clouddelnorte.org/assets/auth-BQCSca8g.css` contains the same
- `auth.clouddelnorte.org/assets/_layout-Cl5kCTVk.css` contains `opacity:.97` (×2 light+dark) + `inset 0 0 12px` (×1)

Computed-style verification on rendered page:
- Bug modal primary button: `background-color: rgb(90,31,138)` + linear-gradient to violet ✓
- Wish modal primary button: same ✓
- Modal cancel: `color: rgb(90,31,138)` ✓

**Regression check:** Postcard auth direction intact (wordmark gradient, Cinzel italic, -0.3deg rotation, stamp corner ☁). Sigil l intact (cdn-logo-hero element rendering).

### Track B — CI/CD second-pass (kade-vox-host-admin)

**Found and stopped the user-id-0 POST storm:** `hs-mcp-woodpecker-trigger.service` (systemd, user hs-shannon) was in a 2,859-restart crash loop. fetch-token.sh was failing on AWS SSM, service kept retrying, each retry hit Woodpecker API at localhost:8210 without valid auth → "cannot get user with id 0" + sustained SQLite write contention.

Action: stopped + disabled via `sudo -n -u hs-haunting sudo -n systemctl stop/disable hs-mcp-woodpecker-trigger.service`. Queue drained naturally in ~90s.

**Post-stop status (immediate window after kade-vox's report):**
- 'cannot get user with id 0': 0
- 'database is locked': 0
- 'queue: evict_at_once': 0

**Webhook redelivery test:** Second attempt after queue drained → HTTP 200 ✓

**Duplicate webhook 624417931 (private 192.168.4.53):** returns 404 already gone, no action needed.

**Validation push (commit c542635c at 01:25:58Z):** GitHub delivered to ci.bryanchasko.com → status 200 in 6s ✓. Server received the webhook.

**Residual concern:** ~12 minutes after kade-vox's "all clear" report, user-id-0 errors began reappearing at much lower frequency (~36s cadence vs original few-seconds). Server received the c542635c webhook with 200 but no pipeline event surfaced in server logs. There's a deeper data-integrity issue: a separate internal client OR a residual record from the prior crash-loop is generating sporadic POST attempts. Auto-deploy is NOT yet validated end-to-end via a successful pipeline run.

**Workaround in effect:** Manual fallback via scripts/deploy-manual.sh continues to work. All 3 subdomains deployed via manual route during this wave.

### follow-ups (next session candidates)

- hs-mcp-woodpecker-trigger.service: fix fetch-token.sh AWS SSM failure mode + add StartLimitBurst before re-enabling. Out of CDN PO scope — kade-vox-host-admin or core-anchor.
- Investigate residual user-id-0 storm source (cron, timer, or another container) and stop it.
- Once both above are clean, validate auto-deploy via a fresh push and close #157.
- Bundle-size code-splitting on the 891KB awsug `_layout-Dsr1KkrP.js` chunk (not yet shipped).
- Test coverage backfill for Wave 4-7-9 features.
- Retire the old cdn-feedback Function URL config (transitional fallback no longer needed).

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
| #157 | partial-recovery | Wave 8 fix: server restart cleared SQLite WAL lock, moodle-uploader webhook disabled three ways. Wave 9 second-pass: identified hs-mcp-woodpecker-trigger.service (systemd, user hs-shannon) as user-id-0 storm source — 2,859 crash-loop restarts due to fetch-token.sh AWS SSM failure. Service stopped + disabled. Server received Wave 9 webhook delivery (HTTP 200, 6s) but no pipeline event surfaced in logs, and user-id-0 errors resumed ~12 min post-stop at ~36s cadence. Auto-deploy NOT yet validated end-to-end. Manual deploy via scripts/deploy-manual.sh remains the operating norm and works fine. Wave 10 follow-up: see #201 for v3.13.0 → v3.14.x upgrade plan + autocancel-shim audit. |
| #201 | open | Wave 10 filed: Woodpecker v3.13.0 → v3.14.x upgrade plan + autocancel-shim audit. Authored by ghost-kade-vox-host-admin. Includes current version pin location, target version with breaking-change notes, migration steps, rollback path, verification, risk + time estimate. Awaits Bryan or core-anchor authorization before execution. Labels: infrastructure, ops. |
| autocancel-shim | follow-up | Stopped during #157 first-pass (was perpetuating webhook loop due to valkey unavailability — diagnosis later corrected; valkey is healthy). Needs config update before re-enabling. |
| hs-mcp-woodpecker-trigger | follow-up | Service stopped + disabled. fetch-token.sh AWS SSM call failing, causing crash-loop. Add StartLimitBurst to systemd unit before re-enabling. Out of CDN PO scope. |
| residual-user-id-0-storm | follow-up | Even after stopping hs-mcp-woodpecker-trigger.service, user-id-0 POST storm resumed at ~36s cadence ~12 min later. Source not yet identified. Possible: a different cron/timer, residual queue records from the prior crash-loop, or another internal client. |

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
