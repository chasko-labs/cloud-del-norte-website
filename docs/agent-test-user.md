# agent test user creation

the heraldstack service account is used for automated testing and agent operations.

## credentials

- email: heraldstack@clouddelnorte.org
- cognito sub: e8716360-c081-708a-1211-3234508e71d2
- groups: members, moderators
- password: stored in AWS Secrets Manager `cloud-del-norte/heraldstack-cognito-pw` (account 170473530355, us-west-2)

## usage

```bash
# retrieve password
aws secretsmanager get-secret-value --secret-id cloud-del-norte/heraldstack-cognito-pw --profile jitsi-video-hosting --region us-west-2 --query SecretString --output text

# authenticate
aws cognito-idp initiate-auth \
  --client-id 57eikmt418ea6vti2f6h0pl74r \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=heraldstack@clouddelnorte.org,PASSWORD=<from-secrets-manager> \
  --region us-west-2 \
  --profile jitsi-video-hosting
```

## notes

- MFA is configured (SOFTWARE_TOKEN). first auth after password reset requires TOTP setup.
- never invoke lambdas as bryan's personal account — always use heraldstack service account.
- the service account has moderator privileges for testing create-meeting and admin endpoints.
