# Cycle 3 Brief — REFINE

**Generator:** ghost-liora-css-repair  
**Timestamp:** 2026-05-29T23:07Z  
**Strategy:** REFINE (close 0.03 gap on Craft criterion)

## Defects to Fix

### 1. Twitch SDK Race Condition
**File:** `src/pages/feed/components/twitch-section.tsx`  
**Root cause:** `probeLive` initializes as `null`; the component renders the embed while probe is pending (only gates on `probeLive === false`). The Twitch SDK loads and fires ~50 asset requests before the probe resolves and unmounts the embed.  
**Fix:** Gate embed render on `probeLive !== null`. When `probeLive === null`, show skeleton (probe pending). When `probeLive === false`, return null (offline). When `probeLive === true`, render embed.

### 2. Footer Backdrop-Filter Override
**File:** `src/layouts/shell/styles.css` (lines 1693–1697)  
**Root cause:** `@supports (backdrop-filter: blur(0)) { .cdn-footer { backdrop-filter: none; -webkit-backdrop-filter: none; } }` explicitly disables the footer's declared `blur(12px)`.  
**Fix:** Remove the `@supports` block. The footer component CSS declares `backdrop-filter: blur(12px) saturate(1.2)` with `background-color: rgba(237, 229, 212, 0.72)` (light) / `rgba(14, 18, 28, 0.75)` (dark). At 72–75% alpha + blur, WCAG AA contrast is maintained (text colors unchanged, background opacity provides sufficient contrast backing).

## Not Touched
- Card alpha/blur (Scene 0.72 PASS — no risk)
- Time-of-day bar (0.80 PASS)
- Dark mode accent vars (0.78 PASS)
- Meetup CORS (external/backend, out of scope)
