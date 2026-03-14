# Agent History

**Created:** 2026-03-13
**Agent:** Kess (Testing Lead)

## Core Context

Initial setup — Squad team infrastructure created for Cloudscape Design System website project.

## Learnings

### Footer test patterns (2026-03-13)
- Badge mock must include `data-color` attribute to test color props: `React.createElement('span', { 'data-testid': 'badge', 'data-color': color }, children)`
- Separate mock data objects per feature variant (org leader, retired leader, placeholder) — keeps tests focused
- Footer tests use mocked `LeaderCard` to isolate; leader-card tests render real component
- `cdn-footer-retired` CSS class on card div for retired leaders; checked via `classList.contains()`
- Organization text rendered via `Box variant="small"` when non-null
- Badge color logic: `retired ? 'grey' : (isPlaceholder ? 'blue' : 'green')`
- Key paths: `src/components/footer/__tests__/footer.test.tsx`, `src/components/footer/__tests__/leader-card.test.tsx`
- Leader data: `src/data/leaders.json` — 6 leaders including Wayne Savage (retired founder)
- Footer bottom: community description paragraph with Link to Global AWS UG Community, no Home/Meetup links, no copyright year

## Session 2025-07-25 — Footer Test Suite Update

**Status:** ✅ Complete

- **Test update scope:** Updated `footer.test.tsx` and `leader-card.test.tsx` for 6-leader dataset, organization/retired fields, community description text, Global AWS UG Community link assertion
- **Badge mock fix:** Added `data-color` attribute to Badge mock span to enable color prop testing: `'data-color': color`
- **Test cases added:** Organization display, retired CSS class, badge color variants (grey for retired, green for active), community description assertion, external link verification
- **Fixture data:** All 6 leader fixtures updated to include `organization` and `retired` fields; mocked Cloudscape components (Button, Link, Badge) via minimal HTML stand-ins
- **Result:** 99/99 tests passing; all mocked component renders match real Cloudscape API signatures
- **Coordination:** Parallel work with Theren (data) and Lyren (CSS); test artifacts aligned with component and data contract changes

## Session 2026-03-14 — Documentation Update (Audit Learnings)

**Status:** ✅ Complete

### Learnings

- **LocaleProvider test wrapper is now the standard pattern:** All future tests for components using `useTranslation()` must wrap in `<LocaleProvider locale="us">`. This is documented in AGENTS.md Common Pitfalls §6 and the testing conventions file.
- **Translation parity allowlist:** The parity test uses an allowlist for intentional pass-throughs (AWS, API, REST, Meetup, etc.) — future contributors adding tech terms should add them to the allowlist, not force-translate them.
- **Test count baseline:** 125 tests after localization integration (up from 99 pre-localization).
