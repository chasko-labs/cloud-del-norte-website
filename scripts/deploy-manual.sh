#!/usr/bin/env bash
# scripts/deploy-manual.sh
# Emergency deploy fallback for when Woodpecker is down.
# Replicates the Woodpecker deploy pattern for one subdomain at a time.
#
# Usage:
#   ./scripts/deploy-manual.sh <main|auth|awsug|dev|quantum> [--skip-build]
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
DRY_RUN=false
shift || true
for arg in "$@"; do
  case "${arg}" in
    --skip-build) SKIP_BUILD=true ;;
    --dry-run)    DRY_RUN=true ;;
  esac
done

QUANTUM_MODE=false

usage() {
  echo "Usage: $0 <main|auth|awsug|dev|quantum> [--skip-build] [--dry-run]" >&2
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
  quantum)
    BUCKET="${S3_BUCKET_DEV}"
    DIST="${CF_DIST_DEV}"
    LIB_DIR="lib-quantum"
    QUANTUM_MODE=true
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
if [[ "${SKIP_BUILD}" == "true" ]]; then
  echo "⚠️  WARNING: CAUTION: deploying existing build output without rebuilding."
  echo "   Only use if you just ran npm run build."
  echo ""
elif [[ "${QUANTUM_MODE}" == "true" ]]; then
  echo "Building quantum site with vite.config.quantum.ts…"
  rm -rf "${REPO_ROOT}/${LIB_DIR}"
  npx vite build --config vite.config.quantum.ts
  echo ""
else
  echo "Cleaning ${LIB_DIR}/ and running npm run build…"
  rm -rf "${REPO_ROOT}/${LIB_DIR}"
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
# Wave 49 — 4-pass Cache-Control tiering for El Paso regional perf.
#
# Prior state: 2-pass (assets/* immutable, everything else no-cache).
# Problem: /events/*.webp, /brand/*, /icons/* all served no-cache → every
# viewer hit origin every request, x-cache: Miss from cloudfront across the board.
#
# New tiering:
#   pass 1: app shell (html + everything not matched below)  → no-cache
#   pass 2: /events/, /brand/, /icons/ (media)               → 24h + must-revalidate
#   pass 3: /data/ (build-time JSON feeds)                   → 5min + must-revalidate
#   pass 4: /assets/ (vite hashed bundles)                   → 1y immutable
#
# Each non-shell pass is gated on directory existence so subdomains without
# those paths (auth, dev) don't fail.
# ──────────────────────────────────────────────────────────────────────────────

if [[ "${DRY_RUN}" == "true" ]]; then
  if [[ "${QUANTUM_MODE}" == "true" ]]; then
    echo "[dry-run] Would sync ${LIB_PATH}/ → s3://${BUCKET}/quantum/"
  else
    echo "[dry-run] Would sync ${LIB_PATH}/ → s3://${BUCKET}/"
  fi
  echo "[dry-run] Would invalidate distribution ${DIST}"
  echo "=== deploy-manual dry-run complete ==="
  exit 0
fi

if [[ "${QUANTUM_MODE}" == "true" ]]; then
  # ── Quantum: simple sync to quantum/ prefix ─────────────────────────────────
  # --delete is safe here because it's scoped to the quantum/ prefix only
  echo "Syncing quantum site to s3://${BUCKET}/quantum/…"
  aws s3 sync "${LIB_PATH}/" "s3://${BUCKET}/quantum/" \
    --delete \
    --exact-timestamps

  echo ""
  echo "Creating CloudFront invalidation for ${DIST} (quantum paths)…"
  INVALIDATION_ID="$(aws cloudfront create-invalidation \
    --distribution-id "${DIST}" \
    --paths "/quantum/*" \
    --query 'Invalidation.Id' \
    --output text)"

  echo "✓ Invalidation created: ${INVALIDATION_ID}"
  echo "  Waiting for invalidation to complete…"
  aws cloudfront wait invalidation-completed \
    --distribution-id "${DIST}" \
    --id "${INVALIDATION_ID}"
  echo "✓ Invalidation complete."

else
  # ── Standard multi-pass deploy ──────────────────────────────────────────────

  # pass 1: app shell — everything except tiered paths (no-cache)
  echo "Pass 1/4: app shell (no-cache)…"
  aws s3 sync "${LIB_PATH}/" "s3://${BUCKET}/" \
    --delete \
    --exclude "assets/*" \
    --exclude "events/*" \
    --exclude "brand/*" \
    --exclude "icons/*" \
    --exclude "data/*" \
    --exclude "liora/*" \
    --exclude "liora-embed/*" \
    --exclude "fiona/*" \
    --exclude "fiona-embed/*" \
    --exclude "screenshots/*" \
    --exclude "quantum/*" \
    --exclude "_previews/*" \
    --cache-control "no-cache"

  # pass 2: media assets — 24h cache (events, brand, icons)
  if [[ -d "${LIB_PATH}/events" ]] || [[ -d "${LIB_PATH}/brand" ]] || [[ -d "${LIB_PATH}/icons" ]]; then
    echo ""
    echo "Pass 2/4: media (24h, must-revalidate)…"
    [[ -d "${LIB_PATH}/events" ]] && aws s3 sync "${LIB_PATH}/events/" "s3://${BUCKET}/events/" \
      --delete \
      --cache-control "public, max-age=86400, must-revalidate"
    [[ -d "${LIB_PATH}/brand" ]] && aws s3 sync "${LIB_PATH}/brand/" "s3://${BUCKET}/brand/" \
      --delete \
      --cache-control "public, max-age=86400, must-revalidate"
    [[ -d "${LIB_PATH}/icons" ]] && aws s3 sync "${LIB_PATH}/icons/" "s3://${BUCKET}/icons/" \
      --delete \
      --cache-control "public, max-age=86400, must-revalidate"
  fi

  # pass 3: build-time data feeds — 5min cache
  if [[ -d "${LIB_PATH}/data" ]]; then
    echo ""
    echo "Pass 3/4: data feeds (5min, must-revalidate)…"
    aws s3 sync "${LIB_PATH}/data/" "s3://${BUCKET}/data/" \
      --delete \
      --cache-control "public, max-age=300, must-revalidate"
  fi

  # pass 4: vite hashed bundles — immutable 1y
  if [[ -d "${LIB_PATH}/assets" ]]; then
    echo ""
    echo "Pass 4/4: hashed bundles (immutable, 1y)…"
    aws s3 sync "${LIB_PATH}/assets/" "s3://${BUCKET}/assets/" \
      --delete \
      --cache-control "public, max-age=31536000, immutable"
  fi

  echo ""

  # ── Liora/Fiona vendor assets (awsug only) ─────────────────────────────────
  if [[ "${TARGET}" == "awsug" ]]; then
    echo ""
    echo "Syncing fiona vendor assets from main bucket…"
    aws s3 sync "s3://${S3_BUCKET_MAIN}/fiona-embed/" "s3://${BUCKET}/fiona-embed/"
    aws s3 sync "s3://${S3_BUCKET_MAIN}/fiona/" "s3://${BUCKET}/fiona/"
  fi

  # ── CloudFront invalidation ─────────────────────────────────────────────────
  echo "Creating CloudFront invalidation for ${DIST}…"
  INVALIDATION_ID="$(aws cloudfront create-invalidation \
    --distribution-id "${DIST}" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)"

  echo "✓ Invalidation created: ${INVALIDATION_ID}"
  echo "  Waiting for invalidation to complete…"
  aws cloudfront wait invalidation-completed \
    --distribution-id "${DIST}" \
    --id "${INVALIDATION_ID}"
  echo "✓ Invalidation complete."
fi

# ── Deploy log ────────────────────────────────────────────────────────────────
DEPLOY_LOG="${REPO_ROOT}/.deploy.log"
COMMIT_SHA="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) target=${TARGET} bucket=${BUCKET} dist=${DIST} commit=${COMMIT_SHA} invalidation=${INVALIDATION_ID}" >> "${DEPLOY_LOG}"
echo "✓ Logged to ${DEPLOY_LOG}"

# ── Verify ────────────────────────────────────────────────────────────────────
case "${TARGET}" in
  main)    VERIFY_URL="https://clouddelnorte.org/" ;;
  auth)    VERIFY_URL="https://auth.clouddelnorte.org/" ;;
  awsug)   VERIFY_URL="https://awsug.clouddelnorte.org/" ;;
  dev)     VERIFY_URL="https://dev.clouddelnorte.org/" ;;
  quantum) VERIFY_URL="https://quantum.clouddelnorte.org/" ;;
esac

echo ""
echo "Verifying deploy landed…"
LAST_MOD="$(curl -sI "${VERIFY_URL}" | grep -i last-modified || echo "(no last-modified header)")"
echo "  ${VERIFY_URL} → ${LAST_MOD}"

# ── Post-deploy title verification ────────────────────────────────────────────
echo ""
echo "=== Post-deploy verification ==="
for check in "https://clouddelnorte.org/|AWS UG Cloud del Norte" "https://quantum.clouddelnorte.org/|Amazon Braket Workshop" "https://awsug.clouddelnorte.org/|Cloud del Norte" "https://auth.clouddelnorte.org/login/index.html|Sign in"; do
  url="${check%%|*}"
  expected="${check##*|}"
  title=$(curl -s "$url" | grep -o '<title>[^<]*' | head -1)
  if echo "$title" | grep -q "$expected"; then
    echo "  PASS: $url — $title"
  else
    echo "  FAIL: $url — expected '$expected', got '$title'"
    exit 1
  fi
done

echo ""
echo "=== deploy-manual complete ==="
