# Decisions

> Team-wide decision log. Scribe merges entries from `.squad/decisions/inbox/`. Agents read this before every task.

---

## DEC-001: Squad Team Established

**Date:** 2026-03-13
**Author:** Stratia
**Status:** ✅ Accepted

**Decision:** Squad v0.5.4 team infrastructure created with HeraldStack personas. Team: Stratia (architecture), Lyren (Cloudscape UI), Vael (build/deploy), Theren (content/data), Kess (testing), Scribe (logger), Ralph (monitor).

**Rationale:** Project needs domain-specialized agent routing. HeraldStack personas consistent with Bryan's other projects (chrome-extension-moodle-uploader-v3). Roles map to project domains: Cloudscape components, Vite MPA build, content/data, and testing.

---

## DEC-002: MCP Server Selection

**Date:** 2026-03-13
**Author:** Stratia
**Status:** ✅ Accepted

**Decision:** Three MCP servers configured: github (Copilot MCP), context7 (library docs), fetch (web fetch). No chrome-devtools, playwright, jaeger, or AWS-specific MCPs.

**Rationale:** This is a static Cloudscape website — no Chrome extension debugging, no E2E browser testing, no observability infrastructure, no CDK/IaC. The three selected MCPs cover: code/PR operations (github), Cloudscape/React/Vite docs (context7), and live documentation fetch (fetch).

---

## DEC-003: Architectural Constraints Inherited

**Date:** 2026-03-13
**Author:** Stratia
**Status:** ✅ Accepted

**Decision:** All constraints from AGENTS.md are binding on the Squad team: MPA-only, no React Router, Cloudscape-only, no path aliases, no backend, ESLint flat config, manual deploy.

**Rationale:** These constraints predate Squad installation and are documented in the project's AGENTS.md. They are non-negotiable architectural decisions made by the project owner.

---

## DEC-004: Leader Schema Extended with Organization & Retired Fields

**Date:** 2025-07-25
**Author:** Theren
**Status:** ✅ Accepted

**Decision:** Extended the `Leader` interface with two new optional-style fields: `organization` (string|null) for institutional affiliation, and `retired` (boolean) for tracking active vs retired leaders. All existing leaders default to `organization: null, retired: false`. Wayne Savage is the first entry with both populated.

**Rationale:** The group has historical founders who are no longer active organizers. The `retired` field enables future UI differentiation (e.g., faded cards, separate section). The `organization` field supports attribution to institutions like NMSU Arrowhead Research Park. Both fields are additive — existing rendering code ignores them, so no breaking changes.

**Impact:** `src/data/leaders.json`, `src/components/footer/leader-card.tsx` (type only), all test fixtures.

---

## DEC-005: Footer Restyle — Design Token Integration

**Date:** 2025-07-25
**Author:** Lyren
**Status:** ✅ Accepted

**Decision:** Complete footer restyle to integrate with the Cloud Del Norte design token system. Key design choices:

1. **Gradient accent top-border** via `::after` pseudo-element (not `::before`, which cards use)
2. **Social links as accessible pills** — 44px min touch targets, `[role="listitem"]` styled containers wrapping Cloudscape Link components
3. **Retired cards** — `filter: saturate(0.72)` muted look with amber→gold `::before` accent line
4. **Community text** — `<p>` with `max-width: 800px` and `font-size: var(--cdn-text-lg)` replacing `Box variant="small"`
5. **"Go Build" gradient text** — amber→orange (light), violet→cyan (dark) via `background-clip: text`
6. **Heading underline** — centered gradient underline instead of left-border (better for centered footer)
7. **Grid** — 3 columns at ≥1200px (2 rows of 3 for 6 cards)
8. **Stagger animation** — nth-child(5)(6) added to tokens.css for reusability

**Rationale:** The first-pass footer used generic colors and minimal token integration. This restyle makes the footer feel like an organic part of the warm-sepia (light) / cosmic-navy (dark) brand language, matching the top-nav and card patterns established in tokens.css and shell/styles.css.

**Affected files:**
- `src/components/footer/styles.css` — complete rewrite
- `src/components/footer/leader-card.tsx` — org display class change
- `src/styles/tokens.css` — nth-child(5)(6) stagger delays

---

## DEC-006: Footer Test Update for Leader Data Structure Changes

**Date:** 2025-07-25
**Author:** Kess
**Status:** ✅ Accepted

**Decision:** Updated Badge mock in leader-card tests to expose `color` prop via `data-color` attribute. Added 6 new tests covering: organization display, retired CSS class, badge color variants (grey for retired, green for active), community description text, and Global AWS UG Community link. Updated LeaderCard source to support `cdn-footer-retired` class, organization display, and retired badge color logic.

**Rationale:** Lyren and Theren updated the footer data model (6 leaders, organization/retired fields, community description replacing copyright). Tests needed to match the new contract. The Badge mock lacked color prop forwarding, making badge color testing impossible — fixed by adding `data-color` attribute. Source component changes (retired class, organization rendering, badge color) were required to make tests pass since they implement the new data contract.

**Test result:** 99/99 passing

---

## DEC-007: Localization Integration — Full String Extraction & Translation Wiring

**Date:** 2026-03-14
**Author:** Harald (Coordinator), Calli (Localization)
**Status:** ✅ Implemented

**Decision:** Extract all hardcoded strings from pages and shared components into translation JSON files (en-US.json / es-MX.json) and wire `useTranslation()` hook throughout the app.

**Key choices:**
- 161 translation keys across 11 namespaces
- Chihuahua norteño dialect for es-MX (informal "tú", regional slang)
- English tech terms preserved (authentic code-switching)
- Learning/API page: headers only, body content deferred
- ShellContent extraction pattern for LocaleProvider context access
- Custom lightweight i18n — no external dependency (react-intl, i18next) needed
- Human review required before translations considered final

**Rationale:** The existing i18n infrastructure (LocaleProvider, useTranslation hook, locale toggle) was well-built but unused. Completing the wiring makes the bilingual toggle functional and delivers value to the Spanish-speaking community members. MCP-powered translation with human review avoids AI slop.

---

## DEC-008: Documentation Update — Audit Learnings Captured

**Date:** 2026-03-14
**Author:** Scribe (Logger), Copilot
**Status:** ✅ Accepted

**Decision:** Update README.md, AGENTS.md, LOCALIZATION.md, and `.squad/skills/localization/SKILL.md` to capture learnings from the localization and UI audit backlog (#30–#37).

**Key additions:**
- **README.md** — Page Compliance Checklist; complete `app.tsx` boilerplate with locale + theme state; `data.ts → t()` pattern documentation
- **AGENTS.md** — Barrel import prohibition made explicit with code example; page compliance checklist added to Architectural Constraints; new "Common Pitfalls" section documenting 6 audit learnings (barrel imports, ShellContent pattern, static data.ts bypass, navigation items inside component, CSS selector locale breakage, test LocaleProvider wrapping)
- **LOCALIZATION.md** — Three new sections: (9) `data.ts` pattern for locale-aware static data, (10) HTML lang attribute & `document.title` pattern, (11) full verification checklist for confirming a page is fully localized
- **`.squad/skills/localization/SKILL.md`** — Confidence raised from `medium` → `high`; five audit patterns documented inline

**Rationale:** The localization audit produced significant learnings (ShellContent pattern, CSS selector breakage, data.ts bypass, etc.) that were only captured in agent history files. Surfacing them in the primary project docs ensures future developers and agents encounter them before making the same mistakes. The page compliance checklist creates a clear, auditable standard for any new page.

**Affected files:**
- `src/locales/en-US.json` (expanded to 166 keys)
- `src/locales/es-MX.json` (full parity with en-US)
- All page app.tsx files — locale state + handlers
- Shared components — useTranslation() integration

---

## DEC-008: Shared Component Localization Pattern

**Date:** 2026-03-14
**Author:** Lyren
**Status:** ✅ Implemented

**Decision:** Established the pattern for wiring `useTranslation()` into shared components that are rendered within `LocaleProvider`. Key architectural insight: when a component renders a context provider AND needs to consume that context, extract the consuming logic into a child component.

**Pattern:**
```tsx
// Shell → renders LocaleProvider, cannot use useTranslation() at same level
function ShellContent(props: ShellProps) {
  const { t } = useTranslation();  // ✅ Inside LocaleProvider
}

export default function Shell(props: ShellProps) {
  return (
    <LocaleProvider locale={props.locale ?? 'us'}>
      <ShellContent {...props} />
    </LocaleProvider>
  );
}

// Navigation, Breadcrumbs, Footer → rendered inside Shell, can use useTranslation() directly
export default function Navigation() {
  const { t } = useTranslation();  // ✅ Safe — Shell wraps everything
}
```

**Rationale:** Separation of concerns — Shell manages LocaleProvider lifecycle; ShellContent handles rendering logic. Test clarity: explicit LocaleProvider wrapping in tests makes context dependency obvious.

**Affected files:**
- `src/layouts/shell/index.tsx` — ShellContent extraction
- `src/components/navigation/index.tsx` — useTranslation() integration
- `src/components/breadcrumbs/index.tsx` — useTranslation() integration
- `src/components/footer/index.tsx` — useTranslation() integration
- All component test files — LocaleProvider wrapper

**Test result:** 120/120 passing

---

## DEC-009: Phase 4 Backlog Creation — Theme/Locale Audit Issues

**Date:** 2026-03-14
**Author:** Kess (Testing Lead)
**Status:** ✅ Complete

**Decision:** Coordinated with Ralph to translate Lyren's localization audit findings into actionable GitHub issues for Copilot to implement. Conducted fresh codebase audit and created 5 GitHub issues.

**Issues Created:**
- #51 — Learning/API Page: Complete Shell/theme/locale refactor + deep imports (HIGH)
- #52 — Maintenance Calendar: Complete Shell/theme/locale integration (HIGH)
- #53 — Theme Page: Implement proper MPA structure or deprecate (MEDIUM, flagged question)
- #54 — Create Meeting Page: Add locale integration + fix barrel import (MEDIUM)
- #55 — Meetings Page: Add locale integration (MEDIUM)

**Acceptance Criteria (all issues):**
- ✅ `npm run lint` passes
- ✅ `npm test` passes (all tests green)
- ✅ `npm run build` succeeds
- ✅ Page renders in light/dark + en/es modes
- ✅ No console errors
- ✅ Theme toggle works (☀️ ↔ 🌙)
- ✅ Locale toggle works (🇺🇸 ↔ 🇲🇽)

**TopNav Artifact Finding:** DEC-008 (Toggle Button CSS fix) already implemented — no additional issue needed.

---

## DEC-010: Theme + Locale Coverage Audit — Phase 3

**Date:** 2026-03-14
**Author:** Lyren (Cloudscape UI & Design Specialist)
**Status:** ✅ Complete

**Decision:** Comprehensive audit of all 6 pages for theme (light/dark) + locale (en-US/es-MX) support, TopNav artifact resolution, and Cloudscape compliance.

**Audit Results:**

| Page | Theme | Locale | Shell | Status |
| --- | --- | --- | --- | --- |
| home | ✅ | ✅ | ✅ | ✅ READY |
| meetings | ✅ | ✅ | ✅ | ✅ READY |
| create-meeting | ✅ | ✅ | ✅ | ✅ READY |
| learning/api | ✅ | ✅ | ✅ | 🟡 NEEDS FIX (barrel import) |
| maintenance-calendar | ❌ | ❌ | ❌ | 🔴 CRITICAL |
| theme/ | N/A | N/A | N/A | ⚠️ NO APP.TSX |

**Key Findings:**

1. **Maintenance Calendar:** app.tsx is a 7-line stub — requires full Shell integration with theme/locale state + handlers
2. **Learning/API:** 9 components in single barrel import (RiftRewindDashboard.tsx:2) — negates tree-shaking, must be split into deep imports
3. **Home/Meetings:** Minor barrel imports (1 each) — low priority
4. **TopNav Artifact:** RESOLVED — emoji toggle buttons render cleanly via CSS override in shell/styles.css (lines 109-116)

**Translation Coverage:** 340 lines across en-US.json/es-MX.json — 1:1 parity, all `t()` calls resolve to valid keys

**Cloudscape Compliance:** All pages correctly import global styles + custom tokens, deep imports (mostly), no violations detected

**Critical Blockers:** Maintenance Calendar missing Shell integration (high impact, easy fix)

---

## DEC-011: Localization Pipeline Strategy

**Date:** 2026-03-14
**Author:** Stratia (Strategy & Architecture Advisor)
**Status:** Proposed

**Decision:** Adopt a 3-phase localization pipeline that scales from the current manual process to MCP-augmented dialect lookup and ultimately to automated LLM-based dialect review.

**Phase A (Current):** Manual + Human Review — no changes, works well at ~161 keys

**Phase B (Future, trigger: ~300+ keys):** MCP Dialect Lookup + Embedding Index
- Build `localization-mcp-dialect-lookup` — queries public corpora (Corpus del Español, COCA, OPUS) for dialect verification
- Build `localization-mcp-glossary` — curated border-region glossary (~200 terms) with lookup, suggestion, validation
- Optional: Qdrant vector index for tone/register consistency

**Phase C (Long-Term):** Automated LLM Dialect Review
- PR-triggered review via LLM checks against Phase B tools + LOCALIZATION.md guidelines
- Outputs PR comments with approve/warn/reject verdicts
- CI/CD checks for key parity, formality register, glossary compliance

**Rationale:** Phase A works now; no over-engineering needed at ~161 keys. Phase B adds consistency at scale (~300+ keys). Phase C adds automated guardrails before human review. Public corpora are free and open-access.

**Resource Links:**
- Corpus del Español, COCA, OPUS, UTEP Bilingualism Institute, INEGI, Wiktionary, UD Treebanks

**Next Steps:**
1. LOCALIZATION.md updated with §§9–10 (pipeline phases)
2. `.squad/skills/mcp-dialect-lookup/SKILL.md` sketched
3. Phase B kickoff when key count hits ~300
4. Glossary curation from UTEP + Wiktionary
5. Phase C planning after Phase B.1 + B.2 stable

---

## DEC-012: Merge & Deploy Batch — 2026-03-13

**Date:** 2026-03-14
**Author:** Vael (MPA Build & Deploy Engineer)
**Status:** Executed

**Decision:** Merged 4 PRs to main in sequence: #28 (docs), #27 (squad infra + footer), #29 (locale toggle), #26 (locale tests). Skipped PRs #24, #25, #21.

**Key Decisions:**

1. **README conflict resolution:** PR #27 trimmed README significantly. Preserved the Localization section from PR #28 during conflict resolution.
2. **Test fix (locale.test.ts):** Added missing `vi` import to fix `tsc` build failure introduced by PR #26. (Bug: globals: true in vitest config makes `vi` available at runtime but TypeScript needs explicit import.)
3. **Deploy blocked:** AWS SSO token expired. Profile is `aerospaceug-admin` (not `bc-website` as documented). Deploy requires manual `aws sso login --profile aerospaceug-admin` then re-run sync/invalidation.
4. **Gitignore update:** Added `coverage/`, `*.tsbuildinfo`, `.eslintcache` — standard patterns.

**PRs Merged:**
- #28 — Documentation updates
- #27 — Squad infrastructure + footer restyle
- #29 — Locale toggle implementation
- #26 — Locale tests + LocaleProvider wiring

**PRs Skipped (per instructions):**
- #24, #25, #21 — deferred to later sprint

**Action Required for Deploy:**
1. Run `aws sso login --profile aerospaceug-admin`
2. Run `aws s3 sync lib/ s3://awsaerospace.org --delete --profile aerospaceug-admin`
3. Run `aws cloudfront create-invalidation --distribution-id ECC3LP1BL2CZS --paths "/*" --profile aerospaceug-admin`

**Test Result:** All merged commits pass `npm run lint && npm test && npm run build`


## DEC-013: Home Page Responsive Rendering Tests

**Author:** Kess (Testing Lead)
**Date:** 2025-07-17
**Status:** Implemented

**Context:** Lyren performed a UX responsiveness pass on the home page (Grid responsive colspans, QualityReport spacing, ProductionOverview responsive ColumnLayout, barrel import fix). Tests were needed to validate the page renders correctly before and after these changes.

**Decision:** Created `src/pages/home/__tests__/app.test.tsx` with 8 tests that render the full component tree (real child components, mocked Cloudscape primitives). This approach validates actual content rendering rather than just checking component presence via mocked children.

**Key Design Choice:** Dual SpaceBetween mock — both barrel import (`@cloudscape-design/components`) and deep import (`@cloudscape-design/components/space-between`) are mocked so tests pass with the current barrel import in meetings.tsx AND will continue passing after Lyren's deep-import fix lands.

**Tests Added:** 8 tests covering error-free render, Shell wrapper, 3 panel headers, community description, 4 metric labels, 4 metric values. All 8 pass on main branch; designed to also pass after Lyren's responsive changes.

---

## DEC-014: Responsive Layout Patterns for Cloudscape Grid & ColumnLayout

**Author:** Lyren (Cloudscape UI & Design Specialist)
**Date:** 2025-07-18
**Status:** Proposed

**Decision:** Establish standard responsive patterns for Cloudscape layout components:

1. **Grid colspans** must use responsive breakpoint objects (`{ default: 12, m: N }`) instead of fixed integers. Panels should stack (colspan 12) on small screens.
2. **ColumnLayout** with 3+ columns should set `minColumnWidth` (recommended: 150px for metrics, 200px for content) to enable automatic wrapping on narrow viewports.
3. **Text blocks** in containers should use `line-height: 1.7`, `max-width: 60ch`, and Cloudscape `Box padding`/`SpaceBetween` for breathing room — never render long text as a raw inline string.

**Rationale:** Fixed colspans and high column counts render unreadable on mobile. Cloudscape's responsive API exists specifically for this — using it consistently prevents future readability regressions. The `60ch` max-width follows typographic best practice for readable line lengths.

**Impact:** All current and future pages using Grid or ColumnLayout.

## DEC-005: Navigation Drawer State Management Standard

**Date:** 2026-03-14
**Author:** Lyren
**Status:** ✅ Accepted

**Decision:** Navigation drawer state must be explicitly managed in Shell component with `navigationOpen` and `onNavigationChange` props. Default to open on desktop (≥768px), closed on mobile.

**Rationale:** Cloudscape AppLayout defaults navigation to closed on all viewports when state is unmanaged. Missing explicit state management caused navigation drawer to appear at 0px height on desktop. The fix ensures consistent UX across all viewports and establishes a reusable pattern for all future layouts.

**Implementation:**
```tsx
const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
const [navOpen, setNavOpen] = useState(isDesktop);

<AppLayout
  navigationOpen={navOpen}
  onNavigationChange={(event) => setNavOpen(event.detail.open)}
  // ... other props
/>
```

**Standards:**
1. Always use `navigationOpen` prop with AppLayout + navigation drawer
2. Always wire `onNavigationChange` to handle toggle events
3. Default to open on desktop (≥768px), closed on mobile
4. Never rely on Cloudscape's default navigation state

**Verification:** All viewports (desktop/tablet/mobile) tested. Navigation visible and responsive in all theme/locale combinations.

---

## DEC-006: Toggle Button CSS — Locale-Aware Selectors + Chrome Removal

**Date:** 2026-03-14
**Author:** Lyren
**Status:** ✅ Accepted

**Decision:** Fixed TopNavigation toggle button CSS with locale-aware selectors and browser chrome removal.

**Rationale:** Original selectors matched English-only hardcoded strings (`[title*="English"]`). After localization wiring, titles became dynamic via `t()` function. Actual titles: "Switch to Spanish" (EN) / "Cambiar a Inglés" (ES). Chrome artifact behind emoji buttons required CSS override.

**Changes:** `src/layouts/shell/styles.css`
- Button chrome removal: `background: transparent !important; border: none !important; box-shadow: none !important`
- Locale-aware selectors: Match all localized title text from en-US.json and es-MX.json
- Theme toggle: `"light mode"`, `"dark mode"`, `"modo claro"`, `"modo oscuro"`
- Locale toggle: `"Switch to Spanish"`, `"Cambiar a Inglés"`

**Verification:** Toggle buttons render cleanly in light/dark theme and en-US/es-MX locale. No chrome artifact. No console errors.

---

## DEC-007: Translation Key Naming Standard

**Date:** 2026-03-14
**Author:** Sofía
**Status:** ✅ Accepted

**Decision:** Use semantic, context-aware translation key naming instead of generic page-scoped keys. Pattern: `{semanticContext}.{specificContent}`

**Rationale:** Generic keys like `home.header` and `home.infoLink` provide no semantic value, hide intent, limit reusability, and confuse translators. Semantic keys make relationship between key name and rendered content obvious.

**Pattern Examples:**

| ❌ Old (generic) | ✅ New (semantic) | Context |
|---|---|---|
| `home.breadcrumb` | `dashboardPage.breadcrumb` | Page-specific (home = dashboard) |
| `home.header` | `dashboardPage.header` | Page-level header |
| `home.userGroupHeader` | `userGroupHero.header` | Component-specific (hero section) |
| `home.metrics.communityMembers` | `userGroupMetrics.communityMembers` | Content domain (metrics) |
| `home.pieChart.chartAriaRoleDescription` | `pieChart.chartAriaRoleDescription` | Global reusable component |

**Standards:**
1. Semantic over location — key describes **what**, not **where**
2. Component context first — group by UI component or content domain
3. Nested structure — use dot-notation for hierarchy
4. Reusability — keys should be portable across pages if content shared
5. Self-documenting — key name alone hints at rendered content

**When to use page prefix:** Only when content is truly page-specific (breadcrumb, page header) or would conflict if moved.

**Verification:** Home page refactored (~80 keys). All tests passing (10/10). Build successful. Renders correctly in en-US and es-MX.

---

## DEC-008: Leader Reordering & Bilingual Footer Support

**Date:** 2026-03-14
**Author:** Theren
**Status:** ✅ Accepted

**Decision:** Reorder footer leader cards by speaking order (Jacob → Andres → LSM → You → Sofía → ASL) and establish translation keys for all leader titles.

**Rationale:** Footer leaders displayed in arbitrary order. Reordering by actual meeting speaking order improves visual hierarchy and community recognition. Translation keys enable bilingual support and future speaker updates without code changes.

**Leader Reorder:**
1. Jacob Wright — Founder & Doña Ana County Lead (orange gradient styling)
2. Andres Toledo — Albuquerque Lead
3. Luis "LSM" Montoya — Community Builder
4. You — Placeholder for speaker/leader
5. Sofía López — Spanish Community Liaison
6. ASL Interpreter — Event Facilitator (placeholder name)

**Files Updated:**
- `src/data/leaders.json` — Reordered entries
- `src/locales/en-US.json` — Leader title keys
- `src/locales/es-MX.json` — Spanish titles (Chihuahua norteño dialect)
- `src/components/footer/leader-card.tsx` — Renders titles from translation keys

**Verification:** All tests passing (99/99). Build successful. Both locales render correctly. Cards display in correct order with proper titles.

---

## DEC-009: Responsive Layout Patterns for Cloudscape Grid & ColumnLayout

**Date:** 2026-03-14
**Author:** Lyren
**Status:** ✅ Accepted

**Decision:** Establish responsive design patterns for Cloudscape Grid and ColumnLayout components. Use native Cloudscape responsive props instead of custom CSS media queries.

**Rationale:** Cloudscape Grid and ColumnLayout have built-in responsive features (`gridDefinition`, `columns`) that handle breakpoints automatically. Custom CSS media queries conflict with component defaults and create maintenance burden.

**Pattern — Grid Responsive Columns:**
```tsx
<Grid gridDefinition={[
  { colspan: { default: 12, xs: 12, s: 6, m: 4, l: 3, xl: 3 } },
  // ...
]}>
```

**Pattern — ColumnLayout Responsive Columns:**
```tsx
<ColumnLayout columns={[
  { default: 1, xs: 1, s: 1, m: 2, l: 3, xl: 3 }
]}>
```

**Breakpoints:** xs (0px), s (432px), m (672px), l (1024px), xl (1216px)

**Never:** Add custom CSS media queries targeting Cloudscape breakpoints. Let the component handle responsive behavior.

**Verification:** All pages tested at multiple viewports. No responsive breakpoint conflicts. Clean CSS output.
