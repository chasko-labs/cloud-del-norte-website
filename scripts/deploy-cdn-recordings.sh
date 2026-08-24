#!/usr/bin/env bash
set -euo pipefail

# Deploy cdn-recordings Lambda + wire to existing API Gateway.
# Profile: jitsi-video-hosting (account 170473530355, us-west-2)
# API Gateway: cloud-del-norte-portal-api (rwmypxz9z6)

LAMBDA_ACCOUNT=170473530355
LAMBDA_REGION=us-west-2
LAMBDA_NAME=cdn-recordings
LAMBDA_RUNTIME=nodejs22.x
LAMBDA_HANDLER=index.handler
LAMBDA_TIMEOUT=10
LAMBDA_MEMORY=256
ROLE_NAME=cdn-recordings-lambda-role
PROFILE=jitsi-video-hosting
API_ID=rwmypxz9z6
RECORDINGS_BUCKET=jitsi-video-platform-recordings-4b917dff

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAMBDA_DIR="$REPO_ROOT/infra/lambda/recordings"

trap 'echo "ERROR: deploy failed at line $LINENO" >&2' ERR

echo "=== 0. SSO check ==="
aws sts get-caller-identity --profile "$PROFILE" --region "$LAMBDA_REGION" \
  --query 'Account' --output text | grep -q "$LAMBDA_ACCOUNT" \
  || { echo "ERROR: not authenticated to $LAMBDA_ACCOUNT" >&2; exit 1; }
echo "Authenticated."

echo "=== 1. Create IAM role ==="
TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"sts:AssumeRole","Principal":{"Service":"lambda.amazonaws.com"}}]}'

if aws iam get-role --role-name "$ROLE_NAME" --profile "$PROFILE" 2>/dev/null; then
  echo "Role exists."
else
  echo "Creating role..."
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --profile "$PROFILE"
fi

EXEC_POLICY='{"Version":"2012-10-17","Statement":[{"Sid":"S3ReadRecordings","Effect":"Allow","Action":["s3:ListBucket","s3:GetObject"],"Resource":["arn:aws:s3:::'"$RECORDINGS_BUCKET"'","arn:aws:s3:::'"$RECORDINGS_BUCKET"'/*"]},{"Sid":"CloudWatchLogs","Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"arn:aws:logs:us-west-2:'"$LAMBDA_ACCOUNT"':*"}]}'

aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name cdn-recordings-execution \
  --policy-document "$EXEC_POLICY" \
  --profile "$PROFILE"

echo "Waiting 10s for IAM propagation..."
sleep 10

echo "=== 2. Package Lambda ==="
cd "$LAMBDA_DIR"
npm init -y 2>/dev/null || true
npm install --production @aws-sdk/client-s3 @aws-sdk/s3-request-presigner 2>/dev/null
zip -r /tmp/cdn-recordings.zip index.mjs node_modules/ package.json
cd "$REPO_ROOT"

echo "=== 3. Create/update Lambda ==="
ROLE_ARN="arn:aws:iam::${LAMBDA_ACCOUNT}:role/${ROLE_NAME}"

if aws lambda get-function --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE" 2>/dev/null; then
  echo "Updating Lambda..."
  aws lambda update-function-code --function-name "$LAMBDA_NAME" \
    --zip-file fileb:///tmp/cdn-recordings.zip \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda wait function-updated --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda update-function-configuration --function-name "$LAMBDA_NAME" \
    --role "$ROLE_ARN" \
    --environment "Variables={RECORDINGS_BUCKET=$RECORDINGS_BUCKET}" \
    --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
else
  echo "Creating Lambda..."
  aws lambda create-function --function-name "$LAMBDA_NAME" \
    --runtime "$LAMBDA_RUNTIME" --handler "$LAMBDA_HANDLER" \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/cdn-recordings.zip \
    --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" \
    --architectures x86_64 \
    --environment "Variables={RECORDINGS_BUCKET=$RECORDINGS_BUCKET}" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda wait function-active --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
fi

echo "=== 4. Wire to API Gateway ==="
LAMBDA_ARN="arn:aws:lambda:${LAMBDA_REGION}:${LAMBDA_ACCOUNT}:function:${LAMBDA_NAME}"

INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id "$API_ID" \
  --integration-type AWS_PROXY \
  --integration-uri "$LAMBDA_ARN" \
  --payload-format-version "2.0" \
  --region "$LAMBDA_REGION" --profile "$PROFILE" \
  --query 'IntegrationId' --output text)

echo "Integration: $INTEGRATION_ID"

aws apigatewayv2 create-route \
  --api-id "$API_ID" \
  --route-key "GET /admin/recordings" \
  --target "integrations/$INTEGRATION_ID" \
  --region "$LAMBDA_REGION" --profile "$PROFILE"

aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id "apigw-cdn-recordings" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${LAMBDA_REGION}:${LAMBDA_ACCOUNT}:${API_ID}/*/*" \
  --region "$LAMBDA_REGION" --profile "$PROFILE" 2>/dev/null || echo "Permission exists"

echo "=== Done ==="
echo "Endpoint: https://${API_ID}.execute-api.${LAMBDA_REGION}.amazonaws.com/admin/recordings"
