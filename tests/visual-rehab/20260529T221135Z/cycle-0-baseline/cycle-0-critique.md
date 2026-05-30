# Cycle 0 Baseline — Visual Rehabilitation Critique

**Evaluator:** ghost-liora-headless-verifier  
**Timestamp:** 2026-05-29T22:12:42Z  
**Target:** http://localhost:8080/feed/index.html  
**Screenshots:** 12/12 captured (2 viewports × 2 modes × 3 scroll positions)

---

## 1. SCENE VISIBILITY — Score: 0.18 | HARD FAIL ❌

**Weight:** 0.30 | **Threshold:** 0.70

**Findings:**

Cards use fully opaque palette-gradient backgrounds. The `.feed-card-shell` CSS defines solid color stops:
- Light: `--fcs-bg-from: #faf7f0` → `--fcs-bg-to: #f5edd8` (amber), `#f0fdf9` → `#e0f7f1` (teal), etc.
- Dark: `--fcs-bg-from: #2a1a08` → `--fcs-bg-to: #1a0f04` (amber), `#042f2e` → `#021a1a` (teal), etc.

Zero `backdrop-filter` anywhere in the feed card CSS. No `blur()`, no alpha-channel backgrounds on card surfaces. The 3D scene (Babylon.js dune scene) is only visible in the left sidebar panel (the "fiona" terminal widget) and potentially behind the page body — but the card grid completely occludes it at every scroll position.

**Pixel-level assessment:** In the desktop-light-top screenshot, the card content area occupies ~85% of the main content viewport. The remaining ~15% is the narrow gap between cards and the page margins — but even the page body background appears to be a solid warm cream (`#faf7f0`-adjacent), not a transparent layer over a 3D scene. The 3D scene is confined to the sidebar fiona widget only.

**What's missing for convergence:**
- `backdrop-filter: blur(20px)` on card surfaces
- Semi-transparent `rgba()` backgrounds replacing solid hex colors
- The 3D scene must be rendered as a full-viewport background layer behind the feed grid
- Cards must become glass panes, not opaque obstacles

---

## 2. DARK MODE DISCIPLINE — Score: 0.62 | HARD FAIL ❌

**Weight:** 0.25 | **Threshold:** 0.70

**Findings:**

The dark mode implementation shows partial discipline but fails on key criteria:

**Positives (why not lower):**
- Background is NOT pure `#000000` — uses dark navy/charcoal tones (`#0f172a`, `#042f2e`, `#1e1b4b` per palette)
- Surfaces show elevation-tinted luminance (palette-specific dark tones like `#2a1a08` amber, `#042f2e` teal)
- Text contrast appears adequate (light text on dark surfaces)
- The overall dark mode reads as a considered design, not a simple inversion

**Failures (why below threshold):**
- Accent colors retain HIGH saturation in dark mode: `--fcs-rim: #f59e0b` (amber, chroma ~85%), `--fcs-rim: #5eead4` (teal, chroma ~70%), `--fcs-rim: #a78bfa` (violet, chroma ~65%). Multiple palettes exceed the chroma <60% requirement.
- The "FEATURED EVENT" marquee header in dark mode uses a saturated gold/amber gradient that creates visible halation against the dark background
- The purple RSVP button (`#7c3aed`-range) at full saturation in dark mode creates a hot spot
- The radio player station name "KSFR 101.1 DONATE" uses saturated red/pink text in dark mode
- Dark mode reads as a "palette-aware recolor" rather than a "discipline-aware redesign" — the same saturated accent hues are used, just on darker backgrounds

**What's missing for convergence:**
- Desaturate all accent colors to chroma <60% in dark mode (e.g., `#f59e0b` → `#b8860b` or similar muted amber)
- Reduce rim border saturation in dark mode
- Ensure no halation around bright elements on dark backgrounds

---

## 3. TIME-OF-DAY COMMUNICATION — Score: 0.00 | HARD FAIL ❌

**Weight:** 0.20 | **Threshold:** 0.70

**Findings:**

**No time-of-day bar exists in the current feed page.** There is no horizontal position-anchored element communicating time. There is no sun/moon glyph. There is no gradient bar encoding temporal position.

The radio player in the header shows station metadata (station name, location) but this is NOT a time-of-day signal — it communicates "what station is selected," not "what time it is."

**Description from screenshot alone:** "There is no time-of-day bar. The page communicates no temporal position signal."

**What's missing for convergence:**
- A dedicated time-of-day bar component (likely horizontal, full-width or near-full-width)
- A position-anchored glyph (sun/moon) whose horizontal position maps to current time
- A gradient that shifts warm→cool or dawn→dusk based on time
- Mode-awareness: desaturated/reduced-luminance variant for dark mode
- The bar must be visible at the top scroll position at minimum

---

## 4. CRAFT + FUNCTIONALITY — Score: 0.58 | HARD FAIL ❌

**Weight:** 0.25 | **Threshold:** 0.85

**Findings:**

**Positives:**
- Layout does not break at either viewport (1920×1080 desktop, 375×812 mobile)
- Two-column grid at desktop collapses to single-column at mobile correctly
- Card spacing is consistent
- Text is legible in both modes
- Navigation sidebar collapses to hamburger on mobile
- The feed page loads and renders content (events, YouTube embeds, blog posts, carousels)

**Failures:**
- **Console errors present:** 404s on two resources + CORS error on Meetup iCal fetch. While these are network/external-service errors (not application crashes), they represent incomplete error handling. Count: 4 unique errors per viewport/mode combination.
- **No weather card exists** — criterion explicitly requires "weather card legible without color dependency." The weather card component is absent from the feed page entirely.
- **Footer not visible** in any bottom-scroll screenshot — the page appears to scroll to content cards at the bottom without a visible footer element. Footer alignment + spacing cannot be assessed as passing.
- **WCAG contrast concerns:** The light-mode "ARROWHEAD CENTER" badge uses small white text on a medium-green background — likely borderline 4.5:1. The carousel counter text ("1 / 2", "1 / 7") uses `var(--cdn-color-text-secondary)` which in light mode appears as a medium gray that may not meet 4.5:1 on the warm cream background.
- **Mobile light-mode bottom scroll** shows the persistent radio player overlapping content text ("Latest newsletter — Agent development has changed... again.") — the player bar occludes readable content.

**What's missing for convergence:**
- Weather card component (does not exist yet)
- Zero console errors (fix 404s, handle CORS gracefully)
- Verify all text meets WCAG AA 4.5:1 (normal) / 3:1 (large)
- Footer must be present and consistently aligned
- Fix mobile player overlap with content

---

## Weighted Aggregate Score

| Criterion | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| Scene Visibility | 0.30 | 0.18 | 0.054 |
| Dark Mode Discipline | 0.25 | 0.62 | 0.155 |
| Time-of-Day Communication | 0.20 | 0.00 | 0.000 |
| Craft + Functionality | 0.25 | 0.58 | 0.145 |
| **TOTAL** | **1.00** | — | **0.354** |

**Hard-fail count:** 4/4 criteria fail their thresholds.  
**Convergence status:** BLOCKED — all four criteria must pass independently.

---

## Refine vs. Pivot Recommendation for Cycle 1

**Recommendation: PIVOT (structural additions required, not refinement)**

The baseline reveals that the feed page is a well-built, functional content aggregator with strong editorial design (palette system, marquee headers, carousel interactions) — but it was never designed for the glassmorphism/atmospheric goals of this rehabilitation. The gap is structural, not cosmetic:

1. **Scene Visibility (0.18 → 0.70+):** Requires architectural change. The 3D scene must become a full-viewport background layer (position: fixed canvas behind the feed grid). All card surfaces must switch from opaque palette gradients to semi-transparent `rgba()` + `backdrop-filter: blur()`. This is a fundamental CSS architecture change to the `.feed-card-shell` system.

2. **Time-of-Day (0.00 → 0.70+):** Requires a NEW COMPONENT. Nothing exists to refine. Build a `TimeOfDayBar` component with position-anchored sun/moon glyph, time-mapped gradient, and dark-mode variant.

3. **Dark Mode Discipline (0.62 → 0.70+):** Closest to threshold. Refine by desaturating `--fcs-rim` values in `.awsui-dark-mode` selectors to chroma <60%. This is achievable with CSS variable changes only.

4. **Craft (0.58 → 0.85+):** Requires weather card component (NEW), console error fixes, footer verification, and contrast audit. Mixed new-build + refinement.

**Priority order for cycle 1:**
1. Scene visibility (highest weight, largest gap, enables glassmorphism foundation)
2. Time-of-day bar (zero → something, new component)
3. Dark mode desaturation (closest to passing, CSS-only)
4. Craft items (weather card, error handling, contrast)

---

## Artifacts

All 12 screenshots saved to:
```
tests/visual-rehab/20260529T221135Z/cycle-0-baseline/
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
