#!/usr/bin/env bash
set -euo pipefail

# fetch-test-tokens.sh — On-demand Cognito token minting for device-farm harnesses.
#
# Reads member test user credentials from SSM Parameter Store, performs
# Cognito USER_PASSWORD_AUTH, writes tokens to a mode-0600 temp file.
# Outputs the temp file path on stdout for consumption by callers.
#
# Usage:
#   TOKEN_FILE=$(scripts/device-farm/fetch-test-tokens.sh)
#   python3 tests/device-farm/music-player-diagnostic.py --refresh-token-file "$TOKEN_FILE"
#   rm -f "$TOKEN_FILE"
#
# Requires:
#   - AWS CLI v2 with active session for profile jitsi-video-hosting
#   - SSM params: /cloud-del-norte/test/member-only-user-email
#                 /cloud-del-norte/test/member-only-user-password
#                 /cloud-del-norte/test/cognito-client-id
#                 /cloud-del-norte/test/cognito-user-pool-id

REGION="${AWS_REGION:-us-west-2}"
PROFILE="${AWS_PROFILE:-jitsi-video-hosting}"
SSM_PREFIX="/cloud-del-norte/test"

err() { echo "ERROR: $*" >&2; exit 1; }

# Verify AWS CLI session
aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1 \
  || err "No active AWS session for profile '$PROFILE'. Run: aws sso login --profile $PROFILE"

# Read credentials from SSM
MEMBER_EMAIL=$(aws ssm get-parameter \
  --name "${SSM_PREFIX}/member-only-user-email" \
  --with-decryption \
  --query "Parameter.Value" --output text \
  --region "$REGION" --profile "$PROFILE") \
  || err "Failed to read member email from SSM"

MEMBER_PW=$(aws ssm get-parameter \
  --name "${SSM_PREFIX}/member-only-user-password" \
  --with-decryption \
  --query "Parameter.Value" --output text \
  --region "$REGION" --profile "$PROFILE") \
  || err "Failed to read member password from SSM"

CLIENT_ID=$(aws ssm get-parameter \
  --name "${SSM_PREFIX}/cognito-client-id" \
  --query "Parameter.Value" --output text \
  --region "$REGION" --profile "$PROFILE") \
  || err "Failed to read Cognito client ID from SSM"

# Create temp file with restricted permissions BEFORE writing tokens
TOKEN_FILE=$(mktemp /tmp/cdn-test-tokens.XXXXXX)
chmod 0600 "$TOKEN_FILE"

# Cleanup on failure
trap 'rm -f "$TOKEN_FILE"' ERR

# Perform Cognito InitiateAuth (USER_PASSWORD_AUTH)
AUTH_RESULT=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters "USERNAME=${MEMBER_EMAIL},PASSWORD=${MEMBER_PW}" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --output json 2>&1) \
  || err "Cognito InitiateAuth failed: $AUTH_RESULT"

# Extract tokens
REFRESH_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.RefreshToken // empty')
ID_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.IdToken // empty')
ACCESS_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.AccessToken // empty')

[[ -n "$REFRESH_TOKEN" ]] || err "No RefreshToken in auth response (MFA challenge?)"

# Write tokens to temp file (refresh token on first line for --refresh-token-file compat)
cat > "$TOKEN_FILE" <<EOF
${REFRESH_TOKEN}
EOF

# Output the path for callers
echo "$TOKEN_FILE"
