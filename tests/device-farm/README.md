# Device Farm Selenium Tests

Comprehensive browser tests covering all user roles, broken links, console errors, auth flows, and API access control.

## Credentials — SSM Parameter Store

Test credentials are stored in AWS SSM Parameter Store and fetched at runtime by the CI pipeline after assuming the OIDC role. No secrets are stored in Woodpecker.

**SSM path prefix:** `/device-farm/test-users/`

| SSM Parameter | Type | Env Var |
|---|---|---|
| `/device-farm/test-users/member-email` | String | `TEST_USER_MEMBER_EMAIL` |
| `/device-farm/test-users/member-password` | SecureString | `TEST_USER_MEMBER_PASSWORD` |
| `/device-farm/test-users/admin-email` | String | `TEST_USER_ADMIN_EMAIL` |
| `/device-farm/test-users/admin-password` | SecureString | `TEST_USER_ADMIN_PASSWORD` |
| `/device-farm/test-users/pending-email` | String | `TEST_USER_PENDING_EMAIL` |
| `/device-farm/test-users/pending-password` | SecureString | `TEST_USER_PENDING_PASSWORD` |
| `/device-farm/test-users/banned-email` | String | `TEST_USER_BANNED_EMAIL` |
| `/device-farm/test-users/banned-password` | SecureString | `TEST_USER_BANNED_PASSWORD` |
| `/device-farm/test-users/cognito-user-pool-id` | String | `COGNITO_USER_POOL_ID` |
| `/device-farm/test-users/cognito-client-id` | String | `COGNITO_CLIENT_ID` |

The CI role (`device-farm-ci`) has `ssm:GetParameter`, `ssm:GetParameters`, and `ssm:GetParametersByPath` on `arn:aws:ssm:us-west-2:*:parameter/device-farm/test-users/*`.

## Environment Variables

| Variable | Description |
|---|---|
| `DEVICE_FARM_GRID_URL` | Selenium Grid URL (default: `http://localhost:4444/wd/hub`) |
| `TEST_URL` | App base URL (default: `https://awsug.clouddelnorte.org`) |
| `TEST_AUTH_URL` | Auth subdomain URL (default: `https://auth.clouddelnorte.org`) |
| `TEST_API_URL` | API Gateway URL (default: `https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com`) |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID (fetched from SSM in CI) |
| `COGNITO_CLIENT_ID` | Cognito App Client ID (fetched from SSM in CI) |
| `TEST_USER_MEMBER_EMAIL` | Member test user email |
| `TEST_USER_MEMBER_PASSWORD` | Member test user password |
| `TEST_USER_ADMIN_EMAIL` | Admin test user email |
| `TEST_USER_ADMIN_PASSWORD` | Admin test user password |
| `TEST_USER_PENDING_EMAIL` | Pending test user email |
| `TEST_USER_PENDING_PASSWORD` | Pending test user password |
| `TEST_USER_BANNED_EMAIL` | Banned test user email |
| `TEST_USER_BANNED_PASSWORD` | Banned test user password |

## Run Locally

```bash
# Start a local Selenium Grid (Chrome)
docker run -d -p 4444:4444 selenium/standalone-chrome:latest

# Install deps
pip install -r tests/device-farm/requirements.txt

# Export credentials (or fetch from SSM if you have AWS access)
aws ssm get-parameters-by-path --path /device-farm/test-users/ --region us-west-2 --with-decryption

# Or set manually:
export TEST_USER_MEMBER_EMAIL="member@example.com"
export TEST_USER_MEMBER_PASSWORD="..."
export COGNITO_USER_POOL_ID="us-west-2_XXXXX"
export COGNITO_CLIENT_ID="..."

# Run
pytest tests/device-farm/ -v --junitxml=results.xml
```

## How Device Farm Runs It

The Woodpecker CI pipeline (`.woodpecker/device-farm.yml`) assumes the OIDC role, fetches all test credentials from SSM Parameter Store, then runs pytest against the Device Farm Selenium Grid.

## Adding Test Users to Cognito

```bash
# Create user
aws cognito-idp admin-create-user \
  --user-pool-id us-west-2_XXXXX \
  --username test-member@clouddelnorte.org \
  --temporary-password 'TempPass1!'

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-west-2_XXXXX \
  --username test-member@clouddelnorte.org \
  --password 'PermanentPass1!' \
  --permanent

# Add to group (member, admin, banned, pending)
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-west-2_XXXXX \
  --username test-member@clouddelnorte.org \
  --group-name member
```
