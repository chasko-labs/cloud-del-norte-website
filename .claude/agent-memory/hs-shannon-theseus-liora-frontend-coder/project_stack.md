---
name: project stack
description: cloud-del-norte-website is Vite+React+TypeScript, not hugo — build gate is npx vite build not hugo --source
type: project
---

cloud-del-norte-website is a Vite+React+TypeScript site (NOT hugo).

**Why:** my agent spec says to run `hugo --source <repo_root>` as the build gate — that command will always fail here with "unable to locate config file". the correct build verification is `npx vite build`.

**How to apply:** skip the hugo gate, run `npx vite build` instead. pre-existing TS errors in `src/sites/auth/*/main.tsx` are stubs with no `app.tsx` files — they pre-date any liora work and are not blocking.

key paths:

- tokens: `src/styles/tokens.css`
- theme page: `src/pages/theme/app.tsx`, `src/pages/theme/data.ts`, `src/pages/theme/custom-theme.css`
- shell CSS: `src/layouts/shell/styles.css` (nav gradient, shimmer, side nav hover, breadcrumb palette)
- feed CSS: `src/pages/feed/styles.css` (krux animations, glassmorphism, info badge, article fade)
- locales: `src/locales/en-US.json` + `src/locales/es-MX.json` (must stay in sync)
- cloudscape component library: `@cloudscape-design/components` — use existing components, no new deps
