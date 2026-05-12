# Diagnostic-First Rule

## The Rule

**TWO FAILED FIX ATTEMPTS against the same symptom → next step is DIAGNOSTIC INSTRUMENTATION, not a 3rd fix attempt.**

Applies to: poltergeist-harald-cdn-product-owner, any contributor running tests against live infra, any agent in a fix loop.

## Why

Fix attempts are blind when the symptom is downstream of an invariant you can't see. You're guessing at causes and burning time.

**2026-05-12 cost**: 3 fix attempts + ~90 minutes wasted. One diagnostic script resolved the root cause in minutes. The script revealed CSP violations in the browser console that pointed directly at the stale CloudFront policy.

## Diagnostic Patterns by Layer

### Browser Layer

- Add `console` listeners (especially `error` — CSP violations appear here)
- Add network request listeners (capture URL, status, timing)
- `page.evaluate(() => ({ ...sessionStorage })` — snapshot auth state
- `page.evaluate(() => ({ ...localStorage })` — snapshot persistent state
- Screenshot mid-state (not just end-state)
- Pattern: write the diagnostic alongside the committed validator (e.g. `scripts/nova-act/fp017-token-refresh-validation.py`), but keep the diagnostic itself throwaway — do not commit. Delete after root cause is found.

### Network Layer

```bash
curl -v -H "Origin: https://awsug.clouddelnorte.org" https://awsug.clouddelnorte.org/
```

Check: CORS headers, CSP header value, cache status. Compare against `infra/cloudfront-security-headers.json`.

### Auth Layer

- Decode JWT claims manually (`echo <token> | base64 -d | jq`)
- Call Cognito `/oauth2/token` directly with curl — check `id_token` claims, `cognito:groups`, expiry
- Verify the token endpoint URL matches what's in CSP `connect-src`

### Infra Layer

```bash
aws cloudfront get-response-headers-policy --id <policy-id>
aws cloudfront get-distribution-config --id <dist-id>
```

Diff against repo file. If they diverge, you found your drift.

## What to Log in a Diagnostic

| Category | What | Why |
|----------|------|-----|
| Console errors | All, especially CSP violations | Reveals whitelist issues in seconds |
| Outbound requests | URL + method + status + timing | Shows what's blocked or slow |
| sessionStorage | Full snapshot at key moments | Auth tokens, state flags |
| localStorage | Full snapshot | Persistent state that survives refresh |
| Step confirmation | Enough state to answer "did step N happen?" | Proves or disproves each link in the hypothesized chain |

## Reusable Template (from 2026-05-12 wave 2)

Pattern: 75-second polling window. Captures:
- sessionStorage snapshot every 5s
- Network listener (all requests with timing)
- Console listener (all messages, filtered for errors)
- 5-second interval screenshots

This is enough to reconstruct the full auth flow timeline and identify where it breaks.

## What This Is NOT

- Not a test harness library — diagnostic scripts are throwaway
- Not a replacement for proper tests — it's for when tests pass but live breaks
- Not an excuse to skip the first two fix attempts — sometimes the fix is obvious
