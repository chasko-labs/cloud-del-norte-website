# cloud del norte — agents & automation

how the site gets built with AI. this is the operating manual for working on cloud del norte with claude code and the shannon agent collective.

---

## the operator stack

development runs on the **heraldstack shannon collective** — a multi-agent system built on claude code CLI. the primary session is an interactive claude code terminal on rocm-aibox. subagents are dispatched into worktrees or background tasks for parallelizable work.

```
operator (bryan) → claude code session
                         ↓
         shannon main thread (this session)
         ├── reads files, dispatches agents, assembles commits
         ├── never does heavy research inline — delegates that
         └── plans and coordinates; agents execute
```

**key principle:** orchestrate more, edit less. the main thread plans and routes. agents do research, write code, verify visuals, review PRs. anything that takes more than 3 reads or queries is a candidate for agent dispatch.

---

## agent types used on this site

### Explore (read-only search)
fast codebase search agent. use when hunting for a class, a component, an animation keyframe, a CSS selector — anything you'd otherwise `grep` through manually.

```
good for: "where is cdn-player-slot defined?", "which files use STREAMS?"
not for: code review, multi-file analysis, anything requiring Write
```

### general-purpose
full tool access (read, write, bash, search). use for multi-step tasks that don't fit a specialist: debugging, refactoring, multi-file edits. this is the swiss army knife.

### hs-shannon-theseus-kerouac-web-researcher
web research specialist. fetches docs, surveys design patterns, returns structured findings. use before any significant new feature to understand the landscape.

```
on this site used for:
- login page UX critique
- podcast player design patterns (marquee scroll, resume position, tactile buttons)
- franklin mountains radio tower reference for SVG icon design
```

### hs-shannon-theseus-liora-headless-verifier
playwright chromium in a headless verifier. navigates dev server, captures screenshots at named moments, reports observed vs expected. the closest thing to a human looking at the screen inside CI.

```
on this site: mobile player layout verification (375px, 768px, 1280px)
mandatory rule: any change to persistent-player appearance must be playwright-verified
before commit. see feedback_radio_mobile_verify.md in project memory.
```

### hs-shannon-theseus-hcom-python-coder
python and bash pipeline specialist. use for build scripts, data pipeline glue, CI tooling. the build scripts in `scripts/*.mjs` are in its wheelhouse.

### hs-shannon-theseus-stratia-pr-reviewer
posts github PR reviews. review-only — reads code, posts APPROVE or REQUEST_CHANGES. useful for a second opinion before merging a significant change.

### hs-shannon-theseus-stratia-codebase-mapper
architecture mapper. reads the whole codebase and produces dependency diagrams, import trees, coupling hotspots. use before any major refactor.

### hs-shannon-theseus-orin-github-ops
the sole write agent for github. all git operations — push, PR creation, merging, issue lifecycle — route through orin. main thread doesn't push directly.

---

## MCP servers active in this session

these servers are connected and pre-authorized in `~/.claude/settings.json`:

| server | endpoint | use on this site |
|--------|----------|-----------------|
| `context7` | context7 MCP | cloudscape + babylon.js docs. use before touching any cloudscape component or babylon API — training data is stale on recent versions |
| `qdrant-shared` | localhost:8102 | shared project knowledge, semantic search across heraldstack docs |
| `qdrant-agent-memory` | persistent | cross-session memory for agents |
| `valkey` | localhost:6379 via MCP | caching layer for agent outputs |
| `github` | github API | issue/PR/repo operations |
| `rocm-filesystem` | rocm-aibox FS | file access on the workstation |

**context7 is especially important here.** cloudscape components change APIs between minor versions — `AppLayout`, `TopNavigation`, and `BreadcrumbGroup` have all had breaking prop changes. before modifying any layout component, run context7 to verify the current API signature.

```
# example: before touching AppLayout
context7: query cloudscape AppLayout props, breadcrumbs, navigationHide, toolsHide
```

---

## Claude Code session configuration

**hooks** (in `~/.claude/hooks/`):

| hook | when it fires | what it does |
|------|--------------|-------------|
| `post-compact-context-reinject.sh` | after `/compact` | re-injects branch, stale branch warnings, and MCP service health check into session context |
| `session-start-motd.sh` | session start | prints branch/commit/service health banner |
| `user-prompt-submit-guard.sh` | every user message | runs the shannon verbal-tick and drift checks |

the post-compact hook is critical on long sessions. after `/compact` the model loses its sense of what branch it's on, whether services are healthy, and what's stale. the hook re-injects that context before the next turn.

**settings highlights** (`~/.claude/settings.json`):
```json
{
  "env": { "CLAUDE_CODE_THEME": "dark" },
  "permissions": {
    "allow": [
      "Bash(*)", "Read", "Write", "Edit", "Glob", "Grep", "Agent",
      "WebFetch(*)", "WebSearch",
      "mcp__plugin_context7_context7__*",
      "mcp__qdrant-shared__*",
      "mcp__valkey__*",
      "mcp__github__*"
    ]
  }
}
```

`Bash(*)` is fully open in this environment — the operator runs as `hs-shannon` with `NOPASSWD` sudo. tool calls are not sandboxed. this is intentional for the dev workflow but means agents must not be given ambiguous destructive instructions.

---

## project memory system

project memory lives at:
```
~/.claude/projects/-home-bryanchasko-code-websites-cloud-del-norte-website/memory/
```

these files persist across sessions and are loaded into context at session start via `MEMORY.md`. current index:

| file | what it records |
|------|----------------|
| `project_woodpecker_ci_webhook.md` | CI webhook routing, bastion proxy, all 32 repo webhooks |
| `reference_screenshot_path.md` | macmini Desktop/cloudelnorte-screenshots/ for manual visual review |
| `feedback_git_workflow.md` | always commit to dev first; never push directly to main |
| `feedback_auto_main_push.md` | after clean dev push, merge dev → main without asking |
| `feedback_no_eyeson_wait.md` | between unrelated sprint items, keep dispatching — don't wait |
| `feedback_orchestrate_more.md` | default to agent dispatch for non-trivial items |
| `feedback_radio_mobile_verify.md` | player changes must be playwright-verified at mobile widths |

**when to write memory:** save anything non-obvious that would take time to re-derive — a constraint, a preference, a workflow rule, a decision the operator had to make twice. don't save things that are in the code.

**when to update memory:** stale memories about file paths, function names, or architecture snapshots are worse than no memory. if you recall something and the code disagrees, trust the code and update the memory.

---

## the linting + formatting contract

agents must produce clean code before reporting a task done. the full check sequence:

```bash
npm run format:check   # biome check src/ — confirms formatting is clean
npm run lint           # biome lint src/ — confirms no lint errors
npx tsc --noEmit       # typecheck — confirms no type errors
npm test               # vitest run — confirms no regressions
```

biome enforces:
- no unused imports/variables
- no `any` escapes (typescript strict mode catches most)
- consistent quote style (double quotes in TSX, single in config)
- trailing commas, semicolons, no magic numbers without comment
- import sort order

if an agent edits a CSS file and breaks the adjacent TSX file's type — typecheck catches it. if an agent adds an import that biome considers a cycle — biome catches it. the full sequence is the gate, not just the file that was edited.

**before committing, always run the full sequence.** CI will run it anyway, but catching it locally is faster than watching a deploy fail and waiting for CI to tell you what you already knew.

---

## parallel agent dispatch pattern

the main thread dispatches agents in parallel when tasks are independent:

```
user asks: "fix the login page AND research podcast player patterns AND check the dune camera math"

→ dispatch: liora-headless-verifier (screenshot login page at 375px, 768px, 1280px)
→ dispatch: kerouac-web-researcher (podcast player pattern research)
→ dispatch: Explore (find dune camera constants in SceneBootstrap.ts)
→ main thread: waits for all three results, synthesizes, then edits code
```

rules:
- agents working on the same file must be sequential, not parallel (edit conflicts)
- research agents can always run in parallel
- write agents need coordination — only one agent edits a file at a time
- use `run_in_background: true` for long research tasks; `foreground` when you need the result before you can proceed

---

## verifying visual changes

the site is heavily visual — the dune scene, the glass player card, the auth glass card, the liora CRT panel, dark/light mode transitions. types passing and tests green is necessary but not sufficient.

**verification stack:**

1. **dev server** (`npm run dev`) — open localhost:8080, test the golden path manually
2. **playwright via liora-headless-verifier** — captures screenshots at 375, 768, 1280px widths; mandatory for any player change
3. **CI screenshot** — after push to dev, screenshots auto-capture at `dev.clouddelnorte.org/_ci/screenshots/latest/` (90s after deploy, cloudfront propagation)
4. **macmini screenshots** — manual screenshots from Desktop/cloudelnorte-screenshots/ when a second browser/platform is needed

for auth pages specifically: `npm run dev:auth` runs on port 8081 and serves only the auth site.

---

## woodpecker + agent integration

woodpecker pipelines are yaml, not programmable logic — they can't make decisions. for anything that needs a feedback loop (retrying a flaky deploy, adapting to a changed API, verifying something after deploy), that logic lives in an agent, not in the pipeline.

pattern for CI-aware agent work:
```
main thread → edits code → commits to dev → pushes dev
  ↓
woodpecker deploys to dev.clouddelnorte.org
  ↓
main thread dispatches liora-headless-verifier to screenshot dev.clouddelnorte.org
  ↓
verifier returns screenshots with pass/fail verdict
  ↓
if pass: merge dev → main
if fail: edit + re-push dev
```

this loop completes in ~3-5 minutes per iteration (CI + cloudfront propagation ~90s + screenshot). it's faster than context-switching to a browser, and the screenshot lives in S3 as a record.

---

## common agent workflows for this repo

**"fix a CSS bug and verify it didn't break anything"**
```
1. Read the affected CSS file
2. Edit with targeted change
3. npm run format:check && npm run lint && npm test
4. Commit to dev, push
5. liora-headless-verifier screenshots dev.clouddelnorte.org at 375/768/1280
6. Merge to main if screenshots look right
```

**"add a new radio station"**
```
1. Read src/lib/streams.ts to understand StreamDef interface
2. Add entry to STREAMS array with key, url, label, location, colors, parseMeta
3. Add key to streams-order.ts shuffle (it picks it up automatically)
4. npm test (streams.test.ts will catch malformed entries)
5. Commit + deploy
```

**"investigate a babylon.js API before touching the dune scene"**
```
context7: resolve-library-id "@babylonjs/core"
context7: query-docs "ShaderMaterial uniforms setFloat"
```

always check context7 before babylon API calls — v9 moved several things from the root package into sub-paths.

**"change a cloudscape component prop"**
```
context7: resolve-library-id "@cloudscape-design/components"
context7: query-docs "AppLayout breadcrumbs navigationHide"
```

cloudscape has a parallel "themeable" package (`@cloudscape-design/components-themeable`) for token overrides. if you're not overriding design tokens, use the standard package.

---

## known agent footguns on this codebase

- **never use relative imports** for cross-directory module paths. the project uses `src/` as root; imports are relative to file location. if you add `../../utils/something` from deep in a component, check tsconfig `paths` first.
- **CSS specificity on cloudscape tokens** — cloudscape uses obfuscated class names (`awsui_button_xyz`). our overrides use `[class*="awsui_button"]` attribute selectors. adding a new specificity level requires testing that it doesn't accidentally lose to a cloudscape base rule. always check with `body:not(.awsui-dark-mode)` for light-mode-only overrides.
- **liora assets are out-of-band** — `public/liora/` and `public/liora-embed/` are NOT in the repo. they're S3-managed separately. CI excludes them from `--delete` syncs. if you're running the dev server locally and liora isn't loading, check the `VITE_LIORA_SCRIPT_URL` env var.
- **vitest + jsdom vs. browser** — some babylon.js code will fail in jsdom (no WebGL). if you're writing tests for dune scene code, mock the babylon engine or gate the test with `if (typeof document === 'undefined')`.
- **the sparkle Hz budget** — `SPARKLE_SPEED_PLAYING` in `src/dune/white-sands-features.ts` must not exceed 1.0. that corresponds to ~2 Hz sparkle rate. above 1.5 the pattern approaches the WCAG 2.3.1 flash threshold. this constant has a safety comment; respect it.
