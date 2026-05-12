# FP-019 Design: Admin Force-Refresh & Approval Notification Tool

**Status:** Shipped 2026-05-12 — SES welcome email on group-add live (SEND_APPROVAL_EMAIL=true, cloud-del-norte-meet a6970d2)
**Sprint:** S3
**Author:** ghost-stratia-code-mapper
**Date:** 2026-05-11
**Mitigation already shipped:** 185c785b (silent 60s token poll on awsug subdomain)

---

## 1. User Stories

**US-1 — Verification**
As an admin, after I approve a pending user via the admin panel, I want confirmation that the approval landed and the user's token has re-synced to the `members` group, so I don't have to check the Cognito console manually.

**US-2 — Notification**
As an admin, I want to send a one-line welcome message to the newly approved user without leaving the admin panel or switching to email/chat.

**US-3 — Closed-tab edge case**
As an approved user who closed the browser tab before the 60s poll fired, I want to receive an email notification so I know to log back in and access the community.

---

## 2. Architecture Options

### Option A — SES email on group-add (backend only, no new admin UI)

**Mechanism:**
Extend the `admin-update-user` Lambda (external dependency — lives in `cloud-del-norte-meet` repo, AWS account `170473530355`) to call `SES.SendEmail` immediately after a successful `AdminAddUserToGroup` call. Uses the existing SES identity `clouddelnorte.org` (pending DKIM verification).

**Flow:**
```
Admin clicks Approve
  → POST /admin/users/{sub}/approve
  → Lambda: AdminAddUserToGroup(sub, "members")
  → Lambda: SES.SendEmail(to: user.email, template: approval-welcome)
  → Lambda returns { ok: true, user: { groups: ["members"], ... } }
  → Admin panel shows success toast (already exists)
```

**Pros:**
- Lowest complexity — one Lambda change, no new infrastructure
- Solves US-2 (user notification) and US-3 (closed-tab edge case) directly
- SES identity already provisioned; just needs DKIM to verify
- No new admin UI surface required
- Rollback is a single env-var feature flag on the Lambda

**Cons:**
- One-way: admin gets no in-panel confirmation that the user *received* or *re-synced* (US-1 partially unmet)
- SES send failure is silent to admin unless Lambda surfaces it in the response
- Requires cross-repo coordination (cloud-del-norte-meet)

---

### Option B — WebSocket / SSE for real-time sync status

**Mechanism:**
New API Gateway WebSocket endpoint (`/admin/events`). On `AdminAddUserToGroup` success, Lambda pushes a `user.synced` event to the admin's open connection. Admin panel displays a "✓ synced" badge per user row.

**Pros:**
- Fully solves US-1 (real-time admin confirmation)
- Clean UX — no polling, instant feedback

**Cons:**
- High infrastructure complexity: WebSocket API Gateway, connection management, DynamoDB connection table, auth re-wire for persistent connections
- Overkill: the 60s poll already covers the happy path; this adds ~3 weeks of infra work to solve a 60s UX gap
- Does not solve US-3 (closed-tab user notification) without also adding SES

---

### Option C — Admin-side polling for group sync confirmation

**Mechanism:**
After admin approves a user, the admin panel starts polling `GET /admin/users?filter=members` every 30s and shows an "approval in progress" badge until the user appears in the members list.

**Pros:**
- No backend changes
- Partially solves US-1 (admin sees when user appears in members list)

**Cons:**
- Polling-heavy; adds unnecessary API calls
- Does not solve US-2 or US-3 (no user notification path)
- Redundant with the existing 60s client-side poll already shipped

---

## 3. Recommendation: Option A

**Rationale:**

The 60s silent poll (shipped 185c785b) already handles the happy path — approved users with an open tab get unblocked automatically. What remains is:

1. Notifying users who closed the tab (US-3) — email is the only viable channel
2. Giving admins lightweight confirmation (US-1) — the Lambda response already returns `{ ok: true, user: { groups: ["members"] } }`; surfacing the user's email in the existing success toast is sufficient
3. Sending a welcome message (US-2) — email covers this without new UI

Option B solves US-1 elegantly but at 10× the implementation cost for a problem that is already 80% solved. Option C adds polling without solving the notification gap.

Option A + a minor admin UI tweak (show user email in the success toast) covers all three user stories with one Lambda change and one locale key addition.

---

## 4. Implementation Breakdown (Option A)

### 4.1 Files to touch

**External repo: `cloud-del-norte-meet` (account 170473530355)**
> ⚠️ `admin-update-user` Lambda was NOT found in `cloud-del-norte-website`. It is an external dependency.

- `lambdas/admin-update-user/handler.js` — add SES call after `AdminAddUserToGroup` success
- `lambdas/admin-update-user/templates/approval-welcome-en-US.txt` — new email template
- `lambdas/admin-update-user/templates/approval-welcome-es-MX.txt` — new email template
- `infra/iam/admin-update-user-policy.json` — add `ses:SendEmail` permission

**This repo: `cloud-del-norte-website`**
- `src/locales/en-US.json` — add `admin.approveSuccess` key
- `src/locales/es-MX.json` — add `admin.approveSuccess` key
- `src/sites/awsug/admin/app.tsx` — update success toast to display approved user's email (uses existing `ApproveUserResponse.user.email`)

### 4.2 Locale keys needed

```json
// en-US.json — under adminPanel namespace
"approveSuccess": "{{email}} approved and notified by email.",
"approveSuccessNoEmail": "User approved. Email notification unavailable."
```

```json
// es-MX.json
"approveSuccess": "{{email}} aprobado/a y notificado/a por correo.",
"approveSuccessNoEmail": "Usuario aprobado. Notificación por correo no disponible."
```

### 4.3 SES email templates

**Subject (en-US):** `You're approved — welcome to AWS UG Cloud Del Norte`
**Subject (es-MX):** `Estás aprobado/a — bienvenido/a a AWS UG Cloud Del Norte`

**Body (en-US, plain text):**
```
Hi,

Your request to join the AWS User Group Cloud Del Norte has been approved.

You can now log in at https://clouddelnorte.org/awsug/ to access the community.

Welcome!
— The AWS UG Cloud Del Norte Team
```

**Body (es-MX, plain text):**
```
Hola,

Tu solicitud para unirte al AWS User Group Cloud Del Norte ha sido aprobada.

Ya puedes iniciar sesión en https://clouddelnorte.org/awsug/ para acceder a la comunidad.

¡Bienvenido/a!
— El equipo de AWS UG Cloud Del Norte
```

**From:** `noreply@clouddelnorte.org`
**Reply-To:** omit (no-reply)

### 4.4 AWS IAM policy changes

Add to the `admin-update-user` Lambda execution role:

```json
{
  "Effect": "Allow",
  "Action": ["ses:SendEmail", "ses:SendRawEmail"],
  "Resource": "arn:aws:ses:us-west-2:170473530355:identity/clouddelnorte.org"
}
```

Prerequisite: SES identity `clouddelnorte.org` must have DKIM verified before deployment.
Verify: `aws ses get-identity-verification-attributes --identities clouddelnorte.org`

### 4.5 Deployment order

1. **Verify SES DKIM** — confirm `clouddelnorte.org` identity is verified in us-west-2. Block on this.
2. **Deploy Lambda + IAM** (`cloud-del-norte-meet`) — add SES call behind `SEND_APPROVAL_EMAIL=true` env-var feature flag. Default `false` in staging.
3. **Deploy UI locale + toast change** (`cloud-del-norte-website`) — independent; can ship in parallel.
4. **Smoke test** — approve a test user in staging, confirm email arrives, confirm toast shows email.
5. **Flip feature flag** to `true` in prod.

### 4.6 Rollback plan

- Set `SEND_APPROVAL_EMAIL=false` on the Lambda env var — SES call is skipped, approval flow continues unaffected.
- No data migration required; SES sends are fire-and-forget.
- Lambda must catch `SES.SendEmail` errors and log them without failing the approval response. `ok: true` must not be gated on email delivery success.

---

## 5. Testable Acceptance Criteria

| # | Criterion | How to verify |
|---|-----------|---------------|
| AC-1 | Approving a pending user triggers a SES email to that user's Cognito email address | Check SES send metrics + test inbox in staging |
| AC-2 | Email arrives with correct subject and body in en-US | Manual test with en-US locale user |
| AC-3 | Email arrives with correct subject and body in es-MX | Manual test with es-MX locale user |
| AC-4 | Admin panel success toast displays the approved user's email address | UI smoke test |
| AC-5 | SES send failure does NOT fail the approval — user is still added to `members` group | Mock SES failure in staging Lambda, confirm approval still returns `ok: true` |
| AC-6 | Setting `SEND_APPROVAL_EMAIL=false` skips email send entirely | Toggle flag, approve user, confirm no SES call in CloudWatch logs |
| AC-7 | User who closed the tab before 60s poll receives email and can log back in | End-to-end: approve user, close tab, check email, re-login |

> **Note on locale detection:** Lambda does not currently have access to user's preferred locale. For v1, send en-US only. Follow-up: add `custom:locale` Cognito attribute at registration to drive bilingual sends.

---

## 6. Estimated Dispatch Plan

### Dispatches required: 3 (2 parallel, 1 sequential)

```
Dispatch 0 (manual — Bryan):
  Verify SES DKIM for clouddelnorte.org in us-west-2 console.
  Unblocks Dispatch 1.

Dispatch 1a (parallel — cloud-del-norte-meet repo):
  Agent: ghost-impl-lambda
  Task: Extend admin-update-user Lambda — SES.SendEmail + feature flag + IAM policy + email templates
  Files: lambdas/admin-update-user/handler, infra/iam policy, templates/
  Depends on: Dispatch 0 (DKIM verified)

Dispatch 1b (parallel — this repo):
  Agent: ghost-solan-rust-coder
  Task: Update admin panel success toast to show approved user email; add locale keys
  Files: src/locales/en-US.json, src/locales/es-MX.json, src/sites/awsug/admin/app.tsx
  Depends on: nothing (UI change is independent)

Dispatch 2 (sequential — after 1a + 1b):
  Agent: ghost-liora-headless-verifier or Bryan manual
  Task: Smoke test staging, flip SEND_APPROVAL_EMAIL=true in prod
  Depends on: Dispatch 1a deployed to staging
```

**Total agent dispatches:** 2 (1a and 1b run in parallel)
**Estimated sessions:** 1 session for 1b (small UI change), 1 session for 1a (Lambda + IAM)
