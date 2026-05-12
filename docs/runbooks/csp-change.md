# CSP Change — Without Drift

## Source of Truth

`infra/cloudfront-security-headers.json`

This file defines the full CloudFront response headers policy including CSP, HSTS, Permissions-Policy. All live CloudFront distributions pull from this definition.

## How to Add a Domain to a CSP Directive

1. Edit `infra/cloudfront-security-headers.json` — add the origin to the relevant directive (`connect-src`, `frame-src`, `img-src`, etc.)
2. Dry-run: `./scripts/sync-cloudfront-headers.sh --dry-run` — shows diff between repo file and live policy without pushing
3. Commit the JSON change
4. Push — CI runs `scripts/verify-csp.sh` which compares live headers against the repo file

## Why Drift Happens

| Cause | Result |
|-------|--------|
| Manual edit in CloudFront console | Live policy diverges from repo; next sync overwrites your console edit OR repo stays stale |
| `aws cloudfront update-response-headers-policy` without updating the JSON file | Same — live drifts ahead of repo |
| Forgetting to push after editing the file | Repo is correct but live is stale |

Drift is silent. You won't know until something breaks or `verify-csp.sh` catches it on next push.

## What `scripts/verify-csp.sh` Checks

Runs on every push (CI). Fetches the live response headers policy from CloudFront, diffs against `infra/cloudfront-security-headers.json`. Fails the pipeline if they diverge.

## Recovery

If you find drift (live ≠ repo):

```bash
./scripts/sync-cloudfront-headers.sh
```

This pushes repo → live. The repo file is always authoritative.

If the repo file is wrong (someone committed a bad CSP), fix the file first, then sync.

## Incident Reference

**2026-05-12 FP-017**: Stale live CSP policy was missing `connect-src` entry for Cognito token endpoint. `/oauth2/token` refresh requests were blocked by the browser for hours. Root cause: the JSON file was updated but sync never ran (or a console edit overwrote it). Diagnosed via CSP violation errors in browser console — the diagnostic script caught it in seconds once instrumented.
