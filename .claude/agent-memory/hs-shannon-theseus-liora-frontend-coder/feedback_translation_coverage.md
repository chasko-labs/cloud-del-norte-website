---
name: translation coverage rule
description: en-US.json and es-MX.json must have identical key structures — vitest enforces this at test time
type: feedback
---

any new `t()` key added to a page component must be added to BOTH `src/locales/en-US.json` AND `src/locales/es-MX.json` simultaneously.

**Why:** `src/locales/__tests__/translation-coverage.test.ts` runs `collectKeys()` on both files and asserts they are identical. adding a key to one file but not the other will fail the test suite.

**How to apply:** when adding new showcase sections, prefer hardcoded JSX strings over new `t()` keys unless the content genuinely needs bilingual support. if `t()` keys are added, patch both JSON files in the same edit pass.
