# dispatch orchestration — cloud-del-norte-website

## dag structure

dispatches follow a multi-stage DAG. each stage is a set of ghost dispatches that run in parallel (disjoint file scope) or sequential (shared file scope).

```
stage 1: [ghost-a, ghost-b, ghost-c]  ← parallel, disjoint files
stage 2: [ghost-d] depends_on: [ghost-c]  ← sequential, shared locale files
stage 3: [ghost-e] depends_on: [stage 1, stage 2]  ← commit + deploy
stage 4: [ghost-f] depends_on: [stage 3]  ← verify
```

## parallel vs sequential

| pattern | when to use |
| ------- | ----------- |
| parallel-no-deps | tracks touch disjoint file sets (e.g. CSS-only vs lambda-only vs test-only) |
| sequential depends_on | tracks touch the same file (en-US.json + es-MX.json merge race, shared component) |

locale files (src/locales/en-US.json, src/locales/es-MX.json) are the primary merge-race surface. any two tracks adding i18n keys must serialize via depends_on.

## ghost types proven on this codebase

| ghost | domain | proven pattern |
| ----- | ------ | -------------- |
| solan-rust-coder | react components, lambdas, infra scripts | 4-of-4 reliable parallel dispatch (wave 4) |
| liora-css-repair | css fixes, cloudscape overrides | targeted selector work with !important scoping |
| liora-headless-verifier | playwright chromium audit | pre/post visual verification, screenshot capture |
| orin-ci-cd | woodpecker pipelines, deploy scripts, git ops | commit + deploy + invalidation |
| kade-vox-host-admin | host-level systemd, docker, server triage | woodpecker server restart, service stop/disable |
| kerouac-source-scribe | documentation, handoff, steering docs | distillation, session capture |

## pre-dispatch context injection

every ghost prompt MUST include before the task description:
- sso profile name (aerospaceug-admin)
- account number for the target resource
- exact file paths and line numbers for the change target
- prior session evidence (commit hashes, error messages, curl outputs)
- any friction-point ID if the work relates to a known FP

this prevents ghosts from re-discovering context that the orchestrator already holds. inject facts, not questions.

## single-atomic-commit-per-phase rule

each logical phase of work produces exactly one commit. do not split a single feature across multiple commits within one phase. do not bundle unrelated features into one commit across phases.

good: one commit for "modal button color fix" containing all files that fix touches
bad: two commits splitting the same fix into "css change" + "test update"
bad: one commit containing both "modal fix" + "unrelated skeleton feature"

## plan vs act line-of-distinction

| mode | behavior |
| ---- | -------- |
| plan | read files, analyze, propose approach, identify file paths + line numbers, report back |
| act | write code, run build, commit, deploy |

ghosts dispatched in "plan" mode MUST NOT write files. ghosts dispatched in "act" mode MUST run biome ci + npm run build before reporting success. the orchestrator decides which mode based on confidence level and whether Bryan has approved the approach.

## the rule in one sentence

dispatch parallel when file scopes are disjoint, serialize when they overlap, inject all known context into ghost prompts so they act on evidence rather than re-discovering it.
