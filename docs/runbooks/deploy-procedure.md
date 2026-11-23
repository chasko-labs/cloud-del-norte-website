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
# Full deploy (builds + guards + syncs + invalidates + waits + verifies)
./scripts/deploy.sh main --apply
./scripts/deploy.sh auth --apply
./scripts/deploy.sh awsug --apply
./scripts/deploy.sh dev --apply

# Dry run (default, shows what would happen, no aws calls)
./scripts/deploy.sh main

# Dry run with read-only delete preview (needs a local build)
./scripts/deploy.sh main --check-remote
```

### What It Does

Dry run is the default. Nothing uploads without `--apply`. Dry run makes no AWS calls unless `--check-remote` is set.

Steps 1 to 4 run once for all selected targets before the first upload. Steps 5 to 8 run per target in sequence: sync, invalidate, log, verify, then the next target.

1. Build (`--apply` only): removes each target build dir, runs `npm ci`, then `npm run build`. The quantum target runs `npx vite build --config vite.config.quantum.ts` instead.
2. Validate output: `index.html` (or `landing/index.html`) must exist. main, auth, and awsug also need a non-empty `assets/` dir. quantum needs its ten brand assets under `brand/quantum/`, because its `--delete` sync would wipe them from the bucket. A dry run without a build skips this check.
3. Region check (`--apply` or `--check-remote`): `get-bucket-location` must match the region set for the target in the script. A mismatch aborts the run.
4. Delete guard (`--apply` or `--check-remote`): each sync pass runs `aws s3 sync --dryrun --delete`. Deletes are summed per bucket across all passes. A total above `MAX_DELETES` (default 25) aborts before any upload. `ALLOW_DELETES=1` overrides. Every target is guarded before the first upload, so one abort leaves every bucket untouched.
5. Sync per target, in passes with excludes. Pass 1 always runs. Each of passes 2 to 4 runs only when its source directory exists in the build output:
   - pass 1 (no-cache): app shell, excluding `assets/`, `events/`, `brand/`, `icons/`, `data/`, `liora/`, `liora-embed/`, `fiona/`, `fiona-embed/`, `screenshots/`, `quantum/`, `_previews/`
   - pass 2 (24h): `events/`, `brand/`, `icons/`
   - pass 3 (5 min): `data/`
   - pass 4 (immutable, 1y): `assets/`
   - awsug also copies `fiona-embed/` and `fiona/` from the clouddelnorte.org bucket
   - quantum runs one `--delete --exact-timestamps` sync of its build dir
6. Invalidate: `create-invalidation` on `/*` for the target distribution, then waits for it to complete (`--apply` only).
7. Log: appends a line to `.deploy.log` with timestamp, target, bucket, distribution, commit, and invalidation ID (`--apply` only).
8. Verify (`--apply` only): curls the target URL and checks the page `<title>` contains the expected text. Targets without a verify URL (dev) skip this step.

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
2. Manual deploys via `scripts/deploy-manual.sh` (since replaced by `scripts/deploy.sh`) unblocked this project on 2026-05-12

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
