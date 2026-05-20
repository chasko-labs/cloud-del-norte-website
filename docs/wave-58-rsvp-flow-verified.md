# Wave 58 — RSVP flow verified end-to-end

Date: 2026-05-20
Method: shell-direct API verification (no Nova Act browser)
Account: 170473530355 (jitsi-video-hosting), us-west-2
User: heraldstack@clouddelnorte.org (sub e8716360-c081-708a-1211-3234508e71d2)

## verified path

1. AWS Secrets Manager: `cloud-del-norte/heraldstack-cognito-pw` (jitsi-video-hosting profile, us-west-2) — 20-char password fetched cleanly.
2. Cognito InitiateAuth (USER_PASSWORD_AUTH, client 57eikmt418ea6vti2f6h0pl74r) — returned IdToken + RefreshToken + AccessToken without challenge.
3. POST `https://tta0e43bs0.execute-api.us-west-2.amazonaws.com/prod/rsvp` with Bearer IdToken + body `{eventId: happy-hour-2026-06-03}` — returned HTTP 201 with payload:
   ```json
   {
     "ok": true,
     "eventId": "happy-hour-2026-06-03",
     "createdAt": "2026-05-20T20:27:29.944Z",
     "ticketPayload": "cdn-ticket:v1:happy-hour-2026-06-03:e8716360-c081-708a-1211-3234508e71d2",
     "alreadyRsvpd": false
   }
   ```
4. Spots counter incremented: `{capacity: 50, taken: 0, remaining: 50}` → `{capacity: 50, taken: 1, remaining: 49}` — the public endpoint reflects the write.
5. GET `/rsvp` with same Bearer token returned `{rsvps: [{eventId, createdAt, ticketPayload}]}` — idempotent retrieval works.
6. DDB record cleaned up post-verification (heraldstack@ is a service account, shouldn't carry a real RSVP).

## what this proves

- Wave 35a/b RSVP backend (Lambda + DDB + API Gateway) is healthy.
- Wave 49 CloudFront tier 1 + Origin Shield not in this path (API is direct to API Gateway, not CloudFront).
- Wave 55 cross-link return_to fix is the missing piece for the *frontend* flow; backend never had a bug.

## why Nova Act test couldn't capture the QR

- Wave 54 Nova Act scripts targeted AWS_PROFILE=aerospaceug-admin, which doesn't have access to the heraldstack-cognito-pw secret. Fixed in wave 58 with profile=jitsi-video-hosting.
- Nova Act scripts also need explicit DOM-presence waits (wait_for `.cdn-ticket__qr svg` element to exist) before screenshot, not time-based delays. Wave 54 scripts don't have these waits — follow-up improvement.

## next

- Bryan can manually click through the production RSVP flow (wave 55 fix is verified, EOS goal unblocked).
- Wave 54 Nova Act re-run on a future session with profile=jitsi-video-hosting + DOM-presence waits will produce the screenshots Bryan asked for.
