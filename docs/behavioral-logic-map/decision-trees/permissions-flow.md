# Logic Decision Tree — Permissions Flow

> Flow ID: PERM-01 through PERM-04
> Roles affected: All
> Technology: cognito:groups claim in JWT, API Gateway JWT authorizer, Lambda group checks, client-side AuthContext
> CONFIRMED: No auto-assignment. Admin approval required. Nav is role-blind.

## PERM-01: Client-Side Permission Check

```
[F] User attempts to access a feature
 |
 [F] AuthContext reads cognito:groups from ID token in sessionStorage
 |    groups = Array.isArray(groupsClaim) ? groupsClaim : []
 |    isModerator = groups.includes("moderators")
 |    isMember = groups.includes("members")
 |
 |--{feature: meetings page}
 |    |--{isMember || isModerator?}
 |         |--YES--> [ST] Meetings table with Join buttons
 |         |--NO---> [ST] "your application is pending approval. meetings are available once approved."
 |
 |--{feature: admin page}
 |    |--{isModerator?}
 |         |--YES--> [ST] Admin table (pending / members / banned tabs)
 |         |--NO---> [ST] "Admin access requires member approval. Your application is still pending."
 |                    NOTE: This message says "member approval" even for Members (confusing wording)
 |                    @gap — Members see a message about "member approval" when it's actually "moderator access"
 |
 |--{feature: join call}
 |    |--{authenticated?}
 |         |--YES--> fetchJitsiToken() sends ID token to server
 |         |         Server checks groups → issues JWT or rejects
 |         |--NO---> "not authenticated" error in embed
 |
 |--{feature: create meeting}
 |    |--{isModerator?}
 |         |--YES--> Create meeting form/button visible
 |         |--NO---> Button hidden (correct — no PHANTOM_NAVIGATION here)
 |
 |  TOKEN REFRESH: Silent, proactive (20% remaining threshold, min 30s)
 |  On expiry: refreshTokens() via REFRESH_TOKEN_AUTH
 |  On failure: No prompt. Next API call returns 401. withRetry() retries once.
 |  If retry fails: Error thrown, displayed as alert. No re-login modal.
 |  @gap SILENT_AUTH_FAILURE
```

## PERM-02: API-Side Permission Check

```
[A] Client makes API request with Authorization: Bearer <idToken>
 |
 [G] API Gateway JWT Authorizer validates token signature + expiry
 |
 |--{token invalid/expired?}
 |    |--[ST] 401 Unauthorized
 |    |  Client behavior: withRetry() calls refreshTokens(), retries once
 |    |  |--{retry succeeds}--> Normal flow
 |    |  |--{retry fails}--> Error thrown, shown as alert
 |    |                       No re-login redirect. @gap SILENT_AUTH_FAILURE
 |
 |--{token valid}--> [F] Lambda reads cognito:groups from JWT claims
 |                    NOTE: HTTP API v2 serializes groups as space-delimited bracket-wrapped:
 |                    "[moderators members]" — Lambda must parse this format
 |
 |    |--{endpoint: /admin/users/*}
 |    |    |--{groups includes "moderators"?}
 |    |         |--YES--> 200 + data
 |    |         |--NO---> 403 Forbidden
 |    |                    Client shows error alert (not a specific "no permission" message)
 |    |
 |    |--{endpoint: /meetings/create}
 |    |    |--{groups includes "moderators"?}
 |    |         |--YES--> 200 + meeting created
 |    |         |--NO---> 403 Forbidden
 |    |
 |    |--{endpoint: /token/jitsi}
 |    |    |--{groups includes "members" OR "moderators"?}
 |    |         |--YES--> 200 + Jitsi JWT (with moderator:true/false based on group)
 |    |         |--NO---> 403 Forbidden
 |    |                    Client shows "cannot join meeting" in modal
```

## PERM-03: Role Transition (Group Assignment)

```
[S] New user completes signup + MFA setup
 |
 [ST] User is authenticated. cognito:groups = [] (empty array)
 |    isMember = false, isModerator = false
 |
 [F] What can they access?
 |
 |--Public pages (home, about, roadmap, plans, radio): FULL ACCESS
 |--Meetings page: Shows "pending approval" message (no Join buttons)
 |--Admin page: Shows "moderator access required" alert
 |--Join call: fetchJitsiToken() → server returns 403 (no group)
 |--Create meeting: Button hidden (isModerator check)
 |
 [ST] User is in GROUP_ASSIGNMENT_LIMBO
 |    They can browse public content but cannot participate.
 |    They see the full nav (including admin!) but most features show denial messages.
 |
 |--{How do they get approved?}
 |    |
 |    [A] Admin (moderator) opens admin panel → "Pending" tab
 |    [A] Admin clicks "Approve" on the user
 |    [A] approveUser(sub, "members") → POST /admin/users/{sub}/approve
 |    [ST] User is now in "members" group
 |    
 |    BUT: User must LOG OUT and LOG BACK IN to get a new token with the group claim.
 |    Their current sessionStorage token still has groups: [].
 |    @gap — No notification that they've been approved. No token refresh triggers group update.
 |    
 |    |--{user refreshes page or re-logs in?}
 |         |--YES--> New token has groups: ["members"] → full access
 |         |--NO---> Still sees "pending" messages despite being approved
 |                   @gap STALE_TOKEN_GROUPS
```

## PERM-04: Permission Escalation

```
[S] Member wants to perform Admin action
 |
 |--{Create meeting button}
 |    --> Hidden (isModerator check in component) ✓ CORRECT
 |    --> Member never sees it
 |
 |--{Admin page via nav}
 |    --> Nav item VISIBLE (no auth check in nav component) @gap PHANTOM_NAVIGATION
 |    --> Click → page loads → inline "moderator access required" alert
 |    --> No redirect, no explanation of how to become admin
 |    --> No "request access" button or contact info
 |    @friction — dead end with no guidance
 |
 |--{Admin API via direct URL/curl}
 |    --> 403 from server (JWT lacks moderators group)
 |    --> Correctly blocked at API level ✓
 |
 |--{Upgrade path?}
 |    --> NO self-service path exists
 |    --> An existing moderator must approve via admin panel
 |    --> approveUser(sub, "moderators") — can promote directly to moderator
 |    --> No UI for requesting promotion. No notification system.
```

## Permission Matrix (Confirmed)

| Feature | Guest (no auth) | Pending (auth, no group) | Member | Admin |
|---------|----------------|--------------------------|--------|-------|
| Public pages | ✓ | ✓ | ✓ | ✓ |
| Radio/podcast player | ✓ | ✓ | ✓ | ✓ |
| View meetings list | Redirect to login | "pending approval" | ✓ | ✓ |
| Join a call | Redirect to login | 403 from token API | ✓ (participant) | ✓ (moderator) |
| Create a meeting | Redirect to login | Hidden | Hidden | ✓ |
| Admin panel | Redirect to login | "moderator access required" | "moderator access required" | ✓ |
| Approve users | N/A | N/A | N/A | ✓ |
| See "admin" in nav | ✓ (visible) | ✓ (visible) | ✓ (visible) | ✓ (visible) |

## Client vs API Permission Sync (Confirmed)

| Feature | Client Gating | API Gating | In Sync? |
|---------|--------------|------------|----------|
| Create Meeting | isModerator check (button hidden) | moderators group in Lambda | ✓ Synced |
| Admin Panel | RequireAuth requireGroup="moderators" (inline alert) | moderators group in Lambda | ✓ Synced |
| Join Call | No client gate (relies on token API) | members OR moderators in Lambda | ✓ Synced |
| Nav visibility | NO gating (all items shown) | N/A (nav is client-only) | ✗ PHANTOM_NAVIGATION |

## Confirmed Friction Points

| ID | Node | Description | Severity | Status |
|----|------|-------------|----------|--------|
| FP-PERM-01 | PERM-03 | No auto-group-assignment — admin approval required, no ETA given | S2 | **Confirmed** |
| FP-PERM-02 | PERM-03 | STALE_TOKEN_GROUPS — approved user must re-login to see new permissions | S2 | **Confirmed** |
| FP-PERM-03 | PERM-01 | SILENT_AUTH_FAILURE — token expires, no re-auth prompt | S2 | **Confirmed** |
| FP-PERM-04 | PERM-04 | No "request access" path, no contact info on denial page | S3 | **Confirmed** |
| FP-PERM-05 | PERM-01 | PHANTOM_NAVIGATION — admin nav item visible to all roles | S2 | **Confirmed** |
| FP-PERM-06 | PERM-01 | Confusing denial message: "member approval" when it means "moderator access" | S3 | **Confirmed** |
