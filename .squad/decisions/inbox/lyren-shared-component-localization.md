# Decision: Shared Component Localization Pattern

**Date:** 2026-03-14  
**Author:** Lyren  
**Status:** ✅ Implemented

## Decision

Established the pattern for wiring `useTranslation()` into shared components that are rendered within `LocaleProvider`. Key architectural insight: when a component renders a context provider AND needs to consume that context, extract the consuming logic into a child component.

## Context

The project has a localization system with:
- `LocaleProvider` context providing `t()` translation function
- 161 translation keys across `en-US.json` and `es-MX.json`
- 4 shared components needing localization: Shell, Navigation, Breadcrumbs, Footer

Shell posed a unique challenge: it renders `<LocaleProvider>` as a wrapper but also needs to use `useTranslation()` for its own strings. React Context Rules of Hooks prevent this at the same level.

## Solution

### 1. Shell Component Pattern (Context Provider + Consumer)

```tsx
// WRONG — cannot use useTranslation() at the same level as LocaleProvider
export default function Shell(props: ShellProps) {
  const { t } = useTranslation();  // ❌ Error: called outside LocaleProvider
  return (
    <LocaleProvider locale={props.locale ?? 'us'}>
      {/* ... */}
    </LocaleProvider>
  );
}

// CORRECT — extract consuming logic into child component
function ShellContent(props: ShellProps) {
  const { t } = useTranslation();  // ✅ Inside LocaleProvider
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

### 2. Navigation, Breadcrumbs, Footer Pattern (Context Consumers Only)

These components are always rendered inside Shell, which provides `LocaleProvider`. They can directly use `useTranslation()`:

```tsx
export default function Navigation() {
  const { t } = useTranslation();  // ✅ Safe — Shell wraps everything
  const items = [
    { type: 'link', text: t('navigation.meetings'), href: '/meetings/index.html' },
    // ...
  ];
  return <SideNavigation items={items} />;
}
```

**Important:** Move const arrays (like `items`) inside the component when they need `t()`.

### 3. Test Pattern for Components Using useTranslation()

Tests must wrap components in `LocaleProvider`:

```tsx
import { LocaleProvider } from '../../../contexts/locale-context';

const renderFooter = () => {
  return render(
    <LocaleProvider locale="us">
      <Footer />
    </LocaleProvider>
  );
};
```

## Rationale

- **Separation of concerns:** Shell manages LocaleProvider lifecycle; ShellContent handles rendering logic
- **External API stability:** `ShellProps` interface unchanged — consumers don't need to know about the internal refactor
- **Test clarity:** Explicit LocaleProvider wrapping in tests makes context dependency obvious
- **Reusability:** This pattern applies to any component that both provides and consumes the same context

## Impact

### Files Modified
- `src/layouts/shell/index.tsx` — ShellContent extraction
- `src/components/navigation/index.tsx` — t() calls, items moved inside component
- `src/components/breadcrumbs/index.tsx` — t() calls, items moved inside component
- `src/components/footer/index.tsx` — t() calls added
- `src/components/footer/__tests__/footer.test.tsx` — LocaleProvider wrapper

### Translation Keys
- Shell: 17 keys (`shell.*`)
- Navigation: 15 keys (`navigation.*`)
- Breadcrumbs: 1 key (`breadcrumbs.home`)
- Footer: 5 keys (`footer.*`)

### Quality Gates
- ✅ Lint: no errors
- ✅ Tests: 120/120 passing

## Future Considerations

This pattern will be needed again if we create new components that:
1. Render a context provider (Theme, Feature flags, etc.)
2. Also need to consume that same context

Always extract the consuming logic into a child component inside the provider.
