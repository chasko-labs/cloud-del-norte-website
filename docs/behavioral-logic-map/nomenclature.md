# Nomenclature — Behavioral Logic Map

Official vocabulary for all behavioral logic map documents. Use these terms consistently.

## Path Types

| Term | Definition |
|------|-----------|
| Happy Path | Intended flow — no errors, no confusion, user achieves goal |
| Exception Path | User makes a recoverable mistake — system guides back |
| Fault Path | System fails — user must recover or retry |
| Abandonment Path | User gives up and leaves the flow entirely |
| Shortcut Path | User skips intended steps (bookmark, direct URL, back button) |

## Decision Node Types

| Node | Symbol | Definition |
|------|--------|-----------|
| START | `[S]` | Entry point to a flow |
| GATE | `[G]` | System-enforced checkpoint (auth, permission, validation) |
| BRANCH | `[B]` | User makes a conscious choice between options |
| FORK | `[F]` | System routes automatically based on state |
| ACTION | `[A]` | User performs a task (click, type, submit) |
| STATE | `[ST]` | System displays information or feedback |
| END | `[E]` | Terminal node — success, failure, or abandonment |

## Edge Notation

```
[NodeID] --{condition}--> [NodeID]
[NodeID] --{condition}--X [NodeID]   (blocked path)
[NodeID] --{condition}--? [NodeID]   (ambiguous/untested path)
```

## Annotation Tags

| Tag | Meaning |
|-----|---------|
| `@friction` | Known friction point at this node |
| `@gap` | Mental model gap identified |
| `@nudge` | Design nudge present |
| `@risk` | Abandonment risk |
| `@a11y` | Accessibility concern |
| `@dark-pattern` | Accidental deceptive pattern |

## Behavioral Markers

| Marker | Definition | CDN Example |
|--------|-----------|-------------|
| Mental Model Gap | User expects X, system does Y | "I signed up, why can't I join?" (no auto-group) |
| Friction Point | Interaction that slows, confuses, or frustrates | MFA setup with no help text |
| Permission Cliff | Sudden capability loss without explanation | Pending user clicks Join → "cannot join meeting" |
| Silent Failure | System fails without user-visible feedback | Token expires, next API call errors with no prompt |
| Trust Erosion | User loses confidence in the system | "Sign in with passkey" in English during Spanish mode |
| Reflexive Block | User instinctively denies a permission prompt | Camera/mic prompt in Jitsi pre-join |
| Abandonment Trigger | The specific moment a user decides to leave | MFA_SETUP screen with no explanation |
| Stale State | Client state doesn't reflect server reality | Approved user's token still has groups:[] |

## Stack-Specific Terms

| Term | Definition | Source File |
|------|-----------|-------------|
| Cognito Gate | Auth checkpoint — email + password + SOFTWARE_TOKEN MFA | src/lib/cognito.ts |
| Group Fork | Routing based on cognito:groups claim (moderators/members/empty) | src/contexts/auth-context.tsx |
| TOTP Challenge | 6-digit code from authenticator app, 30s window | src/sites/auth/login/app.tsx |
| Jitsi Embed | iframe injected by JitsiMeetExternalAPI into Cloudscape Modal | src/pages/meetings/components/jitsi-embed.tsx |
| Token Exchange | Lambda converts Cognito ID token → Jitsi JWT with role | src/lib/jitsi-token.ts → /token/jitsi |
| AppLayout Shell | Cloudscape responsive layout (nav drawer, content, tools) | src/layouts/shell/index.tsx |
| Silent Refresh | Proactive token renewal at 20% remaining lifetime | src/contexts/auth-context.tsx |
| withRetry | API call pattern: on 401, refresh token, retry once | src/lib/admin.ts |
| requireAuth | Page-level guard: no token → redirect to login with returnTo | src/sites/awsug/_shared/auth.ts |
| RequireAuth | Component-level guard: wrong group → inline denial alert | src/pages/admin/app.tsx |
| ECS Cold-Start | Jitsi Fargate tasks at zero → 30-90s provision time | Infrastructure (170473530355) |
| Pre-Join Lobby | Jitsi native device preview before entering call | configOverwrite.prejoinPageEnabled:true |

## Severity Scale (Friction Points)

| Level | Label | Definition |
|-------|-------|-----------|
| S1 | Critical | User cannot complete their goal — flow is broken |
| S2 | High | User can complete goal but with significant confusion/delay |
| S3 | Medium | User notices friction but recovers without help |
| S4 | Low | Minor annoyance, no impact on task completion |

## Transition Verbs

Use these when describing edges between nodes:
- navigates, clicks, submits, selects, dismisses, ignores
- redirects, challenges, grants, denies, expires, refreshes
- abandons, retries, escalates, downgrades, bypasses

## Anti-Pattern Catalog

| ID | Name | Description | CDN Status |
|----|------|-------------|------------|
| AP-01 | PHANTOM_NAVIGATION | "Admin" nav item visible to all roles, denied at page level | **Confirmed** — src/components/navigation/index.tsx has no auth check |
| AP-02 | MFA_HOSTAGE | MFA setup has no escape, no help text, no app store links | **Confirmed** — src/sites/auth/login/app.tsx MFA_SETUP block |
| AP-03 | SILENT_AUTH_FAILURE | Token expires, withRetry fails, error shown but no re-login prompt | **Confirmed** — no "session expired" modal exists |
| AP-04 | PERMISSION_CLIFF | Authenticated user with no group gets 403 with no explanation | **Confirmed** — "cannot join meeting" with no context |
| AP-05 | GROUP_ASSIGNMENT_LIMBO | New user has no group, must wait for manual admin approval | **Confirmed** — no auto-assignment, no ETA shown |
| AP-06 | STALE_TOKEN_GROUPS | Approved user's sessionStorage token still has groups:[] until re-login or refresh cycle | **Confirmed** — up to 48 min delay |
| AP-07 | COLD_START_SILENCE | ECS scale-from-zero adds 30-90s with no user-facing explanation | **Confirmed** (architecture) — no "warming up" message |
| AP-08 | APPROVAL_BLACK_HOLE | No notification to admin of new signups, no notification to user of approval | **Confirmed** — entirely manual, out-of-band |
| AP-09 | UNTRANSLATED_AFFORDANCE | "sign in with passkey" hardcoded English, bypasses i18n system | **Confirmed** — src/sites/auth/login/app.tsx |
| AP-10 | MISLEADING_DENIAL | Admin page shows "member approval" message when it means "moderator access required" | **Confirmed** — confusing copy |
