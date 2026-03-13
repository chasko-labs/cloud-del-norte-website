# Copilot Instructions — Cloudscape Design System Website

> Squad v0.5.4 | Universe: HeraldStack | Owner: Bryan Chasko

## Project Overview

Community website for the **AWS User Group Cloud Del Norte** (formerly awsaerospace). Built with Cloudscape Design System as a Vite multi-page app (MPA), deployed to S3 + CloudFront.

**Live URL:** https://d2ly3jmh1f74xt.cloudfront.net
**Meetup:** https://www.meetup.com/cloud-del-norte/
**GitHub repo:** rgc3-CloudscapeDesignSystem-website

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Bundler | Vite 7 |
| UI | React 19 |
| Language | TypeScript 5.9 |
| Component library | Cloudscape Design System 3.x |
| Linter | ESLint 10 (flat config — `eslint.config.js`) |
| Test framework | Vitest + @testing-library/react |
| Build output | `./lib/` |
| Hosting | S3 + CloudFront (AWS account `bc-website`) |

---

## Commands

```bash
npm install              # install dependencies
npm run dev              # dev server at localhost:8080
npm run build            # tsc + vite build → ./lib/
npm run lint             # eslint
npm test                 # vitest run
npm run test:watch       # vitest (watch mode)
npm run test:ui          # vitest --ui
npm run coverage         # vitest run --coverage
```

**Quality gate before deploy:** `npm run lint && npm test && npm run build`

---

## Architecture: Multi-Page App (NOT SPA)

Each page is an independent Vite entry point. There is **no** React Router. No shared runtime bundle between pages.

### Page anatomy — every page needs exactly 3 files:

```
src/pages/<name>/
  index.html    ← Vite HTML entry point
  main.tsx      ← mounts React root, imports global styles + tokens
  app.tsx       ← page component tree wrapped in Shell
```

### Existing pages

| Page | Path |
| ---- | ---- |
| Home | `src/pages/home/` |
| Meetings | `src/pages/meetings/` |
| Create Meeting | `src/pages/create-meeting/` |
| Learning / API | `src/pages/learning/api/` |
| Maintenance Calendar | `src/pages/maintenance-calendar/` |

### Registering a new page

1. Add entry to `vite.config.ts` → `build.rollupOptions.input`
2. Add nav item in `src/components/navigation/index.tsx` → `items` array

---

## Cloudscape Conventions

### Deep imports only (tree-shaking)

```tsx
import Button from '@cloudscape-design/components/button';
import Table from '@cloudscape-design/components/table';
```

Never use barrel imports: `import { Button } from '@cloudscape-design/components'`

### Key components

- `AppLayout` — page shell (implemented in `src/layouts/shell/index.tsx`)
- `SideNavigation` — shared via `src/components/navigation/index.tsx`
- `Table`, `Header`, `SpaceBetween`, `Box`, `Button`, `Badge`, `Link`

### Theming

- Design tokens: `src/utils/theme.ts`
- Global styles: `@cloudscape-design/global-styles` — imported once per page's `main.tsx`

---

## Navigation

All pages share `src/components/navigation/index.tsx`. Never create per-page navigation components.

---

## Deploy Flow

```bash
npm run build
aws s3 sync lib/ s3://awsaerospace.org --delete --profile bc-website
aws cloudfront create-invalidation --distribution-id ECC3LP1BL2CZS --paths "/*" --profile bc-website
```

- **Profile:** `bc-website`
- **CloudFront ID:** `ECC3LP1BL2CZS`
- **S3 bucket:** `awsaerospace.org`
- **No CI/CD pipeline** — deploy is fully manual.

---

## Data Files

| File | Purpose |
| ---- | ------- |
| `src/data/releases.manual.json` | Hand-curated release data (committed) |
| `src/data/releases.generated.json` | Generated at build time (git-ignored) |

---

## Architectural Constraints (Non-Negotiable)

- **MPA — not SPA.** No React Router. No shared runtime bundle between pages.
- **No path aliases.** All TypeScript imports use relative paths.
- **Cloudscape only.** No other UI component libraries without explicit approval.
- **ESLint flat config (v10).** `eslint.config.js` only — no `.eslintrc`.
- **No backend.** Static site only. Data fetched at build time and bundled as JSON.
- **Manual deploy.** No CI/CD pipeline yet.

---

## Agent Team (HeraldStack)

| Name | Role | Domain |
|------|------|--------|
| Stratia | Strategy & Architecture Advisor | Architecture decisions, MCP integration, Squad config, cross-cutting |
| Lyren | Cloudscape UI & Design Specialist | Components, theming, AppLayout, design tokens, accessibility |
| Vael | MPA Build & Deploy Engineer | Vite config, page anatomy, build pipeline, S3+CloudFront deploy |
| Theren | Content & Data Specialist | Page content, JSON data files, navigation, fetch scripts |
| Kess | Testing Lead | Vitest, testing-library, coverage, test patterns, Cloudscape mocking |
| Scribe | Session Logger | Decisions, orchestration logs, session continuity (silent) |
| Ralph | Work Monitor | Backlog, triage, label, assignment (monitor) |

**Routing:** Route work by domain. See `.squad/routing.md` for the full route table and ambiguity resolution.

**Persona Source:** [HeraldStack](https://github.com/BryanChasko/HeraldStack) — Bryan's ambient intelligence system. Personas are drawn from HeraldStack entities; technical concepts are project-specific.

---

## Scribe Conventions

Agents write decisions to `.squad/decisions/inbox/{name}-{slug}.md` — Scribe merges into decisions.md. Session logs go in `.squad/log/`. Orchestration logs go in `.squad/orchestration-log/`. Scribe commits `.squad/` state after each batch.

---

## MCP Tools Available

MCPs are configured in `.vscode/mcp.json`. Use them over training-data recall for current Cloudscape component APIs, React patterns, and Vite configuration.

- **`github`** — GitHub Copilot MCP for code search, PRs, issues.
- **`context7`** — Authoritative library/framework docs (Cloudscape, React, Vite). Resolve library ID first, then query.
- **`fetch`** — Web fetch for live docs: cloudscape.design component pages, AWS docs.

See `.squad/skills/mcp-tool-discovery/SKILL.md` for the full agent-to-MCP mapping and graceful degradation fallbacks.
