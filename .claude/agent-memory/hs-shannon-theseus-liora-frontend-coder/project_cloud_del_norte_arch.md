---
name: cloud-del-norte site architecture
description: vite+react+cloudscape, liora-panel component ownership split between local repo and sumerian-hosts embed
type: project
---

cloud-del-norte-website at /home/bryanchasko/code/websites/cloud-del-norte-website is vite + react + cloudscape design system — NOT hugo. liora skill set applies (CSS keyframes, click-handler wiring, DOM state) but build gate is `npm run build` (vite), not `hugo`.

liora-panel component split:

- `src/components/liora-panel/index.tsx` — react component, renders the bezel shell + sticky note button, manages v6 zoom toggle via useState
- `src/components/liora-panel/styles.css` — all CSS including crack overlays, sticky note states, keyframes
- embed JS lives at `chasko-labs/sumerian-hosts` repo: `src/embed/liora-embed.ts` — dynamically imported at runtime via VITE_LIORA_SCRIPT_URL env var. manages babylon.js scene, crack click handlers, tap count, status bar, credits sequence

DOM structure:

- `.liora-frame` (relative container)
  - `.liora-bezel` (hardware frame — tap state classes go here: screen-tap-1, screen-tap-2, screen-tap-3)
    - `.liora-panel-wrap` (screen glass — click listener for crack sequence)
    - `#liora-status-bar`
  - `.liora-stickynote` (button, outside bezel, below it in .liora-frame)

click listener scope: `panelWrap.addEventListener` in embed — scoped to the inner screen only, not the full bezel. sticky note is outside panelWrap so it never bubbles into onBezelClick.

**Why:** the two repos have separate deploy pipelines. cloud-del-norte deploys to awsaerospace s3. sumerian-hosts liora-embed deploys separately and is loaded as a dynamic import. changes to either repo are independent.

**How to apply:** always check both repos when modifying liora-panel behavior. CSS changes go in cloud-del-norte-website. scene/animation/click-handler JS changes go in sumerian-hosts liora-embed.ts.
