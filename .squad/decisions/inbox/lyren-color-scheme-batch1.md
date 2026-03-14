# DEC-XXX: Color Scheme Batch 1 — System Preference + Token Consolidation

**Date:** 2026-03-14  
**Author:** Lyren (Cloudscape UI & Design Specialist)  
**Status:** 🟡 Proposed  
**Related Issues:** #60, #64, #65  
**PR:** #70

## Decision

Implemented first batch of color scheme improvements: system preference detection, global font smoothing, and gradient token consolidation.

## Context

The project had three open issues as part of the color scheme improvement roadmap:
1. **#60**: No system preference detection — users always saw light mode on first visit regardless of OS theme
2. **#64**: Font smoothing only scoped to shell — should be global for consistent text rendering
3. **#65**: Hardcoded hex colors in shell/footer gradients — hard to maintain, violates DRY principle

## Implementation

### System Preference Detection (#60)

Added `getSystemPreference()` to check `window.matchMedia('(prefers-color-scheme: dark)')` and updated `getStoredTheme()` to use it as a fallback when no localStorage value exists.

**Critical behavior:** The `watchSystemPreference()` function listens to OS theme changes but ONLY auto-switches when `localStorage.getItem(THEME_KEY) === null`. Once a user manually toggles (which calls `setStoredTheme()`), their choice takes priority forever after. This respects user agency — manual choices override system defaults.

Added `<meta name="color-scheme" content="light dark">` to all 5 page index.html files for native browser theme support (scrollbars, form inputs).

### Global Font Smoothing (#64)

Added `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale` to `:root` in `tokens.css`. This was already scoped to `#top-nav` in shell styles — extending it globally improves text rendering across the entire site for both light (warm sepia) and dark (cosmic navy) modes.

### Gradient Token Consolidation (#65)

Created gradient tokens `--cdn-gradient-nav-start`, `--cdn-gradient-nav-mid`, `--cdn-gradient-nav-end` in `tokens.css` with separate values for light (warm mahogany) and dark (cosmic navy) modes. Replaced all hardcoded hex values in:
- `shell/styles.css` TopNavigation gradients
- `footer/styles.css` background gradient

This makes the navigation/footer color palette maintainable from one place and ensures consistency across components.

## Rationale

**System preference first visit:** Industry standard — users expect websites to respect their OS theme on first visit. After that, explicit user choices (manual toggle) take priority.

**Global font smoothing:** Text should render consistently across the entire page, not just within the shell. Antialiased works well for both modes.

**Token consolidation:** DRY principle — don't repeat hex values across files. Tokens provide a single source of truth and make palette changes trivial (e.g., adjusting the navy→purple gradient in dark mode).

## Alternatives Considered

**System preference listener:** Could have made it always follow system changes regardless of localStorage. Rejected because it violates user agency — if a user manually toggles to light mode while their OS is in dark mode, they expect that choice to persist.

**Separate font smoothing per mode:** Could have used different smoothing values for light vs dark. Rejected because antialiased works well for both — no evidence that mode-specific smoothing improves readability.

**Component-level gradients:** Could have kept gradients hardcoded per component with comments. Rejected because it's harder to maintain and violates the existing token system pattern (e.g., `--cdn-amber`, `--cdn-purple` are already centralized).

## Impact

- **Users:** First-visit experience now respects OS theme. Native browser UI (scrollbars, inputs) matches site theme.
- **Developers:** Gradient palette changes now require editing only `tokens.css`, not hunting through shell/footer styles.
- **Design consistency:** Top nav and footer now use the same gradient token values — guaranteed visual consistency.

## Testing

- ✅ `npm run lint` — clean
- ✅ `npm test` — all 146 tests passing
- ✅ `npm run build` — success
- ✅ Manual testing: System preference detected on first visit, manual toggle persists, scrollbars match theme

## Related Decisions

- DEC-005: Footer Restyle — Design Token Integration (established the token system pattern)
- DEC-007: Localization Integration (Shell provides `locale` prop; same pattern for `theme` prop)

## Follow-Up Work

Remaining color scheme issues in the roadmap:
- **#61**: Dark mode accent refinement (visual audit + iteration)
- **#62**: Sepia/cream tone improvements (palette tuning)
- **#63**: Color contrast validation (accessibility audit)
- **#66**: Light mode glassmorphism polish
- **#67**: Dark mode glassmorphism polish
