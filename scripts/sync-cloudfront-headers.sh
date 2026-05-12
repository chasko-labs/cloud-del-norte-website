#!/usr/bin/env bash
# scripts/sync-cloudfront-headers.sh
# Apply infra/cloudfront-security-headers.json to all managed CloudFront
# response-headers-policies. Idempotent — no-ops when already in sync.
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

# ── Distribution map ─────────────────────────────────────────────────────────
# source of truth: .woodpecker/deploy.yml
CF_DIST_MAIN="ECC3LP1BL2CZS"
CF_DIST_AUTH="ECQ44FO9MBTCY"
CF_DIST_AWSUG="E2QLAWFVIT1AR8"

DISTRIBUTIONS=("${CF_DIST_MAIN}" "${CF_DIST_AUTH}" "${CF_DIST_AWSUG}")
DIST_LABELS=("main" "auth" "awsug")

# ── Repo source-of-truth CSP ─────────────────────────────────────────────────
REPO_CSP="$(jq -r '.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy' "${POLICY_FILE}")"

get_policy_id_for_dist() {
  aws cloudfront get-distribution-config \
    --id "$1" \
    --query 'DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId' \
    --output text 2>/dev/null
}

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

  # Fetch current full config to preserve Name/Comment/CustomHeaders
  aws cloudfront get-response-headers-policy \
    --id "${policy_id}" \
    --query 'ResponseHeadersPolicy.ResponseHeadersPolicyConfig' \
    --output json >"${tmp_dir}/current.json"

  # Merge: take SecurityHeadersConfig + CustomHeadersConfig from repo file,
  # keep Name/Comment from current live config
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

# ── Main loop ────────────────────────────────────────────────────────────────
declare -A SYNCED_POLICIES=()
UPDATED_DISTS=()

for i in "${!DISTRIBUTIONS[@]}"; do
  dist_id="${DISTRIBUTIONS[$i]}"
  label="${DIST_LABELS[$i]}"

  policy_id="$(get_policy_id_for_dist "${dist_id}")"
  if [[ -z "${policy_id}" || "${policy_id}" == "None" ]]; then
    echo "WARN: ${label} (${dist_id}): no response headers policy attached — skipping"
    continue
  fi

  # Skip if we already processed this policy id (shared policy)
  if [[ -n "${SYNCED_POLICIES[${policy_id}]+_}" ]]; then
    echo "${label} (${dist_id}): policy ${policy_id} already synced — skipping"
    continue
  fi
  SYNCED_POLICIES["${policy_id}"]=1

  live_csp="$(get_live_csp "${policy_id}")"

  if [[ "${live_csp}" == "${REPO_CSP}" ]]; then
    echo "${label} (${dist_id}): already in sync"
    continue
  fi

  echo "${label} (${dist_id}): DRIFT DETECTED"
  echo "  repo: ${REPO_CSP}"
  echo "  live: ${live_csp}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "  [dry-run] would update policy ${policy_id} and invalidate ${dist_id}"
    continue
  fi

  echo "  Updating policy ${policy_id}…"
  etag="$(aws cloudfront get-response-headers-policy --id "${policy_id}" --query 'ETag' --output text)"
  update_config="$(build_update_config "${policy_id}")"

  aws cloudfront update-response-headers-policy \
    --id "${policy_id}" \
    --if-match "${etag}" \
    --response-headers-policy-config "${update_config}" >/dev/null

  echo "  Policy updated. Creating invalidation for ${dist_id}…"
  aws cloudfront create-invalidation \
    --distribution-id "${dist_id}" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text

  UPDATED_DISTS+=("${dist_id}")
done

echo "────────────────────────────────────────"
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "dry-run complete — no changes applied"
elif [[ "${#UPDATED_DISTS[@]}" -eq 0 ]]; then
  echo "✓ all policies already in sync"
else
  echo "✓ updated ${#UPDATED_DISTS[@]} distribution(s): ${UPDATED_DISTS[*]}"
  echo "  CloudFront propagation takes 5-15 minutes."
fi
