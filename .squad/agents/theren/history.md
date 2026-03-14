# Agent History

**Created:** 2026-03-13
**Agent:** Theren (Content & Data Specialist)

## Core Context

Initial setup — Squad team infrastructure created for Cloudscape Design System website project.

## Learnings

### 2025-07-25 — Leaders data + footer update

- **Leader schema extended:** `organization` (string|null) and `retired` (boolean) fields added to `Leader` interface in `src/components/footer/leader-card.tsx` and all entries in `src/data/leaders.json`. Backward-compatible: existing rendering ignores these fields.
- **Footer bottom section:** Replaced copyright + nav links with community description text. Uses Cloudscape `Link` (external) inline and `<strong>` for "Go Build" motto. No `year` variable needed anymore.
- **ñ character handling:** `Doña Ana County` uses the Spanish eñe (ñ, U+00F1) — JSON and TSX handle it natively, no escaping needed.
- **Test data must match type:** When extending the `Leader` interface, all test fixtures in `leader-card.test.tsx` must include the new fields or tsc fails during build (even though vitest passes).
- **Key files:** `src/data/leaders.json`, `src/components/footer/index.tsx`, `src/components/footer/leader-card.tsx`, `src/components/footer/__tests__/footer.test.tsx`, `src/components/footer/__tests__/leader-card.test.tsx`

## Session 2025-07-25 — Leaders JSON + Footer Content Finalization

**Status:** ✅ Complete

- **Leaders data:** Extended from 5 to 6 (added Wayne Savage as `retired: true`, `organization: null`; updated Jacob Wright role to include "Founder & Doña Ana County Lead" with proper ñ character)
- **Footer content:** Replaced copyright + nav links with: community description paragraph + external link to "Global AWS UG Community" + "Go Build" emphasis in orange gradient
- **Data contract:** Committed `src/data/leaders.json` with 6 full entries matching extended schema; all tests updated to use 6-leader fixtures
- **Coordination:** Worked in parallel with Lyren (CSS restyle) and Kess (test updates); all changes merged without conflicts
- **Quality:** `npm run lint && npm test && npm run build` all passed — 99/99 tests

## Learnings

### 2026-03-14 — Translation Hook Integration

Wired `useTranslation()` hook into all page components across the website. Replaced hardcoded English strings with `t()` function calls for i18n support. Key changes:

**Pages updated:**
1. **Home** (`src/pages/home/`) — app.tsx, production-overview.tsx, meetings.tsx, quality-report/index.tsx
   - Breadcrumb, header, info link, table headers
   - Pattern: `const { t } = useTranslation();` at component top, then `t('home.key')`

2. **Meetings** (`src/pages/meetings/`) — app.tsx, meetings-table.tsx
   - Breadcrumb, table headers, empty states, preferences, filter placeholder, aria labels
   - Column definitions converted to function accepting `t` parameter for dynamic headers
   - Empty state titles/subtitles, buttons

3. **Create Meeting** (`src/pages/create-meeting/`) — app.tsx, shape.tsx, marketing.tsx, details.tsx, help-panel-home.tsx
   - Breadcrumb, header, description, form labels, validation messages
   - Help panel completely translated (all headings and text)
   - Pattern: inline translation in JSX expressions

4. **Learning/API** (`src/pages/learning/api/`) — main.tsx (breadcrumbs), RiftRewindDashboard.tsx (headers only)
   - Only section headers translated per instructions
   - Body content paragraphs left unchanged
   - Breadcrumb items in main.tsx

5. **Maintenance Calendar** (`src/pages/maintenance-calendar/`) — MaintenanceCalendar.tsx
   - Breadcrumb, header, description, table headers, filter label, export buttons
   - Helper functions updated to accept `t` parameter
   - All category labels, empty states

**Patterns established:**
- Import path: `../../hooks/useTranslation` for app.tsx, `../../../hooks/useTranslation` for components
- Call hook at component top: `const { t } = useTranslation();`
- Replace string literals: `"Text"` → `{t('namespace.key')}`
- For function-scope constants (columnDefinitions, helper functions), convert to functions accepting `t` parameter
- Preserve all logic, props, event handlers — only strings changed
- Skip strings without corresponding translation keys in en-US.json

**Technical details:**
- Shell already wraps all pages in `<LocaleProvider>` — no additional state management needed
- All page app.tsx files already have locale state — only needed to import and use the hook
- Learning/API page special case: inline `t()` function in main.tsx since no useTranslation context there
- Used sed for bulk replacements in RiftRewindDashboard headers and meetings-table hardcoded strings
- ESLint lint check passed after adding `// eslint-disable-next-line` comment for unavoidable `any` type

**Files modified:** 15 total
- 5 app.tsx files
- 10 component files

All 161 translation keys from en-US.json now wired into the UI. Spanish locale toggle functional.

## Session 2026-03-14 — Documentation Update (Audit Learnings)

**Status:** ✅ Complete

### Learnings

- **data.ts bypass is a hidden localization gap:** Pages with `data.ts` files (metric labels, topic names, descriptions) silently bypass `t()` because the strings live outside React component bodies. These must use a `labelKey` pattern (store translation key, resolve at render time) — documented in LOCALIZATION.md §9 and AGENTS.md Common Pitfalls §3.
- **document.title must use t() + useEffect:** `document.title` set once at module load will never update when locale changes. Always set via `useEffect` depending on `[t]`.
- **Verification checklist added:** LOCALIZATION.md §11 now has a full "how to audit a page" checklist — structural requirements, string coverage, data files, accessibility, and test patterns.

## Session 2026-03-14 — Leader Card Reordering & Bilingual Titles (Agent-30)

**Status:** ✅ Complete

### Changes

- **Leader reorder:** Jacob (founder) → Andres (ABQ) → LSM (builder) → You (placeholder) → Sofía (Spanish liaison) → ASL (interpreter)
- **Translation keys:** Created titles for all 6 leaders in en-US.json and es-MX.json
- **Files updated:** src/data/leaders.json, src/locales/en-US.json, src/locales/es-MX.json
- **Quality:** Lint ✅, Tests 99/99 ✅, Build ✅

### Key Learnings

- **Footer speaks the community:** Leader order reflects actual meeting speaking order. Visual alignment with real community improves perception.
- **Translation keys enable future growth:** Speaker rotation no longer requires code changes — only update translation keys.
- **Bilingual titles ready:** All leader titles wired for es-MX locale; "You" placeholder allows easy insertion of new leaders.

### Decision Created

- **DEC-008:** Leader reordering + bilingual footer support (decision merged to decisions.md)

## Session 2026-03-14 — Roadmap Page Creation (GH #68)

**Status:** ✅ Complete

### Changes

Created complete Roadmap page at `src/pages/roadmap/` with Jira-style Scrum board layout:

**Files created:**
- `src/pages/roadmap/index.html` — HTML entry point
- `src/pages/roadmap/main.tsx` — React root mounting (standard boilerplate)
- `src/pages/roadmap/app.tsx` — Page component with theme + locale state + Shell wrapper
- `src/pages/roadmap/data.ts` — Board column data (19 SCRUM cards across 5 columns)
- `src/pages/roadmap/styles.css` — Scrum board CSS (5-column grid, gradient headers, card styling)

**Integration:**
- Registered in `vite.config.ts` input map
- Added to navigation (above Meetings) in `src/components/navigation/index.tsx`
- Translation keys added to `src/locales/en-US.json` and `es-MX.json`
- Updated `src/locales/__tests__/translation-coverage.test.ts` allowlist for "Roadmap" (universally understood term)

**Board layout:**
- 5 columns: Idea | Todo | In Progress | In Review | Done
- 19 SCRUM cards distributed: 4 + 4 + 5 + 4 + 2
- Responsive grid (stacks vertically on mobile)
- Color-coded gradient headers per column (sepia-amber, blue-cyan, amber-orange, violet-cyan, green)
- Cards with glassmorphism styling + hover effects (translateY + colored left accent line)

**Quality gate:** Lint ✅ Tests (146/146) ✅ Build ✅

**PR:** #71 opened with `roadmap` label

### Key Learnings

- **Standard MPA page anatomy enforced:** Every page must have index.html, main.tsx (mounting boilerplate), app.tsx (theme+locale+Shell+LocaleProvider). This pattern is consistent across all existing pages.
- **AppContent extraction pattern:** Since Shell provides `LocaleProvider`, the page component must extract an `AppContent` child component to call `useTranslation()` — the parent cannot call hooks before rendering the provider.
- **Translation allowlist for universal terms:** "Roadmap" is the same in English and Spanish (universally understood). Added to `allowIdentical` set in translation-coverage test to avoid false positives. Full Spanish localization pass deferred to GH #69.
- **data.ts for board structure:** Stored column definitions + card data in separate file for clean separation. Each column has a `translationKey` field resolved at render time with `t()`.
- **Column-specific CSS via data attributes:** Used `data-column="..."` attributes for column-specific gradient styling. Cleaner than multiple class names.

### Decision Created

- **DEC-009:** Roadmap page with Scrum board layout (decision written to `.squad/decisions/inbox/theren-roadmap-page.md`)
