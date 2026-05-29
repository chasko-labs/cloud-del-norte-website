# cloud-del-norte product owner — credential discipline & cheat sheet

> Priority 1 runbook for `poltergeist-harald-cdn-product-owner` operating in
> `chasko-labs/cloud-del-norte-website`. Read this before any operation
> requiring credentials. Update inline when credential plumbing changes.

## mental model

Adapted from Mike Fiedler's *Trusted Publishing* talk (vBrownBag, recorded
2026-05-28). GitHub Actions OIDC primitives don't apply directly — Woodpecker
CI is the runner here — but the principles do.

1. Tokens that exist long enough to get stolen, get stolen. Every credential
   incident in the last decade traces back to a credential that lived on disk
   long enough to be exfiltrated, scraped from a CI log, or phished.

2. Trust the pipeline, not the password. Authenticate the *runtime* with a
   short-lived identity proof, not a stored secret.

3. Mint at the last moment, throw away at the first. Reduce the time a secret
   exists. Acquire immediately before use, discard immediately after.

4. Identity federation beats stored credentials. AWS Roles Anywhere, OIDC,
   Cognito ADMIN_INITIATE_AUTH from a least-privilege role — all forms of
   "the runtime proves who it is, the trust authority returns a short-lived
   token." Storing a long-lived secret is the failure mode.

5. Entire attack categories disappear. Committed to git → nothing to commit.
   Dumped in CI logs → nothing to scrape. Read by a bad dev dependency → no
   env var. Phished → session alone fails. Worm scans for secrets → finds
   nothing.

When you operate as the cloud-del-norte product owner, evaluate every
credential against these five principles.

## diagnostic — current credential inventory

| credential | store | lifetime | refresh authority | trusted-publishing alignment |
| --- | --- | --- | --- | --- |
| AWS `kiro-device-farm` profile | Roles Anywhere x509 cert + key in `~/.config/hs-secret/` | 15-min STS | `aws sso login` via cert | ✅ Aligned. Cert IS the identity; STS tokens are short-lived. |
| AWS `aerospaceug-admin` profile | SSO session cache | 8 hr | `aws sso login` | ⚠️ Acceptable for break-glass. Routine ops should use a least-privilege role (see issue tracker). |
| AWS `ops-reader` profile | x509 via `aws_signing_helper credential-process` | per-call | cert refresh | ✅ Aligned. Read-only role, cert-bound. |
| Roles Anywhere x509 keys | `~/.config/hs-secret/*.key` mode 0600 | cert lifetime | trust anchor renewal | ✅ Aligned (the long-lived root of trust). Rotation discipline below. |
| GitHub via `gh` CLI | OS keyring | per-session | `gh auth refresh` | ✅ Aligned. No env var, no plaintext file. |
| Woodpecker CI secrets | Woodpecker server | per-build | server-managed | ✅ Aligned. Never on agent disk. |
| Cognito refresh token | `~/.config/hs-secret/cdn-refresh-token.txt` plaintext (recreated per manual grab) | 30 days | manual browser grab | ❌ Violates all five principles. Migration target below. |

The Cognito refresh token is the single credential class that violates the
mental model. It is stored long enough to be stolen, lives in plaintext,
requires manual acquisition, stalls every test run that needs it. The file
is absent on disk by default — the runbook's enforced state — but every
manual grab recreates the hazard.

The Roles Anywhere x509 keys are the long-lived root of trust. Their
existence is necessary; their rotation is the discipline. Cert lifetime
should match a documented rotation schedule (target: 1-year cert, 30-day
auto-renewal window via the trust anchor's policy, `kiro-doctor` check that
fails at 30-days-to-expiry).

## gap analysis — the Cognito refresh token

The cloud-del-norte website's authenticated diagnostic harness needs a member
session to bypass `requireAuth()`'s redirect to the login subdomain. Today
this is solved by:

1. Bryan signs in to `auth.clouddelnorte.org` as a member.
2. Bryan opens DevTools, copies `cdn.refreshToken` from `sessionStorage`.
3. Bryan writes the value to `~/.config/hs-secret/cdn-refresh-token.txt`.
4. The product owner waits for the file to land before running verify.

Failure modes:

- Friction (acute): every verify run requires Bryan's manual intervention.
  The product owner stalls, surfaces the gap, waits.
- Long-lived secret on disk (chronic): a 30-day refresh token in a plaintext
  file is exactly what Mike's "tokens that exist long enough" rule warns
  against. Disk theft, accidental git commit, agent misconfiguration — any
  of these leaks it.
- No rotation discipline: when the token expires, the next failed verify is
  the rotation signal. Until then, no one notices.
- Tied to Bryan's personal member account: test runs are charged against
  Bryan's audit identity. A test failure in production logs looks like Bryan
  did something.

## attack table — Mike's slide applied to this case

| Mike's attack vector | today (plaintext refresh token) | post-migration (service member + Secrets Manager) |
| --- | --- | --- |
| committed to git | `~/.config/hs-secret` is gitignored, but a slip is one `git add .` away | nothing to commit; tokens never written to a tracked path |
| dumped in CI logs | harness logs may carry token bytes if the operator runs verbose | path-only logging; token contents live for the run only |
| read by a bad dev dependency | any process with FS access reads the file | requires STS session + `SecretsManager:GetSecretValue` — much higher bar |
| maintainer phished | session compromise → 30-day refresh token harvest | x509 cert + STS session — phishing the human gets you nothing without physical key access |
| worm scans for secrets | `grep ~/.config/hs-secret/*.txt` finds it | no `.txt` matches; secret never lands in a scannable location |

Each row in the right column reads "less" or "nothing" because the protocol
removes the artifact rather than guarding it. New attack vectors emerge —
the test-member account password in Secrets Manager remains a long-lived
credential — but it sits behind a 4-hop identity chain (x509 → STS →
GetSecretValue → Cognito InitiateAuth) and is rotatable on schedule.

## migration target — service member account + on-demand authentication

The Trusted Publishing pattern applied to Cognito:

1. Create a dedicated test member account. Username
   `device-farm-tester@chasko-labs.dev` (or similar). Password generated
   randomly, stored in AWS Secrets Manager under
   `cloud-del-norte/device-farm-tester/password`, accessible only to the
   `heraldstack-cdn-device-farm` role (already in use by the harness).
2. Replace the refresh-token file with a token-fetch helper. Before each
   verify run, the product owner calls a helper script
   (`scripts/device-farm/fetch-test-tokens.sh`) that:
   - Reads the password from Secrets Manager via the existing role.
   - Calls Cognito `InitiateAuth` with `USER_PASSWORD_AUTH`.
   - Writes the resulting `accessToken` + `idToken` + `refreshToken` to a
     temp file with mode 0600.
   - Returns the temp file path.
3. Harness consumes the temp file via `--refresh-token-file`. PR #402's flag.
   No code change required on the harness.
4. Discard immediately after the run. The helper deletes the temp file
   after the harness exits, regardless of pass/fail.

Trusted-publishing alignment after migration:

| principle | before | after |
| --- | --- | --- |
| tokens long enough to be stolen | 30-day refresh token on disk | ~1-hour access token, in temp file |
| trust the pipeline, not the password | manual browser grab | Roles Anywhere identity → Secrets Manager → Cognito |
| mint at the last moment | one-shot, leftover for 30 days | minted per run, discarded post-run |
| identity federation | none (raw refresh token) | x509 cert → STS → SecretsManager:GetSecretValue → Cognito InitiateAuth |
| entire attack categories disappear | all categories apply | disk theft, accidental commit, expired-token-stall — all gone |

Long-lived secret remaining: the test member account's password in Secrets
Manager. This is Mike's "you still need some root of trust" caveat. The
password is rotatable on a schedule, scoped to one account with no admin
privileges, accessible only via the device-farm role's STS-bound session.
Strictly better than the current state on every dimension.

## defense in depth — the extra deadbolt for the test-member account

Mike's "environments — the extra deadbolt" slide applied to the Cognito side:

- Cognito user pool group: `device-farm-tester` only. No membership in
  `members` or `admins`.
- Cognito Lambda PreAuthentication trigger that rejects InitiateAuth from
  non-CI source IPs (the rocm-aibox external IP allowlist, or the Woodpecker
  agent's source IP if/when CI runs the verify).
- Advanced security features enabled to flag credential stuffing.
- Email attribute set to a quarantine address (or unset entirely so
  password-reset email never reaches a usable inbox).
- The account should never have email_verified=true unless explicitly
  needed by a flow, and even then through a controlled path.

## audit trail — Sigstore + Rekor equivalent

Mike's PEP 740 / Sigstore / Rekor thread = "the data is on the wire" for
forensics. The AWS-native equivalent already exists by default:

- CloudTrail logs every `SecretsManager:GetSecretValue` call (who, when,
  from what role, source IP).
- Cognito CloudWatch logs every `InitiateAuth` event (success/fail, source
  IP, app client).

These together = continuous audit of credential acquisition events. Make
this active, not passive: a CloudWatch alarm on unexpected source IPs for
`SecretsManager:GetSecretValue` from the device-farm role is a security
signal, not compliance noise.

## rotation schedules

| credential class | lifetime | rotation cadence | enforcement |
| --- | --- | --- | --- |
| Roles Anywhere x509 cert | 1 year | annual + auto-renewal at 30-days-to-expiry | `kiro-doctor` check warns at 30 days, fails at 7 days |
| Test-member account password (Secrets Manager) | indefinite | quarterly | Lambda + Secrets Manager native rotation |
| AWS SSO sessions | 8 hours | per-login | IdP-controlled |
| Cognito access token (post-migration) | ~1 hour | per-run | helper script enforces |
| Cognito refresh token (post-migration) | ~1 hour | per-run, never persisted past run | helper script deletes |
| GitHub gh CLI keyring | per-session | gh auth refresh on scope expansion | OS keyring |
| Woodpecker secrets | per-build | manual rotate quarterly | server-managed |

Stale credential metadata is an audit gap. When a credential class is added,
update this table.

## cheat sheet — credential acquisition commands

### AWS `kiro-device-farm` (already trusted-publishing-aligned)

```bash
# Verify identity. Should return assumed-role/heraldstack-cdn-device-farm/...
aws sts get-caller-identity --profile kiro-device-farm

# If session expired:
aws sso login --profile kiro-device-farm
```

### GitHub via gh CLI (already trusted-publishing-aligned)

```bash
# Verify identity. Should return github username + active scopes.
gh auth status

# If token expired or scopes insufficient:
gh auth refresh -h github.com -s repo,read:org
```

### Cognito tokens — POST-MIGRATION (target state)

```bash
# Fetch fresh tokens for the test member account.
# Helper handles: SecretsManager read → Cognito InitiateAuth → temp file write.
TOKEN_FILE=$(scripts/device-farm/fetch-test-tokens.sh)

# Run the harness.
AWS_PROFILE=kiro-device-farm python3 tests/device-farm/music-player-diagnostic.py \
  --stations kexp \
  --subdomains https://awsug.clouddelnorte.org \
  --refresh-token-file "$TOKEN_FILE"

# Discard tokens regardless of outcome.
rm -f "$TOKEN_FILE"
```

### Cognito tokens — INTERIM (current state, until migration lands)

```bash
# Probe whether the token file exists with correct permissions.
TOKEN_PATH=~/.config/hs-secret/cdn-refresh-token.txt
if [[ -f "$TOKEN_PATH" && $(stat -c %a "$TOKEN_PATH") == "600" ]]; then
  echo "token-file: PRESENT (mode 0600)"
else
  echo "token-file: MISSING or wrong mode"
  echo "INFRA GAP: Cognito refresh-token automation not yet implemented."
  echo "See docs/runbooks/cloud-del-norte-product-owner-credentials.md"
  echo "Tracking issue: chasko-labs/cloud-del-norte-website#<TBD>"
  exit 1
fi
```

The interim cheat-sheet block deliberately exits non-zero on missing token.
Do not prompt Bryan for a manual grab. The missing token is a configuration
gap to file as an issue and resolve via the migration plan, not a workflow
step to accept.

## discipline rules for the cloud-del-norte product owner

1. Never ask Bryan to grab a token. If a credential is missing, that is a
   configuration gap. File an issue, propose the fix, do not block on manual
   acquisition.

2. Surface the infra gap with a rationale. When a credential is missing,
   reference this runbook by path, name the gap by credential class, propose
   the migration step that resolves it. Not "please grab a token" — "Cognito
   refresh-token automation pending, see migration plan in
   docs/runbooks/cloud-del-norte-product-owner-credentials.md."

3. Treat any plaintext credential file as a violation, not a workaround.
   When you encounter `~/.config/hs-secret/<anything>-token.txt` or
   equivalent, flag it as migration debt and add the credential class to
   the inventory in this runbook.

4. Mint at the last moment, throw away at the first. Even within a single
   harness run, the temp token file should be created seconds before the run
   and deleted seconds after. No "cache for next time" patterns.

5. Document credential rotation schedules in this runbook. When a new
   credential class is added, update the inventory table with lifetime and
   refresh authority. Stale credential metadata is an audit gap.

6. Identity federation is the default. When adding a new third-party service
   that needs authentication, the design question is "what identity does the
   runtime already prove" — Roles Anywhere, SSO, gh CLI keyring — not "where
   do I store the token." Stored tokens are the exception, not the rule.

7. Audit trail is active, not passive. CloudTrail and CloudWatch already
   log every credential operation. Configure alarms on anomalies (unexpected
   source IPs for SecretsManager reads, InitiateAuth failures from non-CI
   addresses) so the data on the wire becomes a security signal.

8. Least privilege over admin convenience. Routine ops should use a
   least-privilege role even when AdministratorAccess is available. Keep the
   admin role as break-glass.

## migration backlog

Three issues track the migration:

1. Migrate Cognito refresh-token acquisition to on-demand fetch via service
   member account. Implement `scripts/device-farm/fetch-test-tokens.sh`.
   Provision the test member account. Store password in AWS Secrets Manager.
   Update PR #402's documentation to reference the new flow. Retire the
   `~/.config/hs-secret/cdn-refresh-token.txt` path. Reference this runbook.

2. Audit `~/.config/hs-secret/` for any other plaintext credential files.
   Each one is migration debt against the same mental model.

3. (haunting-side, separate repo) Add `kiro-doctor` check
   `cloud-del-norte-credentials` that walks the inventory in this runbook
   and fails on any credential class flagged ❌ in the trusted-publishing
   alignment column. Stratia or Tarn-mcp-forge owns it.

## references

- Mike Fiedler, *Trusted Publishing*, vBrownBag (recorded 2026-05-28).
  Source narrative:
  <https://bryan-video-narratives.s3.us-west-2.amazonaws.com/videos/youtube_com_watch_v_1EIFGn1dWoI/narrative.md>
- Official PyPI Trusted Publishers docs:
  <https://docs.pypi.org/trusted-publishers/using-a-publisher>
- AWS IAM Roles Anywhere — already in use for `kiro-device-farm`.
- AWS Cognito InitiateAuth (USER_PASSWORD_AUTH flow):
  <https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html>
- PR #402 — `--refresh-token-file` flag in
  `tests/device-farm/music-player-diagnostic.py` (merged 2026-05-28).
- Issue #403 — capture corruption when harness silently redirects.
- Issue #405 — authenticated parity verify (currently blocked on token
  acquisition; will unblock when this migration lands).
