# deploy

This repo has no automated deploy path yet. See issue #503.

Platform standard is CodeBuild. GitHub Actions is not permitted (zero budget).
Woodpecker was removed 2026-08-12 — it had not been running and its config
misled a merge into appearing deployed when it was not.

## manual deploy until CodeBuild lands

    npm ci --no-audit --no-fund
    npm run build          # output dir is lib/
    aws s3 sync lib/ s3://clouddelnorte.org/ --delete --exact-timestamps \
      --exclude "fiona/*" --exclude "fiona-embed/*" --exclude "data/*" \
      --exclude "assets/*" --cache-control "no-cache" --profile aerospaceug-admin
    aws s3 sync lib/assets/ s3://clouddelnorte.org/assets/ --delete \
      --exact-timestamps --cache-control "public, max-age=31536000, immutable" \
      --profile aerospaceug-admin
    aws cloudfront create-invalidation --distribution-id ECC3LP1BL2CZS \
      --paths "/*" --profile aerospaceug-admin

The --exclude flags are load-bearing: they protect fiona/, fiona-embed/,
data/ and assets/ from --delete.
