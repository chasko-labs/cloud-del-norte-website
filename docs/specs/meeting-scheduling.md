# Scheduled Meetings — Feature Spec
**Status:** Draft  
**Date:** 2026-05-12  
**Repos:** cloud-del-norte-website (frontend) · cloud-del-norte-meet (backend/infra)  
**Author:** ghost-stratia-code-mapper

---

## Background

The current meeting model is static: `src/pages/meetings/data.ts` holds a hardcoded array of past/upcoming meetings with an optional `roomName` for Jitsi. The scheduled-meetings feature replaces the upcoming-meeting workflow with a dynamic, database-backed system: moderators schedule meetings in advance, a hashed URL is generated for sharing, and an optional pre-fire Lambda warms the Jitsi room before the scheduled start.

---

## A. Data Model

### New DynamoDB Table: `cdn-scheduled-meetings`

No existing scheduled-meetings table was found in the meet repo. A new table is required.

| Attribute | Type | Notes |
|---|---|---|
| `meeting_id` | String (PK) | UUID v4, generated on create |
| `scheduled_start` | String (SK) | ISO 8601 UTC, e.g. `2026-06-01T19:00:00Z`. SK enables range queries for list-upcoming. |
| `title` | String | Required. Max 120 chars. |
| `description` | String | Optional. Max 2000 chars. |
| `duration_minutes` | Number | Default 60. |
| `room_hash` | String | 32-char hex token (`crypto.randomBytes(16).toString('hex')`). GSI PK for hash-lookup. |
| `created_by_sub` | String | Cognito sub of creating moderator. |
| `invitees` | StringSet | Optional. Email addresses. Stored encrypted (KMS CMK). |
| `status` | String | `scheduled` \| `live` \| `ended` \| `cancelled` |
| `prefire_enabled` | Boolean | Default false. |
| `prefire_minutes_before` | Number | Default 2. Only meaningful when `prefire_enabled=true`. |
| `eventbridge_rule_name` | String | Stored on create/update so delete can target the rule. Null if prefire disabled. |
| `created_at` | String | ISO 8601 UTC. |
| `updated_at` | String | ISO 8601 UTC. |

**GSI:** `room_hash-index` — PK: `room_hash`. Enables O(1) hash → meeting lookup without scanning.

**TTL:** Set `ttl_epoch` = `scheduled_start_epoch + duration_minutes*60 + 30*24*3600` (30-day post-meeting retention). DynamoDB TTL auto-expires old records.

---

## B. Backend (meet repo)

### New Lambda Handlers

All under `admin-meetings/` in the meet repo, matching the existing `create.ts` pattern.

| Handler | Method + Path | Auth |
|---|---|---|
| `create-scheduled.ts` | `POST /admin/meetings` | Cognito JWT, moderators group |
| `list-scheduled.ts` | `GET /admin/meetings?view=upcoming\|past` | Cognito JWT, moderators group |
| `get-scheduled.ts` | `GET /admin/meetings/{meeting_id}` | Cognito JWT, moderators group |
| `update-scheduled.ts` | `PUT /admin/meetings/{meeting_id}` | Cognito JWT, moderators group |
| `delete-scheduled.ts` | `DELETE /admin/meetings/{meeting_id}` | Cognito JWT, moderators group |
| `resolve-hash.ts` | `GET /m/{hash}` | Public (no auth). Returns meeting title, scheduled_start, status. Does NOT return invitees or created_by_sub. |
| `guest-token.ts` | `POST /m/{hash}/token` | Public. Returns scoped guest Jitsi JWT if meeting is within valid window. |
| `prefire-lobby.ts` | EventBridge target only. Not API-exposed. Mints moderator JWT internally, calls Jitsi HTTP API to warm room. |

### EventBridge Strategy: Per-Meeting Dynamic Schedule

**Decision: per-meeting dynamic schedule** (not a 1-min cron).

Rationale: community group scale (tens of meetings/month, not thousands). Dynamic schedule = one EventBridge Scheduler rule per meeting with prefire enabled. Rule fires once at `scheduled_start - prefire_minutes_before`. Rule is deleted on meeting delete or when prefire is disabled on edit.

Trade-off acknowledged: higher IaC churn than a cron, but cleaner semantics and no lookahead query needed. At this scale the cost difference is negligible.

Schedule expression: `at(YYYY-MM-DDTHH:MM:SS)` (one-time schedule, EventBridge Scheduler).

### Token Exchange Extension

Existing `/token/jitsi` mints a Jitsi JWT for authenticated Cognito users (moderator or member role).

New `guest-token.ts` adds:
- Validates `room_hash` → meeting record exists + `status=scheduled` + current time within `[scheduled_start - 15min, scheduled_start + duration_minutes + 15min]`.
- Mints a guest-scoped Jitsi JWT: `moderator: false`, features: `{ recording: false, livestreaming: false, screen-sharing: true }`, expiry: `min(meeting_end + 2hr, 2hr from now)`.
- No Cognito auth required — public endpoint. Rate-limited by API Gateway (100 req/min per IP).

### IAM Additions

- `create-scheduled` Lambda needs: `scheduler:CreateSchedule`, `scheduler:DeleteSchedule`, `iam:PassRole` (for EventBridge Scheduler execution role).
- `delete-scheduled` + `update-scheduled` need: `scheduler:DeleteSchedule`, `scheduler:UpdateSchedule`.
- `prefire-lobby` Lambda needs: SSM `GetParameter` for Jitsi signing key, `dynamodb:UpdateItem` to set `status=live`.
- EventBridge Scheduler execution role needs: `lambda:InvokeFunction` on `prefire-lobby` ARN.

---

## C. Frontend (website repo)

### New Admin Pages (moderator-gated)

All wrapped in `<RequireAuth requireGroup="moderators">` matching the existing pattern.

| Page | Path | Vite entry |
|---|---|---|
| Meeting list | `/admin/meetings/index.html` | `src/pages/admin-meetings/app.tsx` |
| Create form | `/admin/meetings/new/index.html` | `src/pages/admin-meetings-new/app.tsx` |
| Edit form | `/admin/meetings/[id]/edit/index.html` | `src/pages/admin-meetings-edit/app.tsx` |

**Meeting list** — Cloudscape `Table` with columns: Title, Scheduled Start, Duration, Status, Hash URL (copyable), Actions (Edit / Delete). Two tabs: Upcoming / Past. Delete triggers a Cloudscape `Modal` confirm.

**Create / Edit form** — Cloudscape `Form` with:
- `Input` — Title (required)
- `Textarea` — Description (optional)
- `DatePicker` + `TimeInput` — Scheduled start (required, must be future)
- `Input` type=number — Duration minutes (default 60)
- `Checkbox` — Enable pre-fire lobby
- `Input` type=number — Pre-fire minutes before (shown only when checkbox checked, default 2)
- `Multiselect` or `Textarea` — Invitee emails (optional)

New lib function: `src/lib/scheduled-meetings.ts` — wraps `adminRequest` for CRUD + list calls to `/admin/meetings`.

### New Public Route: `/m/<hash>`

Vite entry: `src/pages/m/app.tsx` + `src/pages/m/index.html`.

No auth required to load the page. Behavior:

1. On mount: `GET /m/{hash}` → meeting title, scheduled_start, status, duration_minutes.
2. If `status=cancelled` or hash not found → show "This meeting is no longer available."
3. If current time < `scheduled_start - 15min` → show title + countdown timer + "Join Call" button (disabled, tooltip: "Opens at [time]").
4. If current time within `[scheduled_start - 15min, scheduled_start + duration_minutes + 15min]` → show title + active "Join Call" button. On click: `POST /m/{hash}/token` → guest JWT → mount `<JitsiEmbed roomName={meeting_id} token={guestJwt} />`.
5. If `status=ended` and past window → show "This meeting has ended." (future: replay link if recording exists).

Authenticated Cognito users visiting `/m/<hash>` get their standard Jitsi JWT (via existing `fetchJitsiToken`) instead of the guest JWT — so moderators enter with moderator rights.

### CloudFront / S3 Routing

`/m/*` must be routed to the S3 React bundle, same as all other SPA routes. Add `/m/*` to the CloudFront behavior that serves the S3 origin with the SPA fallback (return `index.html` for 404s under that prefix). The `src/pages/m/` page handles the hash client-side after load.

---

## D. Infrastructure (meet repo CDK)

- New DynamoDB table construct: `CdnScheduledMeetingsTable` — PAY_PER_REQUEST, point-in-time recovery enabled, KMS CMK for invitees encryption.
- GSI: `room_hash-index`.
- New Lambda constructs for each handler above.
- New API Gateway routes (HTTP API, same gateway as existing `/token/jitsi` and `/admin/users`):
  - `POST /admin/meetings`
  - `GET /admin/meetings`
  - `GET /admin/meetings/{meeting_id}`
  - `PUT /admin/meetings/{meeting_id}`
  - `DELETE /admin/meetings/{meeting_id}`
  - `GET /m/{hash}`
  - `POST /m/{hash}/token`
- EventBridge Scheduler: new `CfnScheduleGroup` (`cdn-meeting-prefires`). Per-meeting rules created/deleted by Lambda at runtime (not CDK-managed per rule).
- IAM: EventBridge Scheduler execution role with `lambda:InvokeFunction` on prefire Lambda.

---

## E. Security

**Hash generation:** `crypto.randomBytes(16).toString('hex')` = 32 hex chars = 128 bits entropy. Generated at create time, stored in DynamoDB, never regenerated unless explicitly rotated. Rotation policy: moderator can trigger hash rotation via edit form (generates new hash, old hash immediately invalidated — `status` on old hash record set to `cancelled`, new record created). Document in runbook.

**Guest JWT:** Minted only when meeting is within valid time window. Claims: `{ moderator: false, room: meeting_id, exp: min(meeting_end_epoch + 7200, now + 7200), features: { recording: false, livestreaming: false } }`. Signed with same Jitsi signing key as authenticated JWTs (SSM-backed).

**Pre-fire Lambda:** Invoked only by EventBridge Scheduler (no public API endpoint). Retrieves Jitsi signing key from SSM at invocation time. Mints a short-lived (5-min) moderator JWT for the internal warm-up call only. Does not return the JWT to any caller.

**Invitee PII:** Email addresses in `invitees` StringSet encrypted at rest via DynamoDB table KMS CMK. Not returned in `resolve-hash` public endpoint. Returned only to authenticated moderators via `get-scheduled`.

**Rate limiting:** `POST /m/{hash}/token` — API Gateway usage plan: 100 req/min per IP. Prevents guest JWT farming.

**CORS:** `/m/{hash}` and `/m/{hash}/token` allow `https://clouddelnorte.org` origin only.

---

## F. Acceptance Criteria

- **AC1:** Moderator creates a meeting scheduled 1hr in future. Meeting appears in `/admin/meetings` list with a copyable `/m/<hash>` URL. Hash is 32 hex chars.
- **AC2:** Non-moderator (members group) navigating to `/admin/meetings/index.html` sees the Cloudscape denial card (same pattern as #162). No table renders.
- **AC3:** Meeting created with `prefire_enabled=true`, `prefire_minutes_before=2`. At T-2min, EventBridge fires `prefire-lobby` Lambda. Jicofo participant list for the room shows a moderator presence within 30s of Lambda invocation.
- **AC4:** `/m/<hash>` URL loads in a browser with no Cognito session. Shows meeting title, scheduled start time, and a Join Call CTA. If current time < T-15min, CTA is disabled with countdown.
- **AC5:** At T+0 (within window), guest clicks Join Call on `/m/<hash>`. `POST /m/{hash}/token` returns a guest JWT. JitsiEmbed mounts. Moderator navigating to same URL with Cognito session enters with moderator rights.
- **AC6:** Moderator edits meeting, changes `scheduled_start` by +1hr. EventBridge rule is deleted and recreated with new fire time. Updated time reflected in list view and `/m/<hash>` page.
- **AC7:** Moderator deletes meeting. EventBridge rule deleted. `/m/<hash>` returns 404 / "no longer available". `GET /admin/meetings/{id}` returns 404.
- **AC8:** Nova Act harness (`scripts/nova-act/fp020-scheduled-meeting-e2e.py`) runs two browser sessions (moderator + guest). Moderator creates meeting, copies hash URL. Guest opens hash URL, joins call. Both sessions confirm `videoConferenceJoined` event fires. Screenshots uploaded to `s3://clouddelnorte.org/screenshots/nova-act/fp020-*.png`.

---

## G. Open Questions for Bryan

1. **Timezone display:** Show scheduled times in user's local timezone (browser `Intl`) or always UTC? Recommendation: local timezone with UTC offset shown in tooltip.
2. **Pre-fire default:** 2 minutes is the spec default. Is this enough for Jicofo/JVB cold start on your Jitsi instance, or should it be 5?
3. **Guest JWT duration:** Spec says `meeting_end + 2hr`. Is 2hr post-meeting the right window, or should it be shorter (e.g., 30min)?
4. **Invitee email notifications:** Spec assumes yes (SES, matching FP-019 pattern) — send invite email on create, update email on reschedule. Confirm before Sprint 2.
5. **Meeting-end behavior for hash URL:** Three options: (a) show "ended" message and expire hash after 30 days, (b) keep hash live as replay link if Jitsi recording exists, (c) redirect to a recording URL if one is stored. Which?
6. **Hash rotation UX:** Should moderators be able to rotate the hash (invalidate old shareable link) from the edit form? Spec includes it as optional — confirm priority.

---

## Sprint Decomposition

### Sprint 1 — Data + Backend Core (meet repo)
**Goal:** Scheduled meetings can be created, listed, and retrieved via API. No frontend yet.

- CDK: `cdn-scheduled-meetings` DynamoDB table + GSI + KMS CMK.
- Lambda: `create-scheduled`, `list-scheduled`, `get-scheduled`, `delete-scheduled`.
- API Gateway routes for the above.
- IAM for CRUD lambdas.
- Unit tests for each handler.
- No EventBridge, no guest token, no prefire yet.

**Exit:** `POST /admin/meetings` creates a record. `GET /admin/meetings` returns it. `DELETE` removes it. Verified via curl + AWS console.

---

### Sprint 2 — Admin Frontend (website repo)
**Goal:** Moderators can manage scheduled meetings from the admin UI.

- `src/pages/admin-meetings/` — list page with Cloudscape Table, tabs (Upcoming/Past), delete Modal.
- `src/pages/admin-meetings-new/` — create form (DatePicker, TimeInput, prefire checkbox).
- `src/pages/admin-meetings-edit/` — edit form (pre-populated).
- `src/lib/scheduled-meetings.ts` — CRUD wrappers.
- i18n keys in `en-US.json` + `es-MX.json`.
- Vite entry points + CloudFront routing for new pages.
- Tests: unit tests for lib, component tests for form validation.
- AC1 + AC2 verified.

**Exit:** Moderator can create/edit/delete a scheduled meeting from the browser. Hash URL shown in list.

---

### Sprint 3 — Public Hash Route + Guest Token (both repos)
**Goal:** External guests can reach a meeting via `/m/<hash>` and join.

- meet repo: `resolve-hash.ts` + `guest-token.ts` lambdas + API routes + rate limiting.
- website repo: `src/pages/m/` — public page with countdown, Join Call CTA, JitsiEmbed mount.
- CloudFront: `/m/*` behavior.
- Authenticated user path: use `fetchJitsiToken` instead of guest token.
- AC4 + AC5 verified.

**Exit:** Guest with no Cognito account can open `/m/<hash>`, see meeting info, and join at scheduled time.

---

### Sprint 4 — Pre-fire Lobby (meet repo)
**Goal:** Jitsi room is warm before guests arrive.

- CDK: EventBridge Scheduler group + execution role.
- `prefire-lobby.ts` Lambda.
- `create-scheduled` + `update-scheduled` + `delete-scheduled` extended to create/update/delete EventBridge Scheduler rules.
- IAM additions for scheduler.
- AC3 + AC6 + AC7 verified.

**Exit:** At T-2min, Jicofo shows moderator presence. Edit reschedules rule. Delete removes rule.

---

### Sprint 5 — Notifications + Nova Act E2E (both repos)
**Goal:** Invitees notified, end-to-end automated test passes.

- meet repo: SES invitee notification on create/update (FP-019 pattern). Confirm with Bryan on meeting-end behavior (G.4 + G.5 above).
- website repo: invitee email field in create/edit form.
- Nova Act harness: `scripts/nova-act/fp020-scheduled-meeting-e2e.py` — 2-user flow, screenshots to S3.
- AC8 verified.

**Exit:** AC1–AC8 all green. Nova Act harness exits 0.

---

*Spec produced by ghost-stratia-code-mapper. Next step: implementing agent writes Sprint 1 CDK + Lambda stubs in meet repo.*
