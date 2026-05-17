#!/usr/bin/env bash
set -euo pipefail

# Deploy cdn-feedback Lambda (code + IAM + env vars).
# Production traffic via API Gateway HTTP V2 (configured separately).
# Profile: jitsi-video-hosting (account 170473530355, us-west-2)

LAMBDA_ACCOUNT=170473530355
LAMBDA_REGION=us-west-2
LAMBDA_NAME=cdn-feedback
LAMBDA_RUNTIME=nodejs22.x
LAMBDA_HANDLER=index.handler
LAMBDA_TIMEOUT=10
LAMBDA_MEMORY=256
ROLE_NAME=cdn-feedback-lambda-role
PROFILE=jitsi-video-hosting

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAMBDA_DIR="$REPO_ROOT/infra/lambda/feedback"
IAM_DIR="$REPO_ROOT/infra/iam"

trap 'echo "ERROR: deploy failed at line $LINENO" >&2' ERR

echo "=== 0. SSO check ==="
aws sts get-caller-identity --profile "$PROFILE" --region "$LAMBDA_REGION" \
  --query 'Account' --output text | grep -q "$LAMBDA_ACCOUNT" \
  || { echo "ERROR: profile $PROFILE is not authenticated to account $LAMBDA_ACCOUNT" >&2; exit 1; }
echo "Authenticated."

echo "=== 1. Create/update IAM role ==="
TRUST_POLICY="file://$IAM_DIR/speaker-proposals-trust-policy.json"
EXEC_POLICY="file://$IAM_DIR/feedback-execution-policy.json"

if aws iam get-role --role-name "$ROLE_NAME" --profile "$PROFILE" 2>/dev/null; then
  echo "Role $ROLE_NAME exists, updating trust policy..."
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" \
    --policy-document "$TRUST_POLICY" \
    --profile "$PROFILE"
else
  echo "Creating role $ROLE_NAME..."
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --profile "$PROFILE"
fi

aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name feedback-execution \
  --policy-document "$EXEC_POLICY" \
  --profile "$PROFILE"

echo "Waiting 10s for IAM propagation..."
sleep 10

echo "=== 2. Package Lambda ==="
cd "$LAMBDA_DIR"
zip -j /tmp/feedback.zip index.mjs
cd "$REPO_ROOT"

echo "=== 3. Create/update Lambda function ==="
ROLE_ARN="arn:aws:iam::${LAMBDA_ACCOUNT}:role/${ROLE_NAME}"
ENV_VARS="Variables={GH_REPO=chasko-labs/cloud-del-norte-website,ATTACHMENTS_BUCKET=cdn-feedback-attachments}"

if aws lambda get-function --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE" 2>/dev/null; then
  echo "Lambda $LAMBDA_NAME exists — updating code + config..."
  aws lambda update-function-code --function-name "$LAMBDA_NAME" \
    --zip-file fileb:///tmp/feedback.zip \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda wait function-updated \
    --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda update-function-configuration --function-name "$LAMBDA_NAME" \
    --role "$ROLE_ARN" \
    --environment "$ENV_VARS" \
    --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
else
  echo "Creating Lambda $LAMBDA_NAME..."
  aws lambda create-function --function-name "$LAMBDA_NAME" \
    --runtime "$LAMBDA_RUNTIME" --handler "$LAMBDA_HANDLER" \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/feedback.zip \
    --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" \
    --architectures x86_64 \
    --environment "$ENV_VARS" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda wait function-active \
    --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
fi

echo "=== 4. Done ==="
echo ""
echo "Lambda code + IAM + env vars deployed."
echo "Production endpoint: https://rknnfq6urf.execute-api.us-west-2.amazonaws.com/feedback (API Gateway HTTP V2, unchanged since Wave 7)"
