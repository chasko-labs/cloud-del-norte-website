#!/usr/bin/env bash
set -euo pipefail

# Deploy cost-aggregator lambda + cross-account IAM roles + EventBridge rule
# Run from AIBOX where SSO profiles are authenticated.
# Requires: aws cli v2, jq

LAMBDA_ACCOUNT=170473530355
LAMBDA_REGION=us-east-1
LAMBDA_NAME=cost-aggregator
LAMBDA_RUNTIME=nodejs22.x
LAMBDA_HANDLER=index.handler
LAMBDA_TIMEOUT=30
LAMBDA_MEMORY=256

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAMBDA_DIR="$SCRIPT_DIR/lambda/cost-aggregator"

echo "=== 1. Package lambda ==="
cd "$LAMBDA_DIR"
zip -j /tmp/cost-aggregator.zip index.mjs

echo "=== 2. Create/update lambda execution role ==="
ROLE_NAME=cost-aggregator-role
TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam get-role --role-name "$ROLE_NAME" --profile jitsi-video-hosting 2>/dev/null || \
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --profile jitsi-video-hosting

aws iam attach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --profile jitsi-video-hosting 2>/dev/null || true

# Lambda needs: sts:AssumeRole (cross-account), ce:Get* (own account), s3:PutObject
INLINE_POLICY=$(cat <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": ["ce:GetCostAndUsage","ce:GetCostForecast"], "Resource": "*"},
    {"Effect": "Allow", "Action": "sts:AssumeRole", "Resource": ["arn:aws:iam::211125425201:role/cost-reader-cross-account","arn:aws:iam::946179428633:role/cost-reader-cross-account"]},
    {"Effect": "Allow", "Action": "s3:PutObject", "Resource": "arn:aws:s3:::clouddelnorte.org/data/costs/*"}
  ]
}
EOF
)
aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name cost-aggregator-permissions \
  --policy-document "$INLINE_POLICY" \
  --profile jitsi-video-hosting

echo "Waiting 10s for IAM propagation..."
sleep 10

echo "=== 3. Create/update lambda function ==="
ROLE_ARN="arn:aws:iam::${LAMBDA_ACCOUNT}:role/${ROLE_NAME}"

if aws lambda get-function --function-name "$LAMBDA_NAME" --region "$LAMBDA_REGION" --profile jitsi-video-hosting 2>/dev/null; then
  aws lambda update-function-code --function-name "$LAMBDA_NAME" \
    --zip-file fileb:///tmp/cost-aggregator.zip \
    --region "$LAMBDA_REGION" --profile jitsi-video-hosting
else
  aws lambda create-function --function-name "$LAMBDA_NAME" \
    --runtime "$LAMBDA_RUNTIME" --handler "$LAMBDA_HANDLER" \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/cost-aggregator.zip \
    --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" \
    --region "$LAMBDA_REGION" --profile jitsi-video-hosting
fi

echo "=== 4. Create cross-account roles ==="
LAMBDA_TRUST=$(cat <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::${LAMBDA_ACCOUNT}:role/${ROLE_NAME}"},"Action":"sts:AssumeRole"}]}
EOF
)
COST_POLICY="$SCRIPT_DIR/iam/cost-reader-policy.json"

for PROFILE in aerospaceug-admin bryanchasko-kiro; do
  echo "--- Creating cost-reader-cross-account in $PROFILE ---"
  aws iam get-role --role-name cost-reader-cross-account --profile "$PROFILE" 2>/dev/null || \
    aws iam create-role --role-name cost-reader-cross-account \
      --assume-role-policy-document "$LAMBDA_TRUST" \
      --profile "$PROFILE"
  aws iam put-role-policy --role-name cost-reader-cross-account \
    --policy-name cost-reader \
    --policy-document "file://$COST_POLICY" \
    --profile "$PROFILE"
done

echo "=== 5. EventBridge daily schedule ==="
RULE_ARN=$(aws events put-rule \
  --name daily-cost-aggregator \
  --schedule-expression "cron(0 6 * * ? *)" \
  --state ENABLED \
  --region "$LAMBDA_REGION" --profile jitsi-video-hosting \
  --query 'RuleArn' --output text)

LAMBDA_ARN="arn:aws:lambda:${LAMBDA_REGION}:${LAMBDA_ACCOUNT}:function:${LAMBDA_NAME}"

aws lambda add-permission --function-name "$LAMBDA_NAME" \
  --statement-id eventbridge-daily \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "$RULE_ARN" \
  --region "$LAMBDA_REGION" --profile jitsi-video-hosting 2>/dev/null || true

aws events put-targets --rule daily-cost-aggregator \
  --targets "Id=cost-aggregator-lambda,Arn=$LAMBDA_ARN" \
  --region "$LAMBDA_REGION" --profile jitsi-video-hosting

echo "=== 6. Invoke once to seed data ==="
aws lambda invoke --function-name "$LAMBDA_NAME" \
  --region "$LAMBDA_REGION" --profile jitsi-video-hosting \
  /tmp/cost-aggregator-output.json
cat /tmp/cost-aggregator-output.json

echo ""
echo "=== Done. Verify: https://clouddelnorte.org/data/costs/latest.json ==="
