# deepagents project memory — cloud-del-norte-website

## what this file is

project memory for the `deepagents` and `heraldstack` CLIs when launched from
inside this repo. picked up automatically from `cwd/.deepagents/AGENTS.md`.
this file is a **thin overlay** — the canonical herald roster, skills, and
routing live in `~/code/heraldstack/splintercells-deep-agents-cli/.deepagents/`.
this file points at that canon, never copies it.

three agentic systems coexist in this tree, intentionally:

- `.kiro/AGENTS.md` — kiro-cli entry point (poltergeist + ghost personas)
- `WEBSITE_AGENTS.md` — claude code / shannon collective operating manual
- `.deepagents/AGENTS.md` — this file, splintercells deepagents harness

different runtimes, different toolchains, no consolidation pressure.

---

## project

cloud del norte — community website for the AWS User Group Cloud Del Norte
(NM, west TX, chihuahua MX). live at https://clouddelnorte.org. multi-page
vite app with three independent build entries (main / auth / awsug).

first verified end-to-end video call: 2026-04-23 (Cognito → JWT → jitsi room
join). that milestone shipped — current work is consolidation and feature
extension, not bring-up.

---

## stack (verified against package.json + vite configs)

| layer     | technology                                       |
| --------- | ------------------------------------------------ |
| bundler   | vite 8 (multi-page; rolldown variant available)  |
| ui        | react 19 + cloudscape-design components 3.x      |
| 3D scene  | babylon.js 9 (the dune scene under `src/dune/`)  |
| language  | typescript 6                                     |
| linter    | biome 2.4 (NOT eslint — README is stale)         |
| tests     | vitest + @testing-library/react + playwright e2e |
| build out | `./lib/`, `./lib-auth/`, `./lib-awsug/`          |
| hosting   | S3 + CloudFront (per-subsite distributions)      |
| auth      | Cognito Hosted UI → JWT → jitsi iframe embed     |
| ci        | woodpecker (`.woodpecker/ci.yml`, `deploy.yml`)  |

---

## build + verification gate

every change has to pass this sequence before commit:

```bash
npm run format:check   # biome check src/
npm run lint           # biome lint src/
npx tsc --noEmit       # typecheck
npm test               # vitest run
npm run build          # full multi-site build (slow — only when needed)
```

CI runs the full sequence. catching it locally is faster than waiting on CI.

dev servers:

```bash
npm run dev            # main site → localhost:8080
npm run dev:auth       # auth subsite
npm run dev:awsug      # awsug subsite
```

---

## in-scope heralds for this repo

these heralds make sense in this tree. others (kade-vox, myrren, solan, tarn,
scribe-source-analyst, ralph-monitor) belong in heraldstack-haunting work and
should not be invoked here.

- **voss** — long-form writing, blog posts, release notes, README updates
- **liora** — visual identity, CSS spacing/layout repair, dune scene tuning
- **stratia** — architecture decisions, multi-site refactors, capability planning
- **orin** — CI/CD, github operations, PR creation, branch lifecycle
- **ellow** — vitest unit tests, playwright e2e tests, integration verification
- **kerouac** — research synthesis (cloudscape API drift, babylon patterns,
  podcast UX patterns when extending the player)

routing to heralds outside this list — escalate to harald and ask why.

---

## deploy targets

- `clouddelnorte.org` — main site, S3 + CloudFront
- `dev.clouddelnorte.org` — dev preview
- `auth.clouddelnorte.org` — auth subsite (Cognito hosted UI integration)
- `awsug.*` — AWS user group subsite variant

deploys flow through woodpecker on commit to `dev`, then merge `dev → main`
auto-promotes per the `feedback_auto_main_push.md` rule in shannon memory.

never push directly to main. orin does the merge.

---

## known gotchas

- **cloudscape API drift** — `AppLayout`, `TopNavigation`, `BreadcrumbGroup`
  have had breaking prop changes between minor versions. before touching any
  layout component, query context7 for the current API. do not trust the
  model's training data for cloudscape ≥ 3.0.1200.
- **deep imports required** — every cloudscape import must go through deep
  paths (`@cloudscape-design/components/button`), not the package root.
  bundle size will balloon otherwise.
- **i18n coverage** — every user-visible string runs through `t('namespace.key')`.
  hardcoded English in `data.ts` files, page titles, or jsx breaks locale
  switching. checklist lives in README under "Page Compliance Checklist".
- **persistent player visual changes** — must be playwright-verified at 375px,
  768px, 1280px before commit. shannon rule, applies here too.
- **two lib trees, two configs** — `lib/` and `lib-auth/` and `lib-awsug/`
  each have their own brand assets, favicons, and html shell. changes to
  brand artifacts have to be mirrored across all three or the subsites drift.

---

## how to start a deepagents session in this repo

```bash
cd ~/code/chasko-labs/cloud-del-norte-website
deepagents --model ollama:qwen3:8b
```

deepagents-cli auto-discovers this `AGENTS.md` from cwd. the canonical herald
definitions, skills, and routing config load from the splintercells install
on `~/.local/bin`. MCP configs auto-discover from the project (use
`--trust-project-mcp` to skip approval prompts on repeat sessions).

for one-shot queries:

```bash
heraldstack "draft release notes for the auth → jitsi handshake refactor"
heraldstack --session cdn-css "investigate dune scene framerate drop on safari"
```

---

## the rule in one sentence

this overlay declares project context and in-scope heralds — every herald
definition, skill, and routing rule lives in `splintercells-deep-agents-cli`
and is loaded from there at session start.
