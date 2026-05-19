# RSVP Phase 2 — Backend Architecture Spec

> DynamoDB + Lambda + API Gateway + KMS-Signed QR Tickets
>
> Author: wave-28f-rsvp-arch ghost · 2026-05-19
>
> Status: DRAFT — awaiting Bryan's decisions on open questions before implementation dispatch.

---

## 1. Current State (Phase 1)

Phase 1 shipped in PR #217 and #221. It provides a client-side RSVP flow backed entirely by `localStorage`.

### Implementation summary (`src/lib/rsvp.ts`)

- **Storage**: All RSVP records are stored under the key `cdn.rsvps.v1` in the browser's `localStorage`. Records are serialized as a JSON array of `RsvpRecord` objects.
- **Data model**: Each record contains `eventId`, `userSub`, `name`, `email`, and `createdAt` (ISO timestamp).
- **Event registry**: A hardcoded `CDN_EVENTS` array defines events with `id`, `title`, `scheduledDate`, `location`, `capacity`, `rsvpedBaseline`, and `meetupRsvpUrl`. Currently one event: `happy-hour-2026-06-03` (capacity 50, baseline 2).
- **Ticket payload**: Deterministic string `cdn-ticket:v1:{eventId}:{userSub}` — no cryptographic signature, no PII.
- **Capacity display**: `spotsRemaining()` computes `capacity - rsvpedBaseline - localCount`. This is a visual-only counter; it reflects only the current browser's localStorage, not global state.
- **RSVP flow** (`src/sites/awsug/rsvp/app.tsx`): Auth-gated via Cognito. On page load, if the user has no existing RSVP and spots remain (locally), the RSVP is auto-confirmed. A QR code is rendered from the deterministic ticket payload.
- **Ticket retrieval** (`/meetings/` page): Lists all RSVPs for the authenticated user from localStorage.

### Phase 1 failure modes

| Failure | Impact |
|---------|--------|
| Browser cache/localStorage cleared | Ticket permanently lost; no recovery path |
| Capacity counter is per-browser | 50 users on 50 different browsers all see "48 remaining" and all RSVP — no enforcement |
| QR payload is deterministic and unsigned | Anyone who knows the format can forge a valid-looking ticket for any `user_sub` |
| Cross-device retrieval impossible | RSVP on laptop → cannot show ticket on phone at the door |
| Private/incognito mode | localStorage may be disabled; RSVP silently fails to persist |

Phase 2 eliminates all of these by moving state to a server-side DynamoDB table with cryptographically signed tickets.

---

## 2. Backend Topology

### 2a. DynamoDB Table: `cdn-rsvps`

| Property | Value |
|----------|-------|
| Account | 170473530355 (jitsi-video-hosting) |
| Region | us-west-2 |
| Billing mode | On-demand (PAY_PER_REQUEST) |
| Partition key | `event_id` (String) |
| Sort key | `user_sub` (String) |

**Attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `event_id` | String | Partition key. Event identifier (e.g., `happy-hour-2026-06-03`) |
| `user_sub` | String | Sort key. Cognito user pool `sub` claim |
| `name` | String | Display name from Cognito token (nullable) |
| `email` | String | Email from Cognito token |
| `created_at` | String | ISO 8601 timestamp of RSVP creation |
| `ticket_signature` | String | Base64-encoded KMS ECDSA signature of the ticket payload |
| `ttl_unix` | Number | TTL attribute — event date + 30 days as Unix epoch seconds |

**Access patterns:**

1. **Get single RSVP**: `event_id` = X AND `user_sub` = Y → single item read
2. **Count RSVPs for event**: Query `event_id` = X, `Select: COUNT` → capacity check
3. **List user's RSVPs**: GSI `user_sub-index` (PK: `user_sub`, SK: `event_id`) → cross-event ticket listing

**GSI: `user_sub-index`**

| Property | Value |
|----------|-------|
| Partition key | `user_sub` (String) |
| Sort key | `event_id` (String) |
| Projection | ALL |

This GSI supports the `cdn-rsvp-list-mine` function without a full table scan.

**Cost estimate**: On-demand pricing at this scale (≤2500 items/year, ≤5000 reads/year) → ~$0.01/mo.

### 2b. Lambda Functions

All functions use **Node.js 20 runtime**, follow the pattern established by `infra/lambda/feedback/index.mjs`, and deploy to account 170473530355 in us-west-2.

#### 1. `cdn-rsvp-create`

- **Route**: `POST /rsvp/{event_id}`
- **Auth**: Required (Lambda authorizer validates Cognito ID token)
- **Logic**:
  1. Extract `event_id` from path, `user_sub` / `name` / `email` from authorizer context
  2. Look up event capacity (from `cdn-events` table or hardcoded config)
  3. Query current RSVP count for `event_id`
  4. If count >= capacity → return `409 Conflict` with `{ error: "capacity_full" }`
  5. Conditional PutItem with `attribute_not_exists(user_sub)` to prevent double-RSVP race
  6. Sign ticket payload via KMS `Sign` API (ECC P-256, SHA-256 digest)
  7. Return `201 Created` with full ticket record including `ticket_signature`
- **Idempotency**: If conditional write fails (item exists), fetch and return existing record with `200 OK`

#### 2. `cdn-rsvp-get`

- **Route**: `GET /rsvp/{event_id}`
- **Auth**: Required
- **Logic**:
  1. GetItem with `event_id` + caller's `user_sub`
  2. If exists → return `200` with ticket record
  3. If not → return `404` with `{ error: "no_rsvp" }`

#### 3. `cdn-rsvp-list-mine`

- **Route**: `GET /rsvp/mine`
- **Auth**: Required
- **Logic**:
  1. Query GSI `user_sub-index` with caller's `user_sub`
  2. Return `200` with array of ticket records (may be empty)

#### 4. `cdn-rsvp-checkin` (Phase 3 — deferred)

- **Route**: `POST /rsvp/{event_id}/checkin`
- **Auth**: Door-scanner credential (separate from user auth)
- **Logic**: Validate QR signature against KMS public key, mark `checked_in_at` timestamp
- **Status**: Stub only in Phase 2; full implementation deferred until door-scan hardware/flow is defined

### 2c. API Gateway HTTP V2: `cdn-rsvp-api`

Mirrors the pattern of `cdn-feedback-api` (see `scripts/deploy-feedback-apigw.sh`).

| Property | Value |
|----------|-------|
| Protocol | HTTP (API Gateway V2) |
| Name | `cdn-rsvp-api` |
| Stage | `$default` with auto-deploy |
| CORS AllowOrigins | `https://awsug.clouddelnorte.org` |
| CORS AllowMethods | `GET,POST,OPTIONS` |
| CORS AllowHeaders | `content-type,authorization` |
| CORS MaxAge | 86400 |

**Routes:**

| Method | Path | Target |
|--------|------|--------|
| POST | `/rsvp/{event_id}` | `cdn-rsvp-create` |
| GET | `/rsvp/{event_id}` | `cdn-rsvp-get` |
| GET | `/rsvp/mine` | `cdn-rsvp-list-mine` |

**Authorizer:**

- Type: Lambda authorizer (REQUEST type, payload format 2.0)
- Function: `cdn-rsvp-authorizer` — validates the Cognito ID token JWT
- Validates against user pool `us-west-2_cyPQF4F3r`, checks `exp`, `iss`, `aud` claims
- Returns `user_sub`, `name`, `email` in authorizer context for downstream Lambdas
- Identity source: `$request.header.Authorization` (Bearer token)
- Authorizer result TTL: 300 seconds (cache per token)

**Throttling:**

- Default throttle: 10 requests/second per route (burst 20)
- Capacity enforcement is at the Lambda level; API Gateway throttle is a coarse safety net

### 2d. KMS Signing Key for QR Tickets

| Property | Value |
|----------|-------|
| Key type | Asymmetric (ECC_NIST_P256) |
| Key usage | SIGN_VERIFY |
| Region | us-west-2 |
| Account | 170473530355 |
| Alias | `alias/cdn-rsvp-ticket-signing` |
| Monthly cost | $1.00 (key) + ~$0.03/10K sign operations |

**Signing flow:**

1. Lambda constructs canonical payload: `cdn-ticket:v2:{event_id}:{user_sub}:{created_at_epoch}`
2. Lambda calls `KMS.Sign` with `SigningAlgorithm: ECDSA_SHA_256`, `MessageType: RAW`
3. KMS returns DER-encoded signature → Lambda base64-encodes and stores as `ticket_signature`

**QR payload format (rendered by frontend):**

```
cdn-ticket:v2:{event_id}:{user_sub}:{created_at_epoch}|{signature_base64}
```

**Verification flow (door-scan / check-in):**

1. Scanner splits payload at `|` → message + signature
2. Fetches public key from KMS `GetPublicKey` (or uses cached/embedded copy)
3. Verifies ECDSA signature against message bytes
4. If valid → look up record in DynamoDB, mark checked-in

---

## 3. Capacity Enforcement Logic

### Write path (cdn-rsvp-create)

```
1. Query: SELECT COUNT(*) FROM cdn-rsvps WHERE event_id = :eid
2. If count >= event.capacity → return 409 { error: "capacity_full" }
3. PutItem with ConditionExpression: attribute_not_exists(user_sub)
   - If succeeds → RSVP created
   - If ConditionalCheckFailedException → item already exists (idempotent return)
```

### Race condition handling

- **Double-RSVP by same user**: The `attribute_not_exists(user_sub)` condition prevents duplicates even under concurrent requests.
- **Capacity overshoot**: Between the count query and the PutItem, another request could slip in. At this scale (50 seats, ~1 RSVP/minute), the race window is negligible. If strict enforcement is needed later, use a DynamoDB transaction with a counter item — but this adds complexity and cost for a problem that won't manifest at current scale.
- **Acceptable overshoot**: ±1 seat. The event has physical flexibility for 1-2 extra attendees.

### Event capacity configuration

**Recommended approach**: A `cdn-events` DynamoDB table.

| Attribute | Type | Description |
|-----------|------|-------------|
| `event_id` | String (PK) | Event identifier |
| `title` | String | Event display name |
| `capacity` | Number | Maximum RSVPs allowed |
| `event_date` | String | ISO date |
| `location` | String | Venue |

**Alternative (simpler, for now)**: Hardcode capacity in the Lambda as a config object. Only one event exists today. Migrate to the table when multi-event support is needed.

**Decision for Bryan**: Hardcode now (simpler, 0 extra cost) vs. `cdn-events` table (future-proof, ~$0.005/mo extra)?

---

## 4. IAM Topology

### Lambda execution role: `cdn-rsvp-lambda-role`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-west-2:170473530355:table/cdn-rsvps",
        "arn:aws:dynamodb:us-west-2:170473530355:table/cdn-rsvps/index/user_sub-index",
        "arn:aws:dynamodb:us-west-2:170473530355:table/cdn-events"
      ]
    },
    {
      "Sid": "KMSSign",
      "Effect": "Allow",
      "Action": [
        "kms:Sign",
        "kms:GetPublicKey"
      ],
      "Resource": "arn:aws:kms:us-west-2:170473530355:alias/cdn-rsvp-ticket-signing"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-west-2:170473530355:*"
    }
  ]
}
```

### Lambda authorizer role: `cdn-rsvp-authorizer-role`

- Only needs CloudWatch Logs permissions (token validation is done in-code against Cognito JWKS)

### API Gateway → Lambda permission

- `lambda:InvokeFunction` granted to `apigateway.amazonaws.com` with source ARN scoped to the specific API + routes

### KMS key policy

```json
{
  "Sid": "AllowLambdaSign",
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::170473530355:role/cdn-rsvp-lambda-role" },
  "Action": ["kms:Sign", "kms:GetPublicKey"],
  "Resource": "*"
}
```

No `kms:Decrypt`, `kms:Encrypt`, or `kms:CreateGrant` — principle of least privilege.

### Cognito user pool

- Pool ID: `us-west-2_cyPQF4F3r`
- The Lambda authorizer fetches JWKS from `https://cognito-idp.us-west-2.amazonaws.com/us-west-2_cyPQF4F3r/.well-known/jwks.json` (cached in-memory across warm invocations)
- Validates: `iss`, `aud` (app client ID), `exp`, `token_use: id`

---

## 5. Frontend Integration

### API client replacement in `src/lib/rsvp.ts`

The existing exports (`addRsvp`, `getRsvp`, `listUserRsvps`, `spotsRemaining`, `buildTicketPayload`) maintain their signatures but swap localStorage for `fetch()` calls:

| Function | Phase 1 | Phase 2 |
|----------|---------|---------|
| `addRsvp()` | localStorage write | `POST /rsvp/{event_id}` with auth header |
| `getRsvp()` | localStorage read | `GET /rsvp/{event_id}` with auth header |
| `listUserRsvps()` | localStorage filter | `GET /rsvp/mine` with auth header |
| `spotsRemaining()` | local count math | Derived from API response (server returns `remaining` field) |
| `buildTicketPayload()` | Deterministic string | Returns server-provided signed payload from ticket record |

### `/rsvp/` page changes (minimal)

- `app.tsx` already calls `addRsvp()` and `buildTicketPayload()` — no structural change needed
- Add error handling for `409 Conflict` (capacity full) and network errors
- QR now renders the signed payload from the API response instead of the deterministic v1 string

### `/meetings/` tickets section changes (minimal)

- Replace `listUserRsvps(userSub)` localStorage call with the API-backed version
- QR codes render signed payloads from server responses

### Auth token passing

- The Cognito ID token is already in `sessionStorage` after auth flow
- New `src/lib/rsvp.ts` methods read it and pass as `Authorization: Bearer {id_token}` header

### Migration note

Phase 1 localStorage tickets are **NOT** backfilled to DynamoDB. Users who RSVPed during Phase 1 will need to re-RSVP after Phase 2 deploys. Since the flow is auto-confirm on page visit, this happens transparently — the user visits `/rsvp/` again and gets a new server-backed ticket. The old localStorage ticket becomes a "ghost" visible only on the original browser until localStorage is cleared or the migration code is removed.

---

## 6. Migration Strategy

A 4-day phased rollout minimizes risk:

### Day 1: Deploy backend + dual-write

- Deploy DynamoDB table, Lambda functions, API Gateway, KMS key
- Frontend update: `addRsvp()` writes to BOTH localStorage AND the API
- Reads still come from localStorage (no user-visible change)
- If API call fails, localStorage write still succeeds (graceful degradation)

### Day 2: Monitor

- Check CloudWatch logs for Lambda errors
- Verify DynamoDB items are being created correctly
- Confirm KMS signatures are valid
- Check API Gateway metrics (latency, 4xx/5xx rates)

### Day 3: Switch reads to API

- `getRsvp()` and `listUserRsvps()` now read from API
- localStorage becomes write-only fallback (for offline resilience)
- QR codes now show signed v2 payloads
- If API is unreachable, fall back to localStorage read (degraded: unsigned QR)

### Day 4: Remove localStorage path

- Remove all localStorage read/write code from `src/lib/rsvp.ts`
- Remove `STORAGE_KEY` constant and `readAll()`/`writeAll()` helpers
- Clean up the `CDN_EVENTS` hardcoded array (capacity now lives server-side)
- Final deploy — Phase 2 is fully live

---

## 7. Cost Estimate

| Service | Monthly cost | Assumptions |
|---------|-------------|-------------|
| DynamoDB (on-demand) | ~$0.01 | 2500 writes/year, 5000 reads/year |
| Lambda | ~$0.02 | 5000 invocations × 100ms × 128MB |
| API Gateway HTTP V2 | ~$0.10 | 5000 requests × $1.00/million |
| KMS asymmetric key | $1.00 | Fixed monthly charge per key |
| KMS Sign operations | ~$0.03 | 2500 sign ops/year × $0.15/10K |
| CloudWatch Logs | ~$0.01 | Minimal log volume |
| **Total** | **~$1.17/mo** | |

**Annual**: ~$14/year

**Alternative (HMAC in SSM instead of KMS)**:
- Replace KMS key ($1.00/mo) with an HMAC-SHA256 secret stored in SSM Parameter Store ($0.05/mo for the parameter)
- Signing done in Lambda code (no KMS API call cost)
- Total drops to ~$0.19/mo
- Tradeoff: symmetric secret means if Lambda is compromised, attacker can forge tickets. KMS keeps the private key in hardware — Lambda never sees it.

---

## 8. Open Questions for Bryan

1. **Account placement**: Comfortable hosting the RSVP backend in the jitsi-video-hosting account (170473530355) alongside `cdn-feedback` and `cdn-speaker-proposals`? This follows the established pattern but concentrates more services in one account.

2. **KMS vs. HMAC**: The KMS asymmetric key costs $1.00/mo but provides hardware-backed signing where the private key never leaves KMS. Alternative: HMAC secret in SSM at ~$0.05/mo — simpler, cheaper, but the secret is accessible to Lambda code (less defense-in-depth). At this scale and threat model, HMAC is likely sufficient. Which do you prefer?

3. **Check-in / door-scan flow**: Build the `cdn-rsvp-checkin` endpoint in Phase 2, or defer to Phase 3? Building it now means the scanner app can be developed in parallel. Deferring keeps Phase 2 scope smaller.

4. **Email notifications**: Send a confirmation email on RSVP? Could use the existing SES setup in account 211125425201 (cross-account send). Adds ~1 day of implementation. In scope or defer?

5. **Event capacity config**: Hardcode capacity in Lambda (simpler, one event today) or create a `cdn-events` DynamoDB table (future-proof for multi-event)? Recommendation: table, since the cost is negligible and it avoids a Lambda redeploy to change capacity.

---

## 9. Implementation Effort

| Phase | Effort | Details |
|-------|--------|---------|
| Backend infrastructure | 1 day | DynamoDB table + GSI, KMS key, IAM roles, API Gateway setup |
| Lambda functions | 1-2 days | `create`, `get`, `list-mine`, authorizer — including unit tests |
| Deploy script | 0.5 day | `scripts/deploy-rsvp-apigw.sh` mirroring feedback pattern |
| Frontend integration | 1 day | Replace `src/lib/rsvp.ts` methods, error handling, CSP update |
| E2E testing | 1 day | Auth flow → RSVP → capacity enforcement → QR validation |
| Migration rollout | 4 days | Phased dual-write → API-primary → localStorage removal |
| **Total** | **~1 week active dev** | Plus 4-day migration window |

---

## 10. Files This Would Touch

For a future implementation dispatch's reference:

### New files

| Path | Purpose |
|------|---------|
| `infra/lambda/cdn-rsvp/create.mjs` | RSVP creation Lambda |
| `infra/lambda/cdn-rsvp/get.mjs` | Single ticket retrieval Lambda |
| `infra/lambda/cdn-rsvp/list-mine.mjs` | User's tickets listing Lambda |
| `infra/lambda/cdn-rsvp/authorizer.mjs` | Cognito ID token validator |
| `infra/cdn-rsvp-iac.yml` | CloudFormation/SAM template for DDB + KMS + IAM |
| `scripts/deploy-rsvp-apigw.sh` | API Gateway V2 deploy script (mirrors `deploy-feedback-apigw.sh`) |

### Modified files

| Path | Change |
|------|--------|
| `src/lib/rsvp.ts` | Replace localStorage with `fetch()` API calls; keep same export signatures |
| `src/sites/awsug/rsvp/app.tsx` | Add error handling for 409/network errors; QR renders signed payload |
| `src/sites/awsug/meetings/components/my-tickets.tsx` | Use API-backed `listUserRsvps()`; render signed QR payloads |
| `infra/cloudfront-security-headers.awsug.json` | Add RSVP API Gateway URL to `connect-src` CSP directive |
| `src/locales/en.json` | New keys: `rsvp.error.capacityFull`, `rsvp.error.network`, `rsvp.error.unauthorized` |
| `src/locales/es.json` | Spanish translations for new error keys |

### Environment variables

| Variable | Value | Where |
|----------|-------|-------|
| `VITE_RSVP_API_URL` | `https://{api-id}.execute-api.us-west-2.amazonaws.com` | `.env.production` |

---

## Appendix: Sequence Diagrams

### RSVP Creation (happy path)

```
User → Frontend → API Gateway → Authorizer → cdn-rsvp-create → DynamoDB
                                                              → KMS (Sign)
                                                              ← ticket record
                  ← 201 { ticket + signature }
       ← render QR with signed payload
```

### Capacity Full (rejection path)

```
User → Frontend → API Gateway → Authorizer → cdn-rsvp-create → DynamoDB (count query)
                                                              ← count >= capacity
                  ← 409 { error: "capacity_full" }
       ← show "Event is full" message + Meetup RSVP link fallback
```

### Cross-device Ticket Retrieval

```
User (phone) → Frontend → API Gateway → Authorizer → cdn-rsvp-get → DynamoDB
                                                                    ← ticket record
                          ← 200 { ticket + signature }
              ← render QR with signed payload (same as laptop)
```
