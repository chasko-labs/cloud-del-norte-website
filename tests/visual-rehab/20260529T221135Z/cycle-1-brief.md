# Cycle 1 Brief — PIVOT (Establish New Aesthetic)

**Generator:** ghost-liora-css-repair  
**Timestamp:** 2026-05-29T22:18Z  
**Strategy:** PIVOT — structural additions, not refinement

---

## Strategic Decisions

### 1. Scene Visibility (0.18 → 0.70+)

**Decision:** The site already has a full-viewport wallpaper system (`<CdnWallpaper />` renders BabylonJS dune scene in light mode, canvas stars in dark mode via `background-viz/index.ts`). The wallpaper is already fixed/full-viewport behind the page. The problem is that cards are fully opaque — they occlude the scene.

**Action:** Convert `.cdn-card` and `.feed-card-shell` surfaces from opaque backgrounds to glassmorphism: `backdrop-filter: blur(20px)` + semi-transparent `rgba()` backgrounds at 0.45–0.60 alpha. The 3D scene is already there — we just need to let it show through.

### 2. Dark Mode Discipline (0.62 → 0.70+)

**Decision:** Desaturate dark-mode `--fcs-rim` values that exceed chroma 60%. Key offenders: `#f59e0b` (amber), `#5eead4` (teal), `#a78bfa` (violet), `#86efac` (sage), `#fda4af` (rose). Replace with muted variants. Ensure no pure `#000000` backgrounds.

**Action:** Override dark-mode rim/accent variables in feed-card-shell.css to desaturated equivalents.

### 3. Time-of-Day Bar (0.00 → 0.70+)

**Decision:** Build a lightweight `TimeOfDayBar` component. Horizontal bar, sun/moon glyph positioned at `(hour/24) * 100%` horizontal offset. Gradient background shifts warm→cool. Mount above the feed content in app.tsx.

**Action:** New component file + CSS. Position-primary semantic. Minimal.

### 4. Craft + Functionality (0.58 → 0.85+)

**Decision:**
- **Weather card:** Already exists in footer (`<Weather />`). Mount a standalone instance in the feed page as a card.
- **Footer:** Already renders (fixed bottom bar with clock + countdown + weather + version). The critique says "not visible" — likely because the spacer wasn't enough or the footer was below fold. Verify spacer height.
- **Mobile radio player overlap:** The `.cdn-player-slot` needs `position: relative` + proper stacking so it doesn't overlap feed content on mobile.
- **Console errors:** Meetup iCal 404/CORS — out of CSS scope (network/external service). Note as unfixable via CSS.
- **Contrast:** Ensure secondary text meets 4.5:1.

---

## Files to Edit

1. `src/pages/feed/styles.css` — glassmorphism on `.cdn-card`, dark-mode desaturation
2. `src/pages/feed/components/feed-card-shell.css` — glass surfaces, desaturated dark rims
3. `src/pages/feed/app.tsx` — mount TimeOfDayBar + WeatherCard
4. NEW: `src/pages/feed/components/time-of-day-bar.tsx` + `.css`
5. NEW: `src/pages/feed/components/weather-card.tsx` + `.css`
6. `src/components/persistent-player/styles.css` — mobile overlap fix

## Out of Scope (Cannot Fix via CSS/Frontend)

- Meetup iCal 404/CORS console errors (external service, network layer)
