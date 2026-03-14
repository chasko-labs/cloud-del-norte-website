# Skill: Localization & Translation Workflow

**Confidence:** high
**Domain:** localization, content
**Applies to:** Calli (primary), Theren, Lyren, Kess
**Last updated:** 2026-03-14

## Summary

How to extract, translate, and wire translation strings for the Cloud Del Norte bilingual website (en-US / es-MX). Covers the full workflow from finding hardcoded strings to producing dialect-accurate translations for human review.

## Translation Workflow

```
Extract → Translate → Review → Wire → Test
```

1. **Extract** — Find hardcoded English strings in TSX components. Add keys to `en-US.json`.
2. **Translate** — Produce es-MX translations using MCP tools + LOCALIZATION.md dialect guide. Write to review document.
3. **Review** — Bryan reviews translations for dialect accuracy and community tone. Edits as needed.
4. **Wire** — Replace hardcoded strings with `t('namespace.key')` calls. Ensure `LocaleProvider` wraps each page.
5. **Test** — Key parity tests, per-page locale rendering, visual validation, accessibility audit.

## Patterns Learned from Audit

### ShellContent extraction pattern (critical)
Shell cannot call `useTranslation()` at its top level because it renders `<LocaleProvider>` as a wrapper. Extract the consuming logic into a child component:
```tsx
function ShellContent(props: ShellProps) {
  const { t } = useTranslation();  // ✅ Safe — inside LocaleProvider
}
export default function Shell(props: ShellProps) {
  return (
    <LocaleProvider locale={props.locale ?? 'us'}>
      <ShellContent {...props} />
    </LocaleProvider>
  );
}
```
Applies to **any** component that both provides AND consumes a context.

### Navigation items must be inside the component
The `items` array in navigation must live inside the component function body to access the `t()` hook. Module-level constants cannot call hooks.

### Static data.ts files bypass t()
Metric labels, descriptions, and topic names in `data.ts` files must NOT be hardcoded English strings. Store translation keys and resolve with `t()` at render time:
```ts
// ❌ Wrong
export const metrics = [{ label: 'Active Members', value: 42 }];
// ✅ Correct
export const METRIC_CONFIG = [{ labelKey: 'home.metrics.activeMembers', value: 42 }];
```

### CSS selectors tied to title text break after localization
TopNavigation utility-button CSS selectors that match on `[title*="..."]` must cover ALL locale variants, because `title` is dynamic via `t()`. Add selectors for both en-US and es-MX translated title substrings.

### document.title must use t() + useEffect
```tsx
useEffect(() => {
  document.title = t('myPage.title') + ' | Cloud Del Norte';
}, [t]);
```

### Test pattern for components using useTranslation()
```tsx
import { LocaleProvider } from '../../../contexts/locale-context';
function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider locale="us">{ui}</LocaleProvider>);
}
```

## Key Naming Convention

Translation keys use dot-notation namespaced by location:

```
shell.*                 — Site chrome (title, toggles)
navigation.*            — Shared nav items
breadcrumbs.*           — Breadcrumb labels
footer.*                — Footer content
home.*                  — Home page
meetings.*              — Meetings page
createMeeting.*         — Create meeting page
learning.api.*          — Learning/API page
maintenanceCalendar.*   — Maintenance calendar page
common.*                — Shared strings (Cancel, Submit, No matches, etc.)
```

Rules:
- Use camelCase for key segments: `createMeeting.shape.virtualDescription`
- Group related strings: `meetings.columns.title`, `meetings.columns.presenters`
- Validation messages: `createMeeting.validation.linkRequired`
- Empty states: `meetings.empty.noMatches`, `meetings.empty.noMatchesDescription`

## Dialect Guidelines (from LOCALIZATION.md)

### en-US — New Mexican English + El Paso Spanglish
- Community tone, informal
- Code-switching with Spanish terms is authentic and encouraged
- Tech terms stay English (API, REST, AWS, etc.)

### es-MX — Chihuahua Norteño
- Informal "tú" form (not "usted")
- Regional slang: ahorita, orale, fierro, compa, morro
- Direct, warm tone
- English tech terms preserved (no forced translations of "API" or "REST")

### Regional Glossary (key terms)
| Term | Meaning | Usage |
|------|---------|-------|
| ahorita | Right now / in a bit | Temporal context |
| orale | Right on, let's go | Encouragement |
| fierro | Hell yeah (norteño) | Enthusiasm |
| compa | Buddy, friend | Address |
| morro/a | Kid, young person | Casual address |
| parquear | To park (Spanglish) | Verb borrowing |
| troque | Truck (Spanglish) | Noun borrowing |
| juntas | Meetings (MX preferred) | Instead of "reuniones" |

## MCP Usage for Translation

### Fetch MCP — Dialect Reference
```
fetch(url="<dialect resource URL>", max_length=5000)
```
Use for: pulling linguistic references, university papers on border Spanish, community usage examples.

### Context7 MCP — Cloudscape i18n Patterns
```
1. context7-resolve-library-id(libraryName="@cloudscape-design/components")
2. context7-query-docs(libraryId="<result>", query="internationalization i18n component labels")
```
Use for: checking if Cloudscape components have built-in i18n support, label conventions, accessibility requirements for translated content.

### Fetch MCP — Live Documentation
```
fetch(url="https://cloudscape.design/components/", max_length=5000)
```
Use for: verifying component prop names for translated labels, checking for locale-aware components.

## Translation Review Document Format

When producing translations, write to `.squad/decisions/inbox/calli-translation-{page}.md`:

```markdown
### Translation Review: {Page Name}

| Key | English (en-US) | Spanish (es-MX) | Confidence | Dialect Notes |
|-----|----------------|-----------------|------------|---------------|
| home.title | Dashboard | Tablero | high | Standard MX Spanish |
| meetings.empty.noMatches | No matches | No hay resultados | medium | "resultados" vs "coincidencias" — both valid |
```

Confidence levels:
- **high** — Standard translation, no dialect ambiguity
- **medium** — Multiple valid options, chose one based on dialect guide
- **low** — Needs human input — dialect preference unclear or culturally sensitive

## Wiring Pattern

### Page app.tsx — Add locale state and LocaleProvider
```tsx
import { useState } from 'react';
import { LocaleProvider } from '../../contexts/locale-context';
import { initializeLocale, applyLocale, setStoredLocale, type Locale } from '../../utils/locale';

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => initializeLocale());
  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    applyLocale(newLocale);
    setStoredLocale(newLocale);
  };

  return (
    <LocaleProvider locale={locale}>
      <Shell
        locale={locale}
        onLocaleChange={handleLocaleChange}
        // ... other props
      >
        <PageContent />
      </Shell>
    </LocaleProvider>
  );
}
```

### Component — Use t() hook
```tsx
import { useTranslation } from '../../hooks/useTranslation';

function PageContent() {
  const { t } = useTranslation();
  return <Header variant="h1">{t('home.title')}</Header>;
}
```

## Agent Routing

| Agent | Role in Localization |
|-------|---------------------|
| **Calli** (primary) | Key extraction, es-MX translation production, coverage audits, review documents |
| **Theren** (content) | Content accuracy review, page-level string identification |
| **Lyren** (UI) | Wiring t() into Cloudscape components, LocaleProvider integration, layout impact of longer Spanish text |
| **Kess** (testing) | Translation coverage tests, per-page locale rendering tests, visual validation |
| **Vael** (build) | Build-time locale file handling, ensuring locale files are tree-shaken per page |

## Sources

- `LOCALIZATION.md` — project dialect guidelines
- `src/locales/en-US.json`, `src/locales/es-MX.json` — existing translations
- `src/contexts/locale-context.tsx` — translation context implementation
