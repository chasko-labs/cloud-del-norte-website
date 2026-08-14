# Nova Act E2E Tests — cloud-del-norte-website

End-to-end browser validation via AWS Bedrock Nova Act (`amazon.nova-act-v1:*`).

## tests

| file | coverage |
| ---- | -------- |
| test_cdn_signin_meeting.py | 5 scenarios: public pages, login renders, protected redirect, full sign-in, join meeting + Jitsi |
| test_join_call_smoketest.py | full 4-step flow: sign-in → meetings → join → Jitsi iframe assertion |

## critical assertion (FP-021)

both test files assert that the Jitsi iframe `src` contains `meet.clouddelnorte.org`. navigation-only assertions are documented false positives per friction-point FP-021.

## setup

```bash
# install dependencies
pip install nova-act pytest requests boto3

# credentials are fetched automatically from SSM via conftest.py
# account: 170473530355, profile: jitsi-video-hosting, region: us-west-2
# SSM path: /cloud-del-norte/test/*

# or set manually:
export CDN_TEST_EMAIL="..."
export CDN_TEST_PASSWORD="..."
export CDN_ADMIN_EMAIL="..."      # optional
export CDN_ADMIN_PASSWORD="..."   # optional
export AWS_PROFILE="bryanchasko-kiro"  # for Nova Act Bedrock auth
```

## pre-flight

tests verify `https://meet.clouddelnorte.org/external_api.js` returns 200 before any browser tests. exit code 75 if Jitsi is unreachable.

## running

```bash
# run all Nova Act tests
pytest tests/nova-act/ -v

# run individually
pytest tests/nova-act/test_cdn_signin_meeting.py -v
pytest tests/nova-act/test_join_call_smoketest.py -v

# run as scripts (includes summary output)
python tests/nova-act/test_cdn_signin_meeting.py
python tests/nova-act/test_join_call_smoketest.py
```

## artifacts

screenshots are saved to `./artifacts/` during test execution. the directory is created automatically.

## infrastructure

- jitsi runs scale-to-zero on ECS (jitsi-cluster). must be WARM before running join-call tests
- Nova Act uses Bedrock in us-east-1 (profile bryanchasko-kiro, account 946179428633)
- test credentials live in SSM (account 170473530355, profile jitsi-video-hosting)
- auth flow uses Cognito Hosted UI redirect (OIDC PKCE), not inline form

## related issues

- #452 — Nova Act e2e tests for sign-in + join flow
- #460 — join-call smoketest acceptance gate for login-flow repair
- FP-021 — canonical false-positive lesson (assert iframe src, not navigation)
