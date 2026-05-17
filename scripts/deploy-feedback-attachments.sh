#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR at line $LINENO" >&2' ERR

PROFILE=jitsi-video-hosting
REGION=us-west-2
ACCOUNT=170473530355
BUCKET=cdn-feedback-attachments

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
POLICY_FILE="$REPO_ROOT/infra/s3-cdn-feedback-attachments-policy.json"
LIFECYCLE_FILE="$REPO_ROOT/infra/s3-cdn-feedback-attachments-lifecycle.json"

echo "=== 0. SSO check ==="
ACTUAL=$(aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" \
  --query 'Account' --output text)
[ "$ACTUAL" = "$ACCOUNT" ] \
  || { echo "ERROR: expected account $ACCOUNT, got $ACTUAL" >&2; exit 1; }
echo "Authenticated: account $ACCOUNT via $PROFILE"

echo "=== 1. Create bucket if missing ==="
if aws s3api head-bucket --bucket "$BUCKET" --profile "$PROFILE" \
    --region "$REGION" 2>/dev/null; then
  echo "Bucket $BUCKET already exists"
else
  echo "Creating bucket $BUCKET in $REGION..."
  aws s3api create-bucket \
    --bucket "$BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" \
    --profile "$PROFILE"
  echo "Bucket created."
fi

echo "=== 2. Block public ACLs, allow bucket policy public read ==="
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
  --profile "$PROFILE" --region "$REGION"
echo "Public access block configured."

echo "=== 3. Apply bucket policy (public read on attachments/*) ==="
aws s3api put-bucket-policy \
  --bucket "$BUCKET" \
  --policy "file://$POLICY_FILE" \
  --profile "$PROFILE" --region "$REGION"
echo "Bucket policy applied."

echo "=== 4. Apply lifecycle rule (delete attachments/ after 365 days) ==="
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$BUCKET" \
  --lifecycle-configuration "file://$LIFECYCLE_FILE" \
  --profile "$PROFILE" --region "$REGION"
echo "Lifecycle rule applied."

echo ""
echo "=== Done ==="
echo "s3://${BUCKET}/"
echo "https://${BUCKET}.s3.${REGION}.amazonaws.com/attachments/<uuid>.<ext>"
echo ""
echo "Bucket policy summary:"
aws s3api get-bucket-policy --bucket "$BUCKET" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'Policy' --output text | python3 -m json.tool 2>/dev/null || \
  aws s3api get-bucket-policy --bucket "$BUCKET" \
    --profile "$PROFILE" --region "$REGION" \
    --query 'Policy' --output text
