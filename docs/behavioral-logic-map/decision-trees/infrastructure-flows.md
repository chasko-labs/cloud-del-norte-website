# Logic Decision Tree — Infrastructure Flows (CDN-Specific)

> Flow ID: INFRA-01 through INFRA-04
> These flows are invisible to users but directly cause behavioral friction.
> They explain WHY certain friction points exist.

## INFRA-01: Jitsi ECS Scale-to-Zero

```
[F] Jitsi ECS service state (meet.clouddelnorte.org)
 |
 |  Architecture: ECS Fargate tasks behind NLB
 |  Account: 170473530355 (jitsi-video-hosting)
 |  Region: us-west-2
 |  Scale-to-zero: Tasks scale down to 0 when no active meetings
 |
 |--{tasks running > 0?}
 |    |
 |    |--YES (warm)--> Jitsi available immediately
 |    |                 external_api.js loads in 1-2s
 |    |                 iframe connects in 2-3s
 |    |                 USER EXPERIENCE: smooth, no delay
 |    |
 |    |--NO (cold / scaled to zero)--> ECS must provision new task
 |         |
 |         |  Cold-start sequence:
 |         |  1. NLB health check detects no healthy targets
 |         |  2. Auto-scaling policy triggers (or manual scale-up.pl)
 |         |  3. Fargate pulls container image
 |         |  4. Container starts Jitsi services (prosody, jicofo, jvb)
 |         |  5. NLB health check passes
 |         |  6. DNS resolves meet.clouddelnorte.org to NLB
 |         |
 |         |  Estimated cold-start time: 30-90 seconds
 |         |
 |         |--{user experience during cold-start:}
 |              |
 |              [ST] User clicks "Join" → modal opens
 |              [ST] "requesting access token…" (token-exchange succeeds — Lambda is always warm)
 |              [ST] "connecting to meeting…" (script load from meet.clouddelnorte.org)
 |              [ST] Script load HANGS — Jitsi server not ready
 |              |
 |              |--{script eventually loads (30-90s)?}
 |              |    |--YES--> Pre-join lobby appears (delayed but functional)
 |              |    |--NO (timeout)--> Blank iframe, no error message @gap
 |              |
 |              |  USER SEES: Extended spinner with no explanation
 |              |  USER THINKS: "Is it broken? Should I close and retry?"
 |              |  @friction FP-009 — no "meeting room is starting up" message
 |
 |--{Scale-up trigger:}
      |--First user attempts to join (reactive) — causes the cold-start delay
      |--Scheduled meeting time (proactive, if configured) — no delay for users
      |--Manual: scale-up.pl script (admin-initiated)
```

### Behavioral Impact of Scale-to-Zero

| Scenario | User Experience | Friction |
|----------|----------------|----------|
| Meeting scheduled, Jitsi pre-warmed | Join in 5s | None |
| Spontaneous call, Jitsi cold | 30-90s spinner, no explanation | S2 |
| Jitsi fails to start | Blank iframe forever | S1 (if no timeout/error) |
| User retries during cold-start | Second attempt may work (task now starting) | S3 |

---

## INFRA-02: Cognito Token Exchange (Token-to-JWT Pipeline)

```
[A] User clicks "Join" on a meeting
 |
 [F] Client-side token state (sessionStorage)
 |
 |--{ID token present + not expired?}
 |    |
 |    |--YES--> [A] POST /token/jitsi with Bearer <id-token>
 |    |          |
 |    |          |  API Gateway: rwmypxz9z6.execute-api.us-west-2.amazonaws.com
 |    |          |  Authorizer: JWT (validates Cognito token signature + expiry)
 |    |          |
 |    |          [F] Lambda: token-exchange
 |    |          |
 |    |          |  1. Extract cognito:groups from JWT claims
 |    |          |     Format: "[moderators members]" (space-delimited, bracket-wrapped)
 |    |          |     Parse: strip brackets, split on space/comma
 |    |          |
 |    |          |  2. Determine Jitsi role:
 |    |          |     groups.includes("moderators") → moderator: true
 |    |          |     groups.includes("members") → moderator: false
 |    |          |     neither → 403 Forbidden
 |    |          |
 |    |          |  3. Issue Jitsi JWT:
 |    |          |     { sub, room: roomName, moderator: bool, exp: 1h }
 |    |          |     Signed with Jitsi JWT secret (shared with prosody)
 |    |          |
 |    |          |  4. Return: { token, domain: "meet.clouddelnorte.org", expiresAt }
 |    |          |
 |    |          |--{200 OK}--> Client has Jitsi JWT → load embed
 |    |          |--{401}--> withRetry: refreshTokens() + retry once
 |    |          |--{403}--> "cannot join meeting" (no group or wrong group)
 |    |
 |    |--NO (expired)--> [A] refreshTokens() (REFRESH_TOKEN_AUTH)
 |         |--{refresh succeeds}--> Retry with new token
 |         |--{refresh fails}--> "not authenticated" error @gap SILENT_AUTH_FAILURE
 |
 |  NOTE: Token-exchange Lambda is always warm (no cold-start concern).
 |  The delay is in Jitsi server availability, not in token issuance.
```

### Token Lifecycle in a Single Session

```
Login:          ID token issued (1h expiry typical)
                Refresh token issued (30d expiry typical)
                Both stored in sessionStorage (tab-scoped)

During session: Timer fires at 80% of token lifetime
                refreshTokens() called silently
                New ID token replaces old in sessionStorage
                No user interaction required

Tab close:      sessionStorage cleared
                All tokens gone
                Next tab = full re-auth

Token used for: API calls (Authorization: Bearer <id-token>)
                Token exchange (Jitsi JWT issuance)
                AuthContext state (groups, isModerator, isMember)
```

---

## INFRA-03: Woodpecker CI Deploy Pipeline

```
[S] Code pushed to main branch
 |
 [A] Woodpecker CI triggers (.woodpecker/deploy.yml)
 |
 |  Pipeline steps:
 |  1. npm ci (install dependencies)
 |  2. npm run build (fetch-feeds + fetch-releases + fetch-next-meetup + tsc + 3 vite builds)
 |  3. aws s3 sync dist/ s3://clouddelnorte.org --delete --exclude "data/*"
 |  4. aws cloudfront create-invalidation (cache bust)
 |
 |  Targets: clouddelnorte.org, auth.clouddelnorte.org, awsug.clouddelnorte.org
 |  S3 bucket: clouddelnorte.org (account 211125425201, us-east-1)
 |  CloudFront: ECC3LP1BL2CZS
 |
 |--{deploy succeeds?}
 |    |
 |    |--YES--> New code live within 1-5 min (CloudFront invalidation)
 |    |          Verify: curl -sI https://clouddelnorte.org | grep last-modified
 |    |
 |    |--NO (build fails)--> 
 |         |--tsc errors (type check)
 |         |--vite build errors
 |         |--fetch-feeds network failure (external RSS)
 |         |--npm ci failure (dependency issue)
 |         |
 |         Site continues serving previous version (no downtime)
 |         @gap No notification to admin that deploy failed
```

### Behavioral Impact of Deploy Pipeline

| Scenario | User Experience | Notes |
|----------|----------------|-------|
| Normal deploy | Invisible — site updates in background | CloudFront serves stale until invalidation completes |
| Deploy during active session | User may see old UI until hard refresh | sessionStorage tokens unaffected |
| Deploy breaks auth flow | Users cannot log in until fixed | S1 — happened with qrcode.react missing (a3364086) |
| Deploy breaks meetings | Users cannot join calls | S1 — happened with token-exchange groups parsing |

---

## INFRA-04: Admin Approval Workflow

```
[S] New user completes signup + MFA setup
 |
 [ST] User state in Cognito:
      - Status: CONFIRMED
      - email_verified: true
      - MFA: configured (SOFTWARE_TOKEN)
      - cognito:groups: [] (empty)
 |
 [ST] User experience: "pending approval" on meetings, "moderator access required" on admin
 |
 |--{How does admin know someone is waiting?}
 |    |
 |    |--NO notification system exists
 |    |--Admin must manually check admin panel → "Pending" tab
 |    |--@gap No alert, no email, no badge count
 |
 [A] Admin opens admin panel → Pending tab
 [A] Admin clicks "Approve" on user row
 |
 [A] POST /admin/users/{sub}/approve { group: "members" }
 |    (or group: "moderators" for direct promotion)
 |
 [ST] Cognito AdminAddUserToGroup executed server-side
 |    User is now in "members" (or "moderators") group
 |
 |--{User experience after approval:}
 |    |
 |    |--{User currently has a tab open?}
 |    |    |--Token in sessionStorage still has groups: []
 |    |    |--Silent refresh will get new token WITH group on next refresh cycle
 |    |    |--BUT: refresh timer may not fire for up to (token_lifetime * 0.8) seconds
 |    |    |--WORST CASE: user must wait up to ~48 min for auto-refresh
 |    |    |--OR: close tab + re-open (forces full re-auth with fresh token)
 |    |    |--@gap STALE_TOKEN_GROUPS
 |    |
 |    |--{User closed tab / not active?}
 |         |--Next login will get fresh token with group
 |         |--No notification that they've been approved
 |         |--User must decide to return on their own
 |         |--@gap No "you've been approved!" email or push notification
```

### Approval Timeline (Worst Case)

```
User signs up:           T+0
User completes MFA:      T+5 min
User sees "pending":     T+5 min (immediate)
Admin checks panel:      T+??? (no notification — could be hours/days)
Admin approves:          T+???
User's token refreshes:  T+??? + up to 48 min (or re-login)
User can join calls:     T+??? + 48 min (worst case without re-login)
```

> The entire approval flow depends on out-of-band communication.
> There is no in-app mechanism to notify either party.
