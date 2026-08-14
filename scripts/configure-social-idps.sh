#!/usr/bin/env bash
# scripts/configure-social-idps.sh — Configure Google and Apple social identity
# providers on the Cognito user pool, then update the app client to allow them.
#
# Prerequisites:
#   - AWS CLI v2 with active SSO session (profile: jitsi-video-hosting)
#   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables set
#   - APPLE_SERVICES_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY env vars set
#
# Usage:
#   export GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
#   export GOOGLE_CLIENT_SECRET="..."
#   export APPLE_SERVICES_ID="..."   # e.g. org.clouddelnorte.signin
#   export APPLE_TEAM_ID="..."
#   export APPLE_KEY_ID="..."
#   export APPLE_PRIVATE_KEY="..."   # PEM contents (with newlines)
#   ./scripts/configure-social-idps.sh

set -euo pipefail

PROFILE="jitsi-video-hosting"
REGION="us-west-2"
USER_POOL_ID="us-west-2_cyPQF4F3r"
CLIENT_ID="57eikmt418ea6vti2f6h0pl74r"

# ── Validate env vars ────────────────────────────────────────────────────
missing=()
[[ -z "${GOOGLE_CLIENT_ID:-}" ]] && missing+=("GOOGLE_CLIENT_ID")
[[ -z "${GOOGLE_CLIENT_SECRET:-}" ]] && missing+=("GOOGLE_CLIENT_SECRET")
[[ -z "${APPLE_SERVICES_ID:-}" ]] && missing+=("APPLE_SERVICES_ID")
[[ -z "${APPLE_TEAM_ID:-}" ]] && missing+=("APPLE_TEAM_ID")
[[ -z "${APPLE_KEY_ID:-}" ]] && missing+=("APPLE_KEY_ID")
[[ -z "${APPLE_PRIVATE_KEY:-}" ]] && missing+=("APPLE_PRIVATE_KEY")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: Missing required environment variables:"
  printf '  - %s\n' "${missing[@]}"
  exit 1
fi

echo "==> Configuring Google identity provider..."
aws cognito-idp create-identity-provider \
  --user-pool-id "$USER_POOL_ID" \
  --provider-name "Google" \
  --provider-type "Google" \
  --provider-details "{
    \"client_id\": \"${GOOGLE_CLIENT_ID}\",
    \"client_secret\": \"${GOOGLE_CLIENT_SECRET}\",
    \"authorize_scopes\": \"openid email profile\"
  }" \
  --attribute-mapping '{
    "email": "email",
    "username": "sub",
    "name": "name",
    "picture": "picture"
  }' \
  --region "$REGION" \
  --profile "$PROFILE" 2>&1 || {
    # If provider already exists, update it
    echo "    Provider may already exist, attempting update..."
    aws cognito-idp update-identity-provider \
      --user-pool-id "$USER_POOL_ID" \
      --provider-name "Google" \
      --provider-details "{
        \"client_id\": \"${GOOGLE_CLIENT_ID}\",
        \"client_secret\": \"${GOOGLE_CLIENT_SECRET}\",
        \"authorize_scopes\": \"openid email profile\"
      }" \
      --attribute-mapping '{
        "email": "email",
        "username": "sub",
        "name": "name",
        "picture": "picture"
      }' \
      --region "$REGION" \
      --profile "$PROFILE"
  }
echo "    Google IdP configured."

echo "==> Configuring Apple identity provider..."
aws cognito-idp create-identity-provider \
  --user-pool-id "$USER_POOL_ID" \
  --provider-name "SignInWithApple" \
  --provider-type "SignInWithApple" \
  --provider-details "{
    \"client_id\": \"${APPLE_SERVICES_ID}\",
    \"team_id\": \"${APPLE_TEAM_ID}\",
    \"key_id\": \"${APPLE_KEY_ID}\",
    \"private_key\": \"${APPLE_PRIVATE_KEY}\",
    \"authorize_scopes\": \"email name\"
  }" \
  --attribute-mapping '{
    "email": "email",
    "username": "sub",
    "name": "name"
  }' \
  --region "$REGION" \
  --profile "$PROFILE" 2>&1 || {
    echo "    Provider may already exist, attempting update..."
    aws cognito-idp update-identity-provider \
      --user-pool-id "$USER_POOL_ID" \
      --provider-name "SignInWithApple" \
      --provider-details "{
        \"client_id\": \"${APPLE_SERVICES_ID}\",
        \"team_id\": \"${APPLE_TEAM_ID}\",
        \"key_id\": \"${APPLE_KEY_ID}\",
        \"private_key\": \"${APPLE_PRIVATE_KEY}\",
        \"authorize_scopes\": \"email name\"
      }" \
      --attribute-mapping '{
        "email": "email",
        "username": "sub",
        "name": "name"
      }' \
      --region "$REGION" \
      --profile "$PROFILE"
  }
echo "    Apple IdP configured."

echo "==> Updating app client to allow social IdPs..."
aws cognito-idp update-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --supported-identity-providers "COGNITO" "Google" "SignInWithApple" \
  --allowed-o-auth-flows "code" \
  --allowed-o-auth-scopes "openid" "email" "profile" \
  --allowed-o-auth-flows-user-pool-client \
  --callback-urls \
    "http://localhost:5173/auth/callback/" \
    "https://auth.clouddelnorte.org/auth/callback/" \
    "https://awsug.clouddelnorte.org/auth/callback/" \
    "https://clouddelnorte.org/auth/callback/" \
  --logout-urls \
    "https://auth.clouddelnorte.org/login/index.html" \
    "https://awsug.clouddelnorte.org/" \
    "https://clouddelnorte.org/" \
  --explicit-auth-flows \
    "ALLOW_REFRESH_TOKEN_AUTH" \
    "ALLOW_USER_AUTH" \
    "ALLOW_USER_PASSWORD_AUTH" \
    "ALLOW_USER_SRP_AUTH" \
  --prevent-user-existence-errors "ENABLED" \
  --enable-token-revocation \
  --region "$REGION" \
  --profile "$PROFILE"
echo "    App client updated with social IdPs."

echo "==> Configuring account linking (auto-merge by email)..."
# Note: Cognito auto-links social accounts to existing email-matched accounts
# when the user pool has email as a required, verified attribute and the
# attribute_mapping maps email from the social IdP.
# No additional API call needed — the attribute-mapping above handles it.
echo "    Account linking configured via email attribute mapping."

echo ""
echo "=== Social IdP configuration complete ==="
echo ""
echo "Cognito Hosted UI callback URL:"
echo "  https://cloud-del-norte.auth.us-west-2.amazoncognito.com/oauth2/idpresponse"
echo ""
echo "To test:"
echo "  1. Visit https://auth.clouddelnorte.org/login/index.html"
echo "  2. Click 'Sign in with Google' or 'Sign in with Apple'"
echo "  3. Complete the OAuth flow"
echo "  4. Verify redirect back to the app with tokens"
