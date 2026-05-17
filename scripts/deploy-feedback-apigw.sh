#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR at line $LINENO" >&2' ERR

PROFILE=jitsi-video-hosting
REGION=us-west-2
ACCOUNT=170473530355
LAMBDA_NAME=cdn-feedback
API_NAME=cdn-feedback-api

echo "=== 0. SSO check ==="
ACTUAL=$(aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" \
  --query 'Account' --output text)
[ "$ACTUAL" = "$ACCOUNT" ] \
  || { echo "ERROR: expected account $ACCOUNT, got $ACTUAL" >&2; exit 1; }
echo "Authenticated: account $ACCOUNT via $PROFILE"

LAMBDA_ARN=$(aws lambda get-function --function-name "$LAMBDA_NAME" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'Configuration.FunctionArn' --output text)
echo "Lambda ARN: $LAMBDA_ARN"

echo "=== 1. Create or reuse HTTP API V2 ==="
EXISTING_ID=$(aws apigatewayv2 get-apis \
  --profile "$PROFILE" --region "$REGION" \
  --query "Items[?Name=='${API_NAME}'].ApiId" --output text)

if [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "None" ]; then
  API_ID="$EXISTING_ID"
  echo "API already exists: $API_ID — updating CORS config"
  aws apigatewayv2 update-api --api-id "$API_ID" \
    --cors-configuration \
      AllowOrigins="https://clouddelnorte.org,https://awsug.clouddelnorte.org,https://dev.clouddelnorte.org",AllowMethods="POST,OPTIONS",AllowHeaders="content-type",MaxAge=86400 \
    --profile "$PROFILE" --region "$REGION" >/dev/null
else
  echo "Creating API $API_NAME..."
  API_ID=$(aws apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --cors-configuration \
      AllowOrigins="https://clouddelnorte.org,https://awsug.clouddelnorte.org,https://dev.clouddelnorte.org",AllowMethods="POST,OPTIONS",AllowHeaders="content-type",MaxAge=86400 \
    --profile "$PROFILE" --region "$REGION" \
    --query 'ApiId' --output text)
  echo "Created API: $API_ID"
fi

echo "=== 2. Lambda integration ==="
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

echo "=== 3. Route POST /feedback ==="
ROUTE_ID=$(aws apigatewayv2 get-routes --api-id "$API_ID" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'Items[?RouteKey==`POST /feedback`].RouteId' --output text)

if [ -n "$ROUTE_ID" ] && [ "$ROUTE_ID" != "None" ]; then
  echo "Route already exists: $ROUTE_ID"
else
  ROUTE_ID=$(aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "POST /feedback" \
    --target "integrations/$INTEG_ID" \
    --profile "$PROFILE" --region "$REGION" \
    --query 'RouteId' --output text)
  echo "Created route: $ROUTE_ID"
fi

echo "=== 4. \$default stage with AutoDeploy ==="
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

echo "=== 5. Lambda permission for API Gateway ==="
SOURCE_ARN="arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*/POST/feedback"
aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id apigw-feedback-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "$SOURCE_ARN" \
  --region "$REGION" --profile "$PROFILE" 2>/dev/null \
  || echo "Permission already exists, ok"

echo ""
echo "=== Done ==="
echo "VITE_FEEDBACK_API_URL=https://${API_ID}.execute-api.${REGION}.amazonaws.com/feedback"
