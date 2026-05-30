#!/usr/bin/env bash
set -euo pipefail

# Apply the heraldstack-ci-deploy inline policy "deploy-s3-sync-cloudfront-invalidate" as IaC.
# Role: heraldstack-ci-deploy (assumed by Woodpecker CI via IAM Roles Anywhere)
# Account: 211125425201 | Region: us-west-2
# chmod +x before first run.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

AWS_PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
ROLE_NAME=heraldstack-ci-deploy
POLICY_NAME=deploy-s3-sync-cloudfront-invalidate
POLICY_FILE="${REPO_ROOT}/infra/iam/ci-deploy-policy.json"

require() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: $1 is required but not found" >&2; exit 1; }; }
require aws

echo "=== Applying inline policy '$POLICY_NAME' to role '$ROLE_NAME' ==="
echo "Profile: $AWS_PROFILE"
echo "Policy file: $POLICY_FILE"

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "file://${POLICY_FILE}" \
  --profile "$AWS_PROFILE"

echo "=== Verifying cloudfront:GetResponseHeadersPolicy permission ==="
RESULT=$(aws iam simulate-principal-policy \
  --policy-source-arn "arn:aws:iam::211125425201:role/${ROLE_NAME}" \
  --action-names cloudfront:GetResponseHeadersPolicy \
  --profile "$AWS_PROFILE" \
  --query 'EvaluationResults[0].EvalDecision' --output text)

if [ "$RESULT" = "allowed" ]; then
  echo "SUCCESS: cloudfront:GetResponseHeadersPolicy is allowed for $ROLE_NAME"
else
  echo "FAIL: cloudfront:GetResponseHeadersPolicy evaluated as '$RESULT' — expected 'allowed'" >&2
  exit 1
fi
