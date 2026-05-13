# Deploy Process

## Quick Reference

| Target | Bucket | CloudFront | Build Dir |
|--------|--------|------------|-----------|
| main | clouddelnorte.org | ECC3LP1BL2CZS | lib/ |
| auth | auth.clouddelnorte.org | ECQ44FO9MBTCY | lib-auth/ |
| awsug | awsug.clouddelnorte.org | E2QLAWFVIT1AR8 | lib-awsug/ |
| dev | dev.clouddelnorte.org | EEHVTUEQ97V0X | lib/ |

## Standard Deploy (Woodpecker)

Push to main triggers automatic deploy of all 3 prod subdomains.
Woodpecker config: `.woodpecker/deploy.yml`

## Manual Deploy (when Woodpecker is down)

```bash
./scripts/deploy-manual.sh <main|auth|awsug|dev>
```

This cleans the output dir, rebuilds from scratch, and deploys. Never use
`--skip-build` unless you JUST ran `npm run build` in the same shell session.

## Critical: Clean Builds

The main site vite config sets `emptyOutDir: true`. This prevents stale chunks
from accumulating. If you ever see 100+ `theme-*.js` files in `lib/assets/`,
the output dir wasn't cleaned before the build that produced them.

The deploy script also does `rm -rf $LIB_DIR` before building, so even if
vite's `emptyOutDir` were absent, the deploy path is clean.

## External Dependencies

### Sumerian Host (Fiona/Liora 3D Avatar)

- Source repo: chasko-labs/sumerian-hosts
- Built artifacts: `dist/liora-embed/` (JS chunks) + `dist/liora-assets/` (GLB models)
- Deployed to: `s3://clouddelnorte.org/liora-embed/` and `s3://clouddelnorte.org/liora/`
- ALSO deployed to: `s3://awsug.clouddelnorte.org/liora-embed/` and `s3://awsug.clouddelnorte.org/liora/`
- The awsug deploy step syncs these from the main bucket automatically
- Entry point: `/liora-embed/liora-embed.js` exports `mountLioraPanel(baseUrl)`
- Consumer: `src/components/fiona-frame/index.tsx` calls `import('/liora-embed/liora-embed.js')`
- CSP requirement: `script-src` must allow `'self'` (no `unsafe-eval` needed since we use direct `import()`)

### Updating Sumerian Host

1. Build in chasko-labs/sumerian-hosts: `npm run build`
2. Sync to main bucket: `aws s3 sync dist/liora-embed/ s3://clouddelnorte.org/liora-embed/ --profile aerospaceug-admin`
3. Sync models: `aws s3 sync dist/liora-assets/ s3://clouddelnorte.org/liora/ --profile aerospaceug-admin`
4. The next awsug deploy will auto-sync from main bucket
5. Invalidate both CloudFront distributions for `/liora-embed/*` and `/liora/*`

## Deploy Verification Checklist

After EVERY deploy:

1. `curl -sI` each subdomain — confirm `last-modified` is fresh
2. Check the served JS doesn't contain stale patterns (e.g., `Function('u','return import')`)
3. Check CSS contains design tokens (grep for `--cdn-gradient-nav-start` in served CSS)
4. If fiona host was touched: verify `/liora-embed/liora-embed.js` returns 200 with correct content-type on ALL subdomains

## Common Failures

- **Stale lib/ dir**: Old chunks served because `emptyOutDir` wasn't set. Fix: `rm -rf lib/ && npm run build`
- **awsug missing liora assets**: `deploy-manual.sh` and Woodpecker both sync from main bucket now. If missing, run: `aws s3 sync s3://clouddelnorte.org/liora-embed/ s3://awsug.clouddelnorte.org/liora-embed/`
- **CSP blocking fiona mount**: The embed uses dynamic `import()`. If CSP blocks it, check `script-src` allows `'self'`. Do NOT use `Function()` constructor (that's eval).
- **mountLioraPanel undefined**: The embed exports `mountLioraPanel` (not `mountFionaPanel`). If the consumer calls the wrong name, the catch logs `[fiona-frame] mount failed`.
