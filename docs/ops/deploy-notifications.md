# deploy notifications — ntfy.sh + AWS SNS SMS

ci fires notifications after every successful deploy (dev + prod) via two parallel channels: ntfy.sh (push) and AWS SNS (SMS). both steps use `failure: ignore` so a notification failure never blocks the deploy.

## topic

```
https://ntfy.sh/cdn-deploy-74697e0f
```

the random suffix keeps the topic effectively private. ntfy.sh has no auth — the url is the secret. do not share it publicly.

## subscribe

**ios** — install [ntfy.sh](https://apps.apple.com/app/ntfy/id1625396347) from the app store. tap + → subscribe to topic → paste `cdn-deploy-74697e0f`

**android** — install [ntfy.sh](https://play.google.com/store/apps/details?id=io.heckel.ntfy) from the play store. tap + → subscribe to topic → paste `cdn-deploy-74697e0f`

**web** — visit `https://ntfy.sh/cdn-deploy-74697e0f` in any browser. click subscribe

**email** — visit `https://ntfy.sh/cdn-deploy-74697e0f` in a browser, open the menu (three-dot or gear), choose "email forwarding", enter your address

## notification content

- **title**: `[CDN dev] deploy: <7-char sha>` or `[CDN prod] deploy: <7-char sha>`
- **body**: git commit message subject
- **click**: opens `https://dev.clouddelnorte.org/` (dev) or `https://clouddelnorte.org/` (prod)
- **tags**: rocket + green_heart icons

## mute / unsubscribe

- ios/android: long-press the topic in the app → mute or unsubscribe
- web: close the browser tab; no persistent subscription
- email: remove forwarding from the topic settings page

## privacy

operational deploy events only — no secrets, tokens, or user data sent. ntfy.sh is a public relay; anyone with the url can post or read. the 8-char random suffix is the only access control.

## rotating the topic if it leaks

1. generate a new suffix: `head -c 8 /dev/urandom | xxd -p | head -c 8`
2. replace `cdn-deploy-74697e0f` everywhere in `.woodpecker/deploy.yml` (two occurrences)
3. update this doc with the new topic url
4. commit + push — old topic becomes a dead channel on next deploy
5. re-subscribe on all devices with the new url

---

## SMS notifications via AWS SNS

Woodpecker publishes to the `cdn-deploy-alerts` SNS topic after each successful deploy. the topic is in account `211125425201`, region `us-west-2`.

### topic ARN

```
arn:aws:sns:us-west-2:211125425201:cdn-deploy-alerts
```

### subscribed phone

`+1 (...) ...3994` (operator, E.164 format in IaC — full number in `infra/sns-deploy-alerts.cfn.yaml`)

### confirming the subscription

AWS sends a one-time confirmation SMS to the subscribed number when the SNS stack is first deployed. the message looks like:

```
You have chosen to subscribe to the topic:
arn:aws:sns:us-west-2:211125425201:cdn-deploy-alerts
To confirm this subscription, click or visit the link below (If this was in error no action is necessary):
Confirm subscription
```

reply `Y` (or click the confirm link) to activate. until confirmed, SNS will not deliver messages to that number.

### adding subscribers

- **additional phone** — add another `AWS::SNS::Subscription` resource to `infra/sns-deploy-alerts.cfn.yaml` with `Protocol: sms` and the new E.164 number, then re-deploy the stack
- **email** — same pattern, `Protocol: email`, `Endpoint: you@example.com` — subscriber gets a confirmation email
- **console one-off** — SNS console → topic `cdn-deploy-alerts` → create subscription → pick protocol + endpoint. not tracked in IaC; prefer CFN for anything persistent

### deploying the IaC

the `infra/sns-deploy-alerts.cfn.yaml` stack requires CloudFormation + SNS + IAM permissions that `heraldstack-ci-deploy` does not hold. run the included script with an admin-capable profile:

```sh
AWS_PROFILE=aerospaceug-admin ./scripts/deploy-sns-alerts.sh
```

### message format

- **dev**: `[CDN dev] <7-char sha> live https://dev.clouddelnorte.org/`
- **prod**: `[CDN prod] <7-char sha> live https://clouddelnorte.org/`

### cost

~$0.00645–$0.0075/SMS in us-west-2 (US numbers). at typical deploy frequency (a few per week) this rounds to ~$0–$0.02/month — negligible.
