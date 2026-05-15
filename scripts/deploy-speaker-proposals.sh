#!/usr/bin/env bash
set -euo pipefail

# Deploy cdn-speaker-proposals Lambda + DynamoDB tables + IAM role + API Gateway + WAF
# Run from AIBOX where SSO profiles are authenticated.
# Requires: aws cli v2, jq
# Profile: jitsi-video-hosting (account 170473530355, us-west-2)

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
API_NAME=cdn-speaker-proposals-api
WEBACL_NAME=cdn-speaker-proposals-webacl

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAMBDA_DIR="$REPO_ROOT/infra/lambda/speaker-proposals"
DYNAMODB_DIR="$REPO_ROOT/infra/dynamodb"
IAM_DIR="$REPO_ROOT/infra/iam"
APIGW_DIR="$REPO_ROOT/infra/api-gateway"
WAF_DIR="$REPO_ROOT/infra/waf"

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

echo "=== 1b. Enable TTL on rate table (idempotent) ==="
aws dynamodb update-time-to-live \
  --table-name "$RATE_TABLE" \
  --time-to-live-specification "Enabled=true,AttributeName=expiresAt" \
  --region "$LAMBDA_REGION" --profile "$PROFILE" 2>/dev/null || true

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

ENV_VARS="Variables={IP_HASH_SALT_SSM_PATH=/cloud-del-norte/speaker-proposals/ip-hash-salt,RATE_TABLE_NAME=${RATE_TABLE},TABLE_NAME=${PROPOSALS_TABLE},NOTIFICATION_EMAIL=bryanj+clouddelnortespeakerrequest@abstractspacecraft.com,FROM_ADDRESS=heraldstack@clouddelnorte.org,ADMIN_PANEL_URL=https://awsug.clouddelnorte.org/admin/}"

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
    --role "$ROLE_ARN" \
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

LAMBDA_ARN=$(aws lambda get-function --function-name "$LAMBDA_NAME" \
  --region "$LAMBDA_REGION" --profile "$PROFILE" \
  --query 'Configuration.FunctionArn' --output text)

ACCOUNT_ID="$LAMBDA_ACCOUNT"
REGION="$LAMBDA_REGION"

echo '=== 5z. Cleanup legacy REST API V1 (idempotent) ==='
V1_API_ID=$(aws apigateway get-rest-apis --profile "$PROFILE" --region "$REGION" --query 'items[?name==`cdn-speaker-proposals-api`].id' --output text)
if [ -n "$V1_API_ID" ] && [ "$V1_API_ID" != "None" ]; then
  echo "Deleting legacy V1 REST API: $V1_API_ID"
  aws apigateway delete-rest-api --rest-api-id "$V1_API_ID" --profile "$PROFILE" --region "$REGION"
fi

echo '=== 5. Create/update HTTP API V2 (idempotent) ==='
API_ID=$(aws apigatewayv2 get-apis --profile "$PROFILE" --region "$REGION" --query 'Items[?Name==`cdn-speaker-proposals-api`].ApiId' --output text)
if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
  echo 'Creating HTTP API V2...'
  API_ID=$(aws apigatewayv2 create-api \
    --name cdn-speaker-proposals-api \
    --protocol-type HTTP \
    --description 'Public API for speaker proposal submissions, protected by AWS WAF CAPTCHA' \
    --cors-configuration AllowOrigins=https://clouddelnorte.org,https://awsug.clouddelnorte.org,AllowMethods=POST,OPTIONS,AllowHeaders=Content-Type,Authorization,x-aws-waf-token,AllowCredentials=false,MaxAge=300 \
    --profile "$PROFILE" --region "$REGION" \
    --query ApiId --output text)
else
  echo "HTTP API V2 exists: $API_ID, updating CORS..."
  aws apigatewayv2 update-api --api-id "$API_ID" \
    --cors-configuration AllowOrigins=https://clouddelnorte.org,https://awsug.clouddelnorte.org,AllowMethods=POST,OPTIONS,AllowHeaders=Content-Type,Authorization,x-aws-waf-token,AllowCredentials=false,MaxAge=300 \
    --profile "$PROFILE" --region "$REGION" >/dev/null
fi
echo "API_ID=$API_ID"

echo '=== 5b. Lambda integration (idempotent) ==='
INTEGRATION_ID=$(aws apigatewayv2 get-integrations --api-id "$API_ID" --profile "$PROFILE" --region "$REGION" --query 'Items[0].IntegrationId' --output text)
if [ -z "$INTEGRATION_ID" ] || [ "$INTEGRATION_ID" = "None" ]; then
  INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$LAMBDA_NAME" \
    --integration-method POST \
    --payload-format-version 2.0 \
    --profile "$PROFILE" --region "$REGION" \
    --query IntegrationId --output text)
fi
echo "INTEGRATION_ID=$INTEGRATION_ID"

echo '=== 5c. Route POST /proposals (idempotent, no authorizer) ==='
ROUTE_KEY='POST /proposals'
EXISTING_ROUTE=$(aws apigatewayv2 get-routes --api-id "$API_ID" --profile "$PROFILE" --region "$REGION" --query "Items[?RouteKey=='$ROUTE_KEY'].RouteId" --output text)
if [ -z "$EXISTING_ROUTE" ] || [ "$EXISTING_ROUTE" = "None" ]; then
  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "$ROUTE_KEY" \
    --target "integrations/$INTEGRATION_ID" \
    --authorization-type NONE \
    --profile "$PROFILE" --region "$REGION" >/dev/null
fi

echo '=== 5d. Stage $default with auto-deploy (idempotent) ==='
STAGE_EXISTS=$(aws apigatewayv2 get-stages --api-id "$API_ID" --profile "$PROFILE" --region "$REGION" --query 'Items[?StageName==`$default`].StageName' --output text)
if [ -z "$STAGE_EXISTS" ] || [ "$STAGE_EXISTS" = "None" ]; then
  aws apigatewayv2 create-stage \
    --api-id "$API_ID" \
    --stage-name '$default' \
    --auto-deploy \
    --profile "$PROFILE" --region "$REGION" >/dev/null
fi

echo '=== 5e. Lambda permission for API Gateway invoke (idempotent) ==='
STATEMENT_ID='apigateway-invoke-speaker-proposals-v2'
aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id "$STATEMENT_ID" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo 'permission already exists, ok'

API_ENDPOINT="https://$API_ID.execute-api.$REGION.amazonaws.com"
echo "API_ENDPOINT=$API_ENDPOINT"
echo "PROPOSALS_URL=$API_ENDPOINT/proposals"

echo "=== 6. Create/update WAF WebACL (idempotent) ==="
WEBACL_ID=$(aws wafv2 list-web-acls --scope REGIONAL \
  --region "$LAMBDA_REGION" --profile "$PROFILE" \
  --query "WebACLs[?Name=='${WEBACL_NAME}'].Id" --output text)

if [ -z "$WEBACL_ID" ]; then
  echo "Creating WAF WebACL: $WEBACL_NAME..."
  WEBACL_RESULT=$(aws wafv2 create-web-acl \
    --cli-input-json "file://$WAF_DIR/speaker-proposals-webacl.json" \
    --region "$LAMBDA_REGION" --profile "$PROFILE")
  WEBACL_ID=$(echo "$WEBACL_RESULT" | jq -r '.Summary.Id')
  WEBACL_ARN=$(echo "$WEBACL_RESULT" | jq -r '.Summary.ARN')
  echo "Created WebACL: $WEBACL_ID"
else
  echo "WebACL $WEBACL_NAME already exists: $WEBACL_ID"
  WEBACL_ARN=$(aws wafv2 list-web-acls --scope REGIONAL \
    --region "$LAMBDA_REGION" --profile "$PROFILE" \
    --query "WebACLs[?Name=='${WEBACL_NAME}'].ARN" --output text)
fi

echo "=== 7. Associate WebACL with API Gateway stage (idempotent) ==="
RESOURCE_ARN="arn:aws:apigateway:${REGION}::/apis/${API_ID}/stages/\$default"
CURRENT_WEBACL=$(aws wafv2 get-web-acl-for-resource \
  --resource-arn "$RESOURCE_ARN" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'WebACL.ARN' --output text 2>/dev/null || true)
if [ "$CURRENT_WEBACL" = "$WEBACL_ARN" ]; then
  echo "WebACL already associated."
else
  aws wafv2 associate-web-acl \
    --web-acl-arn "$WEBACL_ARN" \
    --resource-arn "$RESOURCE_ARN" \
    --region "$REGION" --profile "$PROFILE"
  echo "WebACL associated with API Gateway stage."
fi

echo "=== 8. WAF Application Integration URL ==="
# ApplicationIntegrationURL is not returned by CLI — retrieve from AWS console:
# WAF > Web ACLs > cdn-speaker-proposals-webacl > Application integration tab
# JS SDK endpoint format: https://<id>.<region>.sdk.awswaf.com/<id>/
APP_INTEGRATION_URL="(see WAF console > cdn-speaker-proposals-webacl > Application integration)"

echo "=== 9. Cleanup: remove Lambda Function URL (idempotent) ==="
if aws lambda delete-function-url-config --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE" 2>/dev/null; then
  echo "Lambda Function URL deleted."
else
  echo "Lambda Function URL not found (already removed or never created)."
fi

echo ""
echo "=== 10. Summary ==="
echo "API Gateway endpoint:    $API_ENDPOINT"
echo "POST /proposals URL:     ${API_ENDPOINT}/proposals"
echo "WebACL ARN:              $WEBACL_ARN"
echo "WAF App Integration URL: $APP_INTEGRATION_URL"
echo ""
echo "=== SSM parameter to populate before first use ==="
echo "  aws ssm put-parameter --name /cloud-del-norte/speaker-proposals/ip-hash-salt \\"
echo "    --value \"\$(openssl rand -hex 32)\" --type SecureString \\"
echo "    --region $LAMBDA_REGION --profile $PROFILE"
echo ""
echo "=== Frontend integration ==="
echo "Load WAF JS SDK from: \${APP_INTEGRATION_URL}jsapi.js"
echo "Use AwsWafIntegration.getToken() before submitting the proposal form."
