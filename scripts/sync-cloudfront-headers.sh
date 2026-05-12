#!/usr/bin/env bash
# scripts/sync-cloudfront-headers.sh
#
# Applies infra/cloudfront-security-headers.json to the awsug CloudFront
# response-headers-policy ONLY. Idempotent — no-ops when already in sync.
#
# NOTE: main and auth subdomains are intentionally out of scope here.
# Their CSP requirements are simpler and not yet captured in this repo.
# Per-subdomain CSP config is follow-up work tracked in issue #158.
#
# Usage:
#   AWS_PROFILE=aerospaceug-admin ./scripts/sync-cloudfront-headers.sh
#   AWS_PROFILE=aerospaceug-admin ./scripts/sync-cloudfront-headers.sh --dry-run
#
# Prereqs: aws cli v2, jq

set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
export AWS_PROFILE

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POLICY_FILE="${REPO_ROOT}/infra/cloudfront-security-headers.json"

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

require() { command -v "$1" >/dev/null || { echo >&2 "ERROR: missing dependency: $1"; exit 1; }; }
require aws
require jq

# ── awsug only ───────────────────────────────────────────────────────────────
# source of truth: .woodpecker/deploy.yml
AWSUG_DIST_ID="E2QLAWFVIT1AR8"
AWSUG_POLICY_ID="ef81b3a7-9f54-4871-9d45-0864456d843b"

# ── Repo source-of-truth CSP ─────────────────────────────────────────────────
REPO_CSP="$(jq -r '.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy' "${POLICY_FILE}")"

get_live_csp() {
  aws cloudfront get-response-headers-policy \
    --id "$1" \
    --query 'ResponseHeadersPolicy.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy' \
    --output text 2>/dev/null
}

# Build the update payload from the repo file, stripping XSSProtection if empty
# (avoids the CLI validation bug encountered 2026-05-12 where an empty
# XSSProtection block causes "Invalid request provided" from the API)
build_update_config() {
  local policy_id="$1"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${tmp_dir}"' RETURN

  aws cloudfront get-response-headers-policy \
    --id "${policy_id}" \
    --query 'ResponseHeadersPolicy.ResponseHeadersPolicyConfig' \
    --output json >"${tmp_dir}/current.json"

  jq -s '
    .[0] as $current |
    .[1] as $repo |
    $current
    | .SecurityHeadersConfig = $repo.SecurityHeadersConfig
    | .CustomHeadersConfig   = $repo.CustomHeadersConfig
    | if .SecurityHeadersConfig.XSSProtection? == null or
         (.SecurityHeadersConfig.XSSProtection.Protection? == false and
          (.SecurityHeadersConfig.XSSProtection | keys | length) <= 2)
      then del(.SecurityHeadersConfig.XSSProtection)
      else .
      end
  ' "${tmp_dir}/current.json" "${POLICY_FILE}"
}

# ── Sync awsug ───────────────────────────────────────────────────────────────
live_csp="$(get_live_csp "${AWSUG_POLICY_ID}")"

if [[ "${live_csp}" == "${REPO_CSP}" ]]; then
  echo "awsug (${AWSUG_DIST_ID}): already in sync"
else
  echo "awsug (${AWSUG_DIST_ID}): DRIFT DETECTED"
  echo "  repo: ${REPO_CSP}"
  echo "  live: ${live_csp}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "  [dry-run] would update policy ${AWSUG_POLICY_ID} and invalidate ${AWSUG_DIST_ID}"
  else
    echo "  Updating policy ${AWSUG_POLICY_ID}…"
    etag="$(aws cloudfront get-response-headers-policy --id "${AWSUG_POLICY_ID}" --query 'ETag' --output text)"
    update_config="$(build_update_config "${AWSUG_POLICY_ID}")"

    aws cloudfront update-response-headers-policy \
      --id "${AWSUG_POLICY_ID}" \
      --if-match "${etag}" \
      --response-headers-policy-config "${update_config}" >/dev/null

    echo "  Policy updated. Creating invalidation for ${AWSUG_DIST_ID}…"
    aws cloudfront create-invalidation \
      --distribution-id "${AWSUG_DIST_ID}" \
      --paths "/*" \
      --query 'Invalidation.Id' \
      --output text
  fi
fi

echo "────────────────────────────────────────"
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "dry-run complete — no changes applied"
else
  echo "✓ sync complete"
  echo "  (main/auth intentionally out of scope — see issue #158)"
fi
