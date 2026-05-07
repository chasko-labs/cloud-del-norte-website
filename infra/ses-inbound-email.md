# ses inbound email

receives email for  and stores raw messages in s3 for agent retrieval (verification codes, password resets, etc.)

## architecture



| component | account | region | identifier |
|---|---|---|---|
| route53 hosted zone | 211125425201 (aerospaceug-admin) | us-east-2 | Z045487217Y9179MTBU2Q |
| MX record | 211125425201 | -- | 10 inbound-smtp.us-west-2.amazonaws.com |
| SES domain identity | 211125425201 | us-west-2 | clouddelnorte.org |
| SES receipt rule set | 211125425201 | us-west-2 | heraldstack-agent-inbound |
| S3 bucket | 211125425201 | us-west-2 | heraldstack-agent-mail |

## dns records

| name | type | value |
|---|---|---|
| clouddelnorte.org | MX | 10 inbound-smtp.us-west-2.amazonaws.com |
| _amazonses.clouddelnorte.org | TXT | CPAsPJqN0LqDYpjjg0cDxDdwOXjcwJTNUVYkxX+vgEg= |

## receipt rule

- rule set: heraldstack-agent-inbound (active)
- rule name: store-to-s3
- recipients: clouddelnorte.org (catch-all for the domain)
- action: S3 -> bucket heraldstack-agent-mail, prefix inbound/
- TLS: optional
- spam/virus scan: enabled

## reading inbound mail

2026-05-07 19:17:18        645 AMAZON_SES_SETUP_NOTIFICATION

## cognito integration

the cognito user pool sends verification/reset emails using COGNITO_DEFAULT sender (from no-reply@verificationemail.com). these arrive at the MX endpoint and get stored in s3.

to switch to a custom SES sender (e.g. noreply@clouddelnorte.org):

1. verify the domain identity in SES (already done -- account 211125425201, us-west-2)
2. update the cognito user pool email config to EmailSendingAccount=DEVELOPER with SourceArn pointing to the SES identity
3. note: cross-account SES requires a sending authorization policy on the SES identity granting ses:SendEmail + ses:SendRawEmail to account 170473530355

## status

- [x] MX record pointing to SES inbound (us-west-2)
- [x] receipt rule set created and active
- [x] S3 bucket for storage
- [x] SES domain verification TXT record in route53
- [ ] SES domain verification confirmed by AWS (pending propagation check)
- [ ] test end-to-end: signup -> email arrives in S3 -> extract code -> confirm
- [ ] switch cognito to custom SES sender (optional, improves deliverability + branding)
