# design qa — v0.0.0050

honest pass against dev.clouddelnorte.org + auth.clouddelnorte.org. captured via playwright, 8 pages × 3 viewports × 2 modes = 48 shots in `/tmp/qa-v50/`. report-only — no code changes

date: 2026-05-02
reviewer: claude (subagent of bryan)

---

## section a — pass/fail matrix

legend: ok = renders + no obvious regression, awk = layout/contrast awkwardness, REG = visible regression vs. shipped intent, FOUC = first-render-blank under aggressive screenshot timing (perceptible under slow networks)

| page                    | desktop-light | desktop-dark | tablet-light | tablet-dark | mobile-light | mobile-dark |
|-------------------------|---------------|--------------|--------------|-------------|--------------|-------------|
| feed                    | ok            | ok           | ok           | ok          | awk REG      | awk REG     |
| home                    | ok            | ok           | ok           | ok          | awk REG      | awk REG     |
| roadmap                 | ok            | FOUC         | ok           | awk         | awk REG      | awk REG     |
| meetings                | awk           | awk          | awk          | awk         | awk          | awk         |
| learning/api            | awk REG       | awk          | awk REG      | awk         | awk          | awk         |
| maintenance-calendar    | REG           | REG          | REG          | REG         | REG          | REG         |
| theme                   | ok            | ok           | ok           | ok          | ok           | ok          |
| auth/login              | awk REG       | awk REG      | awk REG      | awk REG     | awk REG      | awk REG     |

footnotes
- roadmap-desktop-dark FOUC: under a 1.5s settle the page rendered as solid cream — body bg is `rgb(237,229,212)` and dark mode is painted by a fixed-position canvas/svg layer that hadn't yet drawn. with `networkidle` + 3s settle the page renders normally. flagging as a perceived-load issue, not a code defect — see p1 #4
- mobile feed/home/roadmap collapse the Cinzel breadcrumb and the AWS USER GROUP tagline — see p0 #2

---

## section b — p0 issues (broken / unprofessional)

### b1. royal blue links and ctas leaking through across light mode

multiple surfaces still ship `#0073e6`-family blue where brand violet / mode-appropriate accent should be:

- **maintenance-calendar — every "Export (.ics)" button** (every card) and the top "Export All (.ics)" pill render as bright royal blue in light mode. visible at all viewports. dark mode shifts to a lighter cyan/teal but it's still the same lineage
- **auth-login** — "Show password" / "Forgot password?" / "New here? Apply to join" all render as royal-blue link text in light mode
- **learning/api** — "Add Champion" CTA button in light mode reads as the same bright royal blue (visible on tablet + desktop)
- **roadmap "TODO" column header** — saturated cyan/blue that visually pairs with the royal-blue family rather than violet

impact: this is exactly the regression bryan called out — brand voice is violet + warm earth, royal blue is off-brand and visually dated

screenshots: `maintenance-calendar-{desktop,tablet,mobile}-light.png`, `auth-login-{desktop,tablet,mobile}-light.png`, `learning-api-{desktop,tablet}-light.png`, `roadmap-mobile-light.png`

### b2. mobile chrome strips the brand identifiers bryan wants kept

at 375px width on the dev subdomain (feed, home, roadmap, meetings, learning, maintenance-calendar):

- **AWS USER GROUP tagline** is not rendered — only the star logo remains. bryan asked specifically that the tagline stay visible at mobile
- **Cinzel "CLOUD DEL NORTE" breadcrumb h1** is not rendered — the visible brand text on mobile reduces to just the page-name pill. h1 collapses into the `▼ More` reveal
- **locale flag toggle** is collapsed under `▼ More` in light mode (in dark mode it stays visible) — inconsistent across modes on the same viewport
- **theme toggle** (sun/moon) stays visible in both modes ✓

impact: branding is the operator's strongest asset on mobile and we're hiding it. parity broken between light + dark mobile chrome (flag visible in dark, hidden in light)

note: auth-login at 375px DOES render AWS USER GROUP + flag + theme toggle correctly. so the "right" mobile chrome already exists on the auth subdomain — the dev pages have a different (worse) breakpoint behavior

screenshots: `feed-mobile-{light,dark}.png`, `home-mobile-{light,dark}.png`, `roadmap-mobile-{light,dark}.png`, `meetings-mobile-{light,dark}.png`, compare against `auth-login-mobile-{light,dark}.png`

### b3. meetings table is not responsive

the meetings table has 6 columns (Meetup Title, Presenters, Happened?, On Demand, Event Page, Join). at 1440px the columns are squeezed and "true / no / true" status text pinches against borders. at 768px and 375px only the first two columns are visible — the rest require horizontal scroll that isn't obviously there. mobile users effectively cannot see whether a past meetup has on-demand recordings or an event link

screenshots: `meetings-{desktop,tablet,mobile}-{light,dark}.png`

---

## section c — p1 issues (awkward but not broken)

### c1. auth-login: breadcrumb h1 + subtitle butt against each other on one line at desktop+tablet

`<h1>CLOUD DEL NORTE</h1>` and `<p>Sign in to Cloud Del Norte</p>` render side-by-side on desktop and tablet, with no separator and no whitespace — the subtitle italic immediately abuts the last `E` of NORTE. on mobile the line wraps, looks fine. needs explicit margin or a forced break above ~640px

screenshots: `auth-login-desktop-{light,dark}.png`, `auth-login-tablet-{light,dark}.png`

### c2. roadmap dark: column-header gradients differ across viewports

at desktop dark + tablet dark, the IDEA column header renders a saturated gold/yellow gradient. at mobile dark + light modes it reads as the expected red. probably an intentional gradient that's getting a different stop calculation at narrow widths, or an opacity layer issue. the inconsistency reads as a bug, not a feature

screenshots: `roadmap-desktop-dark.png`, `roadmap-tablet-dark.png` vs `roadmap-mobile-dark.png`, `roadmap-desktop-light.png`

### c3. meetings page is missing the volunteer pill

every other dev page renders `♥ VOLUNTEER` next to the page-name pill. meetings shows the page-name "meetings (25)" but the volunteer pill slot is taken by `Join` + `Create meeting` action pills instead. either intentional (action ctas displace the volunteer cta) or a layout omission. clarify intent

screenshots: `meetings-{desktop,tablet}-{light,dark}.png`

### c4. dark-mode FOUC perceptible during slow paints

`<html>` background is a constant cream (`rgb(237,229,212)`) regardless of `prefers-color-scheme`. dark mode is delivered via a fixed-position layer (likely the starfield canvas/svg) painted on top. result: under any slow paint or jank, dark-mode users see a flash of cream before the night sky lays down. roadmap-desktop-dark hit this in capture (1.5s settle wasn't enough). real users on bad wifi will see it

fix shape: set `<html>`/`<body>` bg via `@media (prefers-color-scheme: dark)` so the bg is dark before any js/canvas runs

evidence: `recheck.mjs` log captured `body bg: rgba(0,0,0,0)` and html bg `rgb(237,229,212)` even in dark mode

### c5. learning/api: very long single page with no in-page nav

the learning/api page is ~5650 chars of body text with multiple major sections (uniform interface, sample endpoints, world champion data, demo champion performance, api access + data structure, technical implementation, architecture stack, …). no jump links, no toc. functional but exhausting at desktop, brutal at mobile. consider a sticky in-page anchor strip

screenshots: `learning-api-desktop-light.png`, `learning-api-mobile-light.png`

### c6. home page: page-name pill says "About" but route is /home/

the breadcrumb chip on `/home/index.html` reads `About`. either the chip should match the slug ("home") or the route should match the chip (`/about/`). minor but breaks the contract that breadcrumb-chip = pathname

screenshots: `home-desktop-{light,dark}.png`

### c7. home pie chart legend wraps awkwardly at mobile

"Past Topics" pie has 4 categories. on mobile (375px) the legend dots + labels wrap into two cramped rows that overflow the chart card's right edge

screenshots: `home-mobile-{light,dark}.png`

---

## section d — p2 polish

### d1. feed page audio chip is small

the music-player pill is present top-right on feed dark/light at all viewports — it's roughly 60×24px. brand says music player visible; technically yes, but it reads as a status badge more than an interactive element. discoverability is low

### d2. theme page low-contrast labels in light mode

theme page section "glamorization & surface patterns" + the long-prose typography labels render as a tan-on-tan very low-contrast pairing in light mode. legible but failing wcag aa. screenshot: `theme-desktop-light.png` upper-mid section

### d3. tablet (768) tagline rotation on dark mode

at tablet dark, the AWS USER GROUP tagline rotates onto the vertical left nav rail rather than sitting next to the logo. at tablet light, it stays next to the logo. inconsistent cross-mode treatment at the same viewport

screenshots: `feed-tablet-{light,dark}.png`, `home-tablet-{light,dark}.png`

### d4. dunes scene not visible

bryan's brief asked "dunes (light) / starfield (dark) bleeding through left nav?" — light mode shows a warm cream background but no perceptible dune silhouette or scene illustration. dark mode does show stars (small bright points + nebula gradient at top of viewport). may be intentional cleanup, but flag if dunes were meant to ship

screenshots: any `*-desktop-light.png`

### d5. star logo lit / sun-moon animation

screenshots are static so animation can't be confirmed, but: star logo renders with a glow halo on dark + a flat gold on light — looks "lit" only on dark. sun/moon SVG renders crisply. confirm via interactive smoke test that the rotation/glow animation is actually firing

---

## section e — screenshot index

all captures saved as full-page png at `/tmp/qa-v50/`. naming: `{page-slug}-{viewport}-{mode}.png`

### feed
- `/tmp/qa-v50/feed-desktop-light.png`
- `/tmp/qa-v50/feed-desktop-dark.png`
- `/tmp/qa-v50/feed-tablet-light.png`
- `/tmp/qa-v50/feed-tablet-dark.png`
- `/tmp/qa-v50/feed-mobile-light.png`
- `/tmp/qa-v50/feed-mobile-dark.png`

### home
- `/tmp/qa-v50/home-desktop-light.png`
- `/tmp/qa-v50/home-desktop-dark.png`
- `/tmp/qa-v50/home-tablet-light.png`
- `/tmp/qa-v50/home-tablet-dark.png`
- `/tmp/qa-v50/home-mobile-light.png`
- `/tmp/qa-v50/home-mobile-dark.png`

### roadmap
- `/tmp/qa-v50/roadmap-desktop-light.png`
- `/tmp/qa-v50/roadmap-desktop-dark.png`  (re-captured with networkidle after FOUC)
- `/tmp/qa-v50/roadmap-tablet-light.png`
- `/tmp/qa-v50/roadmap-tablet-dark.png`
- `/tmp/qa-v50/roadmap-mobile-light.png`
- `/tmp/qa-v50/roadmap-mobile-dark.png`

### meetings
- `/tmp/qa-v50/meetings-desktop-light.png`
- `/tmp/qa-v50/meetings-desktop-dark.png`
- `/tmp/qa-v50/meetings-tablet-light.png`
- `/tmp/qa-v50/meetings-tablet-dark.png`
- `/tmp/qa-v50/meetings-mobile-light.png`
- `/tmp/qa-v50/meetings-mobile-dark.png`

### learning/api
- `/tmp/qa-v50/learning-api-desktop-light.png`
- `/tmp/qa-v50/learning-api-desktop-dark.png`
- `/tmp/qa-v50/learning-api-tablet-light.png`
- `/tmp/qa-v50/learning-api-tablet-dark.png`
- `/tmp/qa-v50/learning-api-mobile-light.png`
- `/tmp/qa-v50/learning-api-mobile-dark.png`

### maintenance-calendar
- `/tmp/qa-v50/maintenance-calendar-desktop-light.png`
- `/tmp/qa-v50/maintenance-calendar-desktop-dark.png`
- `/tmp/qa-v50/maintenance-calendar-tablet-light.png`
- `/tmp/qa-v50/maintenance-calendar-tablet-dark.png`
- `/tmp/qa-v50/maintenance-calendar-mobile-light.png`
- `/tmp/qa-v50/maintenance-calendar-mobile-dark.png`

### theme
- `/tmp/qa-v50/theme-desktop-light.png`
- `/tmp/qa-v50/theme-desktop-dark.png`
- `/tmp/qa-v50/theme-tablet-light.png`
- `/tmp/qa-v50/theme-tablet-dark.png`
- `/tmp/qa-v50/theme-mobile-light.png`
- `/tmp/qa-v50/theme-mobile-dark.png`

### auth/login (auth.clouddelnorte.org)
- `/tmp/qa-v50/auth-login-desktop-light.png`
- `/tmp/qa-v50/auth-login-desktop-dark.png`
- `/tmp/qa-v50/auth-login-tablet-light.png`
- `/tmp/qa-v50/auth-login-tablet-dark.png`
- `/tmp/qa-v50/auth-login-mobile-light.png`
- `/tmp/qa-v50/auth-login-mobile-dark.png`

### scripts (kept for reproduction)
- `/tmp/qa-v50/capture.mjs` — initial 48-shot run
- `/tmp/qa-v50/retry.mjs` — retried 6 transient `ERR_NETWORK_CHANGED` failures
- `/tmp/qa-v50/recheck.mjs` — single-page diagnostic for the FOUC investigation
- `/tmp/qa-v50/recheck2.mjs` — full re-capture pass with `networkidle` + 2.5s settle (this is the set the matrix above describes)
- `/tmp/qa-v50/results.json`, `/tmp/qa-v50/results2.json` — capture metadata

run from project root:
```
NODE_PATH=/home/bryanchasko/.nvm/versions/node/v24.14.0/lib/node_modules \
  node /tmp/qa-v50/capture.mjs
```
