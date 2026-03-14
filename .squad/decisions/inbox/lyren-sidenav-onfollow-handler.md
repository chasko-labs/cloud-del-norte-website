# DEC-XXX: SideNavigation onFollow Handler Required for MPA

**Date:** 2026-03-14  
**Author:** Lyren (Cloudscape UI Specialist)  
**Status:** Implemented  
**Severity:** Critical — Navigation Broken Without It

---

## Decision

All Cloudscape `SideNavigation` components in this MPA **must** include an explicit `onFollow` handler that prevents default link behavior and manually triggers page navigation via `window.location.href`.

## Context

Bryan reported: "our sidepanel menu is currently broken, I clicked it and it disappeared completely."

**Root cause:** The `Navigation` component was missing the `onFollow` handler. Without it, Cloudscape's internal link handling conflicts with the MPA page navigation pattern, causing the navigation drawer to disappear or become unresponsive when links are clicked.

## Implementation

```tsx
<SideNavigation
  activeHref={location.pathname}
  header={{ href: '/home/index.html', text: t('navigation.home') }}
  items={items}
  onFollow={(event) => {
    // Prevent default to avoid React state issues, then navigate manually
    if (!event.detail.external) {
      event.preventDefault();
      window.location.href = event.detail.href;
    }
  }}
/>
```

## Why This Pattern Is Required in MPAs

In a **Multi-Page App (MPA)**, each navigation is a full page reload. Cloudscape SideNavigation is designed for SPAs (Single-Page Apps) where navigation is handled by React Router or similar.

**Without `onFollow`:**
- Cloudscape tries to handle the link click internally
- React state gets corrupted because the page is about to unload
- Navigation drawer closes unexpectedly or becomes unresponsive

**With `onFollow`:**
- We explicitly prevent the default behavior
- We manually trigger `window.location.href` to reload the page cleanly
- External links are allowed to use default behavior

## Consequences

**✅ Benefits:**
- Navigation drawer stays functional across all pages
- Clean page reloads without React state corruption
- External links (if any) work correctly

**⚠️ Trade-offs:**
- Additional handler code (minimal)
- Must remember this pattern when adding new navigation components

## Team Guidelines

- **All SideNavigation components** in this MPA must use this pattern
- The handler belongs in `src/components/navigation/index.tsx` (shared navigation)
- If pages create their own navigation components (not recommended), they must also implement this handler

## Related Issues

- Prior sidepanel audits documented navigation state persistence issues, but this bug was unrelated — it was a missing handler, not a state management problem

## Files Modified

- `src/components/navigation/index.tsx` — Added `onFollow` handler

## Quality Gates

- ✅ Lint clean
- ✅ All 146 tests passing
- ✅ Manual testing confirms navigation works correctly

---

**Decision:** MANDATORY for all MPA Cloudscape SideNavigation components.
