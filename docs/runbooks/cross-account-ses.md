# Cross-Account SES — Identity Verification Topology

## The Rule

**SES.SendEmail requires the identity (domain or email) to be DKIM-verified IN THE SAME ACCOUNT as the sending Lambda/Cognito.**

This is NOT solved by cross-account IAM trust. IAM lets you assume a role — it does NOT make SES treat a domain as verified in your account. Each account must independently verify the domain with SES, which generates account-specific DKIM tokens.

## Setup Steps

### 1. DNS zone owner account — baseline DKIM (already done typically)

The account that owns the Route 53 hosted zone already has DKIM CNAMEs and `_amazonses` TXT for the domain.

### 2. SENDING account — generate new DKIM tokens

```bash
aws ses verify-domain-dkim --domain clouddelnorte.org --profile <sender-profile>
```

Returns 3 DkimTokens. These are UNIQUE to this account — they differ from the DNS owner's tokens.

### 3. SENDING account — verify domain identity

```bash
aws ses verify-domain-identity --domain clouddelnorte.org --profile <sender-profile>
```

Returns a new `_amazonses` verification token (also unique to this account).

### 4. DNS zone owner account — add the new records

In Route 53 (or wherever DNS lives):

- Add 3 CNAME records: `<token1>._domainkey.clouddelnorte.org` → `<token1>.dkim.amazonses.com` (repeat for token2, token3)
- Merge `_amazonses` TXT record: SES allows multiple values. Keep the existing value AND append the new one. Both accounts need their token present.

### 5. Wait for SES to re-poll

1–15 minutes. If stale, nudge:

```bash
aws ses verify-domain-dkim --domain clouddelnorte.org --profile <sender-profile>
```

### 6. Confirm

```bash
aws sesv2 get-email-identity --email-identity clouddelnorte.org --profile <sender-profile>
```

Must show: `VerifiedForSendingStatus: true`, `DkimAttributes.Status: SUCCESS`

### 7. Lambda IAM policy

```json
{
  "Effect": "Allow",
  "Action": "ses:SendEmail",
  "Resource": "arn:aws:ses:us-west-2:<SENDER-ACCOUNT-ID>:identity/clouddelnorte.org"
}
```

Note: the ARN references the SENDER account, not the DNS owner account.

## Our Topology (clouddelnorte.org)

| Component | Account | Account ID |
|-----------|---------|------------|
| DNS zone (Z045487217Y9179MTBU2Q) | aerospaceug-admin | 211125425201 |
| SES verified (receive + some sends) | aerospaceug-admin | 211125425201 |
| SES verified (admin-update-user Lambda) | jitsi-video-hosting | 170473530355 |

Both accounts hold `VerifiedForSendingStatus=true` as of 2026-05-12.

The `_amazonses` TXT record for `clouddelnorte.org` contains TWO values — one per account.

## Sandbox Reminder

Both accounts are still in SES sandbox:
- 200 emails/day
- 1 email/sec
- Verified recipients only (To: address must be verified or in a verified domain)

Production access request required before public-facing email (signup confirmations to arbitrary addresses, etc.).
