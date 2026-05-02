# aria audit — cloud del norte

scope — every interactive element with hover-revealed info, hover-only state, or icon-only affordance across `src/`. produced 2026-05-02. cloudscape primitives ship compliant; findings concentrate on bespoke hover styling, custom controls, the liora panel

## section 1 — findings

| location | issue | sev | fix |
|---|---|---|---|
| `layouts/shell/index.tsx:182,189` | top-nav locale + theme toggles use emoji `text` + `title`. emoji not consistently announced; `title` is hover-only | P1 | add `ariaLabel: t("shell.switchToUs")` to each `Utility` |
| `layouts/shell/styles.css:784-813` | `:has([title*="..."]):hover` accent fires only on mouse, not keyboard `:focus-visible` | P1 | duplicate each `:hover` block with `:focus-visible` |
| `components/navigation/index.tsx:267-293` (liora sticky-1 button) | toggle has no `aria-expanded`; sr gets text flip but no role-state | P2 | add `aria-expanded={stickyZoomed}` |
| `components/navigation/index.tsx:295-312` (liora sticky-2) | `role="note"` div has `onClick` without keyboard handler — biome-ignore acknowledges | P1 | drop `onClick` if decorative, or convert to `<button>` |
| `components/breadcrumbs/index.tsx` + `cdn-glass-streaks.css:639` | first crumb hover style without focus mirror | P2 | add `:focus-visible` rule |
| `components/footer/*` | cloudscape `Link external` + proper `aria-label` on social `role="list"` | ok | — |
| `components/persistent-player/index.tsx:153-171` | unicode glyph buttons carry `aria-label`; `:focus-visible` exists in css | ok | — |
| `pages/feed/components/feed-section.tsx:69-73` | hover pause no focus mirror — carousel rotates under keyboard focus | **P0** | add `onFocus`/`onBlur` mirroring pause state |
| `pages/feed/components/andres-medium.tsx:57-58` | same | **P0** | same |
| `pages/feed/components/arrowhead-news.tsx:40-41` | same | **P0** | same |
| `pages/feed/components/feed-section.tsx:101-112` | `role="tab"` lacks `aria-controls`, roving `tabindex`, arrow-keys | P1 | add `aria-controls`, `tabIndex={i===index?0:-1}`, ArrowLeft/Right handlers |
| `pages/feed/components/arrowhead-news.tsx:75-86` | same dot-tablist gap | P1 | same |
| `pages/feed/components/builder-center-card.tsx` | numeral `aria-hidden`; link text is title — passes | ok | — |
| `pages/feed/components/next-meetup.tsx` | cloudscape primitives only | ok | — |
| `pages/create-meeting/components/help-panel-home.tsx:67-127` (`.hp-leader:hover`) | hover lift without `:focus-within` mirror — emphasis is mouse-only when child link focuses | P2 | add `.hp-leader:focus-within` rule |
| `pages/create-meeting/components/help-panel.css:287` (`.hp-social-pill:hover`) | pill wrapped in `<Link>`; lift + shadow only on hover, not on link `:focus-visible` | P1 | `:has(:focus-visible)` parent rule |
| `pages/create-meeting/components/help-panel.css:414` (`.hp-role-card:hover`) | non-interactive children, decoration only | ok | — |
| `components/cdn-card/index.tsx` | primitive — children supply semantics | ok | — |
| `styles/tokens.css:374,391` (global `.cdn-card:hover`) | global lift across roadmap, footer leader cards, etc — no `:focus-within` mirror | P1 | one global `.cdn-card:focus-within` rule |
| `pages/roadmap/styles.css:128` (`.cdn-roadmap-card:hover`) | confirm if interactive — if so mirror | P2 | `:focus-within` if cards link out |
| color-contrast | `.hp-leader-bio`, retired badges, muted theme text — verify 4.5:1 | P2 | run axe contrast subset |
| icon-only buttons globally | persistent-player, carousel dots all carry `aria-label` — clean except top-nav toggles | ok | — |
| images | only `theme/app.tsx:685`, alt="Cloud Del Norte AWS User Group" | ok | — |

## section 2 — top 10 P0/P1 next sprint

1. feed carousel hover-pause has no focus equivalent — `feed-section.tsx`, `andres-medium.tsx`, `arrowhead-news.tsx` (P0, three files, one pattern)
2. carousel dot tablist missing `aria-controls`, roving `tabindex`, arrow-key handling (P1, two files)
3. top-nav locale + theme toggles need `ariaLabel` instead of emoji-only (P1, `shell/index.tsx:182,189`)
4. theme + locale toggle hover accents do not fire on `:focus-visible` (P1, `shell/styles.css:784-813`)
5. `.hp-social-pill:hover` lift not mirrored on link focus (P1, `help-panel.css:287`)
6. global `.cdn-card:hover` lift not mirrored on `:focus-within` (P1, `tokens.css:391`)
7. liora sticky-2 `onClick` on `role="note"` div without keyboard handler (P1, `navigation/index.tsx:295-312`)
8. liora sticky-1 toggle missing `aria-expanded` (P2 — bundle with #7)
9. breadcrumb `:focus-visible` mirror (P2, `cdn-glass-streaks.css:639`)
10. color-contrast pass on muted bio + retired badges (P2, axe contrast subset)

## section 3 — ci integration

`eslint-plugin-jsx-a11y` not installed — biome handles `useButtonType`, `noAriaHiddenOnFocusable`, `useSemanticElements`. axe is highest signal per build; pa11y-ci adds page coverage; lighthouse-ci redundant given existing playwright pipeline

| tool | where | gate | added time | catches |
|---|---|---|---|---|
| `@axe-core/playwright` injected into `scripts/ci-screenshot.mjs` | new step `axe-audit` in `.woodpecker/screenshot.yml` (parallel to capture-dev) | fail on new P0/P1 violations vs `latest/axe-baseline.json` | +30-45s | missing aria-label, role mismatches, contrast, focusable-hidden |
| `pa11y-ci` against built `dist/` | tier-1 step in `.woodpecker/ci.yml` after `build`; `.pa11yci.json` enumerates `docs/site-pages.md` rows | fail on new errors per page; warnings advisory | +60-90s | wcag 2.1 aa, runs without auth |
| biome a11y promotion | extend existing config — promote to error, add `noNoninteractiveElementToInteractiveRole`, `useFocusableInteractiveControl` | fails existing `biome ci` step | 0s | role/onClick mismatches at compile time |
| lighthouse-ci accessibility-only (optional) | tier-2 step gated on `[ci-full]` commit tag | warn-only; 95+ score per page | +90s | duplicates axe; skip unless stakeholder needs |

recommended sprint order — biome severity bump (zero infra cost) → axe-core in screenshot pipeline (single file edit, reuses playwright) → pa11y-ci as tier-1 gate. skip lighthouse-ci

## section 4 — long-term guardrails

- update `AGENTS.md` with checklist mirroring section 2: every new `:hover` needs `:focus-visible` or `:focus-within`; every icon-only button needs `aria-label`; every clickable non-button needs role + key handler. cite this doc by relative path
- add `docs/testing-runbook.md` entry: running the axe audit locally — `npx playwright test scripts/axe-local.mjs` against `npm run preview`
- agent prompt addition for cdn-card + shell edits — top-line constraint "if you add `:hover` add `:focus-visible`"
- screenshot ci already produces visual regressions; pair with axe diff so any pr introducing a new violation surfaces in the same `_ci/` s3 prefix
- onboarding — point new contributors at `biome.json` a11y rules, `@axe-core/playwright` config, this doc as canonical baseline. open issues against this doc to track remediation
