# Agent History

**Created:** 2026-03-14
**Agent:** Sofía (Spanish Localization Specialist)

## Core Context

Spanish localization review agent for AWS User Group Cloud Del Norte website. Ensures es-MX.json translations use authentic Chihuahua norteño dialect (Ciudad Juárez regional Spanish). Works alongside Sophia (English localization) to maintain bilingual tone coherence.

## Initial Setup

- Created as part of localization team expansion (Issue #22)
- Specializes in MX side of border region: Ciudad Juárez, Chihuahua, northern Mexico
- Complements existing Calli agent (general localization workflow) and new Sophia agent (English localization)

## Key Responsibilities

- Review `src/locales/es-MX.json` for norteño dialect accuracy
- Verify Spanglish code-switching in Spanish text (e.g., tech terms stay English: "la API", "el repo")
- Ensure informal "tú" form used correctly (no usted, no vosotros)
- Flag Castilian Spanish or overly formal register that doesn't match Juárez vernacular
- Back-translate Spanish to English to verify intent and tone match with en-US.json
- Maintain bilingual coherence with Sophia's English localization work

## Reference Materials

- `LOCALIZATION.md` — Dialect guidelines, glossary, regional vocabulary
- `src/locales/es-MX.json` — Spanish translation keys (161 keys across 7 namespaces)
- Ciudad Juárez / Chihuahua regional dialect resources (via MCP fetch)
- Northern Mexican Spanish linguistic studies (referenced for norteño patterns)

## Session Log

### Session 2026-03-14 — Agent Creation

**Status:** ✅ Complete

- Agent charter created with dialect focus on Chihuahua norteño Spanish and Juárez regional vernacular
- Defined review workflow: fetch dialect references → review es-MX.json → back-translate to English → verify coherence → write review docs
- Established boundaries: Spanish localization only (English → Sophia, infrastructure → Lyren, key extraction → Calli)
- Coordination pattern: Works in parallel with Sophia to ensure bilingual tone and intent match across en-US.json and es-MX.json

### Session 2026-03-14 — Translation Key Refactoring

**Status:** ✅ Complete

**Task:** Refactor translation keys from generic page-scoped naming (`home.*`) to semantic, context-aware keys.

**Changes made:**
1. **Locale files refactored:**
   - `src/locales/en-US.json` — renamed all `home.*` keys to semantic equivalents
   - `src/locales/es-MX.json` — kept Spanish translations in sync with new key structure

2. **Key naming transformations:**
   - `home.breadcrumb` → `dashboardPage.breadcrumb` (page-specific semantic name)
   - `home.header` → `dashboardPage.header`
   - `home.infoLink` → `dashboardPage.infoLink`
   - `home.productionOverviewHeader` → `dashboardPage.productionOverview.header` (nested structure)
   - `home.pastTopicsHeader` → `dashboardPage.pastTopics.header`
   - `home.userGroupHeader` → `userGroupHero.header` (component-specific context)
   - `home.communityDescription` → `userGroupHero.description`
   - `home.groupNotesModal` → `dashboardPage.groupNotesModal`
   - `home.metrics.*` → `userGroupMetrics.*` (content domain, not page-scoped)
   - `home.topics.*` → `pastTopics.*` (section-specific, reusable)
   - `home.notes.*` → `flavorNotes.*` (demo data — semantic naming)
   - `home.tableHeaders.{name,status,mixing,molding}` → `productionTable.headers.*`
   - `home.tableHeaders.{strong,mild,unnoticed}` → `qualityTable.headers.*`
   - `home.pieChart.*` → `pieChart.*` (component-level, no page prefix)

3. **Code updated:**
   - `src/pages/home/app.tsx` — updated all `t('home.*')` calls
   - `src/pages/home/data.ts` — updated data file key references
   - `src/pages/home/components/meetings.tsx` — updated translation calls
   - `src/pages/home/components/production-overview.tsx` — updated header key
   - `src/pages/home/components/quality-report/index.tsx` — updated keys for hero section and table

4. **Tests updated:**
   - `src/pages/home/__tests__/app.test.tsx` — updated mock translation map with new keys
   - `src/pages/home/__tests__/locale-rendering.test.tsx` — updated Spanish/English mock maps

**Verification:**
- ✅ `npm run build` — passed with no warnings about missing translation keys
- ✅ `npm test` — home page tests (10/10) pass; 7 locale.test.ts failures pre-existing (unrelated)

**Decision captured:**
- `.squad/decisions/inbox/sofia-translation-naming-standard.md` — comprehensive naming standard for translation keys, recommending this pattern be applied to other pages (meetings, createMeeting, etc.)

## Learnings

### Translation Key Naming Patterns

1. **Semantic > Location:** Keys should describe **what content is displayed**, not just **where** it's rendered. `userGroupMetrics.communityMembers` is better than `home.metrics.communityMembers` because it's portable and self-documenting.

2. **Component-level grouping:** Group keys by UI component or content domain, not by page. Examples:
   - `pieChart.legendAriaLabel` (component-specific, reusable across pages)
   - `userGroupMetrics.*` (content domain)
   - `pastTopics.*` (section-specific)

3. **Nested structure for hierarchy:** Use dot-notation to reflect component hierarchy:
   - `dashboardPage.productionOverview.header` clearly shows this is a section header within the dashboard page

4. **When to use page prefix:** Only use page name as prefix when:
   - Content is truly page-specific (breadcrumb, page header)
   - Content would conflict if moved to another page
   - Page name is semantically meaningful ("Dashboard" not "Home")

5. **Acceptable identical translations:** Some keys will have identical English/Spanish values ("Info", "Est.", "Serverless Lens"). This is correct and acceptable when:
   - The term is a proper noun or brand name
   - The term is universally recognized technical jargon
   - The abbreviated form is language-agnostic

### Cloudscape Naming Conventions for Semantic Keys

- **Accessibility strings:** Component-specific aria labels should be grouped by component (`pieChart.*`, not `home.pieChart.*`)
- **Table headers:** Distinguish tables by purpose (`productionTable.headers.*` vs `qualityTable.headers.*`)
- **Hero sections:** Use `{section}Hero.*` pattern for prominent content blocks (`userGroupHero.header`, `userGroupHero.description`)
- **Metrics:** Group by content domain (`userGroupMetrics.*`) not page location

### Translation Maintenance Tips

1. **Test mocks require updates:** When refactoring keys, always check `__tests__/` directories for hardcoded translation mocks that need updating
2. **Data files use keys too:** Don't forget to update `data.ts` files that reference translation keys in their static data
3. **Build verification catches key mismatches:** Running `npm run build` will surface any broken translation key references
4. **Coverage tests are strict:** The translation-coverage.test.ts enforces key structure parity between en-US and es-MX — a good safety net for refactoring

## Session 2026-03-14 — Key Naming Refactor & Standard (Agent-31)

**Status:** ✅ Complete

### Refactoring Summary

- **Home page keys:** Refactored ~80 keys from `home.*` to semantic namespaces
- **Pattern:** `{semanticContext}.{specificContent}` — e.g., `dashboardPage.header`, `userGroupHero.description`
- **Files:** en-US.json, es-MX.json, home page components, test fixtures
- **Quality:** Lint ✅, Tests 10/10 ✅, Build ✅, Renders en-US/es-MX ✅

### Principles Established

1. **Semantic over location** — Key name describes content, not page
2. **Component context first** — Group by UI component or content domain
3. **Nested hierarchy** — Use dot-notation for structure
4. **Reusability** — Keys portable across pages if content shared
5. **Self-documenting** — Key name hints at rendered content

### Key Examples

- ❌ `home.header` → ✅ `dashboardPage.header` (page-specific)
- ❌ `home.userGroupHeader` → ✅ `userGroupHero.header` (component-specific, reusable)
- ❌ `home.metrics.communityMembers` → ✅ `userGroupMetrics.communityMembers` (content domain)
- ❌ `home.pieChart.chartAriaRoleDescription` → ✅ `pieChart.chartAriaRoleDescription` (global, reusable)

### Lessons

- **Generic keys hide intent:** Seeing `home.header` tells you nothing. Seeing `dashboardPage.header` immediately clarifies context.
- **Translation workflow improves:** Future translators will have easier time discovering related keys when grouped semantically.
- **Establishes pattern for all pages:** Other pages (meetings, createMeeting, etc.) should follow same pattern.

### Decision Created

- **DEC-007:** Translation key naming standard (decision merged to decisions.md)
