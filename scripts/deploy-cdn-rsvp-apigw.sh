#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR at line $LINENO" >&2' ERR

# Deploy API Gateway HTTP V2 in front of cdn-rsvp Lambda.
# OPTIONS preflights are answered by the Lambda itself (returns 204 +
# Access-Control-Allow-* headers based on the request Origin), so we do NOT
# set an API-level CORS configuration — that would shadow the OPTIONS routes.
# Profile: jitsi-video-hosting (account 170473530355, us-west-2)

PROFILE=jitsi-video-hosting
REGION=us-west-2
ACCOUNT=170473530355
LAMBDA_NAME=cdn-rsvp
API_NAME=cdn-rsvp-api
STAGE_NAME=prod

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
  echo "API already exists: $API_ID"
else
  echo "Creating API $API_NAME..."
  API_ID=$(aws apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
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

echo "=== 3. Routes ==="
ROUTE_KEYS=(
  "OPTIONS /rsvp"
  "POST /rsvp"
  "GET /rsvp"
  "OPTIONS /rsvp/{eventId}/spots"
  "GET /rsvp/{eventId}/spots"
)

for ROUTE_KEY in "${ROUTE_KEYS[@]}"; do
  EXISTING_ROUTE_ID=$(aws apigatewayv2 get-routes --api-id "$API_ID" \
    --profile "$PROFILE" --region "$REGION" \
    --query "Items[?RouteKey==\`${ROUTE_KEY}\`].RouteId" --output text)

  if [ -n "$EXISTING_ROUTE_ID" ] && [ "$EXISTING_ROUTE_ID" != "None" ]; then
    echo "Route '${ROUTE_KEY}' already exists: $EXISTING_ROUTE_ID"
  else
    NEW_ROUTE_ID=$(aws apigatewayv2 create-route \
      --api-id "$API_ID" \
      --route-key "$ROUTE_KEY" \
      --target "integrations/$INTEG_ID" \
      --profile "$PROFILE" --region "$REGION" \
      --query 'RouteId' --output text)
    echo "Created route '${ROUTE_KEY}': $NEW_ROUTE_ID"
  fi
done

echo "=== 4. ${STAGE_NAME} stage with AutoDeploy ==="
STAGE_EXISTS=$(aws apigatewayv2 get-stages --api-id "$API_ID" \
  --profile "$PROFILE" --region "$REGION" \
  --query "Items[?StageName=='${STAGE_NAME}'].StageName" --output text)

if [ -n "$STAGE_EXISTS" ] && [ "$STAGE_EXISTS" != "None" ]; then
  echo "${STAGE_NAME} stage already exists"
  aws apigatewayv2 update-stage --api-id "$API_ID" --stage-name "$STAGE_NAME" \
    --auto-deploy \
    --profile "$PROFILE" --region "$REGION" >/dev/null
else
  aws apigatewayv2 create-stage --api-id "$API_ID" --stage-name "$STAGE_NAME" \
    --auto-deploy \
    --profile "$PROFILE" --region "$REGION" >/dev/null
  echo "${STAGE_NAME} stage created"
fi

echo "=== 5. Lambda permission for API Gateway ==="
SOURCE_ARN="arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*/*/rsvp"
aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id apigw-cdn-rsvp-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "$SOURCE_ARN" \
  --region "$REGION" --profile "$PROFILE" 2>/dev/null \
  || echo "Permission apigw-cdn-rsvp-invoke already exists, ok"

SOURCE_ARN_SPOTS="arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*/*/rsvp/*/spots"
aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id apigw-cdn-rsvp-spots-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "$SOURCE_ARN_SPOTS" \
  --region "$REGION" --profile "$PROFILE" 2>/dev/null \
  || echo "Permission apigw-cdn-rsvp-spots-invoke already exists, ok"

INVOKE_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE_NAME}"

echo ""
echo "=== Done ==="
echo "API_ID=${API_ID}"
echo "Invoke URL (base): ${INVOKE_URL}"
echo "  POST  ${INVOKE_URL}/rsvp"
echo "  GET   ${INVOKE_URL}/rsvp"
echo "  GET   ${INVOKE_URL}/rsvp/{eventId}/spots"
echo ""
echo "Add to CSP connect-src on awsug subdomain:"
echo "  https://${API_ID}.execute-api.${REGION}.amazonaws.com"
