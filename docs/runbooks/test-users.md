# Cognito Test Users — awsug.clouddelnorte.org

Pool: `us-west-2_cyPQF4F3r` in account 170473530355 (jitsi-video-hosting).

## Inventory (as of 2026-05-12)

| Email | Sub | Groups | Password Location | Notes |
|-------|-----|--------|-------------------|-------|
| heraldstack@clouddelnorte.org | e8716360-c081-708a-1211-3234508e71d2 | members, moderators | Secrets Manager `cloud-del-norte/heraldstack-cognito-pw-nuPFyW` | Agent service account. MFA configured. |
| bryanj+clouddelnorte@abstractspacecraft.com | 58315330-f091-7008-ae3b-4033fecd6811 | members, moderators | Bryan's password manager | Bryan's real account. MFA configured. |
| heraldstack-test-member@clouddelnorte.org | 7801f370-8041-70b4-ac72-27ae41858727 | members | (password location unclear — audit needed) | Pre-existing fleet. |
| heraldstack-test-pending@clouddelnorte.org | e8515370-4071-70c1-7497-ad0e4640b31e | pending | (audit needed) | Pre-existing. 'pending' group = distinct from zero-groups. |
| heraldstack-test-banned@clouddelnorte.org | 680183a0-50b1-70c7-3a31-be10b8133bee | banned | (audit needed) | Pre-existing. |
| heraldstack-test-admin@clouddelnorte.org | 98919390-8061-7030-8eb7-53b264b5a0d3 | members, moderators | (audit needed) | Pre-existing. |
| cdn-member-only-test@clouddelnorte.org | c8b16350-1091-703f-5ed9-1ed91a6bf9d2 | members | SSM `/cloud-del-norte/test/member-only-user-password` (email at `/cloud-del-norte/test/member-only-user-email`) | Created 2026-05-12 wave 1. No MFA. For FP-014/FP-016 member-only nav tests. |
| cdn-pending-test@clouddelnorte.org | e8912310-d081-70c1-9cab-c896abb631e3 | (zero groups) | SSM `/cloud-del-norte/test/pending-user-password` (email at `/cloud-del-norte/test/pending-user-email`) | Created 2026-05-12 wave 1. No MFA. For FP-003/FP-010/FP-016/FP-017 pending-user tests. |

## Orphans / Audit Items

- SSM param `/cloud-del-norte/test/smoketest-user-password` exists but no matching user found in pool (checked 2026-05-12). Either the user was retired and the SSM param wasn't cleaned, or the username differs from the implied email. Audit before using any script that references `smoketest`.
- The `heraldstack-test-*` fleet passwords are not clearly stored. Running a test that needs one of these users may require resetting via `admin-set-user-password` and stashing in SSM under `/cloud-del-norte/test/<purpose>-password`.

## 'Pending' State Semantics

Two ways to be pending:

1. **Zero Cognito groups** — user exists but has no group assignments. Client detects via `!auth || groups.length === 0`.
2. **Assigned to 'pending' group** — explicit group membership. Client banner also detects this as pending.

Both trigger the pending UX (approval banner, blocked from meetings, etc.). They are distinct states in Cognito but equivalent from the client's perspective.

## Create a New Test User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-west-2_cyPQF4F3r \
  --username <email> \
  --temporary-password <temp-pw> \
  --user-attributes Name=email,Value=<email> Name=email_verified,Value=true \
  --profile jitsi-video-hosting

aws cognito-idp admin-set-user-password \
  --user-pool-id us-west-2_cyPQF4F3r \
  --username <email> \
  --password <permanent-pw> \
  --permanent \
  --profile jitsi-video-hosting
```

Then:
- Store password in SSM: `aws ssm put-parameter --name /cloud-del-norte/test/<purpose>-password --value <pw> --type SecureString`
- Add to desired group: `aws cognito-idp admin-add-user-to-group --user-pool-id us-west-2_cyPQF4F3r --username <email> --group-name <group>`
- Add a row to this table

## Retire a Test User

```bash
aws cognito-idp admin-delete-user --user-pool-id us-west-2_cyPQF4F3r --username <email> --profile jitsi-video-hosting
aws ssm delete-parameter --name /cloud-del-norte/test/<purpose>-password --profile jitsi-video-hosting
```

Remove the row from this table.
