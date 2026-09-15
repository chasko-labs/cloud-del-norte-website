# deployment — cloud-del-norte-website

## deploy path

there is no CI auto-deploy. woodpecker was decommissioned 2026-07-19; codebuild is retired; github actions is forbidden (zero budget). boutique manual deploy is the permanent, only path:

| tool | command | notes |
| ---- | ------- | ----- |
| kiro-verify wrapper | `~/.kiro/bin/kiro-verify deploy <target>` | gate-safe; runs deploy-manual.sh, trims output, saves full log |
| deploy-manual.sh direct | `bash scripts/deploy-manual.sh <target>` | underlying script; one subdomain per invocation |

## manual deploy syntax

```bash
./scripts/deploy-manual.sh <main|auth|awsug|dev|quantum> [--skip-build] [--dry-run]
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
| quantum.clouddelnorte.org | quantum.clouddelnorte.org | EXLFK7JNU2JNM |

quantum is fully isolated from dev — dedicated bucket + distribution + CloudFront Function (quantum-dedicated-router). previously served from dev.clouddelnorte.org/quantum/ prefix.

## cloudfront invalidation pattern

the script creates `/*` invalidation automatically. to verify propagation:

```bash
curl -sI https://clouddelnorte.org/index.html | grep -i last-modified
curl -sI https://awsug.clouddelnorte.org/index.html | grep -i last-modified
curl -sI https://auth.clouddelnorte.org/index.html | grep -i last-modified
```

last-modified timestamp must match the deploy time within a few minutes. if stale, check invalidation status in CloudFront console or re-run the script.

## post-deploy verification

after any deploy, confirm with curl last-modified checks (see above). for CSS/JS changes, verify bundle hash presence:

```bash
curl -s https://clouddelnorte.org/ | grep -o 'assets/[^"]*\.css'
```

boutique manual deploy via `~/.kiro/bin/kiro-verify deploy <target>` (or `bash scripts/deploy-manual.sh <target>`) is the permanent and only deploy path — there is no CI, verify locally then deploy directly
