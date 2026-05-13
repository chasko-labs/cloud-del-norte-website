# UI Parity Report: Logged-In vs Logged-Out — 2026-05-13

## Comparison Sets

- **Logged-OUT** (baseline): `awsug-logged-OUT-*-20260513T0103Z.png`
- **Logged-IN** (regression): `awsug-logged-in-*-20260512T2326Z.png`
- Viewports: 1440px desktop, 375px mobile
- Scroll positions: y=0, y=400, y=800, y=1200, y=2000, ybottom, full-page

## Findings

### Gap 1: Footer background not rendering (CRITICAL)

| Aspect | Logged-OUT | Logged-IN |
|--------|-----------|-----------|
| Footer background | Dark mahogany gradient (clearly visible) | Transparent/missing — cream page bg shows through |
| Footer text | Light cream text on dark bg — fully readable | Light cream text on cream bg — nearly invisible |
| Version number | `0.0.0141` visible bottom-right | Not visible (same color as background) |
| "Go Build" emphasis | Amber gradient text on dark bg — readable | Invisible against cream |
| "Global AWS User Group Community" link | Purple on dark bg | Purple on cream — only visible element |

**Root cause**: The footer's `.cdn-footer` element has `isolation: isolate` but no explicit stacking context (`position: relative; z-index`). The AppLayout's `main[class*="awsui_layout"]` has a cream background with `background-attachment: fixed` that visually extends across the viewport. Without an explicit stacking position, the footer's background can be obscured by the page's painting order.

**Fix**: Add `position: relative; z-index: 1` to `.cdn-footer` in `src/layouts/shell/styles.css`.

### Gap 2: Massive empty space below footer (CRITICAL)

| Aspect | Logged-OUT | Logged-IN |
|--------|-----------|-----------|
| Page ends at | Footer bottom edge (flush) | ~400-600px of cream space below footer |
| Scrollbar | Minimal — content fills viewport | Extended — page much taller than content |
| y=1200 shot | Shows footer at bottom | Identical to y=0 (page not scrolling) |

**Root cause**: Cloudscape's AppLayout sets inline `min-block-size: calc(100vh - headerHeight)` on the `<main>` element and `block-size: calc(100vh - headerHeight)` on child containers. The existing override (`min-block-size: auto !important`) only addressed `min-block-size` but not `block-size` on the main element. Additionally, `[class*="awsui_drawers-container"] { min-block-size: 100% !important }` forced the grid to expand to viewport height even on short-content pages.

**Fix**:
1. Add `block-size: auto !important` to `main[class*="awsui_layout"]`
2. Replace `min-block-size: 100%` on drawers-container with `align-self: stretch; min-block-size: 0 !important`

### Gap 3: Content layout differences (EXPECTED — not a regression)

The logged-out state shows the auth login page (different site: `auth.clouddelnorte.org`). The logged-in state shows the AWSUG member home. These are intentionally different layouts:
- Logged-out: Centered login form, no side navigation, no tools panel
- Logged-in: Full AppLayout with nav drawer, tools panel, content cards

These differences are by design and not style regressions.

## Files Modified

1. `src/layouts/shell/styles.css` — Footer z-index fix + AppLayout height overrides
2. `src/components/footer/index.tsx` — Version bump 0.0.0141 → 0.0.0142

## Verification

- `npm run biome:ci` — must pass
- `npm run build` — must pass (includes AWSUG build)
- Post-deploy re-capture needed for Bryan's visual verification
