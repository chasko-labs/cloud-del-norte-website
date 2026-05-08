#!/usr/bin/env bash
set -euo pipefail

RUN_ARN=$(cat /tmp/device_farm_run_arn)
DEST="s3://${DEVICE_FARM_ARTIFACTS_BUCKET}/runs/${CI_BUILD_NUMBER}/"

# List and download artifacts
for TYPE in LOG SCREENSHOT FILE; do
  ARTIFACTS=$(aws devicefarm list-artifacts \
    --arn "$RUN_ARN" \
    --type "$TYPE" \
    --query 'artifacts[].url' \
    --output text)

  for URL in $ARTIFACTS; do
    FILENAME=$(basename "$URL" | cut -d'?' -f1)
    curl -sSf -o "/tmp/${TYPE}_${FILENAME}" "$URL"
    aws s3 cp "/tmp/${TYPE}_${FILENAME}" "${DEST}${TYPE}/${FILENAME}"
  done
done

echo "Artifacts uploaded to ${DEST}"
