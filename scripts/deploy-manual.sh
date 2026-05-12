#!/usr/bin/env bash
# scripts/deploy-manual.sh
# Emergency deploy fallback for when Woodpecker is down.
# Replicates the Woodpecker deploy pattern for one subdomain at a time.
#
# Usage:
#   ./scripts/deploy-manual.sh <main|auth|awsug|dev> [--skip-build]
#
# Prereqs: aws cli v2, npm

set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
export AWS_PROFILE

# ── Bucket / distribution map ─────────────────────────────────────────────────
# source of truth: .woodpecker/deploy.yml
S3_BUCKET_MAIN="clouddelnorte.org"
S3_BUCKET_AUTH="auth.clouddelnorte.org"
S3_BUCKET_AWSUG="awsug.clouddelnorte.org"
S3_BUCKET_DEV="dev.clouddelnorte.org"

CF_DIST_MAIN="ECC3LP1BL2CZS"
CF_DIST_AUTH="ECQ44FO9MBTCY"
CF_DIST_AWSUG="E2QLAWFVIT1AR8"
CF_DIST_DEV="EEHVTUEQ97V0X"

# ── Args ──────────────────────────────────────────────────────────────────────
TARGET="${1:-}"
SKIP_BUILD=false
[[ "${2:-}" == "--skip-build" ]] && SKIP_BUILD=true

usage() {
  echo "Usage: $0 <main|auth|awsug|dev> [--skip-build]" >&2
  exit 1
}

[[ -z "${TARGET}" ]] && usage

case "${TARGET}" in
  main)
    BUCKET="${S3_BUCKET_MAIN}"
    DIST="${CF_DIST_MAIN}"
    LIB_DIR="lib"
    ;;
  auth)
    BUCKET="${S3_BUCKET_AUTH}"
    DIST="${CF_DIST_AUTH}"
    LIB_DIR="lib-auth"
    ;;
  awsug)
    BUCKET="${S3_BUCKET_AWSUG}"
    DIST="${CF_DIST_AWSUG}"
    LIB_DIR="lib-awsug"
    ;;
  dev)
    BUCKET="${S3_BUCKET_DEV}"
    DIST="${CF_DIST_DEV}"
    LIB_DIR="lib"
    ;;
  *)
    usage
    ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

require() { command -v "$1" >/dev/null || { echo >&2 "ERROR: missing dependency: $1"; exit 1; }; }
require aws
require npm

echo "=== deploy-manual: target=${TARGET} bucket=${BUCKET} dist=${DIST} ==="
echo "    AWS_PROFILE=${AWS_PROFILE}"
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
if [[ "${SKIP_BUILD}" == "false" ]]; then
  echo "Running npm run build…"
  npm run build --prefix "${REPO_ROOT}"
  echo ""
fi

# ── Validate output ───────────────────────────────────────────────────────────
LIB_PATH="${REPO_ROOT}/${LIB_DIR}"
if [[ ! -d "${LIB_PATH}" ]]; then
  echo "ERROR: ${LIB_PATH} does not exist — build may have failed" >&2
  exit 1
fi
if [[ ! -f "${LIB_PATH}/index.html" ]]; then
  echo "ERROR: ${LIB_PATH}/index.html not found — build output incomplete" >&2
  exit 1
fi
echo "✓ ${LIB_PATH}/index.html exists"
echo ""

# ── S3 sync ───────────────────────────────────────────────────────────────────
echo "Syncing non-asset files (no-cache)…"
aws s3 sync "${LIB_PATH}/" "s3://${BUCKET}/" \
  --delete \
  --exclude "assets/*" \
  --cache-control "no-cache"

echo ""
echo "Syncing assets (immutable)…"
aws s3 sync "${LIB_PATH}/assets/" "s3://${BUCKET}/assets/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

echo ""

# ── CloudFront invalidation ───────────────────────────────────────────────────
echo "Creating CloudFront invalidation for ${DIST}…"
INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "${DIST}" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)"

echo "✓ Invalidation created: ${INVALIDATION_ID}"
echo "  Propagation takes 5-15 minutes."
echo "  Check status: aws cloudfront get-invalidation --distribution-id ${DIST} --id ${INVALIDATION_ID}"
echo ""
echo "=== deploy-manual complete ==="
