# Device Farm Selenium Tests

Comprehensive browser tests covering all user roles, broken links, console errors, auth flows, and API access control.

## Environment Variables

| Variable | Description |
|---|---|
| `DEVICE_FARM_GRID_URL` | Selenium Grid URL (default: `http://localhost:4444/wd/hub`) |
| `TEST_URL` | App base URL (default: `https://awsug.clouddelnorte.org`) |
| `TEST_AUTH_URL` | Auth subdomain URL (default: `https://auth.clouddelnorte.org`) |
| `TEST_API_URL` | API Gateway URL (default: `https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com`) |
| `TEST_USER_MEMBER_EMAIL` | Member test user email |
| `TEST_USER_MEMBER_PASSWORD` | Member test user password |
| `TEST_USER_ADMIN_EMAIL` | Admin test user email |
| `TEST_USER_ADMIN_PASSWORD` | Admin test user password |
| `TEST_USER_PENDING_EMAIL` | Pending test user email |
| `TEST_USER_PENDING_PASSWORD` | Pending test user password |
| `TEST_USER_BANNED_EMAIL` | Banned test user email |
| `TEST_USER_BANNED_PASSWORD` | Banned test user password |
| `AWS_REGION` | AWS region for Cognito (default: `us-west-2`) |

## Run Locally

```bash
# Start a local Selenium Grid (Chrome)
docker run -d -p 4444:4444 selenium/standalone-chrome:latest

# Install deps
pip install -r tests/device-farm/requirements.txt

# Export credentials
export TEST_USER_MEMBER_EMAIL="member@example.com"
export TEST_USER_MEMBER_PASSWORD="..."
export TEST_USER_ADMIN_EMAIL="admin@example.com"
export TEST_USER_ADMIN_PASSWORD="..."
export TEST_USER_PENDING_EMAIL="pending@example.com"
export TEST_USER_PENDING_PASSWORD="..."
export TEST_USER_BANNED_EMAIL="banned@example.com"
export TEST_USER_BANNED_PASSWORD="..."

# Run
pytest tests/device-farm/ -v --junitxml=results.xml
```

## How Device Farm Runs It

The Woodpecker CI pipeline (`.woodpecker/device-farm.yml`) installs Python deps, sets env vars from secrets, and runs pytest against the Device Farm Selenium Grid.

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
