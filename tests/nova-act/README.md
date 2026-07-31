# Nova Act Smoketests — cloud-del-norte-website

End-to-end browser validation using [Nova Act](https://docs.aws.amazon.com/nova-act/) as the mandated browser-automation surface for this collective.

## test_join_call_smoketest.py

Full lifecycle smoketest: signup → approval → meeting start → meeting join with video.

### pre-flight gate

before any browser automation, the harness asserts:

```
GET https://meet.clouddelnorte.org/external_api.js → HTTP 200
```

if this returns anything other than 200 (503 from `awselb/2.0` is the cold-stack signature), the harness exits with **code 75** — a distinct status meaning "infrastructure not ready." this is NOT a test failure and must not be diagnosed as an auth regression.

**why this gate exists:** without it, a cold ECS stack produces a red test that gets misdiagnosed as a code bug and burns an entire debugging session. see issue #460 comments.

### FP-021 assertion (non-negotiable)

the harness asserts:

1. the jitsi iframe's `src` attribute contains `meet.clouddelnorte.org`
2. a video element or jitsi participant surface is present inside the iframe

a navigation-only assertion (page loaded, modal opened, button clicked) is a known false-positive pattern. on 2026-05-08 nova act reported PASS while both test users were silently stranded on the meetings list and never entered jitsi. asserting the actual target state prevents this.

see `.kiro/steering/friction-points-resolved.md` FP-021.

### exit codes

| code | meaning |
| ---- | ------- |
| 0 | all assertions passed — test PASS |
| 1 | test failure or unexpected error |
| 75 | infrastructure not ready (jitsi cold) — NOT a code failure |

### prerequisites

1. **jitsi stack must be warm.** scale-up owner: `ghost-kade-vox-jitsi-perl-ops` via `scale-up.pl`. realistic wall clock: 5-8 minutes. requires an active SSO session for the `jitsi-video-hosting` profile (account 170473530355).

2. **active AWS session** with SSM read access to the parameters listed below.

3. **python dependencies:**
   ```bash
   pip install -r tests/nova-act/requirements.txt
   ```

### SSM parameters required

all credentials are fetched from AWS SSM Parameter Store at runtime. nothing is hardcoded.

| parameter | type | purpose |
| --------- | ---- | ------- |
| `/device-farm/test-users/admin-email` | String | admin/moderator email |
| `/device-farm/test-users/admin-password` | SecureString | admin password |
| `/cloud-del-norte/test/admin-totp-secret` | SecureString | admin TOTP secret for MFA |
| `/cloud-del-norte/test/smoketest-new-user-password` | SecureString | password assigned to new test users |

environment variable overrides (take precedence over SSM):

- `TEST_USER_ADMIN_EMAIL`
- `TEST_USER_ADMIN_PASSWORD`
- `TEST_USER_ADMIN_TOTP_SECRET`

### how to run

```bash
# 1. ensure jitsi is warm (check manually or run scale-up)
curl -sI https://meet.clouddelnorte.org/external_api.js | head -1
# expect: HTTP/2 200

# 2. ensure AWS session is active
aws sts get-caller-identity --profile jitsi-video-hosting

# 3. run
python tests/nova-act/test_join_call_smoketest.py
```

### artifacts

each run writes to `tests/nova-act/artifacts/<timestamp>/`:

- screenshots at each step (login, MFA, meetings page, join, final state)
- `result.json` with pass/fail status and metadata

### MFA handling

**admin user:** has pre-enrolled TOTP. the harness reads the TOTP secret from SSM (`/cloud-del-norte/test/admin-totp-secret`) and generates valid codes via pyotp at runtime.

**new user:** the harness creates the user via Cognito admin SDK and completes MFA enrollment programmatically (AssociateSoftwareToken + VerifySoftwareToken) before any browser login. this means the browser login only hits the `SOFTWARE_TOKEN_MFA` challenge (enter code), not the `MFA_SETUP` challenge (scan QR code).

#### BLOCKING GAP — MFA_SETUP in browser

if Cognito's pool config forces MFA enrollment during the browser-based login flow (before the SDK can pre-enroll), the harness cannot automate the QR-code-scan step because the TOTP secret is only displayed visually in the hosted UI. the current approach avoids this by:

1. creating the user via admin SDK (skips hosted UI signup)
2. completing MFA setup via SDK before the user ever touches a browser
3. when the user logs in via browser, they only face the "enter your 6-digit code" screen

if this SDK-first approach fails (e.g. Cognito forces re-enrollment in browser regardless), the MFA_SETUP browser step is the precise blocking gap. it would require either:
- a known TOTP seed stored in SSM and pre-associated with the user
- or a custom Cognito pre-auth lambda that skips MFA for test accounts

### manual cleanup

the harness auto-deletes the test user on completion (pass or fail). if cleanup fails (e.g. network error, timeout), remove manually:

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id us-west-2_cyPQF4F3r \
  --username "cdn-smoketest-<RUN_ID>@clouddelnorte.org" \
  --profile jitsi-video-hosting
```

the exact email is printed in the harness output header. test users follow the pattern `cdn-smoketest-<YYYYMMDDHHMMSS>-<hex>@clouddelnorte.org`.

to find orphaned test users:

```bash
aws cognito-idp list-users \
  --user-pool-id us-west-2_cyPQF4F3r \
  --filter 'email ^= "cdn-smoketest-"' \
  --profile jitsi-video-hosting
```
