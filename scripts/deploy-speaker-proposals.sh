#!/usr/bin/env bash
set -euo pipefail

# Deploy cdn-speaker-proposals Lambda + DynamoDB tables + IAM role + Function URL
# Run from AIBOX where SSO profiles are authenticated.
# Requires: aws cli v2, jq
# Profile: jitsi-video-hosting (account 170473530355, us-west-2)
# NOTE: Do NOT use aerospaceug-admin — Cognito + admin Lambdas live in 170473530355.

LAMBDA_ACCOUNT=170473530355
LAMBDA_REGION=us-west-2
LAMBDA_NAME=cdn-speaker-proposals
LAMBDA_RUNTIME=nodejs22.x
LAMBDA_HANDLER=index.handler
LAMBDA_TIMEOUT=10
LAMBDA_MEMORY=256
ROLE_NAME=cdn-speaker-proposals-lambda-role
PROFILE=jitsi-video-hosting

PROPOSALS_TABLE=cdn-speaker-proposals
RATE_TABLE=cdn-speaker-proposals-rate

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAMBDA_DIR="$REPO_ROOT/infra/lambda/speaker-proposals"
DYNAMODB_DIR="$REPO_ROOT/infra/dynamodb"
IAM_DIR="$REPO_ROOT/infra/iam"

trap 'echo "ERROR: deploy failed at line $LINENO" >&2' ERR

echo "=== 0. SSO check ==="
aws sts get-caller-identity --profile "$PROFILE" --region "$LAMBDA_REGION" \
  --query 'Account' --output text | grep -q "$LAMBDA_ACCOUNT" \
  || { echo "ERROR: profile $PROFILE is not authenticated to account $LAMBDA_ACCOUNT" >&2; exit 1; }
echo "Authenticated to account $LAMBDA_ACCOUNT via $PROFILE"

echo "=== 1. Create DynamoDB tables (idempotent) ==="
for TABLE_JSON in "$DYNAMODB_DIR/speaker-proposals-table.json" "$DYNAMODB_DIR/speaker-proposals-rate-table.json"; do
  TABLE_NAME=$(jq -r '.TableName' "$TABLE_JSON")
  if aws dynamodb describe-table --table-name "$TABLE_NAME" \
      --region "$LAMBDA_REGION" --profile "$PROFILE" 2>/dev/null; then
    echo "Table $TABLE_NAME already exists, skipping."
  else
    echo "Creating table $TABLE_NAME..."
    aws dynamodb create-table \
      --cli-input-json "file://$TABLE_JSON" \
      --region "$LAMBDA_REGION" --profile "$PROFILE"
    aws dynamodb wait table-exists \
      --table-name "$TABLE_NAME" \
      --region "$LAMBDA_REGION" --profile "$PROFILE"
    echo "Table $TABLE_NAME created."
  fi
done

echo "=== 2. Create/update IAM role ==="
TRUST_POLICY="file://$IAM_DIR/speaker-proposals-trust-policy.json"
EXEC_POLICY="file://$IAM_DIR/speaker-proposals-execution-policy.json"

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
  --policy-name speaker-proposals-execution \
  --policy-document "$EXEC_POLICY" \
  --profile "$PROFILE"

echo "Waiting 10s for IAM propagation..."
sleep 10

echo "=== 3. Package Lambda ==="
cd "$LAMBDA_DIR"
zip -j /tmp/speaker-proposals.zip index.mjs
cd "$REPO_ROOT"

echo "=== 4. Create/update Lambda function ==="
ROLE_ARN="arn:aws:iam::${LAMBDA_ACCOUNT}:role/${ROLE_NAME}"

ENV_VARS="Variables={HCAPTCHA_SECRET_SSM_PATH=/cloud-del-norte/speaker-proposals/hcaptcha-secret,IP_HASH_SALT_SSM_PATH=/cloud-del-norte/speaker-proposals/ip-hash-salt,RATE_TABLE_NAME=${RATE_TABLE},TABLE_NAME=${PROPOSALS_TABLE},NOTIFICATION_EMAIL=bryanj+clouddelnortespeakerrequest@abstractspacecraft.com,FROM_ADDRESS=heraldstack@clouddelnorte.org,ADMIN_PANEL_URL=https://awsug.clouddelnorte.org/admin/}"

if aws lambda get-function --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE" 2>/dev/null; then
  echo "Lambda $LAMBDA_NAME exists, updating code + config..."
  aws lambda update-function-code --function-name "$LAMBDA_NAME" \
    --zip-file fileb:///tmp/speaker-proposals.zip \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda wait function-updated \
    --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda update-function-configuration --function-name "$LAMBDA_NAME" \
    --environment "$ENV_VARS" \
    --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
else
  echo "Creating Lambda $LAMBDA_NAME..."
  aws lambda create-function --function-name "$LAMBDA_NAME" \
    --runtime "$LAMBDA_RUNTIME" --handler "$LAMBDA_HANDLER" \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/speaker-proposals.zip \
    --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" \
    --architectures x86_64 \
    --environment "$ENV_VARS" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda wait function-active \
    --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
fi

echo "=== 5. Create/update Function URL (idempotent) ==="
CORS_CONFIG='AllowOrigins=https://clouddelnorte.org,https://awsug.clouddelnorte.org,AllowMethods=POST,OPTIONS,AllowHeaders=Content-Type,Authorization,AllowCredentials=false'

if aws lambda get-function-url-config --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE" 2>/dev/null; then
  echo "Function URL already exists, updating CORS..."
  aws lambda update-function-url-config --function-name "$LAMBDA_NAME" \
    --auth-type NONE \
    --cors "$CORS_CONFIG" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
else
  echo "Creating Function URL..."
  aws lambda create-function-url-config --function-name "$LAMBDA_NAME" \
    --auth-type NONE \
    --cors "$CORS_CONFIG" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  # Allow public invocation via Function URL
  aws lambda add-permission --function-name "$LAMBDA_NAME" \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region "$LAMBDA_REGION" --profile "$PROFILE" 2>/dev/null || true
fi

FUNCTION_URL=$(aws lambda get-function-url-config --function-name "$LAMBDA_NAME" \
  --region "$LAMBDA_REGION" --profile "$PROFILE" \
  --query 'FunctionUrl' --output text)

echo ""
echo "=== Done ==="
echo "Function URL: $FUNCTION_URL"
echo ""
echo "=== SSM parameters to populate before first use ==="
echo "  aws ssm put-parameter --name /cloud-del-norte/speaker-proposals/hcaptcha-secret \\"
echo "    --value '<YOUR_HCAPTCHA_SECRET_KEY>' --type SecureString \\"
echo "    --region $LAMBDA_REGION --profile $PROFILE"
echo ""
echo "  aws ssm put-parameter --name /cloud-del-norte/speaker-proposals/ip-hash-salt \\"
echo "    --value \"\$(openssl rand -hex 32)\" --type SecureString \\"
echo "    --region $LAMBDA_REGION --profile $PROFILE"
