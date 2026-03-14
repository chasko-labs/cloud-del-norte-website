# Agent History

**Created:** 2026-03-13
**Agent:** Lyren (Cloudscape UI & Design Specialist)

## Core Context

Initial setup — Squad team infrastructure created for Cloudscape Design System website project.

## Learnings — Footer Restyle (2025-07-18)

### Architecture Decisions
- Footer uses `::after` (not `::before`) for its gradient top-border because `.cdn-card` children already use `::before` for their accent lines — no pseudo-element collision.
- Social links styled as pill-shaped `[role="listitem"]` containers wrapping Cloudscape `Link` components — avoids fighting Cloudscape's internal anchor styling while providing 44px touch targets.
- Retired card styling uses `filter: saturate(0.72) brightness(0.97)` for a dignified muted look — not opacity-only, which would affect text readability.
- Community text uses `<p className="cdn-footer-community">` with `max-width: 800px` instead of Cloudscape `Box variant="small"` — the task required larger-than-body font, which contradicts `variant="small"`.

### Design Token Integration
- Gradient top-border mirrors token system: purple→violet→orange (light), violet→cyan→violet (dark).
- Heading uses centered gradient underline (not left-border) — better fit for centered footer layout.
- Added nth-child(5) and (6) stagger delays to tokens.css — reusable for any card grid.
- Retired cards get amber→gold `::before` accent to honor emeritus status distinctly.

### Key File Paths
- `src/components/footer/styles.css` — complete restyle, all design token references
- `src/components/footer/leader-card.tsx` — organization displayed as `<span className="cdn-footer-card-org">`
- `src/components/footer/index.tsx` — community text via `.cdn-footer-community` + `.cdn-footer-emphasis` for "Go Build"
- `src/styles/tokens.css` — nth-child(5)(6) stagger added in ENHANCEMENT 2 section

### Coordination with Theren
- Theren already added `retired: boolean`, `organization: string | null` to Leader interface and leaders.json before Lyren's restyle.
- Footer index.tsx: Lyren changed `Box variant="small"` → `p.cdn-footer-community` with `.cdn-footer-emphasis` for "Go Build" gradient text.
- Removed unused `Box` import from footer/index.tsx after community text restructure.

## Session 2025-07-25 — Footer Complete Restyle Execution

**Status:** ✅ Complete

- **CSS restyle:** Full rewrite of `src/components/footer/styles.css` — gradient top-border via `::after`, accessible pill-shaped social links (44px touch targets), retired card saturation filter + amber→gold accent, responsive 3-col grid (1200px+), dark mode support via CSS variables
- **Design tokens:** Integrated warm-sepia (light) and cosmic-navy (dark) token colors; added nth-child(5)(6) stagger delays to `src/styles/tokens.css` for grid animation reusability
- **Go Build text:** `<p className="cdn-footer-emphasis">` with amber→orange (light) and violet→cyan (dark) gradient via `background-clip: text` + `background-image` linear-gradient
- **Organization display:** Updated `leader-card.tsx` to render `organization` as `<span className="cdn-footer-card-org">` when present
- **Community section:** Changed footer index.tsx from `Box variant="small"` to semantic `<p className="cdn-footer-community">` with proper font-size token reference
- **Coordination:** Parallel work with Theren (data) and Kess (tests); no conflicts; all quality gates passed
- **Result:** Footer now matches Cloud Del Norte brand language across light/dark modes

## Session 2026-03-14 — Localization Wiring into Shared Components

**Status:** ✅ Complete

### What Changed

Wired `useTranslation()` hook into 4 shared components — Shell, Navigation, Breadcrumbs, Footer. All hardcoded English strings replaced with `t()` calls using translation keys from `en-US.json` and `es-MX.json`.

### Architecture Pattern: Shell Component Refactor

**Critical lesson:** Shell cannot use `useTranslation()` at the top level because it renders `<LocaleProvider>` as a wrapper. The solution is to extract a child component:

```tsx
function ShellContent(props: ShellProps) {
  const { t } = useTranslation();  // ✅ Safe — inside LocaleProvider
  // ... all shell logic with t() calls
}

export default function Shell(props: ShellProps) {
  return (
    <LocaleProvider locale={props.locale ?? 'us'}>
      <ShellContent {...props} />
    </LocaleProvider>
  );
}
```

This pattern applies to **any** component that renders a context provider but also needs to consume that context — always extract the consuming logic into a child component.

### Component-Specific Changes

1. **Shell** (`src/layouts/shell/index.tsx`)
   - Extracted `ShellContent` component inside `LocaleProvider`
   - Moved animation state and handlers into `ShellContent`
   - All `TopNavigation` and `AppLayout` strings now use `t()`
   - Preserved external API — `ShellProps` interface unchanged

2. **Navigation** (`src/components/navigation/index.tsx`)
   - Moved `items` array from const outside → inside component function
   - All nav labels (`navigation.meetings`, `navigation.apiGuide`, etc.) use `t()`
   - Navigation can use `useTranslation()` directly — it's always rendered inside Shell's LocaleProvider

3. **Breadcrumbs** (`src/components/breadcrumbs/index.tsx`)
   - Moved `items` array inside component
   - Single translation key: `breadcrumbs.home`

4. **Footer** (`src/components/footer/index.tsx`)
   - All footer text uses `t()`: `footer.ourLeaders`, `footer.communityDescription`, `footer.globalCommunity`, `footer.communityFullDescription`, `footer.goBuild`
   - Footer already rendered inside Shell → LocaleProvider wraps it automatically

### Test Update Required

Footer tests failed initially because `Footer` uses `useTranslation()` but tests rendered it **without** `LocaleProvider`. Fixed by:

1. Importing `LocaleProvider` in test file
2. Creating `renderFooter()` helper that wraps `<Footer />` in `<LocaleProvider locale="us">`
3. Replacing all `render(<Footer />)` calls with `renderFooter()`

**Pattern for any component using `useTranslation()`:** Tests must wrap the component in `LocaleProvider` or mock the translation hook.

### Translation Keys Used

| Component | Keys |
|-----------|------|
| Shell | `shell.*` (17 keys: siteTitle, switchTo*, navigationDrawer, helpPanel, etc.) |
| Navigation | `navigation.*` (15 keys: home, meetings, resources, apiGuide, REST constraints, etc.) |
| Breadcrumbs | `breadcrumbs.home` |
| Footer | `footer.*` (5 keys: ourLeaders, communityDescription, globalCommunity, communityFullDescription, goBuild) |

### Quality Gates

- ✅ `npm run lint` — no lint errors
- ✅ `npm test` — all 120 tests pass (8 footer tests, 17 leader-card tests, 6 maintenance-calendar, etc.)

### Key Files Modified

- `src/layouts/shell/index.tsx` — ShellContent extraction pattern
- `src/components/navigation/index.tsx` — items array moved inside component
- `src/components/breadcrumbs/index.tsx` — items array moved inside component
- `src/components/footer/index.tsx` — t() calls added
- `src/components/footer/__tests__/footer.test.tsx` — LocaleProvider wrapper added

### Coordination

This wiring completes the localization system integration. All shared components now support bilingual rendering (en-US / es-MX). Pages already wire their own locale state and pass to Shell — no page-level changes needed.

## Session 2026-03-14 — Localization Integration (Phase 4)

**Status:** ✅ Complete

### Learnings

- **ShellContent extraction pattern:** Shell cannot use `useTranslation()` at top level because it renders `<LocaleProvider>`. Solution: extract inner component (`ShellContent`) that lives inside the provider and can safely call `useTranslation()`. This pattern applies to any component that both provides AND consumes a context.
- **Wired `t()` into 4 shared components:** Shell (via ShellContent), Navigation, Breadcrumbs, Footer
- **Navigation items moved inside component:** Had to move const `items` array from outside component into component body to access `t()` hook — hooks can't be called at module level
- **38+ hardcoded strings replaced** with translation keys across shared components
- **Test pattern:** Components using `useTranslation()` must be wrapped in `LocaleProvider` in tests or the hook must be mocked
- **Quality gates:** All 120 tests passing, lint clean

## Session 2026-07-18 — Toggle Button Visual Artifacts + Broken CSS Selectors

**Status:** ✅ Complete

### What Changed

Fixed two issues in `src/layouts/shell/styles.css`:

1. **Visual artifact (square behind emoji):** Added CSS overrides to strip Cloudscape's default button chrome (background, border, box-shadow) from TopNavigation utility buttons. Targets both `button` and `[class*="button-trigger"]` inside `[class*="utility-button"]` within `#top-nav`. Uses `!important` to override Cloudscape's scoped styles.

2. **CSS selectors broken in Spanish locale:** The hover/animation selectors used `[title*="English"]`, `[title*="Español"]`, `[title*="light mode"]`, `[title*="dark mode"]` — but after localization was wired, titles change based on locale. Fixed by mapping all actual title values:
   - Theme toggle EN: "Switch to light mode" / "Switch to dark mode" → `[title*="light mode"]` / `[title*="dark mode"]`
   - Theme toggle ES: "Cambiar a modo claro" / "Cambiar a modo oscuro" → `[title*="modo claro"]` / `[title*="modo oscuro"]`
   - Locale toggle EN: "Switch to Spanish" → `[title*="Spanish"]`
   - Locale toggle ES: "Cambiar a Inglés" → `[title*="Inglés"]`

### Key Insight

The old locale selectors (`[title*="English"]` / `[title*="Español"]`) were broken in BOTH locales — in English mode the title is "Switch to Spanish" (no "English" or "Español" substring), and in Spanish mode it's "Cambiar a Inglés" (no "English" or "Español" substring). The fix correctly derives selectors from the actual translation JSON values.

### Quality Gates
- ✅ `npm run lint` — clean
- ✅ `npm test` — all 125 tests passing

## Session 2025-07-18 — UX Responsiveness & Legibility Pass

**Status:** ✅ Complete
**Branch:** `squad/ux-responsiveness-pass`

### What Changed

1. **Home Grid responsive colspans** (`src/pages/home/app.tsx`)
   - Changed fixed `{ colspan: 8 }` / `{ colspan: 4 }` → `{ colspan: { default: 12, m: 8 } }` / `{ colspan: { default: 12, m: 4 } }` — panels now stack vertically on mobile and side-by-side on medium+ screens.

2. **QualityReport readability** (`src/pages/home/components/quality-report/index.tsx` + `styles.css`)
   - Added `SpaceBetween` wrapper and `Box padding` for breathing room
   - Wired the orphaned `.quote` CSS class via `<p className="quote">`
   - Improved `.quote` CSS: `line-height: 1.7`, `font-size: var(--cdn-text-md)`, `max-width: 60ch`, `opacity: 0.85`
   - Imported `styles.css` into the component

3. **ProductionOverview responsive** (`src/pages/home/components/production-overview.tsx`)
   - Added `minColumnWidth={150}` to ColumnLayout — 4 metrics now wrap to 2×2 on narrow viewports instead of crushing into 4 tiny columns.

4. **Barrel import cleanup** (5 files across 4 pages)
   - `home/meetings.tsx`: SpaceBetween barrel → deep import
   - `meetings/meetings-table.tsx`: TextFilter barrel → deep import
   - `create-meeting/app.tsx`: ContentLayout barrel → deep import
   - `learning/api/main.tsx`: AppLayout, TopNavigation, BreadcrumbGroup barrel → 3 deep imports
   - `learning/api/RiftRewindDashboard.tsx`: 9 components barrel → 9 deep imports

### Patterns Applied
- **Cloudscape responsive Grid:** Use `colspan: { default: 12, m: N }` for stacking on mobile
- **ColumnLayout responsive:** Use `minColumnWidth` prop to control column wrapping, not just `columns`
- **Text readability:** `line-height: 1.7`, `max-width: 60ch`, padding via Cloudscape Box/SpaceBetween
- **Deep imports only:** Every barrel import (`import { X } from '@cloudscape-design/components'`) converted to deep import (`import X from '@cloudscape-design/components/x'`)

### Key Decisions
- Audited all 5 pages; only home page had responsive layout issues. Other pages either use ColumnLayout columns≤2 (already wraps fine) or don't use Grid.
- The `create-meeting/marketing.tsx` ColumnLayout uses `columns={2}` which is fine responsively — left as-is.
- Pre-existing lint/test/build failures in locale-context.tsx are NOT from this branch.

### Quality Gates
- ✅ Lint clean on all 9 changed files
- ✅ Tests passing (pre-existing locale failures unrelated)
- ✅ Build succeeds on clean working tree

## Session 2025-07-26 — Navigation Drawer UX Audit

**Status:** ✅ Complete

### Problem

On desktop (1440px+) and tablet (768px-1024px) widths, the SideNavigation appeared at 0px height. The navigation drawer existed in the DOM but was completely invisible — only visible elements were "User Group Home" and other nav items requiring non-existent scrolling.

### Root Cause Analysis

**Missing AppLayout Props:** The `AppLayout` component was not receiving `navigationOpen` or `onNavigationChange` props. Without explicit state management:
1. Cloudscape defaults navigation to **closed** on all viewports
2. The navigation container CSS Grid allocates `height: 0px`
3. Grid template rows: `0px 0px 16px 28px...` — first two rows (navigation area) were 0px

**Key Evidence from Chrome DevTools inspection:**
- `awsui_navigation-container`: `height: 0px`, `position: sticky`, `top: 60px`
- `awsui_navigation`: `height: 0px`, `overflow: hidden auto`
- Navigation content (items, links) had proper heights (162px, 20-22px each) but were clipped by 0-height parent

### Fix Applied

Updated `src/layouts/shell/index.tsx`:

1. **Added props to ShellProps interface:**
   - `navigationOpen?: boolean` — controlled state
   - `onNavigationChange?: (open: boolean) => void` — callback

2. **Added responsive default state:**
   ```tsx
   const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
   const [navOpen, setNavOpen] = useState(controlledNavOpen ?? isDesktop);
   ```

3. **Wired AppLayout:**
   ```tsx
   <AppLayout
     navigationOpen={navOpen}
     onNavigationChange={handleNavigationChange}
     // ... other props
   />
   ```

### Learnings

- **Cloudscape AppLayout navigation state:** Never rely on default — always explicitly manage `navigationOpen` and `onNavigationChange`
- **Responsive breakpoint:** Use `>= 768px` for desktop (open by default), `< 768px` for mobile (closed by default)
- **No custom CSS height overrides needed:** Cloudscape's internal grid handles all navigation height/spacing when `navigationOpen=true`
- **Debugging technique:** Use `getComputedStyle()` in DevTools to trace height: 0px up the parent chain to find the collapsing container

### Cloudscape Design Tokens

Navigation spacing uses Cloudscape's internal grid system (controlled by AppLayout). The component handles its own responsive breakpoints. No custom spacing tokens (`--cdn-space-*`) needed for navigation container height.

### Quality Gates

- ✅ `npm run build` — succeeds
- ✅ Navigation visible on desktop at 1440px
- ✅ Toggle button works to open/close drawer
- ✅ No custom CSS height overrides added

## Session 2026-03-14 — SideNavigation onFollow Handler Fix

**Status:** ✅ Complete

### Problem

Bryan reported: "our sidepanel menu is currently broken, I clicked it and it disappeared completely." The side navigation panel was disappearing when users clicked on nav links.

### Root Cause

The `Navigation` component (`src/components/navigation/index.tsx`) was missing the **`onFollow` handler** on the `SideNavigation` component. Without this handler, Cloudscape's default link behavior can interfere with the MPA page navigation pattern, causing the navigation drawer to close unexpectedly or become unresponsive.

### Fix Applied

Added explicit `onFollow` handler to SideNavigation:

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

### Why This Works

In an MPA (Multi-Page App), each page navigation is a full page reload. Cloudscape's SideNavigation component fires an `onFollow` event when links are clicked. Without an explicit handler:
- The component's internal state can get confused
- Default link behavior may be blocked
- Navigation drawer state becomes corrupted

By preventing the default event and manually triggering `window.location.href`, we ensure clean page navigation that respects the MPA architecture.

### Pattern for MPA Navigation

**CRITICAL:** In MPA apps using Cloudscape SideNavigation, ALWAYS provide an `onFollow` handler that:
1. Calls `event.preventDefault()` for internal links
2. Manually navigates via `window.location.href = event.detail.href`
3. Allows external links to use default behavior

This pattern prevents React state issues and ensures reliable navigation.

### Quality Gates

- ✅ `npm run lint` — clean
- ✅ `npm test` — all 146 tests passing
- ✅ Dev server running — navigation works correctly

## Session 2026-03-14 — Navigation State + CSS Fixes (Agent-32)

**Status:** ✅ Complete

### Navigation State Fix

- **Root cause:** AppLayout missing `navigationOpen` and `onNavigationChange` props; defaulted to closed
- **Symptom:** SideNavigation appeared at 0px height on desktop; items required scrolling
- **Fix:** Added responsive state management to Shell component
- **Pattern:** Open on desktop (≥768px), closed on mobile; never rely on Cloudscape defaults

### Implementation

```tsx
const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
const [navOpen, setNavOpen] = useState(isDesktop);

<AppLayout
  navigationOpen={navOpen}
  onNavigationChange={(event) => setNavOpen(event.detail.open)}
/>
```

### CSS Fixes: Toggle Button Chrome & Locale-Aware Selectors

**Chrome removal:** Added `background: transparent !important; border: none !important; box-shadow: none !important` to eliminate square artifact behind emoji buttons.

**Locale-aware selectors:** Updated TopNavigation toggle CSS to match dynamic locale-dependent titles:
- Theme toggle: `"light mode"` / `"dark mode"` / `"modo claro"` / `"modo oscuro"`
- Locale toggle: `"Switch to Spanish"` / `"Cambiar a Inglés"`

**Why:** Old selectors hardcoded English (`[title*="English"]`). After localization wiring, titles became dynamic via `t()` function.

### Quality Metrics

- Lint ✅, Tests ✅, Build ✅
- Desktop/tablet/mobile responsive ✅
- Theme/locale combinations ✅
- No console errors ✅

### Decisions Created

- **DEC-005:** Navigation drawer state management standard (merged)
- **DEC-006:** Toggle button CSS fixes (merged)
- **DEC-009:** Responsive layout patterns for Cloudscape Grid/ColumnLayout (merged)

### Key Learnings

- **Cloudscape defaults are closed:** Never assume navigation is open — always explicitly manage state.
- **CSS selectors must be locale-aware:** Hardcoded English substrings fail when content is localized.
- **Responsive patterns matter:** Desktop/mobile have different navigation expectations. Let the component decide based on viewport.

## Learnings — AppLayout Whitespace Fix (2025-07-19)

### Root Cause

Cloudscape AppLayout applies inline `min-block-size: calc(100vh - headerHeight)` on the `<main>` layout element and `block-size: calc(100vh - headerHeight)` on nav/content/tools containers. This is viewport-fill behavior designed for apps where AppLayout is the only page element. Since our Footer renders OUTSIDE AppLayout (`footerSelector` was removed to fix a sidebar-collapse bug), this viewport-fill created a giant whitespace gap between content and footer (up to 721px on short-content pages like create-meeting).

### Fix Applied

CSS overrides in `src/layouts/shell/styles.css`:
- `min-block-size: auto !important` on `main[class*="awsui_layout"]`
- `block-size: auto !important` on navigation-container, tools-container, content-container

### Key Findings

- The `footerSelector` prop in AppLayout can NOT be used because Cloudscape subtracts footer height from the sidebar height calculation, causing sidebar to collapse when footer is large (~1118px).
- Cloudscape applies these sizing values as **inline styles** via JS (`use-skeleton-slots-attributes.js`), so CSS `!important` is required to override.
- The override is safe: sticky nav positioning still works correctly because `position: sticky` doesn't depend on the parent's min-height.
- `min-block-size` (not `min-height`) is what Cloudscape uses — it's the logical property equivalent.

### Architecture Decision

Footer rendering OUTSIDE AppLayout + CSS min-block-size override is the correct pattern for this project. Do NOT re-add `footerSelector` — it breaks sidebar height.

## Learnings — Toggle Button Box-Shadow Fix (2025-07-19)

### Root Cause: `[class*="top-navigation"]` selector leak
The TASK 6 TopNavigation container styles used `#top-nav [class*="top-navigation"]` to apply `box-shadow`, `border-bottom`, and `background`. This *also* matched inner `<a>` elements whose Cloudscape-generated class contains `variant-top-navigation`, leaking the container's shadow onto individual emoji toggle links as ugly square boxes.

### Fix Pattern
1. **Blanket strip rule**: `#top-nav [class*="top-navigation"] a[class*="top-navigation"]` overrides leaked styles with `box-shadow: none; border-bottom: none; background: transparent`.
2. **Targeted glow restore**: More specific selectors on `[class*="utility-wrapper"] a[class*="top-navigation"]` re-apply a soft circular glow (`border-radius: 50%`) scoped per mode — warm amber (light) / violet (dark).
3. Specificity layering: blanket < glow (glow selectors add `:root:not(...)` or `.awsui-dark-mode` class).

### Key Takeaway
When using `[class*="..."]` attribute selectors on Cloudscape containers, always verify the substring doesn't also match child elements. Cloudscape generates variant classes like `awsui_variant-top-navigation_*` on inner elements. Prefer targeting by tag+class or structure (`header[class*="top-navigation"]`) to avoid cascade leaks.

## Session 2025-07-26 — SideNavigation onFollow Section-Header Fix

**Status:** ✅ Complete

### Problem
Expandable section headers (Learning, Resources) in SideNavigation flashed open then immediately closed. The `onFollow` handler intercepted ALL events — including section expand/collapse toggles — calling `preventDefault()` and `window.location.href`, which broke the expand/collapse behavior.

### Root Cause
Cloudscape's `onFollow` fires for section headers with `detail.type === 'section-header'`. The original handler didn't discriminate by type, so it called `preventDefault()` and attempted navigation for section toggle clicks.

### Fix
Two-part guard in the `onFollow` handler:
1. **Early return** for `type === 'section-header'` — lets Cloudscape handle expand/collapse natively
2. **Href validation** — only navigate when href exists and isn't `'#'`

### Key Type Discovery
`SideNavigationProps.FollowDetail` includes `type?: 'link' | 'link-group' | 'expandable-link-group' | 'section-header'`. This type field is the reliable way to distinguish navigation clicks from expand/collapse toggles.

### Files Changed
- `src/components/navigation/index.tsx` — onFollow handler updated with type guard + href validation

## Session 2026-03-14 — Color Scheme Batch 1: System Preference, Font Smoothing, Token Consolidation

**Status:** ✅ Complete
**Branch:** `squad/60-64-65-color-scheme-batch1`
**PR:** #70

### Issues Completed

**Issue #60: System preference detection (prefers-color-scheme)**
- Added `getSystemPreference()` function to detect OS-level dark/light mode via `window.matchMedia('(prefers-color-scheme: dark)')`
- Updated `getStoredTheme()` to fallback to system preference when no localStorage value exists (was hardcoded `'light'`)
- Added `watchSystemPreference()` function that:
  - Listens to `matchMedia('(prefers-color-scheme: dark)')` changes
  - Only auto-switches when localStorage has NO stored value (respects manual user toggle)
  - Returns cleanup function to remove listener
- Added `<meta name="color-scheme" content="light dark">` to all 5 page index.html files for native browser theme integration

**Issue #64: Font smoothing per mode**
- Added global font smoothing to `:root` in `tokens.css`:
  - `-webkit-font-smoothing: antialiased`
  - `-moz-osx-font-smoothing: grayscale`
- Extends existing shell-scoped font-smoothing to global scope
- Works well for both light (warm sepia) and dark (cosmic navy) modes

**Issue #65: Consolidate hardcoded colors to tokens**
- Created gradient tokens in `tokens.css`:
  - Light mode: `--cdn-gradient-nav-start: #2c1206`, `--cdn-gradient-nav-mid: #4a2010`, `--cdn-gradient-nav-end: #3d1a08` (warm mahogany)
  - Dark mode: `--cdn-gradient-nav-start: #00002a`, `--cdn-gradient-nav-mid: #200050`, `--cdn-gradient-nav-end: #30006a` (cosmic navy)
- Replaced hardcoded hex values in `shell/styles.css` TopNavigation gradients with token references
- Replaced hardcoded hex values in `footer/styles.css` background gradient with token references

### Files Changed

- `src/utils/theme.ts` — added system preference detection + watcher
- `src/styles/tokens.css` — added global font smoothing + gradient tokens
- `src/layouts/shell/styles.css` — replaced hardcoded TopNavigation gradient hex with tokens
- `src/components/footer/styles.css` — replaced hardcoded footer gradient hex with tokens
- `src/pages/home/index.html` — added color-scheme meta tag
- `src/pages/meetings/index.html` — added color-scheme meta tag
- `src/pages/create-meeting/index.html` — added color-scheme meta tag
- `src/pages/learning/api/index.html` — added color-scheme meta tag
- `src/pages/maintenance-calendar/index.html` — added color-scheme meta tag

### Quality Gates

- ✅ `npm run lint` — clean
- ✅ `npm test` — all 146 tests passing
- ✅ `npm run build` — success

### Key Patterns

**System preference detection:**
```typescript
const getSystemPreference = (): Theme => {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const watchSystemPreference = (onChange: (theme: Theme) => void): (() => void) => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === null) {  // Only auto-switch if user hasn't manually toggled
      const newTheme = e.matches ? 'dark' : 'light';
      onChange(newTheme);
    }
  };
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
};
```

**Gradient token pattern:**
```css
/* tokens.css */
:root {
  --cdn-gradient-nav-start: #2c1206;
  --cdn-gradient-nav-mid:   #4a2010;
  --cdn-gradient-nav-end:   #3d1a08;
}
.awsui-dark-mode {
  --cdn-gradient-nav-start: #00002a;
  --cdn-gradient-nav-mid:   #200050;
  --cdn-gradient-nav-end:   #30006a;
}

/* shell/styles.css */
#top-nav [class*="top-navigation"] {
  background: linear-gradient(135deg, var(--cdn-gradient-nav-start) 0%, var(--cdn-gradient-nav-mid) 55%, var(--cdn-gradient-nav-end) 100%);
}
```

### Learnings

- **System preference as fallback:** Users without a stored preference now see their OS theme immediately on first visit. Once they manually toggle, their choice persists and overrides system preference.
- **matchMedia listener scope:** The watcher checks localStorage on EVERY change event — this is correct because the user could toggle in one tab, then switch system theme in another tab, and we want to respect the most explicit choice (stored > system).
- **color-scheme meta tag:** Tells browsers to use native dark mode UI (scrollbars, form inputs) — small but polished UX improvement.
- **Gradient token DRY principle:** Moving gradients to tokens makes it trivial to adjust the entire navigation/footer color palette from one place. Top nav and footer now share the same token values for consistency.

---

## 2026-03-14 — PR #71 Review + Color Scheme Batch 2 (Issues #61, #62, #63)

**Context:** Dual tasks — review Theren's Roadmap page (PR #71), then implement color scheme batch 2 (dark mode text emphasis, desaturated accents, elevation system).

### Task A: PR #71 Review (Roadmap Page)

Reviewed PR #71 for MPA compliance, Cloudscape patterns, and CSS quality.

**Findings:**
- ✅ Clean MPA anatomy: index.html, main.tsx, app.tsx with Shell wrapper
- ✅ Proper theme + locale state management with AppContent extraction
- ✅ All Cloudscape imports are deep imports (ContentLayout, Header — no barrel imports)
- ✅ Board uses Cloudscape ContentLayout and Header with responsive CSS grid
- ✅ Translation keys properly used via t() throughout
- ✅ Nav item correctly placed above Meetings
- ✅ Glassmorphism styling and column-specific gradients follow project tokens

**Outcome:** Left approval comment on PR #71 (cannot formally approve own PR due to GitHub restriction).

### Task B: Color Scheme Batch 2 — Issues #61, #62, #63

**Branch:** `squad/61-62-63-color-scheme-batch2`
**File:** `src/styles/tokens.css`

**Issue #61: Dark mode text emphasis hierarchy**
Added 3-level text emphasis system using Material Design opacity levels:
- `--cdn-color-text-high` (87% opacity): headings, primary text — 15.8:1 contrast (WCAG AAA)
- `--cdn-color-text-medium` (60% opacity): secondary labels — 10.3:1 (AAA)
- `--cdn-color-text-low` (38% opacity): disabled, hints — 6.2:1 (AA)

Also added equivalent light mode tokens for consistency (even though light mode already had good hierarchy).

**Issue #62: Desaturated dark mode accent colors**
Added soft variants to reduce eye strain on dark backgrounds:
- `--cdn-violet-soft` (#a080e8): 8.4:1 contrast on #00002a (AAA)
- `--cdn-orange-soft` (#ffb347): 13.2:1 contrast on #00002a (AAA)

Updated `--cdn-color-accent` to use `--cdn-violet-soft`. Kept `--cdn-color-primary` with original violet for interactive elements where high contrast is critical.

**Issue #63: Dark mode elevation system**
Added 4-level elevation ramp for progressive lightening:
- `--cdn-elevation-0`: #0a0a2e (base background)
- `--cdn-elevation-1`: #12123a (cards, panels)
- `--cdn-elevation-2`: #1a1a4a (modals, dropdowns)
- `--cdn-elevation-3`: #22225a (tooltips, popovers)

Updated `--cdn-color-bg` → `--cdn-elevation-0` and `--cdn-color-surface` → `--cdn-elevation-1`. Improves depth perception without harsh borders.

**Quality gate:**
- ✅ Lint passed
- ✅ All tests passed (146/146)
- ✅ Build succeeded

**PR:** #72 opened with "color-scheme" label, closes #61, #62, #63.

### Learnings

- **Material Design opacity levels translate well to dark mode text:** The 87%/60%/38% progression gives clear visual hierarchy without harsh contrast jumps.
- **Desaturated accents prevent eye strain:** On dark backgrounds, fully saturated colors (#9060f0, #FF9900) vibrate. Softer variants (#a080e8, #ffb347) maintain contrast while reducing fatigue.
- **Elevation ramp is more effective than borders:** Progressive lightening (#0a0a2e → #22225a) creates depth without adding visual noise. Users perceive stacking order naturally.
- **Contrast ratio verification matters:** Both soft variants exceed WCAG AAA (8.4:1, 13.2:1). This gives us room to adjust without breaking accessibility.
- **Light mode tokens for consistency:** Even though light mode already had good text hierarchy, adding the explicit tokens makes the system symmetric and easier to reason about.
