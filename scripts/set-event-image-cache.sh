#!/usr/bin/env bash
# scripts/set-event-image-cache.sh
# Sets cache-control: public, max-age=86400 on event images in the main S3 bucket.
# Event images change infrequently; 24h cache avoids redundant CloudFront origin fetches.
#
# Usage: AWS_PROFILE=aerospaceug-admin ./scripts/set-event-image-cache.sh

set -euo pipefail

PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
BUCKET="clouddelnorte.org"
PREFIX="events/"
CACHE_CONTROL="public, max-age=86400"

echo "Setting cache-control on s3://$BUCKET/$PREFIX*.webp"

aws s3 cp "s3://$BUCKET/$PREFIX" "s3://$BUCKET/$PREFIX" \
  --recursive \
  --exclude "*" --include "*.webp" \
  --metadata-directive REPLACE \
  --cache-control "$CACHE_CONTROL" \
  --content-type "image/webp" \
  --profile "$PROFILE"

echo "Done. Invalidate CloudFront if needed:"
echo "  aws cloudfront create-invalidation --distribution-id ECC3LP1BL2CZS --paths '/events/*' --profile $PROFILE"
