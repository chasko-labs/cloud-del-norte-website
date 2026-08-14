#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR at line $LINENO" >&2' ERR

PROFILE=jitsi-video-hosting
REGION=us-west-2
ACCOUNT=170473530355
TABLE_NAME=cdn-scheduled-meetings
LAMBDA_NAME=cdn-scheduled-meetings
ROLE_NAME=cdn-scheduled-meetings-role
API_NAME=cdn-scheduled-meetings-api
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== 0. SSO check ==="
ACTUAL=$(aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" \
  --query 'Account' --output text)
[ "$ACTUAL" = "$ACCOUNT" ] \
  || { echo "ERROR: expected account $ACCOUNT, got $ACTUAL" >&2; exit 1; }
echo "Authenticated: account $ACCOUNT via $PROFILE"

echo "=== 1. DynamoDB table ==="
TABLE_EXISTS=$(aws dynamodb describe-table --table-name "$TABLE_NAME" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null && echo "yes" || echo "no")

if [ "$TABLE_EXISTS" = "no" ]; then
  echo "Creating table $TABLE_NAME..."
  aws dynamodb create-table \
    --cli-input-json "file://${SCRIPT_DIR}/../infra/dynamodb/cdn-scheduled-meetings-table.json" \
    --profile "$PROFILE" --region "$REGION" >/dev/null
  echo "Waiting for table to become active..."
  aws dynamodb wait table-exists --table-name "$TABLE_NAME" \
    --profile "$PROFILE" --region "$REGION"
  echo "Table created."
else
  echo "Table $TABLE_NAME already exists."
fi

echo "=== 2. IAM role ==="
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'Role.Arn' --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
  echo "Creating role $ROLE_NAME..."
  TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  ROLE_ARN=$(aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --profile "$PROFILE" --region "$REGION" \
    --query 'Role.Arn' --output text)
  echo "Attaching execution policy..."
  aws iam put-role-policy --role-name "$ROLE_NAME" \
    --policy-name "${ROLE_NAME}-policy" \
    --policy-document "file://${SCRIPT_DIR}/../infra/iam/scheduled-meetings-execution-policy.json" \
    --profile "$PROFILE" --region "$REGION"
  echo "Waiting 10s for IAM propagation..."
  sleep 10
else
  echo "Role already exists: $ROLE_ARN"
  # Update policy in case it changed
  aws iam put-role-policy --role-name "$ROLE_NAME" \
    --policy-name "${ROLE_NAME}-policy" \
    --policy-document "file://${SCRIPT_DIR}/../infra/iam/scheduled-meetings-execution-policy.json" \
    --profile "$PROFILE" --region "$REGION"
fi

echo "=== 3. Lambda function ==="
LAMBDA_EXISTS=$(aws lambda get-function --function-name "$LAMBDA_NAME" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null && echo "yes" || echo "no")

# Package lambda
cd "${SCRIPT_DIR}/../infra/lambda/scheduled-meetings"
zip -j /tmp/cdn-scheduled-meetings.zip index.mjs
cd "$SCRIPT_DIR"

if [ "$LAMBDA_EXISTS" = "no" ]; then
  echo "Creating Lambda $LAMBDA_NAME..."
  aws lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --runtime nodejs20.x \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/cdn-scheduled-meetings.zip \
    --timeout 15 \
    --memory-size 256 \
    --environment "Variables={TABLE_NAME=$TABLE_NAME}" \
    --profile "$PROFILE" --region "$REGION" >/dev/null
  echo "Lambda created."
else
  echo "Updating Lambda code..."
  aws lambda update-function-code \
    --function-name "$LAMBDA_NAME" \
    --zip-file fileb:///tmp/cdn-scheduled-meetings.zip \
    --profile "$PROFILE" --region "$REGION" >/dev/null
  echo "Lambda updated."
fi

LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT}:function:${LAMBDA_NAME}"

echo "=== 4. API Gateway HTTP V2 ==="
EXISTING_ID=$(aws apigatewayv2 get-apis \
  --profile "$PROFILE" --region "$REGION" \
  --query "Items[?Name=='${API_NAME}'].ApiId" --output text)

if [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "None" ]; then
  API_ID="$EXISTING_ID"
  echo "API already exists: $API_ID — updating CORS"
  aws apigatewayv2 update-api --api-id "$API_ID" \
    --cors-configuration \
      AllowOrigins="https://clouddelnorte.org,https://awsug.clouddelnorte.org,https://dev.clouddelnorte.org",AllowMethods="GET,POST,PUT,DELETE,OPTIONS",AllowHeaders="content-type,authorization",MaxAge=86400 \
    --profile "$PROFILE" --region "$REGION" >/dev/null
else
  echo "Creating API $API_NAME..."
  API_ID=$(aws apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --cors-configuration \
      AllowOrigins="https://clouddelnorte.org,https://awsug.clouddelnorte.org,https://dev.clouddelnorte.org",AllowMethods="GET,POST,PUT,DELETE,OPTIONS",AllowHeaders="content-type,authorization",MaxAge=86400 \
    --profile "$PROFILE" --region "$REGION" \
    --query 'ApiId' --output text)
  echo "Created API: $API_ID"
fi

echo "=== 5. Lambda integration ==="
INTEG_ID=$(aws apigatewayv2 get-integrations --api-id "$API_ID" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'Items[?IntegrationUri==`'"$LAMBDA_ARN"'`].IntegrationId' --output text)

if [ -n "$INTEG_ID" ] && [ "$INTEG_ID" != "None" ]; then
  echo "Integration already exists: $INTEG_ID"
else
  INTEG_ID=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" \
    --payload-format-version 2.0 \
    --profile "$PROFILE" --region "$REGION" \
    --query 'IntegrationId' --output text)
  echo "Created integration: $INTEG_ID"
fi

echo "=== 6. Routes ==="
for ROUTE_KEY in "POST /admin/scheduled-meetings" "GET /admin/scheduled-meetings" "GET /admin/scheduled-meetings/{meeting_id}" "PUT /admin/scheduled-meetings/{meeting_id}" "DELETE /admin/scheduled-meetings/{meeting_id}"; do
  ROUTE_ID=$(aws apigatewayv2 get-routes --api-id "$API_ID" \
    --profile "$PROFILE" --region "$REGION" \
    --query "Items[?RouteKey==\`${ROUTE_KEY}\`].RouteId" --output text)

  if [ -n "$ROUTE_ID" ] && [ "$ROUTE_ID" != "None" ]; then
    echo "Route '$ROUTE_KEY' already exists: $ROUTE_ID"
  else
    ROUTE_ID=$(aws apigatewayv2 create-route \
      --api-id "$API_ID" \
      --route-key "$ROUTE_KEY" \
      --target "integrations/$INTEG_ID" \
      --profile "$PROFILE" --region "$REGION" \
      --query 'RouteId' --output text)
    echo "Created route '$ROUTE_KEY': $ROUTE_ID"
  fi
done

echo "=== 7. \$default stage with AutoDeploy ==="
STAGE_EXISTS=$(aws apigatewayv2 get-stages --api-id "$API_ID" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'Items[?StageName==`$default`].StageName' --output text)

if [ -n "$STAGE_EXISTS" ] && [ "$STAGE_EXISTS" != "None" ]; then
  echo "\$default stage already exists"
  aws apigatewayv2 update-stage --api-id "$API_ID" --stage-name '$default' \
    --auto-deploy \
    --profile "$PROFILE" --region "$REGION" >/dev/null
else
  aws apigatewayv2 create-stage --api-id "$API_ID" --stage-name '$default' \
    --auto-deploy \
    --profile "$PROFILE" --region "$REGION" >/dev/null
  echo "\$default stage created"
fi

echo "=== 8. Lambda permission for API Gateway ==="
SOURCE_ARN="arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*"
aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id apigw-scheduled-meetings-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "$SOURCE_ARN" \
  --region "$REGION" --profile "$PROFILE" 2>/dev/null \
  || echo "Permission already exists, ok"

echo ""
echo "=== Done ==="
echo "API endpoint: https://${API_ID}.execute-api.${REGION}.amazonaws.com"
echo ""
echo "Add to .env.production:"
echo "VITE_SCHEDULED_MEETINGS_API_URL=https://${API_ID}.execute-api.${REGION}.amazonaws.com"
