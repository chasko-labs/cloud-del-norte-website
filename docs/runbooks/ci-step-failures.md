# Woodpecker CI step failure runbook

Diagnostic procedure and permanent fixes for known CI step failures in the
cloud-del-norte-website pipelines (.woodpecker/deploy.yml, ci.yml,
screenshot.yml, device-farm.yml).

## How to diagnose

The Woodpecker UI is at `http://192.168.4.53:8210/` (LAN-only, requires SSO).
For scripted diagnosis without UI access, query the SQLite database directly
on the host running the woodpecker-server container:

```bash
DB=/var/lib/docker/volumes/heraldstack-woodpecker-server-data/_data/woodpecker.sqlite

# Find repo id
sudo sqlite3 $DB "SELECT id, full_name FROM repos WHERE full_name LIKE '%cloud-del-norte%';"

# Recent pipelines for that repo (substitute REPO_ID)
sudo sqlite3 $DB -header -column "SELECT id, number, status, branch, datetime(created,'unixepoch','localtime') AS created FROM pipelines WHERE repo_id=REPO_ID ORDER BY id DESC LIMIT 10;"

# Steps for a specific pipeline
sudo sqlite3 $DB -header -column "SELECT pid, name, state, exit_code FROM steps WHERE pipeline_id=PIPELINE_ID ORDER BY pid;"

# Logs for a specific step
sudo sqlite3 $DB "SELECT data FROM log_entries WHERE step_id=STEP_ID ORDER BY line DESC LIMIT 30;"
```

## Known failure modes (resolved)

### 1. `device-farm-test` — awscli ImportError

**Symptom**: `ImportError: cannot import name 'register_feature_id' from 'botocore.useragent'`

**Root cause**: The step ran `pip install awscli` from a `python:3.12-slim`
base. PyPI's `awscli` v1 picks up an incompatible `botocore` because the
two are versioned independently and the version skew window opens
periodically. Result: awscli expects a botocore symbol that the installed
botocore doesn't export, and every `aws ...` invocation crashes before it
runs.

**Fix**: Install awscli v2 from the AWS-published binary zip pinned to
`2.27.50`. The v2 binary bundles its own Python interpreter and dependency
tree, so version skew is impossible. See `.woodpecker/device-farm.yml`.

**Why not pin pip versions instead?**: Even pinned, `awscli`/`botocore` from
pip drift apart at the patch level when you `pip install -r requirements.txt`
for the test suite. The binary install is sealed.

### 2. `qdrant-reindex` — private repo clone with no auth

**Symptom**: `fatal: could not read Username for 'https://github.com': No
such device or address`

**Root cause**: The step did `git clone https://github.com/BryanChasko/
haunting-kiro-cli.git` to pull an indexer script, but `haunting-kiro-cli` is
a private repo and the Woodpecker CI workspace has no GitHub token.

**Fix**: Removed the step entirely from `.woodpecker/deploy.yml`. The
qdrant index lives in the haunting collective's domain, not the
cloud-del-norte-website's. If qdrant indexing of cdn website source is
actually required, do it from a pipeline that runs IN the haunting-kiro-cli
repo (which has GitHub access to itself) and uses the GitHub API to
enumerate cdn website file changes — not the other way around.

### 3. `screenshot-capture-prod`, `capture-prod` — Playwright version mismatch

**Symptom**: `browserType.launch: Executable doesn't exist at
/ms-playwright/chromium_headless_shell-XXX/chrome-linux/headless_shell`
followed by an explicit Playwright version mismatch warning.

**Root cause**: The Docker image tag (e.g. `playwright:v1.49.0-jammy`)
specified a Chromium build that the installed `playwright` npm package
(at v1.55.1, per package.json) couldn't find. Playwright pins its browser
builds tightly to the npm package version; the image tag MUST match.

**Fix**: Pinned all 4 playwright image references in `.woodpecker/`
screenshot.yml and `.woodpecker/deploy.yml` to `playwright:v1.55.1-noble`
to match `package.json`.

**Maintenance rule**: When bumping the npm `playwright` version in
package.json, also bump the 4 image tags in the YAML pipelines. Search
`.woodpecker/*.yml` for `playwright:v` to find them all.

### 4. `aws-cli:latest` tag drift (preventive)

**Symptom**: Steps using `public.ecr.aws/aws-cli/aws-cli:latest` may break
without warning when AWS publishes a new latest tag with a regression.

**Fix**: Pinned all `aws-cli:latest` references to `:2.27.50` in
`.woodpecker/deploy.yml` and `.woodpecker/ci.yml`.

**Maintenance rule**: Bump the version intentionally when needed; don't
track `:latest`.

## Failure mode markers

Steps in this pipeline are tagged with `failure: ignore` or `failure: fail`.

- `failure: ignore` — step CAN fail, the overall pipeline still succeeds.
  Used for non-critical steps like screenshots and notifications.
- `failure: fail` (default) — step failure marks the pipeline as failed.

**Important**: Even a `failure: ignore` step's failure shows in the
pipeline summary as a failed step. Look at the actual deploy step's state
to determine whether the website was actually published. The pipeline's
overall "failure" status alone is not a reliable signal of deploy outcome.
