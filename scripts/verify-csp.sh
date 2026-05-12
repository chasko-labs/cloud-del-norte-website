#!/usr/bin/env bash
# scripts/verify-csp.sh
#
# This script validates CSP for the awsug subdomain only.
#
# main and auth subdomains have their own (simpler) CSP requirements not yet
# captured in this repo. Per-subdomain CSP config is follow-up work tracked
# in issue #158.
#
# When main/auth CSP is formalized, extend this script with their respective
# required-whitelists and repo file comparisons.
#
# CI gate: verify live awsug CloudFront CSP matches infra/cloudfront-security-headers.json
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

# ── awsug policy ID (source of truth: .woodpecker/deploy.yml) ───────────────
AWSUG_POLICY_ID="ef81b3a7-9f54-4871-9d45-0864456d843b"

# ── Required domain whitelist (awsug only) ───────────────────────────────────
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

fail() { echo "  FAIL: $*"; ERRORS=$((ERRORS + 1)); }
pass() { echo "  ok:   $*"; }

get_live_csp() {
  aws cloudfront get-response-headers-policy \
    --id "$1" \
    --query 'ResponseHeadersPolicy.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy' \
    --output text 2>/dev/null
}

extract_directive() {
  echo "${1}" | grep -oP "(?<=${2} )[^;]+" || true
}

check_domain_in_directive() {
  local value
  value="$(extract_directive "${1}" "${2}")"
  if echo "${value}" | grep -qF "${3}"; then
    pass "awsug: ${2} contains ${3}"
  else
    fail "awsug: ${2} MISSING ${3}"
    echo "       live ${2}: ${value:-<empty>}"
  fi
}

# ── Repo source-of-truth CSP ─────────────────────────────────────────────────
REPO_CSP="$(jq -r '.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy' "${POLICY_FILE}")"
echo "Repo CSP (source of truth):"
echo "  ${REPO_CSP}"
echo ""

# ── awsug policy check ───────────────────────────────────────────────────────
echo "Checking awsug (policy ${AWSUG_POLICY_ID})…"
LIVE_CSP="$(get_live_csp "${AWSUG_POLICY_ID}")"

if [[ -z "${LIVE_CSP}" || "${LIVE_CSP}" == "None" ]]; then
  fail "awsug: could not fetch live CSP"
else
  # 1. Drift check: live must match repo
  if [[ "${LIVE_CSP}" == "${REPO_CSP}" ]]; then
    pass "awsug: live CSP matches repo"
  else
    fail "awsug: live CSP DRIFTS from repo"
    echo "       repo: ${REPO_CSP}"
    echo "       live: ${LIVE_CSP}"
    if command -v diff >/dev/null; then
      diff <(echo "${REPO_CSP}" | tr ';' '\n') <(echo "${LIVE_CSP}" | tr ';' '\n') || true
    fi
  fi

  # 2. Required whitelist check
  echo "  Checking awsug required whitelist…"
  for domain in "${AWSUG_CONNECT_SRC_REQUIRED[@]}"; do
    check_domain_in_directive "${LIVE_CSP}" "connect-src" "${domain}"
  done
  for domain in "${AWSUG_FRAME_SRC_REQUIRED[@]}"; do
    check_domain_in_directive "${LIVE_CSP}" "frame-src" "${domain}"
  done
fi
echo ""

# ── Result ───────────────────────────────────────────────────────────────────
echo "────────────────────────────────────────"
if [[ "${ERRORS}" -eq 0 ]]; then
  echo "✓ CSP verification passed — no drift detected"
  exit 0
else
  echo "✗ CSP verification FAILED — ${ERRORS} issue(s) found"
  exit 1
fi
