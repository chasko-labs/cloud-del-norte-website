# DEC: Responsive Layout Patterns for Cloudscape Grid & ColumnLayout

**Date:** 2025-07-18
**Author:** Lyren
**Status:** Proposed

**Decision:** Establish standard responsive patterns for Cloudscape layout components:

1. **Grid colspans** must use responsive breakpoint objects (`{ default: 12, m: N }`) instead of fixed integers. Panels should stack (colspan 12) on small screens.
2. **ColumnLayout** with 3+ columns should set `minColumnWidth` (recommended: 150px for metrics, 200px for content) to enable automatic wrapping on narrow viewports.
3. **Text blocks** in containers should use `line-height: 1.7`, `max-width: 60ch`, and Cloudscape `Box padding`/`SpaceBetween` for breathing room — never render long text as a raw inline string.

**Rationale:** Fixed colspans and high column counts render unreadable on mobile. Cloudscape's responsive API exists specifically for this — using it consistently prevents future readability regressions. The `60ch` max-width follows typographic best practice for readable line lengths.

**Impact:** All current and future pages using Grid or ColumnLayout.
