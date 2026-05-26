#!/usr/bin/env bash
set -euo pipefail
# Usage: AWS_PROFILE=aerospaceug-admin ./scripts/deploy-csp-function.sh

FUNCTION_NAME="cdn-csp-viewer-response"
DISTRIBUTION_ID="ECC3LP1BL2CZS"
POLICY_ID="95055f76-9d40-424a-9453-b82edc124680"
REGION="us-east-1"
FUNC_CONFIG='{"Comment":"CSP header for clouddelnorte.org","Runtime":"cloudfront-js-2.0","KeyValueStoreAssociations":{"Quantity":0,"Items":[]}}'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."
FUNC_DIR="${ROOT_DIR}/infra/cloudfront-functions"
ALLOWLIST="${FUNC_DIR}/csp-allowlist.json"
FUNC_SRC="${FUNC_DIR}/csp-main.js"

require() { command -v "$1" >/dev/null || { echo >&2 "ERROR: missing $1"; exit 1; }; }
require aws
require jq
require node

export AWS_PROFILE="${AWS_PROFILE:-aerospaceug-admin}"

echo "── Step 1: Build allowlist from streams.ts ──"
node "${SCRIPT_DIR}/build-csp-allowlist.mjs"

echo "── Step 2: Inject allowlist into function source ──"
TMP_FUNC=$(mktemp)
node -e "
const fs = require('fs');
const src = fs.readFileSync('${FUNC_SRC}', 'utf-8');
const allowlist = fs.readFileSync('${ALLOWLIST}', 'utf-8').trim();
const out = src.replace('var ALLOWLIST = {};', 'var ALLOWLIST = ' + allowlist + ';');
fs.writeFileSync('${TMP_FUNC}', out);
"
echo "  Injected $(jq '.["connect-src"] | length' "${ALLOWLIST}") connect-src origins"

echo "── Step 3: Create or update CloudFront Function ──"
EXISTING=$(aws cloudfront list-functions --region "${REGION}" \
  --query "FunctionList.Items[?Name=='${FUNCTION_NAME}'].FunctionMetadata.FunctionARN" \
  --output text 2>/dev/null || echo "")

if [[ -z "${EXISTING}" || "${EXISTING}" == "None" ]]; then
  echo "  Creating new function: ${FUNCTION_NAME}"
  RESULT=$(aws cloudfront create-function --region "${REGION}" \
    --name "${FUNCTION_NAME}" \
    --function-config "${FUNC_CONFIG}" \
    --function-code "fileb://${TMP_FUNC}" \
    --output json)
  ETAG=$(echo "${RESULT}" | jq -r '.ETag')
else
  echo "  Updating existing function: ${FUNCTION_NAME}"
  ETAG=$(aws cloudfront describe-function --region "${REGION}" \
    --name "${FUNCTION_NAME}" --stage DEVELOPMENT \
    --query 'ETag' --output text)
  RESULT=$(aws cloudfront update-function --region "${REGION}" \
    --name "${FUNCTION_NAME}" \
    --function-config "${FUNC_CONFIG}" \
    --function-code "fileb://${TMP_FUNC}" \
    --if-match "${ETAG}" \
    --output json)
  ETAG=$(echo "${RESULT}" | jq -r '.ETag')
fi

echo "── Step 4: Publish function (DEVELOPMENT → LIVE) ──"
aws cloudfront publish-function --region "${REGION}" \
  --name "${FUNCTION_NAME}" \
  --if-match "${ETAG}" \
  --output json >/dev/null
echo "  Published. Stage: LIVE"

echo "── Step 5: Associate with distribution viewer-response ──"
DIST_CONFIG_RAW=$(aws cloudfront get-distribution-config --region "${REGION}" \
  --id "${DISTRIBUTION_ID}" --output json)
DIST_ETAG=$(echo "${DIST_CONFIG_RAW}" | jq -r '.ETag')
DIST_CONFIG=$(echo "${DIST_CONFIG_RAW}" | jq '.DistributionConfig')

FUNC_ARN=$(aws cloudfront describe-function --region "${REGION}" \
  --name "${FUNCTION_NAME}" --stage LIVE \
  --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text)

# Check if already associated
CURRENT_ASSOC=$(echo "${DIST_CONFIG}" | jq -r '.DefaultCacheBehavior.FunctionAssociations.Items[]? | select(.EventType=="viewer-response") | .FunctionARN')
if [[ "${CURRENT_ASSOC}" == "${FUNC_ARN}" ]]; then
  echo "  Already associated"
else
  UPDATED_CONFIG=$(echo "${DIST_CONFIG}" | jq --arg arn "${FUNC_ARN}" '
    .DefaultCacheBehavior.FunctionAssociations = {
      "Quantity": 1,
      "Items": [{
        "FunctionARN": $arn,
        "EventType": "viewer-response"
      }]
    }
  ')
  aws cloudfront update-distribution --region "${REGION}" \
    --id "${DISTRIBUTION_ID}" \
    --if-match "${DIST_ETAG}" \
    --distribution-config "${UPDATED_CONFIG}" >/dev/null
  echo "  Associated ${FUNCTION_NAME} with ${DISTRIBUTION_ID} (viewer-response)"
fi

echo "── Step 6: Remove CSP from response-headers-policy ──"
POLICY_RAW=$(aws cloudfront get-response-headers-policy --region "${REGION}" \
  --id "${POLICY_ID}" --output json)
POLICY_ETAG=$(echo "${POLICY_RAW}" | jq -r '.ETag')
HAS_CSP=$(echo "${POLICY_RAW}" | jq '.ResponseHeadersPolicy.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy // empty')

if [[ -n "${HAS_CSP}" ]]; then
  POLICY_CONFIG=$(echo "${POLICY_RAW}" | jq '.ResponseHeadersPolicy.ResponseHeadersPolicyConfig')
  UPDATED_POLICY=$(echo "${POLICY_CONFIG}" | jq 'del(.SecurityHeadersConfig.ContentSecurityPolicy)')
  aws cloudfront update-response-headers-policy --region "${REGION}" \
    --id "${POLICY_ID}" \
    --if-match "${POLICY_ETAG}" \
    --response-headers-policy-config "${UPDATED_POLICY}" >/dev/null
  echo "  Removed CSP from response-headers-policy ${POLICY_ID}"
else
  echo "  CSP already removed from policy"
fi

echo "── Step 7: Invalidate cache ──"
INVALIDATION_ID=$(aws cloudfront create-invalidation --region "${REGION}" \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text)
echo "  Invalidation: ${INVALIDATION_ID}"

rm -f "${TMP_FUNC}"
echo "────────────────────────────────────────"
echo "✓ CSP CloudFront Function deployed and associated"
