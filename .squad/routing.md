# Routing

> How work gets routed to the right team member.

## Route Table

| Pattern | Route To | Reason |
|---------|----------|--------|
| Coordination, priority, scope, triage, cross-cutting, sprint planning, ambiguous requests | Coordinator (direct) | Lead — coordinator handles all coordination inline |
| Architecture decisions, MPA constraints, MCP integration, Squad config, cross-cutting design | Stratia | Strategy & Architecture Advisor |
| Cloudscape components, AppLayout, Shell, theming, design tokens, accessibility, `src/layouts/`, `src/components/`, `src/styles/` | Lyren | Cloudscape UI & Design Specialist |
| Vite config, page anatomy, `index.html`/`main.tsx` scaffolding, build pipeline, S3 deploy, CloudFront, `vite.config.ts` | Vael | MPA Build & Deploy Engineer |
| Page content, JSON data files, navigation items, fetch scripts, `src/data/`, `scripts/`, `src/components/navigation/` | Theren | Content & Data Specialist |
| Translation keys, `src/locales/`, es-MX translations, locale coverage audits, `LOCALIZATION.md`, dialect accuracy, i18n string extraction | Calli | Localization & Translation Specialist |
| `src/locales/en-US.json` review, Chicano English dialect, border region vernacular, English code-switching naturalness, informal English tone | Sophia | English Localization Specialist |
| `src/locales/es-MX.json` review, Chihuahua norteño dialect, Juárez regional Spanish, Spanish code-switching, bilingual coherence with en-US.json | Sofía | Spanish Localization Specialist |
| Vitest, @testing-library/react, test patterns, Cloudscape mocking, coverage, `vitest.config.ts`, `*.test.{ts,tsx}` | Kess | Testing Lead |
| Decision log, session history, orchestration log, knowledge synthesis | Scribe | Session logger (silent) |
| Backlog, triage, label, assignment | Ralph | Work monitor |

## Ambiguity Resolution

When a task spans multiple domains:
1. **Coordinator decomposes** — breaks task into domain-specific work items
2. **Route to primary owner first** — e.g., "add a new page" → Vael scaffolds page anatomy, Lyren builds component tree, Theren adds content
3. **Stratia consults on architecture** — not implementation; routes to specialists for execution
4. **Cross-cutting concerns** — e.g., "theme affects test mocks" → Kess owns test changes, Lyren consulted for theme patterns

## Review Policy

- Stratia reviews architecture and cross-cutting changes
- Lyren reviews Cloudscape component and theming changes
- Vael reviews build/deploy configuration changes
- Kess reviews test changes and enforces coverage
- All code changes require review by at least one team member who didn't write the code
