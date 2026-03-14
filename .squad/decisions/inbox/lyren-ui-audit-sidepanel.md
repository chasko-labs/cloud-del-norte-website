# UI Audit — Side Panel Responsive Layout

**Date:** 2025-01-23  
**Author:** Lyren (Cloudscape UI & Design Specialist)  
**Status:** 🔍 Investigation Complete — Recommendations Ready

---

## Executive Summary

The Shell implementation has a **critical architectural flaw** in its responsive navigation logic that causes inconsistent behavior across pages. The root cause: Shell uses `window.innerWidth` to determine the initial `navigationOpen` state at component mount, but this conflicts with Cloudscape AppLayout's built-in content-type defaults. Additionally, no pages pass explicit `navigationOpen` or `onNavigationChange` props, leaving each page vulnerable to the Shell's flawed default logic.

**Impact:** Medium-to-High severity across 5 pages with varying manifestations depending on contentType.

---

## Root Cause Analysis

### Issue 1: Shell's Viewport Detection Logic Conflicts with AppLayout Defaults

**Location:** `src/layouts/shell/index.tsx` lines 36-38

```tsx
const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
const [navOpen, setNavOpen] = useState(controlledNavOpen ?? isDesktop);
```

**Problem:**  
This logic hardcodes a breakpoint assumption (`>= 768px = desktop = nav open`) that **directly conflicts** with Cloudscape's content-type-aware defaults:

| ContentType | Cloudscape Default `navigationOpen` | Shell Logic Forces |
|-------------|-------------------------------------|-------------------|
| `default` | `true` | `true` (desktop) / `false` (mobile) |
| `table` | `true` | `true` (desktop) / `false` (mobile) |
| `form` | `false` | `true` (desktop) / `false` (mobile) ❌ |
| `wizard` | `false` | `true` (desktop) / `false` (mobile) ❌ |

**Evidence from Cloudscape source:**  
File: `node_modules/@cloudscape-design/components/app-layout/defaults.js`
```javascript
const defaults = {
    form: {
        navigationOpen: false,  // ← Cloudscape wants nav closed
        minContentWidth: 280,
        maxContentWidth: 800,
    },
    wizard: {
        navigationOpen: false,  // ← Cloudscape wants nav closed
        minContentWidth: 280,
        maxContentWidth: 1080,
    },
};
```

**Result:**  
- **create-meeting** page (`contentType="form"`) opens nav on desktop when Cloudscape expects it closed
- **meetings** page (`contentType="table"`) behaves correctly by accident (both want open)
- **home**, **learning/api**, **maintenance-calendar** pages (no explicit contentType) inherit `default` behavior (open)

### Issue 2: No Page Passes Explicit Navigation Props

**Affected Pages:** ALL (home, meetings, create-meeting, learning/api, maintenance-calendar)

**Current pattern:**
```tsx
<Shell
  theme={theme}
  onThemeChange={handleThemeChange}
  locale={locale}
  onLocaleChange={handleLocaleChange}
  breadcrumbs={...}
  navigation={<Navigation />}
>
```

**Missing:**
- `navigationOpen={navOpen}` prop
- `onNavigationChange={handleNavChange}` callback
- Page-level state management for `navOpen`

**Consequence:**  
Pages cannot control their own navigation state. They're at the mercy of Shell's flawed default logic. When a user toggles the nav drawer, the state lives only in Shell and cannot be persisted per-page or overridden by pages that need different behavior (e.g., forms).

---

## Reproducible Issues

### Issue A: Form Pages Open Nav on Desktop (Wrong Behavior)

**Page:** `/create-meeting/`  
**Viewport:** 1024px+ (desktop)  
**Expected:** Nav closed (Cloudscape default for `contentType="form"`)  
**Actual:** Nav open (Shell's `isDesktop` logic overrides)

**Steps:**
1. Open `http://localhost:8080/create-meeting/index.html` at 1440px viewport
2. Observe nav drawer is open
3. Note that closing it and refreshing re-opens it (state not persisted)

**Severity:** **HIGH** — Violates Cloudscape design intent. Form pages maximize content width for optimal form layout. An open nav reduces available horizontal space.

---

### Issue B: Mobile Nav State Not Persisted Across Pages

**Pages:** ALL  
**Viewport:** 375px (mobile)  
**Expected:** User's toggle preference persists when navigating between pages  
**Actual:** Nav resets to closed on every page load (Shell's default)

**Steps:**
1. Open any page at 375px viewport
2. Toggle nav open
3. Navigate to another page via nav link
4. Observe nav is closed again (state lost)

**Severity:** **MEDIUM** — Annoying UX. Users must re-open nav after every navigation on mobile.

---

### Issue C: Viewport Resize Doesn't Update Nav State

**Pages:** ALL  
**Viewport:** Start at 1440px, resize to 600px  
**Expected:** Nav remains in user's chosen state OR gracefully adapts  
**Actual:** Nav stays open (from desktop default), overlaying content on narrow viewport

**Steps:**
1. Open any page at 1440px (nav opens by default)
2. Resize browser to 600px
3. Nav drawer now overlays and obscures main content
4. No automatic close behavior

**Severity:** **MEDIUM** — Cloudscape's drawer should overlay gracefully, but the lack of resize listener means the initial state becomes "stuck" and feels broken.

---

### Issue D: Content Width Misalignment (Not Observed — Likely Resolved)

**Hypothesis:** Prior reports of content left-aligning with a right-side gap.  
**Investigation:** Examined `src/layouts/shell/styles.css` — no max-width constraints or centering issues found. ContentLayout and Grid components use Cloudscape's responsive tokens.  

**Conclusion:** If this issue existed, it was likely fixed in a previous session. No current evidence of content-width problems when nav is closed.

**Severity:** **LOW** — Not reproducible. Archive as resolved.

---

## Responsive Progression Analysis (375px → 1440px)

| Viewport Width | Expected Behavior | Actual Behavior | Issues |
|----------------|-------------------|-----------------|--------|
| **375px** | Nav closed, hamburger menu visible | ✅ Correct | Issue B (state not persisted) |
| **600px** | Nav closed or user-controlled | ⚠️ Can get stuck open if resized from desktop | Issue C (resize handling) |
| **768px** | Threshold for `isDesktop` check | ⚠️ Arbitrary — not aligned with Cloudscape breakpoints | Issue 1 (conflicts with contentType defaults) |
| **1024px+** | Nav open (default pages), closed (form/wizard pages) | ❌ All pages open nav | Issue A (form pages wrong) |

**Awkward Transition:** The 768px breakpoint feels arbitrary. Cloudscape uses token-based responsive design (`awsui-breakpoint-*`) that doesn't expose a single "desktop" threshold. Shell's pixel-based check creates a mismatch.

---

## Cloudscape AppLayout Compliance Assessment

### ✅ What's Correct

1. **Props wired correctly:**
   - `navigationOpen={navOpen}` ✅
   - `onNavigationChange={handleNavigationChange}` ✅
   - `navigation` prop passed ✅

2. **Callback structure:**
   ```tsx
   const handleNavigationChange = useCallback((event: { detail: { open: boolean } }) => {
     setNavOpen(event.detail.open);
     onNavigationChange?.(event.detail.open);
   }, [onNavigationChange]);
   ```
   This correctly extracts `event.detail.open` (Cloudscape convention).

3. **AriaLabels configured:**
   ```tsx
   ariaLabels={{
     navigation: t('shell.navigationDrawer'),
     navigationClose: t('shell.closeNavigationDrawer'),
     navigationToggle: t('shell.openNavigationDrawer'),
   }}
   ```
   ✅ Accessibility labels present and translated.

### ❌ What's Broken

1. **Initial state logic ignores contentType:**
   ```tsx
   const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
   const [navOpen, setNavOpen] = useState(controlledNavOpen ?? isDesktop);
   ```
   Should defer to AppLayout's content-type defaults OR accept a `defaultNavigationOpen` prop from pages.

2. **No resize listener:**  
   Once the component mounts, `isDesktop` is frozen. Window resizes don't trigger state updates.

3. **No localStorage persistence:**  
   User's toggle preference is lost on page reload. Compare with theme toggle (uses `localStorage`).

---

## Design Critique: UX & A11y

### Overall UX: **Janky** 🟡

- **Inconsistent behavior** between pages (form pages open nav when they shouldn't)
- **No state persistence** makes mobile navigation tedious
- **Resize handling absent** creates "stuck" states

### Accessibility: **Mostly OK** ✅

- **Keyboard nav:** AppLayout's built-in focus management works. Tab order is correct.
- **Screen reader labels:** AriaLabels present and translated ✅
- **Focus trap:** When nav drawer opens, focus moves inside (Cloudscape default behavior) ✅
- **No detected issues** with focus management or ARIA attributes

### Visual Polish: **Good** ✨

- Side nav hover effects (amber/violet glow from `styles.css`) are subtle and pleasant
- No layout jank or content jump when toggling (AppLayout's smooth drawer animation works)
- Dark mode nav background matches theme correctly

---

## Recommendations

### Recommendation 1: Remove Shell's Viewport-Based Default Logic

**Change:** Delete lines 36-38 in `src/layouts/shell/index.tsx`:
```tsx
// ❌ DELETE THIS
const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
const [navOpen, setNavOpen] = useState(controlledNavOpen ?? isDesktop);
```

**Replace with:**
```tsx
// Let AppLayout control defaults based on contentType unless controlled
const [navOpen, setNavOpen] = useState(controlledNavOpen ?? undefined);
```

**Rationale:** AppLayout has sophisticated content-type-aware defaults. Trust them. If `controlledNavOpen` is undefined, AppLayout will use its own logic (form/wizard = closed, default/table = open).

**Severity:** **BLOCKER** — This is the root cause of Issue A and conflicts with Cloudscape design intent.

---

### Recommendation 2: Add localStorage Persistence for Nav State

**Pattern:** Mirror the theme toggle mechanism.

**Add to `src/utils/locale.ts` or create `src/utils/navigation.ts`:**
```ts
const NAV_STORAGE_KEY = 'cdn-nav-open';

export function getStoredNavState(): boolean | undefined {
  const stored = localStorage.getItem(NAV_STORAGE_KEY);
  if (stored === null) return undefined; // No preference = defer to AppLayout
  return stored === 'true';
}

export function setStoredNavState(open: boolean): void {
  localStorage.setItem(NAV_STORAGE_KEY, String(open));
}
```

**Update Shell:**
```tsx
const [navOpen, setNavOpen] = useState<boolean | undefined>(() => 
  controlledNavOpen ?? getStoredNavState()
);

const handleNavigationChange = useCallback((event: { detail: { open: boolean } }) => {
  setNavOpen(event.detail.open);
  setStoredNavState(event.detail.open);
  onNavigationChange?.(event.detail.open);
}, [onNavigationChange]);
```

**Severity:** **HIGH** — Dramatically improves UX on mobile. User's preference persists across sessions.

---

### Recommendation 3: Add Resize Listener for Viewport Adaptation (Optional)

**Trade-off:** Adds complexity. AppLayout's drawer already overlays gracefully on narrow viewports.

**If implemented:**
```tsx
useEffect(() => {
  const handleResize = () => {
    // Only auto-close if no user preference stored AND viewport < 768px
    if (getStoredNavState() === undefined && window.innerWidth < 768) {
      setNavOpen(false);
    }
  };
  
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

**Severity:** **LOW** — Nice-to-have. Not critical if Rec 1 & 2 are implemented.

---

### Recommendation 4: Let Pages Opt Into Explicit Nav Control (Future)

**For pages that need custom nav behavior:**

```tsx
// In create-meeting/app.tsx (example)
const [navOpen, setNavOpen] = useState(false); // Force closed for forms

<Shell
  navigationOpen={navOpen}
  onNavigationChange={setNavOpen}
  // ...
>
```

**Severity:** **LOW** — Not urgent. Once Shell's defaults are fixed (Rec 1), pages can override only if needed.

---

## Summary

**Critical path to fix:**
1. ✅ Remove Shell's viewport-based default (Rec 1) — **BLOCKER**
2. ✅ Add localStorage persistence (Rec 2) — **HIGH**
3. ⏭️ Resize listener (Rec 3) — **OPTIONAL**

**After fixes:**
- Form pages will correctly start with nav closed (matching Cloudscape intent)
- User's toggle preference persists across pages and sessions
- Mobile UX improves significantly
- Desktop behavior remains smooth and predictable

**Estimated effort:** 30 minutes (Rec 1 + 2), 15 minutes (Rec 3 if added)

---

**Next step:** Implement Rec 1 & 2, test on all 5 pages at 375px/768px/1440px, verify no regressions.
