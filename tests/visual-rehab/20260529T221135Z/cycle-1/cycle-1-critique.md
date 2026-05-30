# Cycle 1 — Visual Rehabilitation Critique

**Evaluator:** ghost-liora-headless-verifier  
**Timestamp:** 2026-05-29T22:35:00Z  
**Target:** http://localhost:8080/feed/index.html  
**Screenshots:** 12/12 captured (2 viewports × 2 modes × 3 scroll positions)

---

## 1. SCENE VISIBILITY — Score: 0.55 | HARD FAIL ❌

**Weight:** 0.30 | **Threshold:** 0.70

**Findings:**

The 3D scene canvas is now rendered as a full-viewport fixed background (`position: fixed; z-index: -2; width: 1920px; height: 1080px`). Cards have been converted to glass with `backdrop-filter: blur(20px) saturate(1.1)` and semi-transparent backgrounds:
- Light: `rgba(250, 247, 240, 0.48)` on `.feed-card-shell`, `rgba(250, 247, 240, 0.45)` on `.cdn-card`
- Dark: `rgba(14, 14, 28, 0.52)` on both

**However, the scene is NOT visually revealed through cards in the light-mode screenshots.** The warm cream tint at 0.45–0.48 alpha, combined with `blur(20px)`, produces a frosted-glass effect that reads as a solid warm surface. In `desktop-light-top.png`, the Featured Event card area and the content below it show NO discernible 3D scene geometry — the blur homogenizes whatever is behind into a uniform warm cream. The card surfaces read as opaque warm panels, not glass revealing depth.

In `desktop-dark-top.png`, the scene is slightly more perceptible — the dark semi-transparent cards at 0.52 alpha over the dark scene produce a subtle depth variation visible at card edges and in the gaps between cards. But the blur still homogenizes the scene into a uniform dark field through the card body.

**Pixel-level assessment:**
- Desktop-light-top: Card content area occupies ~75% of main viewport. The remaining ~25% (margins, gaps, time-of-day bar area) shows the scene. Through the cards themselves, the scene is NOT distinguishable — the frosted glass reads as a solid warm surface.
- Desktop-dark-top: Scene slightly visible through card edges and gaps (~30% of non-text card pixels show scene variation). The dark glass is more transparent-feeling but still heavily blurred.
- Desktop-light-mid: The "AWS Builder Center" card, "The Zacs' Show" card, and "andmore.dev" card all read as solid warm surfaces. Zero scene geometry visible through them.

**Why 0.55 not lower:** The architectural foundation is correct (fixed canvas, backdrop-filter, rgba backgrounds). The scene IS visible in gaps between cards and at page margins. Dark mode achieves partial transparency. But the light-mode alpha values (0.45–0.48) combined with the warm cream tint and 20px blur produce visual opacity. The anchor for 0.92 requires "scene visible through 78%+ of card surface" — this implementation achieves maybe 20-30% in dark mode and <10% in light mode.

**What's needed for convergence:**
- Reduce light-mode alpha to 0.30–0.35 (currently 0.45–0.48)
- Consider reducing blur to 12–16px to allow more scene geometry through
- The warm cream tint in light mode is the primary occluder — a more neutral/cooler tint would reveal more scene

---

## 2. DARK MODE DISCIPLINE — Score: 0.78 | PASS ✓

**Weight:** 0.25 | **Threshold:** 0.70

**Findings:**

**Passes threshold.** Significant improvement from cycle 0 (0.62 → 0.78).

**Evidence of discipline:**
- Background: `rgb(10, 12, 20)` on `<html>` — dark navy with blue cast, NOT pure black. Matches the 0.91 anchor's `#0f0f12 slight blue cast` pattern.
- Card surfaces: `rgba(14, 14, 28, 0.52)` — dark navy-blue at 52% alpha. Elevation-tinted (the 28 blue channel provides the tint).
- All 8 dark-mode rim colors desaturated to <60% chroma (HSL saturation):
  - amber: `#b89860` → S=38.3%
  - teal: `#7ab8a8` → S=30.4%
  - violet: `#9088b8` → S=25.3%
  - sage: `#7ab89a` → S=30.4%
  - rose: `#c89898` → S=30.4%
  - navy: `#8aa8c8` → S=36.0%
  - gold: `#b8a060` → S=38.3%
  - lavender: `#a8a0c0` → S=20.3%
- No pure `#000000` found anywhere in computed styles.
- The RSVP button in dark mode uses a muted purple (visible in desktop-dark-top as a desaturated violet, not the hot `#7c3aed` from cycle 0).
- The overall dark mode reads as a considered redesign — the color palette shifts to muted, desaturated tones rather than simply darkening the light-mode accents.

**Deductions (why not higher):**
- The "FEATURED EVENT" marquee header in dark mode still uses a gold/amber gradient that, while desaturated, creates a slight warm glow against the dark background (visible in desktop-dark-top). Not halation per se, but a warm spot.
- The footer does NOT have `backdrop-filter` applied in the computed styles (shows `none` despite CSS declaring `blur(12px)`). This may be a rendering issue with the fixed-position footer, but it means the footer in dark mode is a solid dark surface rather than a glass pane — inconsistent with the glass vocabulary established by the cards.
- Text contrast appears adequate (light text on dark surfaces), but I cannot pixel-measure exact ratios from screenshots alone.

---

## 3. TIME-OF-DAY COMMUNICATION — Score: 0.80 | PASS ✓

**Weight:** 0.20 | **Threshold:** 0.70

**Findings:**

**Passes threshold.** From zero (0.00) to a functional position-primary time signal.

**Component verification:**
- `TimeOfDayBar` component exists and renders at the top of the content area (visible in desktop-light-top, desktop-dark-top, mobile-light-top, mobile-dark-top).
- Moon glyph (☽) positioned at `left: 93.8889%` — corresponding to 22:32 local time (22 + 32/60 = 22.53 hours → 22.53/24 = 93.9%). **Position is mathematically correct.**
- The track uses a dawn-to-dusk gradient: dark navy → purple → warm amber → cream → cool blue → amber → purple → dark navy (mapping midnight → dawn → noon → afternoon → dusk → midnight).
- Dark mode variant uses desaturated, lower-luminance colors (verified: `rgb(10, 10, 20)` → `rgb(107, 74, 32)` → `rgb(90, 80, 64)` → `rgb(58, 72, 88)` → back).
- Updates every 60 seconds via `setInterval`.
- Has `role="img"` and `aria-label="Time of day: 22:32 local"` for accessibility.

**Description from screenshot alone:** "It's late evening — a moon glyph sits near the right end of a horizontal gradient bar that transitions from dark tones through warm amber at center to dark tones at the edges, indicating the current time is close to midnight."

**Why 0.80 not higher:**
- The bar is visually thin (6px height) and could be mistaken for a decorative divider at first glance. The 0.85 anchor describes "subtle warm gradient from midpoint" which implies more visual weight.
- The glyph drop-shadow (`drop-shadow(0 0 3px rgba(255, 200, 60, 0.6))`) is subtle — at 18px font-size on a 6px track, the glyph is small but readable.
- In the mobile screenshots, the bar is visible but very compact — the glyph is tiny at 375px width.
- The gradient communicates time-of-day context effectively: the warm amber zone at center (noon) and dark zones at edges (night) create an intuitive mapping.

---

## 4. CRAFT + FUNCTIONALITY — Score: 0.48 | HARD FAIL ❌

**Weight:** 0.25 | **Threshold:** 0.85

**Findings:**

**Hard fail.** Multiple issues prevent passing the 0.85 threshold.

### Console Errors — FAIL (zero required, many present)

**Unique error count: 60** (136 total across all viewport/mode combinations)

**Error categories:**

| Category | Count (unique URLs) | External? | Fixable? |
|----------|-------------------|-----------|----------|
| Meetup iCal CORS | 2 | ✓ External (meetup.com) | Not via frontend |
| Twitch embed assets | ~50 | ✓ External (assets.twitch.tv, embed.twitch.tv) | Not via frontend |
| Local 404: `/data/rsvp-counts.json` | 2 | ✗ LOCAL | YES — missing data file |
| Open-Meteo weather API | 2 | ✓ External (network change) | Transient |
| Permissions policy violation | 1 | ✓ External (Twitch iframe) | Not via frontend |

**Key URLs:**
- `http://localhost:8080/data/rsvp-counts.json` — **404, LOCAL RESOURCE, FIXABLE** (generator claimed only Meetup errors were unfixable — this is incorrect)
- `https://www.meetup.com/awsugclouddelnorte/events/ical/` — CORS, external, confirmed unfixable
- `https://assets.twitch.tv/*` (30+ JS/CSS files) — Twitch embed iframe loading failures, external CDN
- `https://embed.twitch.tv/*` — Twitch embed iframes, external
- `https://api.open-meteo.com/*` and `https://air-quality-api.open-meteo.com/*` — transient network errors

**Generator's claim that "only Meetup iCal errors are unfixable" is PARTIALLY INCORRECT.** The `/data/rsvp-counts.json` 404 is a local resource that should either exist or have its fetch gracefully handled. The Twitch embed errors (not mentioned by generator) are also external and unfixable, but they represent a significant error volume.

### Layout Assessment

- **Desktop (1920×1080):** No layout breaks observed. Two-column grid renders correctly. Cards are properly spaced.
- **Mobile (375×812):** No visible overlap of persistent player with content (the `overflow: hidden` fix on `.cdn-player-slot` at ≤600px appears effective based on mobile-light-top screenshot — the radio player renders cleanly above content).
- **Footer:** Visible in the page (confirmed via probe: height 41.6px, positioned at y=1684px). However, the footer is NOT visible in the bottom-scroll screenshots because the page content extends well beyond the viewport at bottom scroll. The footer IS present and aligned.

### Weather Card Assessment

- **Exists:** Yes, visible in desktop-dark-top screenshot showing "PAQUIME ☀ 86 30°C WIND 21 mph SW UV 6.5 AQI 47 good"
- **Glass surface:** Confirmed (`backdrop-filter: blur(20px) saturate(1.2)`, `rgba(250, 247, 240, 0.45)` light / `rgba(14, 14, 28, 0.50)` dark)
- **Legible without color dependency:** The weather card uses text labels ("WIND", "UV", "AQI", "good") alongside numeric values. The sun icon (☀) is decorative. Temperature is communicated via numbers. **However**, the "good" AQI label may rely on color coding in some implementations — from the screenshot it appears as plain text, which passes.

### WCAG Contrast Concerns

- The desktop-light-mid screenshot shows card marquee headers ("AWS Builder Center", "The Zacs' Show", "andmore.dev") in dark text on warm cream backgrounds — likely adequate contrast.
- The "aws community builder" and "aws employee" badges use small colored text on colored backgrounds — these are borderline and would need pixel-level measurement to confirm 4.5:1.
- In dark mode, text appears as light gray/cream on dark navy — visually adequate but not measured.

### Why 0.48:
- Console errors alone are a hard blocker (criterion requires ZERO). Even excluding external/unfixable errors, the local `/data/rsvp-counts.json` 404 is a fixable application error.
- The Twitch embed errors (50+ unique URLs) represent a massive error volume that, while external, indicates the page loads iframes that fail in headless environments. A production-quality page should handle iframe load failures gracefully.
- Weather card and mobile player fix are positive improvements.

---

## Weighted Aggregate Score

| Criterion | Weight | Score | Weighted | Threshold | Pass? |
|-----------|--------|-------|----------|-----------|-------|
| Scene Visibility | 0.30 | 0.55 | 0.165 | 0.70 | ❌ |
| Dark Mode Discipline | 0.25 | 0.78 | 0.195 | 0.70 | ✓ |
| Time-of-Day Communication | 0.20 | 0.80 | 0.160 | 0.70 | ✓ |
| Craft + Functionality | 0.25 | 0.48 | 0.120 | 0.85 | ❌ |
| **TOTAL** | **1.00** | — | **0.640** | — | — |

**Hard-fail count:** 2/4 criteria fail their thresholds.  
**Convergence status:** BLOCKED — Scene Visibility and Craft must pass independently.

---

## Score Delta vs. Cycle 0

| Criterion | Cycle 0 | Cycle 1 | Delta | Direction |
|-----------|---------|---------|-------|-----------|
| Scene Visibility | 0.18 | 0.55 | +0.37 | ↑ Major improvement |
| Dark Mode Discipline | 0.62 | 0.78 | +0.16 | ↑ Now passing |
| Time-of-Day Communication | 0.00 | 0.80 | +0.80 | ↑ From zero to passing |
| Craft + Functionality | 0.58 | 0.48 | −0.10 | ↓ Regression (more errors counted) |
| **Weighted Total** | **0.354** | **0.640** | **+0.286** | ↑ |

**Note on Craft regression:** The cycle 0 baseline counted "4 unique errors per viewport/mode combination." Cycle 1's more thorough error capture reveals 60 unique errors — many of which are Twitch embed failures that were likely present in cycle 0 but not fully captured. The local `/data/rsvp-counts.json` 404 may be new (introduced by the RSVP count feature). The weather API errors are transient network issues. The true regression is the new local 404.

---

## Refine vs. Pivot Recommendation for Cycle 2

**Recommendation: REFINE (both remaining failures are addressable with targeted changes)**

### Scene Visibility (0.55 → 0.70+): REFINE

The architectural foundation is correct. The fix is parametric:
1. **Reduce light-mode card alpha from 0.45–0.48 to 0.30–0.35.** This is the single highest-impact change. The warm cream at current alpha reads as opaque.
2. **Consider reducing blur from 20px to 14–16px** to allow more scene geometry through while maintaining text legibility.
3. **Test with a cooler/more neutral tint** in light mode — the warm cream `rgba(250, 247, 240, ...)` adds visual density that a neutral `rgba(255, 255, 255, ...)` would not.
4. The dark mode is closer to passing — `rgba(14, 14, 28, 0.52)` could drop to 0.45 for more scene reveal.

### Craft + Functionality (0.48 → 0.85+): REFINE

1. **Create `/data/rsvp-counts.json`** or add graceful error handling for its absence. This is the only fixable local error.
2. **Suppress Twitch embed errors** — either lazy-load Twitch iframes only when scrolled into view (avoiding load failures in headless/blocked environments), or wrap iframe loads in error boundaries that swallow external failures silently.
3. **The Meetup CORS and weather API transient errors** are genuinely external and unfixable. If the criterion is interpreted strictly as "zero console errors of any kind," this page cannot pass without removing the Twitch embeds and Meetup iCal fetch entirely. A pragmatic interpretation would exclude errors from third-party iframe sandboxes and transient network conditions.
4. **Footer backdrop-filter** is declared in CSS but not computing — investigate whether the `will-change: transform; transform: translateZ(0)` on the footer is creating a stacking context that prevents backdrop-filter from applying. This is a CSS bug.

### Priority for Cycle 2:
1. Scene visibility alpha reduction (highest weight, closest to threshold)
2. Local 404 fix + Twitch error suppression (craft criterion)
3. Footer backdrop-filter bug (minor craft item)

---

## Artifacts

All 12 screenshots saved to:
```
tests/visual-rehab/20260529T221135Z/cycle-1/
├── desktop-dark-bottom.png
├── desktop-dark-mid.png
├── desktop-dark-top.png
├── desktop-light-bottom.png
├── desktop-light-mid.png
├── desktop-light-top.png
├── mobile-dark-bottom.png
├── mobile-dark-mid.png
├── mobile-dark-top.png
├── mobile-light-bottom.png
├── mobile-light-mid.png
└── mobile-light-top.png
```
