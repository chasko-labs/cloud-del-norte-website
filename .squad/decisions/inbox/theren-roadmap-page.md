# DEC-009: Roadmap Page with Scrum Board Layout

**Date:** 2026-03-14  
**Author:** Theren (Content & Data Specialist)  
**Status:** ✅ Accepted

## Decision

Created a new Roadmap page at `src/pages/roadmap/` with a Jira-style Scrum board layout showing 19 SCRUM cards distributed across 5 workflow columns (Idea, Todo, In Progress, In Review, Done).

## Rationale

The project needed a visual roadmap to communicate sprint progress and upcoming work. A Scrum board layout was chosen for its familiarity to technical audiences and clear visual hierarchy.

**Design choices:**

1. **5-column workflow:** Maps to standard Scrum stages from ideation to completion
2. **Gradient headers per column:** Color-coded for quick visual scanning (sepia-amber → blue-cyan → amber-orange → violet-cyan → green)
3. **Minimal card content:** Only SCRUM IDs displayed (keeps board clean, encourages click-through to full descriptions)
4. **Responsive grid:** Auto-fit columns on desktop, vertical stack on mobile
5. **Glassmorphism card styling:** Consistent with existing page cards (footer leader cards, home metrics)

**Translation strategy:**

"Roadmap" kept untranslated in Spanish (universally understood term in tech context). Column names translated: "Por Hacer", "En Progreso", "En Revisión", "Hecho". Full localization audit deferred to GH #69.

## Impact

**Files created:**
- `src/pages/roadmap/index.html` — HTML entry point
- `src/pages/roadmap/main.tsx` — React root mounting (standard boilerplate)
- `src/pages/roadmap/app.tsx` — Page component with theme + locale state
- `src/pages/roadmap/data.ts` — Board column + card data
- `src/pages/roadmap/styles.css` — Scrum board layout + card styling

**Files modified:**
- `vite.config.ts` — Added roadmap entry point
- `src/components/navigation/index.tsx` — Added "Roadmap" link (above Meetings)
- `src/locales/en-US.json` — Added roadmap translation keys
- `src/locales/es-MX.json` — Added roadmap translation keys
- `src/locales/__tests__/translation-coverage.test.ts` — Added allowlist entries for "Roadmap" and "Idea"

**Quality gate:** All checks passed (lint ✅ tests 146/146 ✅ build ✅)

**PR:** #71 opened with `roadmap` label, review requested from Lyren

## Alternatives Considered

1. **Table layout:** Rejected — less visual impact, harder to scan workflow stages
2. **Timeline view:** Rejected — requires date data (cards are unscheduled at this stage)
3. **Kanban with WIP limits:** Deferred — no WIP limit enforcement needed yet
4. **Full card descriptions on board:** Rejected — clutters board, breaks mobile layout

## Notes

- Cards are static data in `data.ts` — no drag-drop or interactive features yet
- Card IDs link to GitHub issues (implementation deferred to future enhancement)
- CSS uses existing design tokens from `src/styles/tokens.css`
- Responsive breakpoint at 768px (mobile stack) matches existing pages
