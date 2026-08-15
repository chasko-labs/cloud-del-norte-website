# project context — cloud-del-norte-website

## what this repo is

cloud-del-norte-website is a React + Vite SPA for the Cloud Del Norte community college CS program website. Deployed to AWS (S3 + CloudFront). Authenticated via Cognito on a dedicated auth subdomain.

## stack

- React 18 + Vite
- AWS Cloudscape Design System (UI components)
- Amazon Cognito (auth — hosted UI on auth subdomain, token flow via redirect)
- Vitest (unit/integration tests)
- Woodpecker CI (build, deploy, device-farm testing)
- S3 + CloudFront (hosting)

## deploy targets

- Production: S3 bucket via Woodpecker pipeline on main merge
- Preview: per-branch deploys on PR (CloudFront invalidation)

## testing infrastructure

- **Device Farm integration**: `.woodpecker/device-farm.yml` — runs cross-browser/device tests on AWS Device Farm
- **Test suite**: `tests/device-farm/` — pytest-based tests (auth flows, broken links, console errors, API access)
- **Credentials**: SSM Parameter Store at `/device-farm/test-users/*`
- **Infra repo**: `chasko-labs/aws-device-farm-infra` (Terraform for Device Farm project + device pools)

## notable architectural facts

- Auth subdomain pattern: Cognito hosted UI on `auth.{domain}`, token exchange via redirect back to app
- Token flow: authorization code grant → token endpoint → access/id/refresh tokens stored in session
- Vitest runs in CI on every PR; Device Farm runs on main merge
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