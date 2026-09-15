# project context — cloud-del-norte-website

## what this repo is

cloud-del-norte-website is a React + Vite SPA for the Cloud Del Norte community college CS program website. Deployed to AWS (S3 + CloudFront). Authenticated via Cognito on a dedicated auth subdomain.

## stack

- React 18 + Vite
- AWS Cloudscape Design System (UI components)
- Amazon Cognito (auth — hosted UI on auth subdomain, token flow via redirect)
- Vitest (unit/integration tests)
- boutique deploy: scripts/deploy-manual.sh + ~/.kiro/bin/kiro-verify (no CI — woodpecker decommissioned 2026-07-19, codebuild retired)
- S3 + CloudFront (hosting)

## deploy targets

- Production: S3 + CloudFront via `kiro-verify deploy main` (manual, boutique — no pipeline)
- Other subdomains: `kiro-verify deploy <auth|awsug|dev|quantum>` per target

## testing infrastructure

- **Device Farm integration**: `tests/device-farm/` is run on demand (no CI trigger — woodpecker decommissioned)
- **Test suite**: `tests/device-farm/` — pytest-based tests (auth flows, broken links, console errors, API access)
- **Credentials**: SSM Parameter Store at `/device-farm/test-users/*`
- **Infra repo**: `chasko-labs/aws-device-farm-infra` (Terraform for Device Farm project + device pools)

## notable architectural facts

- Auth subdomain pattern: Cognito hosted UI on `auth.{domain}`, token exchange via redirect back to app
- Token flow: authorization code grant → token endpoint → access/id/refresh tokens stored in session
- Vitest + biome run via local pre-push git hook (the only gate); Device Farm suite is run on demand, not via CI
- Cloudscape components are the only permitted UI library — no MUI, no Tailwind
- Static assets in `public/` are deployed as-is to S3 root

## the rule in one sentence

repo-type behaviors live in `~/.kiro/steering/repo-types/react-vite.md`; only project-specific deviations and notable architectural facts belong here

## operator discipline (session-start read)

read this section before touching any file. these are real failure patterns observed tonight on a sibling repo under the same haunting architecture (poltergeist-harald-core-anchor orchestrator) — this repo runs the identical orchestrator and is exposed to the identical failure modes even though the specific incidents happened elsewhere.

### orchestrator does not write source or tests, ever

poltergeist-harald-cloud-del-norte-product-owner (or poltergeist-harald-core-anchor acting on this repo) is gated from direct fs_write/write to src/, tests/, scripts/, dist/ per capability-matrix.md. do not attempt a direct write "because it is small" or "because it is urgent" — dispatch to the owning ghost (ghost-liora-css-repair for CSS/layout, poltergeist-stratia-aws-infra for infra, ghost-orin-ci-cd for CI/deploy) every time, before any write attempt.

### verify agent-reported completion against the real working tree before merging

before merging any PR, confirm gh pr diff <n> --name-only actually lists the expected files. if two dispatches run in parallel against the same repo, check for file or branch collision first — a dispatched agent reporting "done" does not guarantee the change is actually on the branch it claims.

### stale search-index audits produce false negatives

search/knowledge-base-backed read-only agents (ghost-stratia-code-mapper and similar) can report features as "never implemented" when their search index lags the live git history. any "X was never built" claim from a shell-less, search-only agent must be independently grep-verified against current main before acting on it.

### reviewer agents need the diff passed inline

read-only reviewer agents lack shell/git access and cannot fetch their own diff. ghost-orin-ci-cd fetches the diff and head SHA first and passes both inline in the review dispatch payload — never dispatch a review step assuming the reviewer will find the content itself. see merge-chain-review-fetch.md in this repo's own steering for the local version of this rule; keep both in sync if either changes.

### s3vectors / session-memory can go stale mid-session

if s3vectors or session-memory MCP calls report "transport closed" or "no valid session ID," that is a dead bridge connection, not a transient error — retrying the identical call will not fix it, and a fresh session is required. write time-sensitive findings to valkey instead since it stays reachable independently of that bridge.

### the session bash-gate keys on the session, not the dispatch target

poltergeist-harald-core-anchor cannot run npx/npm/lint/vitest directly, and every subagent dispatched from a core-anchor session inherits THIS session's gate profile — routing npx work to ghost-orin-ci-cd (or its luna variant) does not grant npx authority, the gate identifies the running session as core-anchor regardless of dispatch target. do not build dispatch chains to escape the gate; they all inherit it. the working path to commit+verify from a gated session: stage files by name, then `git commit` — the .husky/pre-commit hook runs lint-staged + `biome ci --diagnostic-level=error src/` in git's own shell OUTSIDE the agent gate, so the biome gate runs and passes there — then `git push`, where the pre-push hook runs unit tests as the real vitest gate. read-only git is always ungated. never run bare `npx biome ci .` (whole-repo): it false-fails on pre-existing lint debt in docs/walkthrough/*.cjs; the project scopes biome to src/ (package.json scripts + the pre-commit hook), but biome.json `files.includes` is `**` so a whole-repo scan disagrees with the project's own scripts.

### orchestrator dispatches symptom-only — no pre-reads to build briefs

the expensive orchestrator model (poltergeist-harald-core-anchor) burns tokens when it read_files and greps to assemble a detailed brief before dispatching. this is waste: the cheap ghost can and should do its own investigation. dispatch the SYMPTOM and the scope boundary, not the pre-chewed file/line map. tell the ghost "the feed cards leave awkward gaps, scope is src/pages/feed CSS, you own the investigation" — do NOT open the css files first to find the selectors and hand them over. proven this session: ghosts located their own selectors correctly every time from a symptom-only brief. the ONLY reads the orchestrator should do are (a) the one-time session-start context and (b) verifying a dispatched result landed (git diff --stat, build exit) — never exploratory reads to write a brief. if a brief feels like it needs 5 file reads to write, that is the signal to dispatch a plan-mode investigation to a cheap ghost instead, then dispatch the fix from its findings.

### commit/deploy is not orchestrator hand-work either

the git stage/commit/push and deploy sequence is mechanical and should be dispatched to ghost-orin-ci-cd, not run turn-by-turn by the orchestrator. the orchestrator confirms the result (commit sha, deploy verification tail) but does not personally run each git add / git commit / kiro-verify deploy call. batch the whole "verify + stage named files + commit + push + deploy <target> + report sha and curl check" as a single dispatch to orin. read-only git status to confirm final state is fine; running the mutation sequence by hand is the waste.