#!/usr/bin/env bash
# Apply the Response Headers Policy in cloudfront-security-headers.json to the
# clouddelnorte.org CloudFront distribution. Idempotent — re-running updates
# the existing policy rather than creating duplicates.
#
# Prereqs:
#   - AWS CLI v2
#   - A profile with cloudfront:CreateResponseHeadersPolicy, UpdateResponseHeadersPolicy,
#     GetDistributionConfig, UpdateDistribution on the distribution owner account
#     (aerospaceug-admin / 211125425201)
#
# Usage:
#   AWS_PROFILE=aerospaceug-admin ./infra/apply-security-headers.sh
#
# Rollback: associate the distribution with the AWS-managed 'Managed-SecurityHeadersPolicy'
# or 'Managed-SimpleCORS' (revert via `./infra/apply-security-headers.sh --detach`).

set -euo pipefail

DIST_ID="${DIST_ID:-ECC3LP1BL2CZS}"
POLICY_NAME="cloud-del-norte-security-headers"
POLICY_FILE="$(dirname "$0")/cloudfront-security-headers.json"

require() { command -v "$1" >/dev/null || { echo >&2 "missing dependency: $1"; exit 1; }; }
require aws
require jq

find_policy_id() {
  aws cloudfront list-response-headers-policies \
    --type custom \
    --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='${POLICY_NAME}'].ResponseHeadersPolicy.Id | [0]" \
    --output text
}

upsert_policy() {
  local existing_id
  existing_id="$(find_policy_id)"

  if [[ -z "${existing_id}" || "${existing_id}" == "None" ]]; then
    echo "creating response headers policy '${POLICY_NAME}'…"
    aws cloudfront create-response-headers-policy \
      --response-headers-policy-config "file://${POLICY_FILE}" \
      --query 'ResponseHeadersPolicy.Id' \
      --output text
    return
  fi

  echo "updating existing response headers policy id=${existing_id}…"
  local etag
  etag="$(aws cloudfront get-response-headers-policy --id "${existing_id}" --query 'ETag' --output text)"
  aws cloudfront update-response-headers-policy \
    --id "${existing_id}" \
    --if-match "${etag}" \
    --response-headers-policy-config "file://${POLICY_FILE}" >/dev/null
  echo "${existing_id}"
}

attach_policy_to_default_behavior() {
  local policy_id="$1"
  echo "associating policy ${policy_id} with distribution ${DIST_ID}…"

  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' RETURN

  aws cloudfront get-distribution-config --id "${DIST_ID}" >"${tmp}/dc.json"
  local etag
  etag="$(jq -r '.ETag' "${tmp}/dc.json")"

  jq --arg pid "${policy_id}" \
    '.DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId = $pid
     | .DistributionConfig' \
    "${tmp}/dc.json" >"${tmp}/new.json"

  aws cloudfront update-distribution \
    --id "${DIST_ID}" \
    --if-match "${etag}" \
    --distribution-config "file://${tmp}/new.json" >/dev/null

  echo "done. distribution updating — propagation can take 5-15 minutes."
  echo "verify with: curl -sI https://clouddelnorte.org/ | grep -iE 'content-security|strict-transport|referrer-policy|permissions-policy|x-content-type'"
}

detach_policy_from_default_behavior() {
  echo "removing ResponseHeadersPolicyId from distribution ${DIST_ID} default behavior…"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' RETURN
  aws cloudfront get-distribution-config --id "${DIST_ID}" >"${tmp}/dc.json"
  local etag
  etag="$(jq -r '.ETag' "${tmp}/dc.json")"
  jq 'del(.DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId) | .DistributionConfig' \
    "${tmp}/dc.json" >"${tmp}/new.json"
  aws cloudfront update-distribution \
    --id "${DIST_ID}" \
    --if-match "${etag}" \
    --distribution-config "file://${tmp}/new.json" >/dev/null
  echo "detached."
}

case "${1:-apply}" in
  apply)
    policy_id="$(upsert_policy | tail -n1)"
    attach_policy_to_default_behavior "${policy_id}"
    ;;
  --detach|detach)
    detach_policy_from_default_behavior
    ;;
  *)
    echo "usage: $0 [apply|detach]" >&2
    exit 2
    ;;
esac
