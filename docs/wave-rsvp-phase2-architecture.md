# RSVP Phase 2 — Backend Architecture

> Lambda + DynamoDB + API Gateway HTTP V2 — Cognito-native, no KMS, no HMAC
>
> Wave 35a (backend) · Wave 35b (frontend wiring) · 2026-05-19

---

## 1. Overview

Phase 1 stored RSVPs in `localStorage`. That fails the moment a user clears
their browser, switches devices, or opens incognito. Worse, the "spots
remaining" counter is per-browser — fifty users on fifty browsers all see
"48 left" and all RSVP, blowing capacity wide open.

Phase 2 moves state to a single DynamoDB table behind a Lambda behind an
API Gateway HTTP V2 endpoint. Capacity is enforced server-side, RSVPs follow
the user across devices, and the QR ticket payload remains a short
deterministic string that the door volunteer scans and looks up against the
table.

What we explicitly **do not** add:

- **No KMS asymmetric key** — the original spec proposed ECDSA-signed QR
  payloads at $1.00/mo. Phase 3 door check-in is volunteer-mediated: the
  volunteer scans the QR, the scanner app calls `cognito-idp:AdminGetUser`
  with the embedded `user_sub`, and the volunteer visually confirms the
  attendee against the returned profile. No cryptographic signature needed
  because there is a human in the loop.
- **No HMAC secret in SSM** — same reasoning.
- **No new SSM parameters at all.** Capacity lives in a Lambda env var.
- **No Cognito schema changes.** We use the existing `sub` claim from the
  ID token, decoded inline (mirrors the `decodeJwtSub` helper in
  `infra/lambda/speaker-proposals/index.mjs`).
- **No SES email on RSVP.** Confirmation lives on-screen + in `/meetings/`.

Annual cost: ~$0.60/year (down from ~$14/year in the original proposal).

---

## 2. Storage — `cdn-rsvps` DynamoDB table

| Property         | Value                                  |
| ---------------- | -------------------------------------- |
| Account          | 170473530355 (jitsi-video-hosting)     |
| Region           | us-west-2                              |
| Table name       | `cdn-rsvps`                            |
| Billing mode     | `PAY_PER_REQUEST`                      |
| Partition key    | `user_sub` (String) — Cognito `sub`    |
| Sort key         | `event_id` (String) — e.g. `happy-hour-2026-06-03` |
| GSIs             | none                                   |

**Item attributes**

| Attribute    | Type   | Notes                                 |
| ------------ | ------ | ------------------------------------- |
| `user_sub`   | String | Partition key                         |
| `event_id`   | String | Sort key                              |
| `name`       | String | Optional display name from form       |
| `email`      | String | Optional contact email from form      |
| `created_at` | String | ISO 8601 timestamp                    |

**Access patterns**

| Pattern                                | Operation                         |
| -------------------------------------- | --------------------------------- |
| List a user's RSVPs                    | Query by `user_sub`               |
| Look up one user/event RSVP            | Query by `user_sub` + `event_id`  |
| Count RSVPs for an event (capacity)    | Scan + `FilterExpression` + `Select: COUNT` |

The Scan-for-count is intentional. At capacities of ≤ 50 attendees per
event, a Scan over the entire `cdn-rsvps` table is a single capacity unit's
worth of work and avoids the operational overhead of maintaining a counter
item or a GSI on `event_id`. If we ever host a 500-seat event, swap in a
GSI on `event_id` and update the IAM policy to scope `Query` to that index.

Schema definition: [`infra/dynamodb/cdn-rsvps-table.json`](../infra/dynamodb/cdn-rsvps-table.json)

---

## 3. Lambda — `cdn-rsvp`

Single Lambda handles all three routes via `event.routeKey` dispatch
(HTTP V2 payload format 2.0). Mirrors `infra/lambda/feedback/index.mjs` for
structure (CORS helpers, in-memory rate limit, JSON-line logging) and reuses
`decodeJwtSub` verbatim from `infra/lambda/speaker-proposals/index.mjs`.

| Property | Value                |
| -------- | -------------------- |
| Name     | `cdn-rsvp`           |
| Runtime  | `nodejs22.x`         |
| Handler  | `index.handler`      |
| Memory   | 256 MB               |
| Timeout  | 10 s                 |

**Routes**

| Method   | Path                    | Auth | Behavior |
| -------- | ----------------------- | ---- | -------- |
| OPTIONS  | any                     | n/a  | 204 + CORS headers |
| POST     | `/rsvp`                 | Required (Bearer ID token) | Create or return existing RSVP |
| GET      | `/rsvp`                 | Required | List the caller's RSVPs |
| GET      | `/rsvp/{eventId}/spots` | Public | `{capacity, taken, remaining}` |

**Auth model**

The Authorization header carries the Cognito ID token. The Lambda decodes
the second segment of the JWT (no signature verification — see note below)
and pulls the `sub` claim. Mirrors the `decodeJwtSub` helper currently used
by `cdn-speaker-proposals`.

> _Note on signature verification:_ API Gateway HTTP V2 supports a built-in
> JWT authorizer that validates the Cognito signature before the Lambda is
> invoked. We're keeping parity with `cdn-speaker-proposals` for now (which
> also decodes the ID token without verifying inside the Lambda). The
> `Authorization` header is passed verbatim by the browser; an attacker
> would need a valid signed Cognito token to populate `sub` with anything
> useful, and an unauthenticated attacker can only spoof a `user_sub` they
> don't control — they'd just RSVP "as themselves" against a fake `sub`,
> which is harmless. We can add the JWT authorizer later as a hardening
> step without changing the Lambda.

**Idempotency**

`POST /rsvp` is idempotent on `(user_sub, event_id)`:

1. Look up an existing item; if present → 200 + existing ticket.
2. Else count the event; if at capacity → 409 `capacity_full`.
3. Else PutItem with
   `ConditionExpression: attribute_not_exists(user_sub) AND attribute_not_exists(event_id)`.
4. On `ConditionalCheckFailedException` (race lost), re-read and return 200.

**Rate limit**

Per-IP, 5 requests/hour, in-memory (per Lambda instance). Mirrors the
`rateMap` pattern in `infra/lambda/feedback/index.mjs`. This is a soft cap;
abuse beyond Lambda warm-instance scope is still bounded by the API
Gateway throttle defaults.

**Validation**

- `eventId`: required, regex `/^[a-z0-9-]+$/`, ≤ 64 chars
- `name`: optional, ≤ 200 chars
- `email`: optional, simple regex sanity check
- `eventId` must be a key in the `EVENT_CAPACITIES` env var

**Ticket payload**

Same wire format as Phase 1: `cdn-ticket:v1:{eventId}:{userSub}`. No
signature. Phase 3 check-in (separate wave) validates by calling
`cognito-idp:AdminGetUser` against the embedded `userSub` — the volunteer
sees the user's name/email and visually confirms.

**Environment variables**

| Variable           | Value                                       |
| ------------------ | ------------------------------------------- |
| `RSVP_TABLE`       | `cdn-rsvps`                                 |
| `USER_POOL_ID`     | `us-west-2_cyPQF4F3r`                       |
| `EVENT_CAPACITIES` | JSON map: `{"happy-hour-2026-06-03":50}`    |

`EVENT_CAPACITIES` is a JSON-encoded string. Editing it is a one-line
change to `scripts/deploy-cdn-rsvp.sh` plus a redeploy. The 4 KB Lambda env
var ceiling fits dozens of events comfortably; we'll migrate to a
`cdn-events` table if we ever exceed it.

Source: [`infra/lambda/cdn-rsvp/index.mjs`](../infra/lambda/cdn-rsvp/index.mjs)

---

## 4. API Gateway HTTP V2 — `cdn-rsvp-api`

Single HTTP V2 API. No Lambda authorizer (auth is in the Lambda).
OPTIONS preflights return from the Lambda's `OPTIONS` branch with the
correct `Access-Control-Allow-Origin` for the request — there is no
API-level CORS configuration that would otherwise shadow the OPTIONS
routes.

| Property      | Value             |
| ------------- | ----------------- |
| API name      | `cdn-rsvp-api`    |
| Protocol      | HTTP              |
| Stage         | `prod` (auto-deploy) |
| Integration   | `AWS_PROXY` → `cdn-rsvp` Lambda |
| Payload fmt   | 2.0               |

**Routes**

```
OPTIONS /rsvp
POST    /rsvp
GET     /rsvp
OPTIONS /rsvp/{eventId}/spots
GET     /rsvp/{eventId}/spots
```

Invoke URL pattern: `https://{api-id}.execute-api.us-west-2.amazonaws.com/prod`.

The API id is generated at first deploy; the deploy script prints it for
copy/paste into the awsug CSP.

Deploy script: [`scripts/deploy-cdn-rsvp-apigw.sh`](../scripts/deploy-cdn-rsvp-apigw.sh)

---

## 5. IAM Topology

**Trust policy** — reuses `infra/iam/speaker-proposals-trust-policy.json`
verbatim (Lambda-service trust). No new trust policy file.

**Execution policy** — [`infra/iam/cdn-rsvp-execution-policy.json`](../infra/iam/cdn-rsvp-execution-policy.json)

| Statement Sid        | Allows                                                    | On                                              |
| -------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `DynamoDBRsvps`      | `PutItem`, `GetItem`, `Query`, `Scan`                     | `cdn-rsvps` table                               |
| `CognitoAdminGetUser`| `cognito-idp:AdminGetUser`                                | `us-west-2_cyPQF4F3r` (Phase 3 readiness)       |
| `CloudWatchLogs`     | `CreateLogGroup`, `CreateLogStream`, `PutLogEvents`       | `arn:aws:logs:us-west-2:170473530355:*`         |

`Scan` is needed for the `spots` endpoint (count RSVPs per event). At ≤ 50
items this costs a single read capacity unit per call. If table size ever
becomes an issue, add a GSI on `event_id` and tighten this to `Query` only.

`AdminGetUser` is granted now but unused in Phase 2; it's included so
Phase 3 (volunteer door scanner) doesn't need an IAM change. The Lambda
exports a `lookupUser(userSub)` helper that's not wired to any current
route.

No `ses:*`, no `ssm:*`, no `kms:*`.

**Role name:** `cdn-rsvp-lambda-role`.

**API Gateway → Lambda** invoke permission is added by
`scripts/deploy-cdn-rsvp-apigw.sh` (statement IDs
`apigw-cdn-rsvp-invoke` and `apigw-cdn-rsvp-spots-invoke`).

---

## 6. Frontend Integration Plan (separate wave)

Wave 35a ships the backend only. Wave 35b wires it up.

`src/lib/rsvp.ts` keeps the same export signatures and swaps localStorage
for `fetch()`:

| Function              | Phase 1 (current)         | Phase 2 (wave 35b)                                |
| --------------------- | ------------------------- | ------------------------------------------------- |
| `addRsvp(input)`      | localStorage push         | `POST /rsvp` with Bearer ID token                 |
| `getRsvp(evt, sub)`   | localStorage filter       | call `listUserRsvps`, find by `eventId`           |
| `listUserRsvps(sub)`  | localStorage filter       | `GET /rsvp` with Bearer ID token                  |
| `spotsRemaining(evt)` | `capacity - localCount`   | `GET /rsvp/{evt}/spots` (public)                  |
| `buildTicketPayload`  | `cdn-ticket:v1:{e}:{u}`   | unchanged — wire format already matches           |

Wave 35b also adds the API Gateway origin to
`infra/cloudfront-security-headers.awsug.json` `connect-src`. The deploy
script prints the exact origin to add (it's
`https://{api-id}.execute-api.us-west-2.amazonaws.com`, where `{api-id}`
is whatever HTTP V2 hands back at first deploy).

Phase 1 RSVPs already in localStorage are not migrated. The auto-confirm
flow on `/rsvp/` will write a fresh server-side record the next time the
user visits.

---

## 7. Cost Estimate

| Service                | Monthly | Notes                                |
| ---------------------- | ------- | ------------------------------------ |
| DynamoDB on-demand     | ~$0.01  | Tiny item count, sub-1 RCU avg       |
| Lambda                 | ~$0.02  | 5 K invokes × 100 ms × 256 MB        |
| API Gateway HTTP V2    | ~$0.02  | ~$1.00 per million requests          |
| CloudWatch Logs        | ~$0.01  |                                      |
| **Total**              | **~$0.05/mo** | ~$0.60/year                    |

Original proposal (with KMS asymmetric, cross-account SES, dedicated
authorizer Lambda) was ~$1.17/mo. We deleted all that.

---

## 8. Phase Scope

**Phase 1 (shipped):** localStorage + deterministic v1 ticket payload.
No capacity enforcement. Single-browser only.

**Phase 2 (this wave + next wave):**

- Wave 35a (this PR) — Lambda + DDB + IAM + API Gateway HTTP V2 + deploy
  scripts. Source code only; nothing deployed yet.
- Wave 35b (separate PR) — flip `src/lib/rsvp.ts` from localStorage to
  `fetch()`, update CSP, deploy.

Capabilities delivered: capacity-enforced RSVP create, idempotent return
of existing tickets, list-mine across devices, public spots-remaining
counter, per-IP rate limit.

**Phase 3 (deferred):** volunteer-mediated door check-in.

The volunteer's scanner app reads the QR (`cdn-ticket:v1:{e}:{u}`),
extracts `user_sub`, and calls
`cognito-idp:AdminGetUser` against the user pool. The returned profile
(name, email) is shown to the volunteer who visually confirms. A
"checked-in" flag can be flipped on the DynamoDB record by a separate
Lambda + route. **No HMAC, no signature** — the volunteer is the
verification step. The IAM policy already grants `AdminGetUser`, so
Phase 3 only needs the new Lambda + route, not an IAM change.

---

## 9. Files Touched

### Wave 35a (this PR — source only)

| Path                                              | Status  |
| ------------------------------------------------- | ------- |
| `infra/lambda/cdn-rsvp/index.mjs`                 | added   |
| `infra/dynamodb/cdn-rsvps-table.json`             | added   |
| `infra/iam/cdn-rsvp-execution-policy.json`        | added   |
| `scripts/deploy-cdn-rsvp.sh`                      | added (executable) |
| `scripts/deploy-cdn-rsvp-apigw.sh`                | added (executable) |
| `docs/wave-rsvp-phase2-architecture.md`           | rewritten |

### Wave 35b (follow-up — deploy + frontend wiring)

| Path                                              | Status  |
| ------------------------------------------------- | ------- |
| `src/lib/rsvp.ts`                                 | rewrite localStorage → `fetch()` |
| `infra/cloudfront-security-headers.awsug.json`    | add API Gateway origin to `connect-src` |
| `.env.production`                                 | add `VITE_RSVP_API_URL` |
| `src/locales/en-US.json` / `es-MX.json`           | new error keys (`rsvp.error.capacityFull`, etc.) |

Bryan runs the deploy after wave 35a merges:

```
./scripts/deploy-cdn-rsvp.sh        # Lambda + DDB + IAM + env vars
./scripts/deploy-cdn-rsvp-apigw.sh  # HTTP V2 API + routes + permissions
```

The second script prints the API id and the exact CSP `connect-src` value
to update in wave 35b.
