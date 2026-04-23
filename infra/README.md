# infra

out-of-band infrastructure artifacts that the site deploy workflow does not manage automatically

## cloudfront security headers

the site's cloudfront distribution `ECC3LP1BL2CZS` lives in account `211125425201` (aerospaceug-admin). the github actions deploy role in this repo has permission to `s3:sync` to the bucket and `cloudfront:CreateInvalidation` — it does **not** have permission to manage response headers policies, so those must be applied out-of-band from a local shell with a profile that can

### files

| file | purpose |
|---|---|
| `cloudfront-security-headers.json` | aws cloudfront response-headers-policy-config payload — CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| `apply-security-headers.sh` | idempotent apply + detach script using the json above |

### apply

```bash
AWS_PROFILE=aerospaceug-admin ./infra/apply-security-headers.sh
```

this will:
1. create or update a custom response headers policy named `cloud-del-norte-security-headers`
2. associate it with the default cache behavior on distribution `ECC3LP1BL2CZS`
3. leave cloudfront to propagate (5-15 min)

### verify

```bash
curl -sI https://clouddelnorte.org/ | grep -iE 'content-security|strict-transport|referrer-policy|permissions-policy|x-content-type'
```

expected headers after propagation:

- `content-security-policy: default-src 'self'; …`
- `strict-transport-security: max-age=31536000; includeSubDomains; preload`
- `x-content-type-options: nosniff`
- `referrer-policy: strict-origin-when-cross-origin`
- `permissions-policy: camera=(self "https://meet.clouddelnorte.org"), …`

### rollback

```bash
AWS_PROFILE=aerospaceug-admin ./infra/apply-security-headers.sh detach
```

or, via console, associate the distribution's default cache behavior with the aws-managed `Managed-SecurityHeadersPolicy`

### known tradeoff

`style-src 'unsafe-inline'` is currently required because cloudscape injects runtime styles without a nonce. tightening this is tracked separately; revisit if cloudscape adds a nonce-compatible mode

### visual regression check after apply

after the policy propagates, click-through every page to confirm nothing renders blank due to blocked resources. pages to check:

- `/` (home)
- `/meetings/` (cloudscape table)
- `/create-meeting/` (cloudscape form — will redirect to hosted ui if not moderator)
- `/roadmap/` (board)
- `/theme/` (design system)
- `/maintenance-calendar/`
- `/learning/api/`
- `/auth/callback?code=test` (will surface the error alert — ok)

open the browser devtools console; any `Refused to load` or `Refused to connect` messages indicate the CSP needs a source added. common offenders:

- gravatar avatars → already allowed via `img-src https://www.gravatar.com`
- fonts → already allowed via `font-src 'self' data:`
- `data:` image URIs → already allowed

## related

issue #91 on this repo tracks the landing + follow-up tightening passes
