# deployment — cloud-del-norte-website

## deploy modes

| mode | trigger | status |
| ---- | ------- | ------ |
| auto (woodpecker) | push to main | partial-recovery — not validated end-to-end (#157). do not rely on it. |
| manual fallback | operator runs scripts/deploy-manual.sh | operational norm since wave 4. works reliably. |

## manual deploy syntax

```bash
./scripts/deploy-manual.sh <main|auth|awsug|dev> [--skip-build] [--dry-run]
```

- `--dry-run` prints what would happen without touching S3 or CloudFront
- `--skip-build` reuses existing dist/ (use after a confirmed `npm run build`)
- requires: aws cli v2, npm, SSO session active (profile aerospaceug-admin)
- deploys one subdomain per invocation — run once per target

## distribution IDs

| subdomain | bucket | cloudfront distribution |
| --------- | ------ | ---------------------- |
| clouddelnorte.org (main) | clouddelnorte.org | ECC3LP1BL2CZS |
| auth.clouddelnorte.org | auth.clouddelnorte.org | ECQ44FO9MBTCY |
| awsug.clouddelnorte.org | awsug.clouddelnorte.org | E2QLAWFVIT1AR8 |
| dev.clouddelnorte.org | dev.clouddelnorte.org | EEHVTUEQ97V0X |

## cloudfront invalidation pattern

the script creates `/*` invalidation automatically. to verify propagation:

```bash
curl -sI https://clouddelnorte.org/index.html | grep -i last-modified
curl -sI https://awsug.clouddelnorte.org/index.html | grep -i last-modified
curl -sI https://auth.clouddelnorte.org/index.html | grep -i last-modified
```

last-modified timestamp must match the deploy time within a few minutes. if stale, check invalidation status in CloudFront console or re-run the script.

## manual fallback decision tree

use manual deploy when:
- woodpecker is in death-loop or SQLite-locked state (#157)
- auto-deploy webhook delivered HTTP 200 but no pipeline event surfaced
- you need to deploy a hotfix faster than waiting for CI

do NOT use manual deploy when:
- woodpecker is confirmed healthy and auto-deploy is validated end-to-end
- the change has not passed `biome ci` + `npm run build` locally

## woodpecker auto-deploy (expected behavior when healthy)

push to main triggers:
- build step (npm ci + npm run build)
- s3 sync to all 3 production buckets
- cloudfront invalidation on all 3 distributions
- pipeline status posted back to github commit

current blocker: residual user-id-0 POST storm at ~36s cadence from unidentified source. server received webhook but no pipeline event surfaced. tracked in #157.

## post-deploy verification

after any deploy, confirm with curl last-modified checks (see above). for CSS/JS changes, verify bundle hash presence:

```bash
curl -s https://clouddelnorte.org/ | grep -o 'assets/[^"]*\.css'
```

## the rule in one sentence

manual deploy via scripts/deploy-manual.sh is the operational norm until woodpecker #157 is fully resolved and auto-deploy is validated end-to-end with a successful pipeline run.
