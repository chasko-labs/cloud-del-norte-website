#!/usr/bin/env bash
# scripts/sync-cloudfront-headers.sh
#
# Syncs per-subdomain CSP to CloudFront response-headers policies.
# Refactored in wave 5: accepts <main|auth|awsug|all> argument and loads
# from infra/cloudfront-security-headers.<subdomain>.json.
#
# Usage:
#   AWS_PROFILE=aerospaceug-admin ./scripts/sync-cloudfront-headers.sh main
#   AWS_PROFILE=aerospaceug-admin ./scripts/sync-cloudfront-headers.sh auth
#   AWS_PROFILE=aerospaceug-admin ./scripts/sync-cloudfront-headers.sh awsug
#   AWS_PROFILE=aerospaceug-admin ./scripts/sync-cloudfront-headers.sh all
#   AWS_PROFILE=aerospaceug-admin ./scripts/sync-cloudfront-headers.sh main --dry-run
#
# Prereqs: aws cli v2, jq

set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
export AWS_PROFILE

SUBDOMAIN="${1:-}"
DRY_RUN=false
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${SCRIPT_DIR}/../infra"

require() { command -v "$1" >/dev/null || { echo >&2 "ERROR: missing dependency: $1"; exit 1; }; }
require aws
require jq

declare -A DIST_IDS=(
  [main]="ECC3LP1BL2CZS"
  [auth]="ECQ44FO9MBTCY"
  [awsug]="E2QLAWFVIT1AR8"
)

declare -A POLICY_IDS=(
  [main]="95055f76-9d40-424a-9453-b82edc124680"
  [auth]="6e5c7c27-39d3-4a6e-8a89-58a70396c5ed"
  [awsug]="ef81b3a7-9f54-4871-9d45-0864456d843b"
)

get_live_csp() {
  aws cloudfront get-response-headers-policy \
    --id "$1" \
    --query 'ResponseHeadersPolicy.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy' \
    --output text 2>/dev/null
}

# Build update payload: merge repo SecurityHeadersConfig + CustomHeadersConfig
# into the live policy config (preserving Name and any live fields not in repo file).
# Strips empty XSSProtection blocks to avoid CloudFront API validation error.
build_update_config() {
  local policy_id="$1"
  local json_file="$2"
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
    | if $repo.CustomHeadersConfig then
        .CustomHeadersConfig = $repo.CustomHeadersConfig
      else .
      end
    | if .SecurityHeadersConfig.XSSProtection? == null or
         ((.SecurityHeadersConfig.XSSProtection | keys | length) == 0) or
         (.SecurityHeadersConfig.XSSProtection.Protection? == false and
          (.SecurityHeadersConfig.XSSProtection | keys | length) <= 2)
      then del(.SecurityHeadersConfig.XSSProtection)
      else .
      end
  ' "${tmp_dir}/current.json" "${json_file}"
}

sync_one() {
  local name="$1"
  local dist_id="${DIST_IDS[$name]}"
  local policy_id="${POLICY_IDS[$name]}"
  local json_file="${INFRA_DIR}/cloudfront-security-headers.${name}.json"

  if [[ ! -f "$json_file" ]]; then
    echo "ERROR: $json_file not found" >&2
    exit 1
  fi

  local repo_csp
  repo_csp="$(jq -r '.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy' "${json_file}")"

  local live_csp
  live_csp="$(get_live_csp "${policy_id}")"

  echo "── ${name} (${dist_id}) ──────────────────────────────────────────"

  if [[ "${live_csp}" == "${repo_csp}" ]]; then
    echo "  already in sync"
  else
    echo "  DRIFT DETECTED"
    if [[ "${DRY_RUN}" == "true" ]]; then
      echo "  [dry-run] would update policy ${policy_id}"
    else
      echo "  Updating policy ${policy_id}…"
      local etag
      etag="$(aws cloudfront get-response-headers-policy --id "${policy_id}" --query 'ETag' --output text)"
      local update_config
      update_config="$(build_update_config "${policy_id}" "${json_file}")"

      aws cloudfront update-response-headers-policy \
        --id "${policy_id}" \
        --if-match "${etag}" \
        --response-headers-policy-config "${update_config}" >/dev/null

      echo "  Policy updated. Creating invalidation…"
      aws cloudfront create-invalidation \
        --distribution-id "${dist_id}" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text
      echo "  Done: ${name}"
    fi
  fi
}

case "$SUBDOMAIN" in
  main|auth|awsug)
    sync_one "$SUBDOMAIN"
    ;;
  all)
    sync_one main
    sync_one auth
    sync_one awsug
    ;;
  *)
    echo "Usage: $0 <main|auth|awsug|all> [--dry-run]" >&2
    exit 1
    ;;
esac

echo "────────────────────────────────────────"
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "dry-run complete — no changes applied"
else
  echo "✓ sync complete"
fi
