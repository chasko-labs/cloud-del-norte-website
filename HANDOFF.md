# cloud del norte — handoff plan

**date:** 2026-05-08  
**branch:** main (dev recreated fresh)  
**last commit:** 7d528ed feat: token refresh, nav cleanup, player overflow, footer, speakeasy redesign, costs tab, home dashboard  
**deploy:** 3f8c98e5 (empty commit trigger) — woodpecker firing to all three targets

---

## completed 2026-05-08

- token refresh fix shipped (`_shared/auth.ts`, `api.ts`) — all speakeasy buttons functional post-deploy
- nav cleanup — removed duplicate links
- css fixes: player overflow, footer bleed, speakeasy sign (purple neon matching logo)
- liora frame logs errors instead of swallowing silently
- costs tab added to plans page with lambda backend ready in `infra/`
- ses domain verification started (account 211125425201, us-west-2)
- git reconciled — both machines on main head, dev branch fresh
- nova act working on aibox (recipe in session memory)

---

## priority queue (next session)

### p0 — dkim cname records (unblocks signups)

**blocker:** SSO tokens expired on all three profiles. cannot reach AWS APIs from this machine.  
**what's needed:**
1. `aws sso login --profile aerospaceug-admin`
2. `aws sesv2 get-email-identity --email-identity clouddelnorte.org --region us-west-2 --profile aerospaceug-admin` → extract 3 DKIM CNAME tokens
3. add the 3 CNAMEs at the **DNS registrar** (not Route53 — the registrar for clouddelnorte.org)
4. wait for propagation, then verify: `aws sesv2 get-email-identity` shows `DkimAttributes.Status: SUCCESS`
5. switch cognito user pool email config to `EmailSendingAccount=DEVELOPER` with `SourceArn` pointing to the SES identity
6. request SES production access (out of sandbox)

**SES identity location:** account 211125425201, region us-west-2, domain clouddelnorte.org  
**cognito pool:** account 170473530355, us-west-2, pool us-west-2_cyPQF4F3r

### p1 — deploy cost-aggregator lambda + cross-account iam

**files ready:** `infra/lambda/cost-aggregator/index.mjs`, `infra/iam/cost-reader-policy.json`, `infra/eventbridge/daily-cost-rule.json`  
**steps:**
1. create lambda function `cost-aggregator` in account 170473530355, us-east-1
2. create IAM role `cost-reader-cross-account` in accounts 211125425201 and 946179428633 with `infra/iam/cost-reader-policy.json`
3. create EventBridge rule from `infra/eventbridge/daily-cost-rule.json`
4. tag bryanchasko.com resources in account 946179428633 with `project=bryanchasko-com` so they're excluded from CDN cost reporting

### p2 — nova act authenticated audit (PR #140)

infra works. needs auth tokens injected so nova can see the logged-in view.  
options: login-first flow in the recipe, or browser auth injection (cookie/localStorage seeding).

### p3 — dependabot alerts

two branches exist (`flatted-3.4.2`, `picomatch-2.3.2`) but both are stale — created against old package.json structure. will conflict on merge. likely need closing and re-running dependabot, or manual version bumps in current package.json. five total alerts reported.

### p4 — pdf link (resolved)

`https://arrowheadcenter.nmsu.edu/park/Soundstage-DB-RFP.pdf` returns HTTP 200, last-modified 2026-04-30. link is live. no action needed.

---

## critical: photosensitivity violations

> fix these before any public demo. the epilepsy foundation guideline is <3 Hz for flashing content.
> wcag 2.3.1 (general flash threshold) applies at 3 flashes per second over any 10-degree visual field.

### 1. `liora-tube-off` animation — confirmed violation

**file:** `src/components/liora-panel/styles.css:1607`  
**animation:** `@keyframes liora-tube-off` — runs at 1.1s, 5 bright-dark flash cycles  
**measured rate:** first pair ~6.5 Hz, second ~5.7 Hz, third ~4.5 Hz, fourth ~3.8 Hz — all exceed 3 Hz  
**fix:** extend total duration to ≥3s so each cycle is ≥333ms. reduce number of flash cycles from 5 to 2 max.  
suggested rewrite: 0% bright → 40% dark → 70% dim → 100% black. remove intermediate peaks at 22%, 40%, 62%.

### 2. `liora-tube-off` color — amber on charcoal (no red-on-blue, but verify)

check that no bright frames combine dominant red + bright blue simultaneously (WCAG 2.3.1 pair threshold 1cd/m²).  
current keyframes use `saturate(0)` — grayscale — so no color pair violation. safe.

### 3. dune sparkle rate at `SPARKLE_SPEED_PLAYING`

**file:** `src/dune/white-sands-features.ts:88-90`  
`SPARKLE_SPEED_PLAYING = 1.5` — sparkles at ~3 Hz when music plays. borderline.  
**fix:** drop to 1.0 (≈2 Hz). the visual difference is minimal; the safety margin is not.

### 4. dancing animations / strobe on station start/stop/skip

user reports: "dancing animations = random fast strobe"  
**find in:** `src/components/liora-panel/styles.css` — `name-flash`, `shatter-flash`, any class applied on station change  
`name-flash` at 0.65s is a one-shot forward-fill — not repeating, likely safe  
`shatter-flash` at 0.95s is a one-shot — safe  
**action:** audit for any `.cdn-stream-playing` body class transitions that fire repeating flicker effects. strobe must only fire once on start/stop/skip, never loop.

---

## a — layout + panels

### a1. side panels bleed into / get stuck under footer

**symptom:** left nav panel bleeds into the persistent player / footer. right tools panel ends awkwardly above footer with dead space.  
**files:** `src/layouts/shell/styles.css`, `src/components/footer/styles.css`  
**approach:**  
- left nav: cloudscape `AppLayout` sets `blockSize: calc(100vh - headerHeight)` on navigation container. add `padding-bottom` on `main[class*="awsui_layout"] > [class*="navigation-container"]` to match `cdn-player-slot` height (approx 72px) + footer height (approx 48px).
- right tools: same treatment on `[class*="tools-container"]`.
- measure both at 320px, 768px, 1280px with playwright before marking done.

### a2. login page — full ux rethink

UX critique summary (dispatched 2026-05-03):

> "current design is technically competent but tonally split. cloudscape formality clashes with a creative product. the dune scene is atmospheric but competing for attention. breadcrumbs and glass card both feel borrowed from enterprise UI."

specific findings:
- **breadcrumbs on a login page** distract rather than orient. remove or replace with top-left logo link.
- **cloudscape form labels** feel institutional ("Email") not inviting. at minimum: softer placeholder text, more vertical breathing room.
- **glass card on animated 3D** creates cognitive overload — the animated background competes with the form for attention. increase card opacity or add a subtle dark scrim behind the card.
- **amber CTA** catches the eye but reads as "caution/proceed carefully" — not "let's go." consider warm gold or the brand's secondary if it exists.
- **player slot** adds a third focal point during auth. optionally hide it on auth pages.

three design alternatives researched and available (see full critique below for detail):  
1. **"the postcard"** — full-bleed dune scene, form as dark overlay strip at bottom. no glass card.  
2. **"the command console"** — dark glass card, monospace / handwriting font, underline-only inputs.  
3. **"the desert entry"** — no card, form floats over dune with 20-40% dark tint overlay, serif typography.

**near-term quick fix (no design rethink required):**
- increase `backdrop-filter: blur` on auth glass card to 18-20px + raise `background-color` opacity from current ~0.55 to 0.72 to make form easier to read
- hide breadcrumbs on auth pages via `AuthLayout` (remove `breadcrumbs` prop, add a bare `<a href="...">` logo link in the header instead)
- optionally suppress persistent player on `cdn-auth-subdomain` body class (`.cdn-auth-subdomain .cdn-player-slot { display: none; }`)

---

## b — player — next station / navigation

### b1. next button falls off screen on long titles

**symptom:** on long episode titles the skip-to-next button (`cdn-pp__btn--skip`) scrolls/overflows off the left edge.  
**file:** `src/components/persistent-player/styles.css`, `src/components/persistent-player/index.tsx:523-529`  
**approach:**  
- player controls bar must use `flex` with the skip button in a `flex-shrink: 0` container anchored right.
- title area gets `flex: 1 1 auto; min-width: 0; overflow: hidden;` so it absorbs excess width.
- title text itself: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` — OR if marquee scroll is desired, set up `animation: marquee 8s linear infinite` only on long titles (detect via `scrollWidth > clientWidth`).

### b2. next station info under skip button

**spec:** under the `>>|` skip button, show the call sign / 4-letter key of the next podcast + `&next` label so the `t` of `next` aligns vertically with the `|` in `>>|`.  
**file:** `src/components/persistent-player/index.tsx`  
**approach:**  
- derive `nextStation` from `STREAMS` array using same modulo arithmetic as `skipStation()` (line 728).
- render below skip button:
  ```tsx
  <span className="cdn-pp__next-hint">{nextStation.key.slice(0,4).toUpperCase()}&amp;next</span>
  ```
- css: `font-size: 9px; letter-spacing: 0.08em; text-align: right; white-space: nowrap;`

### b3. scroll position lost on next station

**current behavior:** navigating to next station scrolls page back to top.  
**cause:** unknown — likely `window.scrollTo(0,0)` or `focus()` on audio element triggering a scroll into view. check `PersistentPlayerBar` `onSkipStation` handler and any `useEffect` that fires on station change.  
**fix:** capture `window.scrollY` before skip, restore after station mount. or `document.querySelector('.cdn-player-slot')?.focus({ preventScroll: true })`.

---

## c — streams / podcast data

### c1. aws developers podcast — hide until dns resolves

**symptom:** go-aws.com DNS was SERVFAIL as of 2026-05-03. episode audio fails.  
**file:** `src/lib/streams.ts:696`  
**fix:** add a `hidden: true` field to `StreamDef` interface and filter it out in `streams-order.ts` before the shuffle. one-line addition:
```ts
// in streams.ts at aws_developers_podcast entry:
hidden: true,
```
```ts
// in streams-order.ts shuffleOnce:
const copy = [...arr].filter(s => !s.hidden);
```
restore by removing `hidden: true` when DNS is fixed.

### c2. add aws latam podcast

**target feed:** find the AWS LATAM podcast RSS feed (likely `anchor.fm/aws-latam` or similar — verify before adding). add a new entry to `src/lib/streams.ts` following the existing `aws_podcast` entry pattern. pick a spanish-language slot (after the last `type: "podcast"` entry in the Spanish section).

---

## d — podcast state

### d1. resume position not saved

**current:** `src/lib/player-persist.ts` only stores `stationKey`, `stationUrl`, `stationLabel`, `metaUrl`. no `currentTime`.  
**fix — three parts:**

1. **extend `PersistedPlayerState`** in `src/lib/player-persist.ts`:
   ```ts
   podcastCurrentTime?: number;
   podcastEpisodeUrl?: string;
   ```
   switch from `sessionStorage` to `localStorage` for podcast entries only (or for all — user intent is to resume across page loads, not just within session).

2. **save position** in `PersistentPlayerBar` — on `timeupdate` event (throttled to every 5s), call `savePlayerState({ ...currentState, podcastCurrentTime: audio.currentTime, podcastEpisodeUrl: rssAudioUrl })`. use `useRef` for the throttle so the handler doesn't cause re-renders.

3. **restore position** — after `audio.src` is set and `loadedmetadata` fires: `audio.currentTime = savedTime ?? 0`.

**important:** clear `podcastCurrentTime` when the user explicitly skips past that episode. do not restore if the saved `podcastEpisodeUrl` doesn't match the current episode URL.

---

## e — podcast player visual energy

### e1. player is visually muted (podcast mode)

**problem:** audio-reactive CSS vars (`--cdn-bass`, `--cdn-mid`, `--cdn-treble`) barely move on monotone podcast audio. the station-color splash and sparkle effects are designed for music.

**research-backed fixes (2026-05-03):**

1. **circular episode-art badge** — 40×40px round image anchored left inside the transparent zone. uses episode cover art or station brand color as fallback. acts as visual lock-point. see `src/components/persistent-player/index.tsx` — add `<img className="cdn-pp__episode-art" />` loaded from RSS `<itunes:image>` or `<image>`.

2. **time-ring progress** — circular progress ring around the episode-art badge showing playback position. css `conic-gradient` driven by `currentTime / duration`. updates on `timeupdate`. frequency: once every 250ms via `requestAnimationFrame` rate-limited update.

3. **tactile button feedback** — replace flat button press with:
   ```css
   .cdn-pp__btn:active {
       transform: scale(0.94);
       transition: transform 0.06s cubic-bezier(0.34, 1.56, 0.64, 1);
   }
   ```
   adds physical press feel with slight overshoot on release.

4. **waveform freeze-frame** — static colored bars (5-7 bars) using brand/station color, no audio reactivity needed. faint animation: slow breathing (2s ease-in-out infinite alternate) at low amplitude (5% height variation). this gives the feel of "something alive" without relying on audio analysis.

### e2. podcast player icon redesign

user spec: "next button, back/forward, play/pause are all very boring"  
**approach options:**
- play/pause: custom SVG triangle + double-bar — add brand fill color, subtle rounded corners on the bars
- seek ±15s: arced arrow with number inside (as seen in Overcast, Castro, Pocket Casts) — `src/components/` new SVG file
- next episode: use `>>|` but as SVG with station accent color stroke + subtle glow on hover

---

## f — donate label

**file:** `src/components/persistent-player/index.tsx:543-544`  
**current:** `{" · donate"}` — already lowercase. no change needed — it renders as `· donate`.  
**verify:** if the live page shows "DONATE" in uppercase, check CSS `text-transform: uppercase` in `src/components/persistent-player/styles.css`. search for `cdn-pp__label-donate` class.

---

## g — dune scene

### g1. too bouncy / photosensitive

**files:** `src/dune/white-sands-features.ts`, `src/dune/DuneMaterial.ts`

current values in `white-sands-features.ts`:
- `MIGRATION_SPEED_MULTIPLIER = 3.0`
- `SPARKLE_SPEED_PLAYING = 1.5` — borderline 3 Hz
- `RIPPLE_AMPLITUDE = 0.018`

**proposed reductions:**
```ts
export const MIGRATION_SPEED_MULTIPLIER = 1.5; // was 3.0 — halve horizontal drift
export const SPARKLE_SPEED_PLAYING = 1.0;      // was 1.5 — drop to ~2 Hz (safety margin)
export const MIGRATION_BASS_SWAY = 0.08;       // was whatever — reduce bass-linked sway
```

**dune philosophy post-change:** "lights, spotlights, fog do the visual work" — vertex displacement stays slow/ambient. dramatic effect comes from phase-color transitions (time-of-day palette), fog density, rim light, not fast vertex motion.

### g2. sun stays still until music/podcast playing

**file:** `src/dune/AnimationController.ts:96-99`  
**current:** time-of-day and sun wobble advance continuously even when idle.  
**proposed:** check whether `AudioAdapter.isPlaying()` or a passed-in `isPlaying` prop can gate `timeSeconds` increment. if idle, freeze `timeSeconds` (sun stays still, palette frozen). resume on play.  
**note:** this requires a new signal path — either pass `isPlaying` into `AnimationController.update()` or expose a `setPlaying(bool)` method.

---

## h — liora

### h1. console lights — spec

**current:** LED blink at `led-blink 2.4s linear infinite` — fires continuously.  
**user spec:** lights fire every 4th beat alternating between 4 lights; strobe fires only on station start/stop/skip.  
**file:** `src/components/liora-panel/styles.css:1315`, `src/components/liora-panel/index.tsx`  

**approach:**
- strobe (tap-3 tube-off): keep as-is but fix Hz (see critical section above). it already fires only on tap sequence, not continuously.
- LED beat: requires JS-side beat detection signal from `src/lib/background-viz/beat.ts`. pipe `beatCount` into liora panel via a CSS var `--cdn-beat-count` written on each beat detection. CSS `:has` or JS class toggle flips which of the 4 LEDs is "active" on beat 0, 4, 8, 12 (every 4th beat).

### h2. liora "powered by amazon sumerian" text

**location:** the text comes from the external `liora-embed.js` bundle (loaded from `VITE_LIORA_SCRIPT_URL`), not from source code in this repo. the text is rendered inside `.liora-panel-wrap` by the embed script.  
**fix options:**
- override via CSS `content` replacement (fragile — depends on pseudo-elements)
- modify the liora-embed source (if accessible)
- overlay with CSS to hide the element: `.liora-sumerian-credit { display: none; }` and use a new adjacent element for the new label
- confirm the exact element selector from the rendered DOM via devtools before deciding approach

### h3. liora name typography

**user spec:** bold/condensed/italic 70s retro — Cooper Black, Helvetica Condensed, ITC Serif Gothic, Kompakt  
**file:** `src/components/liora-panel/styles.css` — `.liora-title` or equivalent selector  
**approach:**
- load Cooper Black via `@font-face` or Google Fonts / Adobe Fonts CDN
- apply to `.liora-panel-wrap [class*="liora-title"]` or wherever the "LIORA" name renders
- test: all four named faces. pick two finalists, show screenshots, confirm with bryan

---

## i — name scroll

### i1. fade-off-into-distance character lost

**user spec:** "blend end credits / retro video game aesthetic." reference: Babylon.js playground DK9140#3 (https://playground.babylonjs.com/#DK9140#3)  
**current behavior:** character fade at end of name scroll may have been lost in a recent refactor.  
**file:** `src/components/liora-panel/styles.css:2367-2372`  
**approach:**
- the scroll should have characters enter full-opacity from left, drift right, and fade to 0 as they pass the right edge (not clip to invisible suddenly)
- use `mask-image: linear-gradient(to right, transparent 0%, black 8%, black 85%, transparent 100%)` on the scroll container to handle both the entry and exit fade
- "retro video game" feel: add a very slight color aberration (chromatic split) on exit — 1px CSS `text-shadow` in a secondary color offset

---

## j — audio visualization

### j1. too much treble / no bass / no ripples

**file:** `src/lib/background-viz/canvas.ts`, `src/dune/DuneMaterial.ts`  
**user spec:** "moon rocks to baseline/podcast" — on podcast the visualization should show a slow, rocky surface, not flickering treble.  
**approach:**
- in `src/lib/background-viz/audio.ts` or `canvas.ts`: for podcast mode, apply a low-pass filter or reduce the treble band weight before writing `--cdn-treble`
- in `src/dune/DuneMaterial.ts`: reduce the fragment's `treble` weight on the ripple + sparkle brightness multiplier — bass-driven shadows and slow ripples should dominate

---

## k — icons

### k1. dancer icon

**spec:** custom SVG silhouette of a dancer (feminine form, arms raised, flowing movement). used in the persistent player or liora panel to represent radio/music state.  
**file location:** `src/components/` — new file, e.g. `dancer-icon/index.tsx` wrapping an inline SVG  
**approach:** sketch a 24×24 or 32×32 viewBox silhouette. thin lines, no fill — brand violet stroke. provide both a static and an animating (swaying) variant using CSS `@keyframes`.

### k2. speaker icon

**spec:** custom microphone-over-headphones or abstract "podcast speaker" SVG. distinct from standard Material/Heroicons mic.

### k3. radio tower icon

**spec:**
- under dancer icon — a radio tower on flat ground
- dark mode variant: Franklin Mountains silhouette (jagged right-leaning ridge) with tower on the highest peak above the star on the flat spot of the mountain
- reference: Franklin Mountains "north franklin peak" (≈7,192 ft) visible from El Paso. tower silhouette should read as skinny mast + crossbars + blinking light at tip.

*note: Franklin Mountains tower research agent was dispatched 2026-05-03; findings pending. will supplement this section.*

### k4. headphones-over-microphone icon

**spec:** for podcast mode indicator. composite SVG: standard over-ear headphone shape, small mic icon below center.

---

## l — animated records

**user spec:** "rethink digital-age animated records for podcasts" — the "boom" animations on info/hamburger/stop buttons may be missing; restore them; the spinning record aesthetic needs a modern rethink.  
**approach:**
- confirm whether `.cdn-pp__boom` or equivalent class is still being applied on station events. check `src/components/persistent-player/index.tsx` for any `boom` class toggling.
- for podcasts: replace the vinyl record concept with an abstract "waveform disc" — a circle with concentric rings that pulse at low frequency (1 Hz) regardless of audio (cosmetic, not reactive). on play state, rings animate outward (like a wifi signal). on pause, rings freeze.

---

## appendix — ux research findings

### login page critique (2026-05-03)

see section a2 above for summary. three design alternatives: postcard, command console, desert entry.

### podcast + music player patterns (2026-05-03)

- **resume-position:** `HTMLMediaElement.currentTime` + `localStorage`. standard since 2015. implementation is in section d1 above.
- **long title:** marquee scroll (`animation: marquee 8s linear infinite`) preserves control real estate. or expand-on-tap. apply marquee only when `scrollWidth > clientWidth`.
- **tactile buttons:** `transform: scale(0.94)` on `:active` + overshoot easing `cubic-bezier(0.34, 1.56, 0.64, 1)`. 60ms duration.
- **visual interest without audio reactivity:** circular time-ring progress + waveform freeze-frame bars + state-transition animation on button press.
- **episode-art badge:** 40×40px circular image anchored in transparent-left zone. fallback to station brand color. acts as visual anchor.

### franklin mountains tower reference (2026-05-03)

factual grounding for the k3 icon:

- **north franklin mountain peak: 7,192 ft** — anchor point for the icon. city sits at 3,888 ft — the range rises ~3,300 ft above El Paso's street level. prominent from anywhere downtown.
- **ridge composition:** precambrian, billion-year-old sedimentary/igneous mix — weathered, fractured, jagged silhouette. not a smooth dome. icon should show irregular stepped/notched ridge profile, not rounded.
- **actual towers:** FCC antenna database (arcgis.com / fcc.gov ASR) confirms transmitter infrastructure on the mountains — specific call signs and coordinates not extracted. for accuracy before finalizing the icon, query `fcc.gov/oet/asr/rasrs` for El Paso county antenna registrations to find which broadcasters sit on the peak.
- **icon style reference:** Noun Project has 608 "radio tower + antenna" icon variations at thenounproject.com — good starting point for line/solid style reference.
- **suggested icon approach:**
  - viewBox 24×24 or 32×32
  - mountain silhouette: right-leaning jagged ridge, highest notch at upper-right (~⅔ right, ⅔ height). matches North Franklin's visual prominence when viewed from downtown El Paso looking west.
  - tower: skinny vertical mast at the peak, 3-4 horizontal crossbars, blinking light indicator dot at tip (can animate via CSS opacity pulse at 0.5 Hz — well under safety threshold)
  - "flat spot" on the franklin ridge near the star icon position: the plan is for the dark mode mountain/star placement — check `src/components/franklin-overlay/` path-builder for the existing ridge path geometry to ensure icon silhouette matches the site's existing franklin overlay.
