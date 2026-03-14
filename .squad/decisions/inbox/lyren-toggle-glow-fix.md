# Decision: Fix TopNav toggle button box-shadow leak

**Date:** 2025-07-19
**Agent:** Lyren
**Scope:** `src/layouts/shell/styles.css`

## Context

The `[class*="top-navigation"]` selector on TASK 6 container styling rules also matched inner `<a>` elements (class `awsui_variant-top-navigation_*`), leaking `box-shadow` and `border-bottom` onto emoji toggle icons as square boxes.

## Decision

1. Added a blanket override stripping leaked styles from all `<a>` elements inside `#top-nav [class*="top-navigation"]`.
2. Re-applied a subtle circular glow (`border-radius: 50%`) specifically to utility-wrapper toggle anchors, scoped per theme mode.

## Rationale

- Surgical: only affects the elements that were broken; container shadow retained.
- Mode-aware: amber glow in light mode, violet glow in dark mode — matches existing palette.
- Hover animations preserved (scale + brightness on `:hover`).

## Risk

Low. Only CSS changes. All 146 tests pass, lint clean, build succeeds.
