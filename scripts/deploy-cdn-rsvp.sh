#!/usr/bin/env bash
set -euo pipefail

# Deploy cdn-rsvp Lambda (code + DynamoDB + IAM + env vars).
# Production traffic via API Gateway HTTP V2 (configured separately by
# scripts/deploy-cdn-rsvp-apigw.sh).
# Profile: jitsi-video-hosting (account 170473530355, us-west-2)
#
# DRIFT WARNING: Never use `aws lambda update-function-configuration` ad-hoc.
# That command REPLACES the entire Environment block — any variable not in
# the --environment payload is silently deleted. Always re-run this script
# to update env vars so all declared variables (RSVP_TABLE, EVENT_CAPACITIES,
# USER_POOL_ID) stay in sync. Incident: 2026-08-13, ad-hoc update dropped
# EVENT_CAPACITIES + USER_POOL_ID, breaking RSVP creation (404 unknown_event).
#
# NOTE: Environment variables are written to a tmp JSON file via jq and passed
# as `--environment file:///tmp/cdn-rsvp-env.json` (instead of the AWS CLI
# `Variables={k=v,...}` shorthand). EVENT_CAPACITIES contains JSON with commas,
# which breaks the shorthand parser. The file:// pattern sidesteps it entirely.
# See wave 35c.

LAMBDA_ACCOUNT=170473530355
LAMBDA_REGION=us-west-2
LAMBDA_NAME=cdn-rsvp
LAMBDA_RUNTIME=nodejs22.x
LAMBDA_HANDLER=index.handler
LAMBDA_TIMEOUT=10
LAMBDA_MEMORY=256
ROLE_NAME=cdn-rsvp-lambda-role
PROFILE=jitsi-video-hosting

RSVP_TABLE=cdn-rsvps
USER_POOL_ID=us-west-2_cyPQF4F3r

# EVENT_CAPACITIES is a JSON map: eventId → seat capacity. Bryan edits this
# inline when launching a new event. Stays well under the 4 KB Lambda env
# var limit (current size: a few dozen bytes per event).
EVENT_CAPACITIES='{"happy-hour-2026-06-03":50}'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAMBDA_DIR="$REPO_ROOT/infra/lambda/cdn-rsvp"
DYNAMODB_DIR="$REPO_ROOT/infra/dynamodb"
IAM_DIR="$REPO_ROOT/infra/iam"

trap 'echo "ERROR: deploy failed at line $LINENO" >&2' ERR

echo "=== 0. SSO check ==="
aws sts get-caller-identity --profile "$PROFILE" --region "$LAMBDA_REGION" \
  --query 'Account' --output text | grep -q "$LAMBDA_ACCOUNT" \
  || { echo "ERROR: profile $PROFILE is not authenticated to account $LAMBDA_ACCOUNT" >&2; exit 1; }
echo "Authenticated to account $LAMBDA_ACCOUNT via $PROFILE"

echo "=== 1. Create DynamoDB table (idempotent) ==="
for TABLE_JSON in "$DYNAMODB_DIR/cdn-rsvps-table.json"; do
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
EXEC_POLICY="file://$IAM_DIR/cdn-rsvp-execution-policy.json"

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
  --policy-name cdn-rsvp-execution \
  --policy-document "$EXEC_POLICY" \
  --profile "$PROFILE"

echo "Waiting 10s for IAM propagation..."
sleep 10

echo "=== 3. Package Lambda ==="
cd "$LAMBDA_DIR"
zip -j /tmp/cdn-rsvp.zip index.mjs
cd "$REPO_ROOT"

echo "=== 4. Create/update Lambda function ==="
ROLE_ARN="arn:aws:iam::${LAMBDA_ACCOUNT}:role/${ROLE_NAME}"

# Build the Environment payload as a tmp JSON file via jq. Passing complex
# values inline via the AWS CLI `Variables={k=v,...}` shorthand fails when
# any value contains a comma (e.g. EVENT_CAPACITIES JSON). jq handles all
# the quote/escape rules correctly. See wave 35c.
ENV_JSON_FILE=/tmp/cdn-rsvp-env.json
jq -n \
  --arg ec "$EVENT_CAPACITIES" \
  --arg up "$USER_POOL_ID" \
  --arg rt "$RSVP_TABLE" \
  '{Variables: {EVENT_CAPACITIES: $ec, USER_POOL_ID: $up, RSVP_TABLE: $rt}}' \
  > "$ENV_JSON_FILE"
trap 'rm -f "$ENV_JSON_FILE" /tmp/cdn-rsvp.zip' EXIT

if aws lambda get-function --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE" 2>/dev/null; then
  echo "Lambda $LAMBDA_NAME exists — updating code + config..."
  aws lambda update-function-code --function-name "$LAMBDA_NAME" \
    --zip-file fileb:///tmp/cdn-rsvp.zip \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda wait function-updated \
    --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda update-function-configuration --function-name "$LAMBDA_NAME" \
    --role "$ROLE_ARN" \
    --environment "file://$ENV_JSON_FILE" \
    --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
else
  echo "Creating Lambda $LAMBDA_NAME..."
  aws lambda create-function --function-name "$LAMBDA_NAME" \
    --runtime "$LAMBDA_RUNTIME" --handler "$LAMBDA_HANDLER" \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/cdn-rsvp.zip \
    --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" \
    --architectures x86_64 \
    --environment "file://$ENV_JSON_FILE" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
  aws lambda wait function-active \
    --function-name "$LAMBDA_NAME" \
    --region "$LAMBDA_REGION" --profile "$PROFILE"
fi

echo "=== 5. Done ==="
echo ""
echo "Lambda code + DynamoDB + IAM + env vars deployed."
echo "Next: run scripts/deploy-cdn-rsvp-apigw.sh to attach the HTTP V2 API."
