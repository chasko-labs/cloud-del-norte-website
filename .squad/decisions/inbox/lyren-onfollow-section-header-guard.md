# Decision: Guard onFollow handler against section-header events

**Date:** 2025-07-26  
**Author:** Lyren  
**Status:** Implemented  

## Context

The `onFollow` handler in `src/components/navigation/index.tsx` was intercepting ALL SideNavigation events, including section expand/collapse toggles. This broke expandable sections (Learning, Resources) — they would flash open then immediately close because the handler called `preventDefault()` and attempted navigation.

## Decision

Guard the `onFollow` handler with two checks:
1. **Early return** for `event.detail.type === 'section-header'` — lets Cloudscape handle expand/collapse natively
2. **Href validation** — only navigate when `href` is truthy and not `'#'`

## Rationale

Cloudscape's `SideNavigationProps.FollowDetail` includes a `type` field that distinguishes `'link'`, `'link-group'`, `'expandable-link-group'`, and `'section-header'`. Section headers are toggle controls, not navigation targets. The MPA onFollow pattern must respect this distinction.

## Impact

- `src/components/navigation/index.tsx` — onFollow handler updated
- No test changes required — existing 146 tests pass
- Skill doc `.squad/skills/cloudscape-mpa-navigation/SKILL.md` updated with new "Section Header Pitfall" section
