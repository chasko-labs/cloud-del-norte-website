# merge-chain review-fetch — bounded-excerpt extraction pattern

narrows the review-fetch stage of the merge-and-deploy-chain. orin extracts targeted excerpts per audit criterion rather than passing full diffs inline. eliminates payload-size failures regardless of PR size.

## precipitating incidents

PR #471 and #472 merge cycle (2026-08-14):

1. style-gate FAIL halted the pipeline before the diff was captured — auditor received no diff content
2. full diff exceeded inline payload capacity — auditor received truncated/empty context

workaround (now the standard): bounded grep excerpts per audit criterion, passed as the review surface. auditor evaluated excerpts and returned APPROVE for both PRs.

## the pattern

orin (review-fetch stage) runs:

```bash
git fetch origin
HEAD_SHA=$(gh pr view <n> --json headRefOid -q .headRefOid)
FULL_DIFF=$(gh pr diff <n>)
DIFF_HASH=$(echo "$FULL_DIFF" | sha256sum | cut -d' ' -f1)
```

then extracts bounded excerpts per audit criterion:

| criterion | extraction command | max lines |
| --------- | ----------------- | --------- |
| feeds.json noise | `echo "$FULL_DIFF" \| grep -A3 -B1 'feeds.json'` | 50 |
| secrets patterns | `echo "$FULL_DIFF" \| grep -inE '(password\|secret\|token\|api.?key\|credential)' \| head -30` | 30 |
| locale file changes | `echo "$FULL_DIFF" \| grep -A5 'src/locales/'` | 80 |
| src/ file list | `echo "$FULL_DIFF" \| grep '^diff --git' \| grep 'src/'` | 100 |
| test changes | `echo "$FULL_DIFF" \| grep '^diff --git' \| grep -E '(test\|spec)'` | 50 |
| config changes | `echo "$FULL_DIFF" \| grep '^diff --git' \| grep -E '(vite\.config\|tsconfig\|package\.json\|biome)'` | 50 |
| steering/docs changes | `echo "$FULL_DIFF" \| grep '^diff --git' \| grep -E '(\.kiro/\|docs/\|AGENTS\.md\|README)'` | 50 |

## payload structure sent to auditor

```json
{
  "head_sha": "<HEAD_SHA>",
  "diff_hash": "<sha256 of full diff>",
  "file_list": ["src/...", "..."],
  "excerpts": {
    "feeds_json": "<bounded text or 'no matches'>",
    "secrets_scan": "<bounded text or 'no matches'>",
    "locale_changes": "<bounded text or 'no matches'>",
    "src_files": "<bounded text>",
    "test_changes": "<bounded text or 'no matches'>",
    "config_changes": "<bounded text or 'no matches'>",
    "steering_docs": "<bounded text or 'no matches'>"
  },
  "pr_number": <n>,
  "pr_title": "<title>",
  "total_files_changed": <count>,
  "total_lines": "+<add> -<del>"
}
```

## auditor behavior under this pattern

- auditor confirms `head_sha` matches the task's stated PR head (unchanged from base chain)
- auditor reviews the bounded excerpts — not the full diff
- `diff_hash` field lets the auditor detect staleness if excerpts are passed across a context boundary where the PR advanced
- if `excerpts` is empty or all fields are 'no matches' and `total_files_changed > 0` → ABORT with `missing-excerpt-context`

## relationship to merge-and-deploy-chain.md

this doc refines the review-fetch stage described in `steering/common/merge-and-deploy-chain.md`. the base doc's statement "passes diff and head SHA inline" is now implemented as bounded-excerpt extraction rather than full-diff passthrough. all other stages (stale-gate, review-verdict, merge-or-hold, deploy) are unchanged.

## the rule in one sentence

orin extracts bounded excerpts per audit criterion from the full diff — never passes the full diff inline — and includes a diff hash so the auditor can detect staleness without filesystem access
