#!/usr/bin/env bash
# scripts/verify-csp.sh
# CI gate: verify live CloudFront CSP matches infra/cloudfront-security-headers.json
# and that required domains are present in the correct directives.
#
# Exits 0 if clean, exits 1 on any drift or missing required domain.
#
# Usage:
#   AWS_PROFILE=aerospaceug-admin ./scripts/verify-csp.sh
#
# Prereqs: aws cli v2, jq

set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
export AWS_PROFILE

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POLICY_FILE="${REPO_ROOT}/infra/cloudfront-security-headers.json"

require() { command -v "$1" >/dev/null || { echo >&2 "ERROR: missing dependency: $1"; exit 1; }; }
require aws
require jq

# ── Distribution → Response Headers Policy ID map ───────────────────────────
# source of truth: .woodpecker/deploy.yml
CF_DIST_MAIN="ECC3LP1BL2CZS"
CF_DIST_AUTH="ECQ44FO9MBTCY"
CF_DIST_AWSUG="E2QLAWFVIT1AR8"

# ── Required domain whitelist (hard-coded, clearly labelled) ─────────────────
# awsug connect-src MUST include these three endpoints (Cognito + API Gateway)
AWSUG_CONNECT_SRC_REQUIRED=(
  "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com"
  "https://cognito-idp.us-west-2.amazonaws.com"
  "https://cloud-del-norte.auth.us-west-2.amazoncognito.com"
)
# awsug frame-src MUST include Jitsi meet endpoint
AWSUG_FRAME_SRC_REQUIRED=(
  "https://meet.clouddelnorte.org"
)

# ── Helpers ──────────────────────────────────────────────────────────────────
ERRORS=0

fail() {
  echo "  FAIL: $*"
  ERRORS=$((ERRORS + 1))
}

pass() {
  echo "  ok:   $*"
}

get_policy_id_for_dist() {
  local dist_id="$1"
  aws cloudfront get-distribution-config \
    --id "${dist_id}" \
    --query 'DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId' \
    --output text 2>/dev/null
}

get_live_csp() {
  local policy_id="$1"
  aws cloudfront get-response-headers-policy \
    --id "${policy_id}" \
    --query 'ResponseHeadersPolicy.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy' \
    --output text 2>/dev/null
}

extract_directive() {
  local csp="$1"
  local directive="$2"
  # Extract value of a named directive from a CSP string
  echo "${csp}" | grep -oP "(?<=${directive} )[^;]+" || true
}

check_domain_in_directive() {
  local csp="$1"
  local directive="$2"
  local domain="$3"
  local label="$4"
  local value
  value="$(extract_directive "${csp}" "${directive}")"
  if echo "${value}" | grep -qF "${domain}"; then
    pass "${label}: ${directive} contains ${domain}"
  else
    fail "${label}: ${directive} MISSING ${domain}"
    echo "       live ${directive}: ${value:-<empty>}"
  fi
}

# ── Repo source-of-truth CSP ─────────────────────────────────────────────────
REPO_CSP="$(jq -r '.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy' "${POLICY_FILE}")"
echo "Repo CSP (source of truth):"
echo "  ${REPO_CSP}"
echo ""

# ── Discover policy IDs ──────────────────────────────────────────────────────
echo "Fetching policy IDs from distributions…"
POLICY_MAIN="$(get_policy_id_for_dist "${CF_DIST_MAIN}")"
POLICY_AUTH="$(get_policy_id_for_dist "${CF_DIST_AUTH}")"
POLICY_AWSUG="$(get_policy_id_for_dist "${CF_DIST_AWSUG}")"

echo "  main  (${CF_DIST_MAIN}): policy=${POLICY_MAIN}"
echo "  auth  (${CF_DIST_AUTH}): policy=${POLICY_AUTH}"
echo "  awsug (${CF_DIST_AWSUG}): policy=${POLICY_AWSUG}"
echo ""

# Deduplicate: if all three share the same policy id, check once
declare -A CHECKED_POLICIES=()

check_policy() {
  local label="$1"
  local policy_id="$2"
  local is_awsug="${3:-false}"

  if [[ -z "${policy_id}" || "${policy_id}" == "None" ]]; then
    fail "${label}: no response headers policy attached to distribution"
    return
  fi

  # Skip if already checked this policy id (shared policy)
  if [[ -n "${CHECKED_POLICIES[${policy_id}]+_}" && "${is_awsug}" == "false" ]]; then
    echo "  ${label}: policy ${policy_id} already verified (shared) — skipping"
    return
  fi
  CHECKED_POLICIES["${policy_id}"]=1

  echo "Checking ${label} (policy ${policy_id})…"
  local live_csp
  live_csp="$(get_live_csp "${policy_id}")"

  if [[ -z "${live_csp}" || "${live_csp}" == "None" ]]; then
    fail "${label}: could not fetch live CSP"
    return
  fi

  # 1. Drift check: live must match repo
  if [[ "${live_csp}" == "${REPO_CSP}" ]]; then
    pass "${label}: live CSP matches repo"
  else
    fail "${label}: live CSP DRIFTS from repo"
    echo "       repo: ${REPO_CSP}"
    echo "       live: ${live_csp}"
    # Show token-level diff if diff is available
    if command -v diff >/dev/null; then
      diff <(echo "${REPO_CSP}" | tr ';' '\n') <(echo "${live_csp}" | tr ';' '\n') || true
    fi
  fi

  # 2. awsug-specific required domain checks
  if [[ "${is_awsug}" == "true" ]]; then
    echo "  Checking awsug required whitelist…"
    for domain in "${AWSUG_CONNECT_SRC_REQUIRED[@]}"; do
      check_domain_in_directive "${live_csp}" "connect-src" "${domain}" "awsug"
    done
    for domain in "${AWSUG_FRAME_SRC_REQUIRED[@]}"; do
      check_domain_in_directive "${live_csp}" "frame-src" "${domain}" "awsug"
    done
  fi
  echo ""
}

check_policy "main"  "${POLICY_MAIN}"  "false"
check_policy "auth"  "${POLICY_AUTH}"  "false"
check_policy "awsug" "${POLICY_AWSUG}" "true"

# ── Result ───────────────────────────────────────────────────────────────────
echo "────────────────────────────────────────"
if [[ "${ERRORS}" -eq 0 ]]; then
  echo "✓ CSP verification passed — no drift detected"
  exit 0
else
  echo "✗ CSP verification FAILED — ${ERRORS} issue(s) found"
  exit 1
fi
