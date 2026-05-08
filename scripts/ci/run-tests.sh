#!/usr/bin/env bash
set -euo pipefail

# Assume CI role via OIDC
eval "$(aws sts assume-role-with-web-identity \
  --role-arn "$AWS_ROLE_ARN" \
  --role-session-name "woodpecker-${CI_BUILD_NUMBER}" \
  --web-identity-token "$CI_OIDC_TOKEN" \
  --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
  --output text | awk '{printf "export AWS_ACCESS_KEY_ID=%s\nexport AWS_SECRET_ACCESS_KEY=%s\nexport AWS_SESSION_TOKEN=%s\n",$1,$2,$3}')"

TEST_PACKAGE="${TEST_PACKAGE_PATH:-tests.zip}"

# Create upload slot
UPLOAD=$(aws devicefarm create-upload \
  --project-arn "$DEVICE_FARM_PROJECT_ARN" \
  --name "$(basename "$TEST_PACKAGE")" \
  --type "WEB_APP" \
  --output json)

UPLOAD_ARN=$(echo "$UPLOAD" | jq -r '.upload.arn')
UPLOAD_URL=$(echo "$UPLOAD" | jq -r '.upload.url')

# Upload test package
curl -sSf -T "$TEST_PACKAGE" "$UPLOAD_URL"

# Wait for upload processing
for i in $(seq 1 30); do
  STATUS=$(aws devicefarm get-upload --arn "$UPLOAD_ARN" --query 'upload.status' --output text)
  [ "$STATUS" = "SUCCEEDED" ] && break
  [ "$STATUS" = "FAILED" ] && echo "Upload failed" && exit 1
  sleep 2
done

# Schedule run
RUN=$(aws devicefarm schedule-run \
  --project-arn "$DEVICE_FARM_PROJECT_ARN" \
  --app-arn "$UPLOAD_ARN" \
  --test type=BUILTIN_FUZZ \
  --output json)

RUN_ARN=$(echo "$RUN" | jq -r '.run.arn')
echo "Run started: $RUN_ARN"

# Poll until complete (timeout 30 min)
for i in $(seq 1 180); do
  RESULT=$(aws devicefarm get-run --arn "$RUN_ARN" --output json)
  STATUS=$(echo "$RESULT" | jq -r '.run.status')
  [ "$STATUS" = "COMPLETED" ] && break
  [ "$STATUS" = "ERRORED" ] && echo "Run errored" && exit 1
  sleep 10
done

# Check result
OUTCOME=$(echo "$RESULT" | jq -r '.run.result')
echo "Run result: $OUTCOME"

# Export for collect-artifacts.sh
echo "$RUN_ARN" > /tmp/device_farm_run_arn

[ "$OUTCOME" = "PASSED" ] && exit 0
exit 1
