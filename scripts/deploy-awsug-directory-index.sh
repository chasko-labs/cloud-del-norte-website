#!/usr/bin/env bash
set -euo pipefail
# Deploy the awsug directory-index CloudFront Function (viewer-request).
# This resolves /admin-rsvps/ → /admin-rsvps/index.html at the edge.
#
# Usage: AWS_PROFILE=aerospaceug-admin ./scripts/deploy-awsug-directory-index.sh
#
# The function is associated with the awsug distribution E2QLAWFVIT1AR8
# on the viewer-request event type. The existing CSP function remains on
# viewer-response — both can coexist (one per event type per behavior).

FUNCTION_NAME="cdn-awsug-directory-index"
DISTRIBUTION_ID="E2QLAWFVIT1AR8"
REGION="us-east-1"
FUNC_CONFIG='{"Comment":"Directory-index rewrite for awsug MPA","Runtime":"cloudfront-js-2.0","KeyValueStoreAssociations":{"Quantity":0,"Items":[]}}'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."
FUNC_SRC="${ROOT_DIR}/infra/cloudfront-functions/awsug-directory-index.js"

require() { command -v "$1" >/dev/null || { echo >&2 "ERROR: missing $1"; exit 1; }; }
require aws

export AWS_PROFILE="${AWS_PROFILE:-aerospaceug-admin}"

echo "── Step 1: Create or update CloudFront Function ──"
EXISTING=$(aws cloudfront list-functions --region "${REGION}" \
  --query "FunctionList.Items[?Name=='${FUNCTION_NAME}'].FunctionMetadata.FunctionARN" \
  --output text 2>/dev/null || echo "")

if [[ -z "${EXISTING}" || "${EXISTING}" == "None" ]]; then
  echo "  Creating new function: ${FUNCTION_NAME}"
  RESULT=$(aws cloudfront create-function --region "${REGION}" \
    --name "${FUNCTION_NAME}" \
    --function-config "${FUNC_CONFIG}" \
    --function-code "fileb://${FUNC_SRC}" \
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
    --function-code "fileb://${FUNC_SRC}" \
    --if-match "${ETAG}" \
    --output json)
  ETAG=$(echo "${RESULT}" | jq -r '.ETag')
fi

echo "── Step 2: Publish function (DEVELOPMENT → LIVE) ──"
aws cloudfront publish-function --region "${REGION}" \
  --name "${FUNCTION_NAME}" \
  --if-match "${ETAG}" \
  --output json >/dev/null
echo "  Published. Stage: LIVE"

echo "── Step 3: Associate with awsug distribution viewer-request ──"
DIST_CONFIG_RAW=$(aws cloudfront get-distribution-config --region "${REGION}" \
  --id "${DISTRIBUTION_ID}" --output json)
DIST_ETAG=$(echo "${DIST_CONFIG_RAW}" | jq -r '.ETag')
DIST_CONFIG=$(echo "${DIST_CONFIG_RAW}" | jq '.DistributionConfig')

FUNC_ARN=$(aws cloudfront describe-function --region "${REGION}" \
  --name "${FUNCTION_NAME}" --stage LIVE \
  --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text)

# Check if already associated on viewer-request
CURRENT_ASSOC=$(echo "${DIST_CONFIG}" | jq -r '.DefaultCacheBehavior.FunctionAssociations.Items[]? | select(.EventType=="viewer-request") | .FunctionARN')
if [[ "${CURRENT_ASSOC}" == "${FUNC_ARN}" ]]; then
  echo "  Already associated"
else
  # Merge with existing associations (preserve viewer-response CSP function)
  UPDATED_CONFIG=$(echo "${DIST_CONFIG}" | jq --arg arn "${FUNC_ARN}" '
    .DefaultCacheBehavior.FunctionAssociations.Items += [{
      "FunctionARN": $arn,
      "EventType": "viewer-request"
    }] |
    .DefaultCacheBehavior.FunctionAssociations.Quantity = (.DefaultCacheBehavior.FunctionAssociations.Items | length)
  ')
  aws cloudfront update-distribution --region "${REGION}" \
    --id "${DISTRIBUTION_ID}" \
    --if-match "${DIST_ETAG}" \
    --distribution-config "${UPDATED_CONFIG}" >/dev/null
  echo "  Associated ${FUNCTION_NAME} with ${DISTRIBUTION_ID} (viewer-request)"
fi

echo "── Step 4: Invalidate cache ──"
INVALIDATION_ID=$(aws cloudfront create-invalidation --region "${REGION}" \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text)
echo "  Invalidation: ${INVALIDATION_ID}"

echo "────────────────────────────────────────"
echo "✓ Directory-index CloudFront Function deployed and associated with awsug distribution"
echo "  /admin-rsvps/ will now resolve to /admin-rsvps/index.html"
