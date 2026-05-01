#!/usr/bin/env bash
# recover-liora-assets.sh
#
# one-shot manual recovery for missing liora assets on s3://dev.clouddelnorte.org.
#
# why this exists:
#   .woodpecker/deploy.yml deploy-dev step mirrors `s3://awsaerospace.org/liora/`
#   and `s3://awsaerospace.org/liora-embed/` into `s3://dev.clouddelnorte.org/`.
#   in practice the legacy awsaerospace bucket is missing some objects that prod
#   (clouddelnorte.org, served via cloudfront ECC3LP1BL2CZS) actually serves —
#   notably /liora/fiona.glb (8432296 bytes, model/gltf-binary, last-modified
#   2026-04-29). dev sync silently completes without copying that object so
#   dev.clouddelnorte.org returns the SPA fallback (text/html, 3521 bytes) for
#   /liora/fiona.glb and the panel sticks at "modem connecting".
#
# what this does:
#   downloads each missing asset from the public prod CDN URL (which we KNOW
#   returns the right bytes + content-type) and uploads it into the dev bucket
#   under the same key. bypasses the awsaerospace mirror entirely. idempotent —
#   safe to re-run.
#
# credentials required:
#   the operator's "ops-reader" role (rolesanywhere) has read-only s3 and
#   CANNOT s3 cp to dev.clouddelnorte.org. run this with an admin profile that
#   has s3:PutObject on s3://dev.clouddelnorte.org/* and cloudfront:CreateInvalidation
#   on distribution EEHVTUEQ97V0X.
#
# how to run:
#   AWS_PROFILE=admin bash scripts/recover-liora-assets.sh
#
# or, if you only have the heraldstack-ci-deploy role wired (same role CI uses):
#   AWS_PROFILE=ci-deploy bash scripts/recover-liora-assets.sh
#
# verify after running:
#   curl -sI https://dev.clouddelnorte.org/liora/fiona.glb
#     → HTTP/2 200, content-type: model/gltf-binary, content-length: 8432296
#   node scripts/probe-liora-headless.mjs https://dev.clouddelnorte.org/home/index.html
#     → exit 0, panel state shimmerOpacity=0

set -euo pipefail

DEV_BUCKET="dev.clouddelnorte.org"
DEV_DISTRIBUTION_ID="EEHVTUEQ97V0X"
PROD_BASE="https://clouddelnorte.org"

# add more keys here if other liora assets are found missing from dev.
# format: <s3-key> <content-type>
ASSETS=(
  "liora/fiona.glb model/gltf-binary"
)

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "==> sts identity"
aws sts get-caller-identity

INVALIDATE_PATHS=()
for entry in "${ASSETS[@]}"; do
  key="${entry%% *}"
  ctype="${entry#* }"
  url="${PROD_BASE}/${key}"
  local_file="${TMPDIR}/$(basename "$key")"

  echo "==> fetch $url"
  curl -fsSL -o "$local_file" "$url"
  size=$(stat -c%s "$local_file")
  echo "    got ${size} bytes"

  echo "==> put s3://${DEV_BUCKET}/${key} (content-type: ${ctype})"
  aws s3 cp "$local_file" "s3://${DEV_BUCKET}/${key}" \
    --content-type "$ctype" \
    --cache-control "max-age=31536000, immutable"

  INVALIDATE_PATHS+=("/${key}")
done

echo "==> cloudfront invalidate ${INVALIDATE_PATHS[*]}"
aws cloudfront create-invalidation \
  --distribution-id "$DEV_DISTRIBUTION_ID" \
  --paths "${INVALIDATE_PATHS[@]}"

echo "==> done. verify with:"
echo "    curl -sI https://dev.clouddelnorte.org/liora/fiona.glb"
