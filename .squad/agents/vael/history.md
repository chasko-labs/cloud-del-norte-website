# Agent History

**Created:** 2026-03-13
**Agent:** Vael (MPA Build & Deploy Engineer)

## Core Context

Initial setup — Squad team infrastructure created for Cloudscape Design System website project.

## Learnings

### 2026-03-13 — Merge & Deploy Session

- **PRs merged:** #28 (localization docs), #27 (squad infra + footer + leader cards), #29 (locale toggle infrastructure), #26 (locale TDD tests)
- **PRs skipped:** #24 (destructive team.md overwrite), #25 (WIP, no code), #21 (dependabot/undici)
- **Gitignore hardened:** Added `coverage/`, `*.tsbuildinfo`, `.eslintcache`
- **Build fix:** PR #26's `locale.test.ts` was missing `vi` import — `tsc` failed. Fixed by adding `vi` to the vitest import.
- **Barrel import note:** `create-meeting/app.tsx` still has a barrel import for `ContentLayout` from `@cloudscape-design/components` — pre-existing, not introduced by these PRs. Should be fixed in a future PR.
- **AWS profile:** The deploy docs reference `bc-website` profile but the actual configured profile is `aerospaceug-admin`. Needs SSO login before deploy.
- **PR #27 vs #29 overlap:** PR #29 was a superset of #27 (shared the same base footer/squad commits + added locale). Merging #27 first then #29 worked cleanly because GitHub deduplicated the shared commits.
- **Quality gate results:** Lint ✅ | Tests 120/120 ✅ | Build ✅
