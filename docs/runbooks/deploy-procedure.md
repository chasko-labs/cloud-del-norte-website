# Deploy Procedure — cloud-del-norte-website

## Infrastructure Map

| Subdomain | S3 Bucket | CloudFront Distribution | Build Dir |
|-----------|-----------|------------------------|-----------|
| clouddelnorte.org (main) | clouddelnorte.org | ECC3LP1BL2CZS | lib/ |
| auth.clouddelnorte.org | auth.clouddelnorte.org | ECQ44FO9MBTCY | lib-auth/ |
| awsug.clouddelnorte.org | awsug.clouddelnorte.org | E2QLAWFVIT1AR8 | lib-awsug/ |
| dev.clouddelnorte.org | dev.clouddelnorte.org | EEHVTUEQ97V0X | lib/ |

---

## Normal Path (Woodpecker CI)

Push to **main** → Woodpecker auto-deploys all 3 production subdomains (main, auth, awsug).

Push to **any other branch** → Woodpecker deploys to dev.clouddelnorte.org.

Pipeline stages: `install` → `biome` → `typecheck` → `build` → `verify-csp` → `deploy*` → `notify` → `screenshot` → `qdrant-reindex`

### Verify CI Deploy Landed

```bash
# Check headers after push (allow ~90s for pipeline + invalidation)
curl -sI https://clouddelnorte.org/ | grep -i last-modified
curl -sI https://awsug.clouddelnorte.org/ | grep -i last-modified
curl -sI https://auth.clouddelnorte.org/ | grep -i last-modified
```

Or check ntfy: `https://ntfy.sh/cdn-deploy-74697e0f`

---

## Manual Deploy Fallback

When Woodpecker is stuck, failing, or unreachable.

### Prerequisites

- AWS SSO session active: `aws sts get-caller-identity --profile aerospaceug-admin`
- Node.js + npm available
- aws cli v2

### Commands

```bash
# Full deploy (builds + syncs + invalidates + waits + verifies)
./scripts/deploy-manual.sh main
./scripts/deploy-manual.sh auth
./scripts/deploy-manual.sh awsug
./scripts/deploy-manual.sh dev

# Skip build (already built locally)
./scripts/deploy-manual.sh main --skip-build

# Dry run (shows what would happen)
./scripts/deploy-manual.sh main --dry-run
```

### What It Does

1. `npm run build` (unless `--skip-build`)
2. Validates `<lib-dir>/index.html` exists
3. `aws s3 sync` non-assets with `no-cache`
4. `aws s3 sync` assets with immutable cache
5. `aws cloudfront create-invalidation`
6. Waits for invalidation to complete
7. Logs deploy to `.deploy.log`
8. Curls the site to verify last-modified changed

---

## Woodpecker Diagnostic Triage

Run these 3 commands on **rocm-aibox** (192.168.4.53) to determine runner health:

```bash
# 1. Are server + agent alive?
docker ps --filter "name=heraldstack-woodpecker" --format "table {{.Names}}\t{{.Status}}"

# 2. Any stuck pipeline containers?
docker ps --filter "name=wp_" --format "table {{.Names}}\t{{.Status}}\t{{.RunningFor}}"

# 3. Recent errors in agent log?
docker logs heraldstack-woodpecker-agent --tail 50 2>&1 | grep -iE "error|fail|retry"
```

### Interpreting Results

| Symptom | Diagnosis | Action |
|---------|-----------|--------|
| Server/agent not running | Service down | Restart (see below) |
| `wp_*` container running >30min | Stuck pipeline | Kill container |
| `queue.Done: cannot ack workflow` | Autocancel race | Benign — pipeline was superseded |
| `exit code 1` on this repo | Build/deploy step failed | Check pipeline UI or re-push |
| `exit code 2` on another repo | Other repo failing | Not blocking — agent still picks up jobs |

---

## Known-Stuck Recovery

### Kill a stuck pipeline container

```bash
# Find it
docker ps --filter "name=wp_" --format "{{.ID}} {{.Names}} {{.RunningFor}}"

# Kill it
docker stop <container-id>
```

### Restart Woodpecker agent

```bash
cd ~/code/heraldstack/heraldstack-infra
docker compose restart woodpecker-agent
```

### Restart both server + agent

```bash
cd ~/code/heraldstack/heraldstack-infra
docker compose restart woodpecker-server woodpecker-agent
```

### Re-trigger a pipeline manually

Via Woodpecker UI: `http://192.168.4.53:8000` → repo → pipeline → "Restart"

Or push an empty commit:
```bash
git commit --allow-empty -m "ci: retrigger deploy"
git push
```

---

## Issue #157 Context

The chrome-extension-moodle-uploader repo had a death-loop that locked Woodpecker's SQLite backend (2026-05-12). This project's pipelines were starved. The fix was:

1. The moodle-uploader repo's pipeline was cancelled/fixed in its own repo
2. Manual deploys via `deploy-manual.sh` unblocked this project

If #157 recurs: the agent is NOT stuck — it's processing the looping repo's retries. This project's jobs will queue behind them. Use manual deploy as fallback.

---

## CloudFront Security Headers

```bash
# Sync CSP headers for awsug distribution (idempotent)
AWS_PROFILE=aerospaceug-admin ./scripts/sync-cloudfront-headers.sh

# Dry run
AWS_PROFILE=aerospaceug-admin ./scripts/sync-cloudfront-headers.sh --dry-run
```

Only covers awsug. Main/auth CSP tracked in issue #158.
