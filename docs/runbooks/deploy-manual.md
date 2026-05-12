# Emergency Manual Deploy

## When to Use

Woodpecker pipeline is stuck, failing, or unreachable — and you need to ship NOW.

Do not use this as a routine deploy path. Fix the pipeline after.

## Pre-flight

```bash
aws sso login --profile aerospaceug-admin
```

Required for S3 write + CloudFront invalidation. The SSO session must be active.

## The Command

```bash
./scripts/deploy-manual.sh <target>
```

Targets: `main`, `auth`, `awsug`, `dev`

## What It Does

Replicates the CI deploy steps from `.woodpecker/deploy.yml`. Bucket/distribution mapping:

| Target | S3 Bucket | CF Distribution | Build Dir |
|--------|-----------|-----------------|-----------|
| main | clouddelnorte.org | ECC3LP1BL2CZS | lib/ |
| auth | auth.clouddelnorte.org | ECQ44FO9MBTCY | lib-auth/ |
| awsug | awsug.clouddelnorte.org | E2QLAWFVIT1AR8 | lib-awsug/ |
| dev | dev.clouddelnorte.org | EEHVTUEQ97V0X | lib/ |

Steps: `npm run build` → `aws s3 sync <build-dir>/ s3://<bucket>/ --delete` → `aws cloudfront create-invalidation --distribution-id <dist> --paths "/*"`

Assets get `Cache-Control: public, max-age=31536000, immutable`. Everything else gets `no-cache`.

## Verify Deploy Landed

```bash
curl -sI https://awsug.clouddelnorte.org/ | grep -i last-modified
curl -sI https://clouddelnorte.org/ | grep -i last-modified
```

Should reflect current time (within CF invalidation propagation — usually <60s).

## Rollback

```bash
git checkout <previous-sha>
./scripts/deploy-manual.sh <target>
git checkout main
```

You're deploying the old build. This is a full redeploy, not a revert.

## Follow-up

File an issue on the Woodpecker failure. Pipeline health must be restored — manual deploys are a stopgap.

## Incident Reference

**2026-05-12**: chrome-extension-moodle-uploader death-loop starved the Woodpecker SQLite backend. Pipeline was unresponsive. Manual deploy was required to ship FP-017 fix.
