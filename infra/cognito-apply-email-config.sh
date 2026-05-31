#!/usr/bin/env bash
set -euo pipefail

# Apply Cognito email verification config (non-clobber pattern) as IaC.
# Pool: us-west-2_cyPQF4F3r | Account: 170473530355 | Region: us-west-2
# Profile default: jitsi-video-hosting
# chmod +x before first run.
#
# WARNING: aws cognito-idp update-user-pool RESETS any field you omit.
# This script reads the live config first and merges changes to avoid clobber.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

POOL="us-west-2_cyPQF4F3r"
REGION="us-west-2"
PROFILE="${AWS_PROFILE:-jitsi-video-hosting}"

require() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: $1 is required but not found" >&2; exit 1; }; }
require aws
require jq

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

echo "=== Fetching live pool config ==="
aws cognito-idp describe-user-pool \
  --user-pool-id "$POOL" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'UserPool' > "$TMPFILE"

echo "=== Building update payload (non-clobber merge) ==="
PAYLOAD=$(jq --arg pool "$POOL" '{
  UserPoolId: $pool,
  Policies: .Policies,
  DeletionProtection: .DeletionProtection,
  LambdaConfig: .LambdaConfig,
  AutoVerifiedAttributes: ["email"],
  UserAttributeUpdateSettings: .UserAttributeUpdateSettings,
  MfaConfiguration: .MfaConfiguration,
  AdminCreateUserConfig: .AdminCreateUserConfig,
  AccountRecoverySetting: .AccountRecoverySetting,
  VerificationMessageTemplate: .VerificationMessageTemplate,
  EmailConfiguration: {
    SourceArn: "arn:aws:ses:us-west-2:170473530355:identity/clouddelnorte.org",
    EmailSendingAccount: "DEVELOPER",
    From: "Cloud del Norte <no-reply@clouddelnorte.org>"
  }
} | with_entries(select(.value != null and .value != {} and .value != []))' "$TMPFILE")

echo "=== Applying update-user-pool ==="
echo "$PAYLOAD" | aws cognito-idp update-user-pool \
  --cli-input-json file:///dev/stdin \
  --region "$REGION" \
  --profile "$PROFILE"

echo "=== Post-apply verification ==="
VERIFY=$(aws cognito-idp describe-user-pool \
  --user-pool-id "$POOL" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'UserPool')

FAIL=0
check() {
  local actual="$1" expected="$2" label="$3"
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $label = '$actual', expected '$expected'" >&2
    FAIL=1
  else
    echo "OK: $label = $actual"
  fi
}

check "$(echo "$VERIFY" | jq -r '.EmailConfiguration.EmailSendingAccount')" "DEVELOPER" "EmailSendingAccount"
check "$(echo "$VERIFY" | jq -r '.AutoVerifiedAttributes | contains(["email"])')" "true" "AutoVerifiedAttributes contains email"
check "$(echo "$VERIFY" | jq -r '.DeletionProtection')" "ACTIVE" "DeletionProtection"
check "$(echo "$VERIFY" | jq -r '.MfaConfiguration')" "OPTIONAL" "MfaConfiguration"

if [ "$FAIL" -ne 0 ]; then
  echo "ERROR: Post-apply verification failed" >&2
  exit 1
fi
echo "=== All checks passed ==="
