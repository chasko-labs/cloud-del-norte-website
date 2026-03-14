# AGENTS.md — AWSUGcloudDelNorte

> Read this file before working on any part of this project. It covers project
> identity, stack conventions, architecture constraints, and deploy procedures.

---

## Project Identity

- **Name:** AWS User Group Cloud Del Norte (formerly awsaerospace)
- **Purpose:** Community website for the AWS User Group serving the North Coast
  region — meeting announcements, resources, and learning content.
- **Meetup:** https://www.meetup.com/cloud-del-norte/
- **Live URL:** https://d2ly3jmh1f74xt.cloudfront.net (CloudFront — no custom domain yet)
- **Repo root:** `/Users/bryanchasko/Code/rgc3-CloudscapeDesignSystem-website`

---

## Stack

| Layer | Technology |
| ----- | ---------- |
| Bundler | Vite 7 |
| UI | React 19 |
| Language | TypeScript 5.9 |
| Component library | Cloudscape Design System 3.x |
| Linter | ESLint 10 (flat config — `eslint.config.js`) |
| Test framework | Vitest + @testing-library/react |
| Build output | `./lib/` |
| Hosting | S3 + CloudFront |

---

## Cloudscape Design System — Patterns & Conventions

### Imports
Use **deep imports** (preferred over barrel imports for tree-shaking):

```tsx
import Button from '@cloudscape-design/components/button';
import Table from '@cloudscape-design/components/table';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
```

### AppLayout
`AppLayout` is the root shell — already implemented in `src/layouts/shell/index.tsx`.
Every page wraps its content in this shell. Do not create parallel layout mechanisms.

### Key Components in Use
- `AppLayout` — page shell with nav + content area
- `TopNavigation` — top bar with identity, theme toggle (☀️/🌙), locale toggle (🇺🇸/🇲🇽)
- `SideNavigation` — left nav (shared via `src/components/navigation/index.tsx`)
- `Footer` — leader cards + community description (`src/components/footer/`)
- `Table` — data tables
- `Header` — section headers
- `SpaceBetween` — spacing utility
- `Box` — layout primitive
- `Button` — actions
- `Badge` — status indicators
- `Link` — internal and external links

### Theming
- Package: `@cloudscape-design/components-themeable`
- Design tokens: `src/utils/theme.ts`
- Global styles: `@cloudscape-design/global-styles` — imported **once** in each
  page's `main.tsx`. Do not import it multiple times.

### Docs
https://cloudscape.design/components/

---

## Localization (US/MX Locale Toggle)

The site supports two locales via a flag toggle (🇺🇸↔🇲🇽) in TopNavigation:

- **`us`** — New Mexican English with Spanglish & local slang
- **`mx`** — Chihuahua dialect Spanish (norteño)

### Key files

| File | Purpose |
| ---- | ------- |
| `src/utils/locale.ts` | `type Locale`, localStorage (`cdn-locale`), `applyLocale`, `initializeLocale` |
| `src/contexts/locale-context.tsx` | `LocaleProvider`, `t()` translation function, dot-notation key lookup |
| `src/hooks/useTranslation.ts` | `useTranslation()` hook returning `{ locale, t }` |
| `src/locales/en-US.json` | English translation keys |
| `src/locales/es-MX.json` | Spanish translation keys |

### How it works
- Mirrors the theme toggle pattern: localStorage persistence, Shell props, page-level state
- Each page creates its own `LocaleProvider` (MPA — no shared runtime)
- Translation JSONs imported statically (tree-shaken per page via Vite)
- `t('shell.title')` does dot-notation lookup with `en-US` fallback

See [LOCALIZATION.md](LOCALIZATION.md) for dialect guides, translation guidelines,
and linguistic resources for the El Paso / Juárez / Las Cruces border region.

---

## Vite MPA Structure

This is a **multi-page app (MPA)** — each page is an independent Vite entry point.
There is **no** `src/index.html`.

### Page anatomy
Each page requires three files:

```
src/pages/<name>/
  index.html    ← Vite HTML entry point
  main.tsx      ← mounts React root, imports global styles + theme
  app.tsx       ← page component tree
```

### Registering a new page
Add it to `vite.config.ts` under `build.rollupOptions.input`:

```ts
input: {
  home: resolve(__dirname, 'src/pages/home/index.html'),
  meetings: resolve(__dirname, 'src/pages/meetings/index.html'),
  'create-meeting': resolve(__dirname, 'src/pages/create-meeting/index.html'),
  'learning/api': resolve(__dirname, 'src/pages/learning/api/index.html'),
  'maintenance-calendar': resolve(__dirname, 'src/pages/maintenance-calendar/index.html'),
  '<name>': resolve(__dirname, 'src/pages/<name>/index.html'),  // ← add here
},
```

### Dev server
- URL pattern: `http://localhost:8080/<pagename>/`
- Root `/` returns 404 — this is by design; there is no index page at root

### Build output
`./lib/<pagename>/` — mirrored to S3 on deploy

### Existing pages
| Page | Path |
| ---- | ---- |
| Home | `src/pages/home/` |
| Meetings | `src/pages/meetings/` |
| Create Meeting | `src/pages/create-meeting/` |
| Learning / API | `src/pages/learning/api/` |
| Maintenance Calendar | `src/pages/maintenance-calendar/` |
| Theme Preview | `src/pages/theme/` |

---

## Navigation

All pages share a single navigation component: `src/components/navigation/index.tsx`.

### Adding a nav item
Append to the `items` array:

```ts
{ type: 'link', text: 'Page Label', href: '/pagename/' }
```

### Anchor deep-links
```ts
{ type: 'link', text: 'Section', href: '/pagename/#anchor-id' }
```

Do not create per-page navigation components — always update the shared one.

---

## Deploy Flow

### CI/CD (GitHub Actions)

`.github/workflows/deploy.yml` triggers on pushes to `main` that touch `src/`,
`public/`, `package.json`, `package-lock.json`, `vite.config.ts`, or `tsconfig.json`.

Pipeline: `npm install` → `npm run build` → `aws s3 sync` → CloudFront invalidation.

**Required repo secrets** (Settings → Secrets and variables → Actions):

| Secret | Purpose |
| ------ | ------- |
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `AWS_ROLE_ARN` | IAM role ARN for OIDC (optional if using keys) |

> ⚠️ If secrets are not configured, the workflow builds successfully but
> **silently skips** the S3 deploy and CloudFront invalidation
> (`continue-on-error: true` on the credential step masks the failure).

### Manual deploy

```bash
aws sso login --profile aerospaceug-admin
npm run lint && npm test && npm run build
aws s3 sync lib/ s3://awsaerospace.org --delete --profile aerospaceug-admin
aws cloudfront create-invalidation \
  --distribution-id ECC3LP1BL2CZS \
  --paths "/*" \
  --profile aerospaceug-admin
```

### Build

```bash
npm run build   # fetch-releases → tsc → vite build → ./lib/
```

> **Script order matters:** fetch script → `tsc` → `vite build`. Any changes to
> the `build` script in `package.json` must preserve this order once the fetch
> script is wired in.

### AWS context
- **CLI profile:** `aerospaceug-admin` (SSO — requires `aws sso login`)
- **CloudFront ID:** `ECC3LP1BL2CZS`
- **CloudFront domain:** `d2ly3jmh1f74xt.cloudfront.net`
- **S3 bucket:** `awsaerospace.org`

---

## Testing

- **Framework:** Vitest + @testing-library/react
- **Convention:** Test files colocated with source — `*.test.ts` / `*.test.tsx`
- **Commands:**

```bash
npm test              # vitest run
npm run test:watch    # vitest (watch mode)
npm run test:ui       # vitest --ui
npm run coverage      # vitest run --coverage
```

- **Quality gate before deploy:** `npm run lint && npm test && npm run build`

---

## Data Files

| File | Status | Purpose |
| ---- | ------ | ------- |
| `src/data/releases.manual.json` | Committed, never overwritten | Hand-curated release data |
| `src/data/releases.generated.json` | Git-ignored, written by script | Generated at build time |

JSON imports are supported via `resolveJsonModule: true` in `tsconfig.json`.

---

## Scripts

| Script | How to run | Notes |
| ------ | ---------- | ----- |
| `scripts/fetch-releases.mjs` | `node scripts/fetch-releases.mjs` | Pre-build data fetch (ESM, top-level await) |
| Force refresh | `node scripts/fetch-releases.mjs --force` | Bypasses freshness check |

**GitHub API rate limits:** unauthenticated = 60 req/hr. Set `GITHUB_TOKEN` env
var to raise the limit. The script skips fetch if cached data is < 24h old.

---

## Agent Team (Squad v0.5.4 — HeraldStack)

This project uses [Squad](https://github.com/bradygaster/squad) for AI agent orchestration.

| Name | Role | Domain |
|------|------|--------|
| Harald | Coordinator (Lead) | Orchestration, routing, scope, session continuity |
| Stratia | Strategy & Architecture Advisor | Architecture decisions, MCP integration, Squad config |
| Lyren | Cloudscape UI & Design Specialist | Components, theming, AppLayout, design tokens, accessibility |
| Vael | MPA Build & Deploy Engineer | Vite config, page anatomy, build pipeline, S3+CloudFront deploy |
| Theren | Content & Data Specialist | Page content, JSON data files, navigation, fetch scripts |
| Kess | Testing Lead | Vitest, testing-library, coverage, test patterns, Cloudscape mocking |
| Scribe | Session Logger (silent) | Decisions, orchestration logs, session continuity |
| Ralph | Work Monitor | Backlog, triage, label, assignment |

**Agent definitions:** `.github/agents/squad.agent.md`
**Team config:** `.squad/team.md`, `.squad/routing.md`, `.squad/agents/{name}/charter.md`
**Persona Source:** [HeraldStack](https://github.com/BryanChasko/HeraldStack)

---

## Architectural Constraints (Non-Negotiable)

- **MPA — not SPA.** No React Router. No shared runtime bundle between pages.
- **No path aliases.** All TypeScript imports use relative paths. `baseUrl`/`paths`
  in tsconfig require architecture review before adding.
- **Cloudscape only.** Do not introduce other UI component libraries without
  explicit approval.
- **ESLint flat config (v10).** `eslint.config.js` only — no `.eslintrc`.
- **No backend.** Static site only. No Lambda, no API Gateway, no SSR. Data is
  fetched at build time and bundled as JSON.
- **Deep imports only (no barrel imports).** Always import Cloudscape components
  from their individual paths:
  ```tsx
  // ✅ Correct
  import Button from '@cloudscape-design/components/button';
  // ❌ Wrong — breaks tree-shaking, increases bundle size
  import { Button } from '@cloudscape-design/components';
  ```
- **Page compliance checklist.** Every page must implement all of:
  1. Shell wrapper (`<Shell>` from `src/layouts/shell`)
  2. Theme state (`useState<Theme>` + `initializeTheme()`)
  3. Locale state (`useState<Locale>` + `initializeLocale()` + `<LocaleProvider>`)
  4. Deep Cloudscape imports
  5. `t()` translation for all user-visible strings (never hardcoded English)
  6. `document.title` set via `t()` so it updates on locale change
  7. Locale-aware `data.ts` — static data labels use translation keys, not raw strings

---

## Common Pitfalls

> For new developers and agents — mistakes caught during the localization audit.

### 1. Barrel imports break tree-shaking
```tsx
// ❌ Never do this
import { Button, Table } from '@cloudscape-design/components';
// ✅ Always do this
import Button from '@cloudscape-design/components/button';
import Table from '@cloudscape-design/components/table';
```

### 2. Shell cannot call `useTranslation()` at the top level
Shell renders `<LocaleProvider>` as a wrapper, so it **cannot** call `useTranslation()` inside its own body — that hook requires being inside a `LocaleProvider`. Solution: extract a `ShellContent` child component:
```tsx
function ShellContent(props: ShellProps) {
  const { t } = useTranslation();  // ✅ Safe — inside LocaleProvider
  // ...
}
export default function Shell(props: ShellProps) {
  return (
    <LocaleProvider locale={props.locale ?? 'us'}>
      <ShellContent {...props} />
    </LocaleProvider>
  );
}
```
This pattern applies to **any** component that both provides AND consumes a context.

### 3. Static data in `data.ts` files bypasses `t()`
Metric labels, descriptions, and topic names in `data.ts` files must **not** be hardcoded English strings — they bypass `t()` and stay English regardless of locale. Store translation keys instead and resolve with `t()` at render time.

### 4. Navigation `items` array must be inside the component
The `items` array in `src/components/navigation/index.tsx` must live inside the component function body so it can access the `t()` hook. Module-level constants cannot call hooks.

### 5. CSS selectors tied to title text break after localization
TopNavigation utility-button CSS selectors that match on `[title*="..."]` must cover ALL locale variants. When the `title` attribute is set via `t()`, its value changes per locale — a selector that only matches English will silently fail in Spanish mode.

### 6. Tests for components using `useTranslation()` must wrap in `LocaleProvider`
```tsx
// ✅ Correct test pattern
import { LocaleProvider } from '../../../contexts/locale-context';
function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider locale="us">{ui}</LocaleProvider>);
}
```
