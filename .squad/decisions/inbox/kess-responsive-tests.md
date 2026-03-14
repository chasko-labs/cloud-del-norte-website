# Decision: Home Page Responsive Rendering Tests

**Author:** Kess (Testing Lead)
**Date:** 2025-07-17
**Status:** Implemented

## Context

Lyren is performing a UX responsiveness pass on the home page (Grid responsive colspans, QualityReport spacing, ProductionOverview responsive ColumnLayout, barrel import fix). Tests are needed to validate the page renders correctly before and after these changes.

## Decision

Created `src/pages/home/__tests__/app.test.tsx` with 8 tests that render the full component tree (real child components, mocked Cloudscape primitives). This approach validates actual content rendering rather than just checking component presence via mocked children.

## Key Design Choice

Dual SpaceBetween mock — both barrel import (`@cloudscape-design/components`) and deep import (`@cloudscape-design/components/space-between`) are mocked so tests pass with the current barrel import in meetings.tsx AND will continue passing after Lyren's deep-import fix lands.

## Tests Added

- 8 tests covering: error-free render, Shell wrapper, 3 panel headers, community description, 4 metric labels, 4 metric values
- All 8 pass on main branch; designed to also pass after Lyren's responsive changes
