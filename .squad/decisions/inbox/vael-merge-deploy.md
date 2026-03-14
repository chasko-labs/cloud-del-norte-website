# Decision: Merge & Deploy Batch — 2026-03-13

**Author:** Vael (MPA Build & Deploy Engineer)
**Status:** Executed

## Summary

Merged 4 PRs to main in sequence: #28 (docs), #27 (squad infra + footer), #29 (locale toggle), #26 (locale tests). Skipped PRs #24, #25, #21 per instructions.

## Key Decisions

1. **README conflict resolution:** PR #27 trimmed README significantly. Preserved the Localization section from PR #28 during conflict resolution.
2. **Test fix (locale.test.ts):** Added missing `vi` import to fix `tsc` build failure introduced by PR #26. This was a bug in the PR — `globals: true` in vitest config makes `vi` available at runtime but TypeScript needs the explicit import.
3. **Deploy blocked:** AWS SSO token expired. Profile `aerospaceug-admin` (not `bc-website` as documented). Deploy requires manual `aws sso login --profile aerospaceug-admin` then re-run deploy commands.
4. **Gitignore update:** Added `coverage/`, `*.tsbuildinfo`, `.eslintcache` — standard patterns that were missing.

## Action Required

Bryan needs to:
1. Run `aws sso login --profile aerospaceug-admin`
2. Run `aws s3 sync lib/ s3://awsaerospace.org --delete --profile aerospaceug-admin`
3. Run `aws cloudfront create-invalidation --distribution-id ECC3LP1BL2CZS --paths "/*" --profile aerospaceug-admin`
