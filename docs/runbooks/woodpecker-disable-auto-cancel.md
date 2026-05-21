# Runbook: Disable Woodpecker Auto-Cancel for a Project

## Context

Woodpecker's "cancel previous pipelines" feature kills in-flight pipelines when a new commit arrives on the same branch/event. This is destructive for deploy pipelines on `main` — rapid PR merges cancel each other's deploys.

**This is a project-level API setting only.** There is no YAML workflow key to control it. Reference: https://woodpecker-ci.org/docs/usage/project-settings#cancel-previous-pipelines

## Prerequisites

- Woodpecker server running (container: `heraldstack-woodpecker-server`)
- API base URL: `http://localhost:8210` (port 8210 on AIBOX, mapped from container port 8000)
- Admin API token (personal token generated in Woodpecker UI → User Settings → API tokens, or from environment variable `woodpecker_admin_api_token`)

## Auth

```bash
export WP_TOKEN="<your-personal-api-token>"
```

Verify auth works:

```bash
curl -s -H "Authorization: Bearer $WP_TOKEN" http://localhost:8210/api/user | python3 -m json.tool
```

## Procedure

### 1. Get current project state

By repo ID (faster if known):

```bash
curl -s -H "Authorization: Bearer $WP_TOKEN" \
  "http://localhost:8210/api/repos/14" | python3 -m json.tool
```

Or by owner/name (note: Woodpecker v3 routes by ID; use the repos list to find the ID first):

```bash
curl -s -H "Authorization: Bearer $WP_TOKEN" \
  "http://localhost:8210/api/repos" | python3 -c "
import json, sys
repos = json.load(sys.stdin)
for r in repos:
    if r['full_name'] == 'chasko-labs/cloud-del-norte-website':
        print(json.dumps(r, indent=2))
"
```

**Before (default):**

```json
{
    "cancel_previous_pipeline_events": ["push", "pull_request"]
}
```

### 2. Disable auto-cancel

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer $WP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cancel_previous_pipeline_events": []}' \
  "http://localhost:8210/api/repos/14" | python3 -m json.tool
```

### 3. Verify

```bash
curl -s -H "Authorization: Bearer $WP_TOKEN" \
  "http://localhost:8210/api/repos/14" | python3 -c "
import json, sys
r = json.load(sys.stdin)
print(f\"cancel_previous_pipeline_events: {r['cancel_previous_pipeline_events']}\")
"
```

**After:**

```json
{
    "cancel_previous_pipeline_events": []
}
```

## Re-enabling (if needed)

To restore the default behavior:

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer $WP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cancel_previous_pipeline_events": ["push", "pull_request"]}' \
  "http://localhost:8210/api/repos/14" | python3 -m json.tool
```

## Applying to other repos

Replace repo ID `14` with the target repo's ID. Find IDs via:

```bash
curl -s -H "Authorization: Bearer $WP_TOKEN" \
  "http://localhost:8210/api/repos" | python3 -c "
import json, sys
for r in json.load(sys.stdin):
    print(f\"{r['id']:3d}  {r['full_name']}  cancel={r['cancel_previous_pipeline_events']}\")
"
```

## API Reference

- Woodpecker API docs: https://woodpecker-ci.org/docs/usage/project-settings#cancel-previous-pipelines
- Endpoint: `PATCH /api/repos/{repo_id}`
- Field: `cancel_previous_pipeline_events` (array of event strings: `"push"`, `"pull_request"`, `"tag"`, `"deploy"`)
- Empty array `[]` = no events trigger auto-cancel (disabled)

## Change Log

| Date | Repo | Action | Issue |
|------|------|--------|-------|
| 2026-05-21 | chasko-labs/cloud-del-norte-website (id:14) | Disabled auto-cancel | #329 |
