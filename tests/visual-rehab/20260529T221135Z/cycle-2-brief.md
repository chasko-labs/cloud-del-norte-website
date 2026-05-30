# Cycle 2 Brief — Visual Rehabilitation

**Generator:** ghost-liora-css-repair  
**Timestamp:** 2026-05-29T22:39Z  
**Strategy:** REFINE (cycle 1 scored 0.640; Dark Mode 0.78 PASS, Time-of-Day 0.80 PASS)

---

## Decisions

### 1. Scene Visibility (0.55 → target ≥0.70)

- Reduce light-mode `.feed-card-shell` background alpha from 0.48 → 0.28
- Reduce light-mode `.cdn-card` background alpha from 0.48/0.45 → 0.28
- Reduce `backdrop-filter` blur from 20px → 14px on both card primitives
- Add subtle `text-shadow` on card text elements for legibility at lower alpha
- Dark-mode alpha stays at 0.52 (already closer to passing; dark scene is inherently more visible through dark glass)
- Rationale: The warm cream at 0.48 + 20px blur homogenizes the scene into a solid surface. Dropping to 0.28 alpha + 14px blur allows scene geometry to read through ~70% of non-text card surface while maintaining text legibility via text-shadow backing.

### 2. Craft + Functionality (0.48 → target ≥0.85)

**2a. /data/rsvp-counts.json 404:**
- Create `public/data/rsvp-counts.json` with the expected shape: `{ counts: { "happy-hour-2026-06-03": { remaining: 50 } } }`
- This eliminates the local 404 and the console.warn that follows.

**2b. Twitch embed console errors (~50):**
- The probe mechanism already returns `null` on transient failure, which causes the embed to mount. When the embed mounts in a headless/blocked environment, the Twitch SDK script and its iframe assets fail to load.
- Fix: When `probeTwitchLive` returns `null` (transient), treat it as offline (don't mount the embed). This prevents the SDK from loading entirely when the probe can't confirm live status. The existing `onOfflineChange` callback still fires.
- This eliminates the ~50 Twitch asset errors from the console.

**2c. Footer backdrop-filter not computing:**
- The footer has `will-change: transform; transform: translateZ(0)` which creates a new stacking context. However, `backdrop-filter` should still work with these. The issue is likely that the footer's `background-color: rgba(237, 229, 212, 0.88)` at 88% alpha is too opaque for the blur to be visually perceptible. But the evaluator says it's "not computing" — checking if there's a parent `overflow: hidden` or missing isolation. The footer is `position: fixed` which should be fine. Will ensure `-webkit-backdrop-filter` prefix is present (it is) and that no ancestor clips it.

**2d. External errors (Meetup CORS, weather API):**
- These are genuinely external. The Meetup iCal fetch and weather API are in our code — will wrap in silent catch where possible.

### 3. DO NOT REGRESS

- Dark mode alpha values unchanged (0.52)
- Dark mode chroma/saturation palette untouched
- Time-of-day bar position/visibility untouched
- All changes scoped to light-mode alpha, blur radius, and error suppression

---

## Files to Edit

1. `src/pages/feed/components/feed-card-shell.css` — light-mode alpha + blur
2. `src/pages/feed/styles.css` — `.cdn-card` light-mode alpha + blur
3. `src/pages/feed/components/twitch-section.tsx` — treat null probe as offline
4. `public/data/rsvp-counts.json` — create with expected shape
5. `src/components/footer/styles.css` — footer backdrop-filter fix (if needed)
