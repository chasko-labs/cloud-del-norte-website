# User Mental Model — Admin (Moderator)

> cognito:groups = ["moderators"] | Full access | System-oriented behavior
> Can: create meetings, manage users (approve/ban), join calls as Jitsi moderator
> Admin panel: /admin/ — three tabs: pending, members, banned

## Identity

- **Who they are:** Community organizer (Bryan or designated co-organizer)
- **Technical comfort:** High (AWS professional, comfortable with dashboards)
- **Session frequency:** Multiple times per week
- **Device profile:** Desktop primary (admin tasks + hosting calls)

## Expectations vs Reality (Confirmed)

| Touchpoint | Admin Expects | Actual Behavior | Gap |
|------------|--------------|-----------------|-----|
| Login | Quick re-auth, maybe skip MFA on known device | Full MFA every time (no remember-device) | S3 — acceptable for admin |
| Dashboard | Overview of pending users, upcoming meetings | No dashboard — must navigate to admin panel manually | S3 |
| Create Meeting | Simple form → meeting exists | Create meeting form (moderator-gated, button hidden for others ✓) | Minor |
| Manage Users | See pending, approve, ban | Admin panel with 3 tabs (pending/members/banned) ✓ | None |
| Join Call | One click → in as host | Click Join → modal → token (moderator:true) → pre-join → host controls | Acceptable |
| View Costs | Transparent billing | Costs page hidden from prod nav (dev-only) | S4 — intentional |
| Approve user | Approve → they're in immediately | Approve → user must re-login to get new token | S2 — STALE_TOKEN_GROUPS |

## Knowledge Assumptions (Confirmed)

- [✓] "I can manage users from the admin panel" — Yes, 3 tabs: pending/members/banned
- [✓] "My role gives me all permissions" — Yes, moderators group grants full access
- [✓] "I can see everything a Member sees, plus more" — Correct
- [✗] "Approving a user gives them immediate access" — They must re-login for new token
- [✓] "I'm the host/moderator in Jitsi calls" — Yes, JWT has moderator:true
- [✗] "I can promote someone to moderator from the admin panel" — Can, but no UI confirmation of the distinction (approveUser defaults to "members")

## Common Misconceptions (Confirmed)

| # | Misconception | Actual Behavior | Severity | Flow |
|---|--------------|-----------------|----------|------|
| 1 | "Approving a user = they can join immediately" | User must re-login to get updated token | S2 | Permissions |
| 2 | "I can skip MFA on my regular laptop" | No remember-device, MFA every session | S3 | Auth |
| 3 | "There's a dashboard showing activity" | No dashboard — admin panel is user management only | S3 | Navigation |
| 4 | "I can see who's online / in a call" | No presence system exists | S4 | Meetings |
| 5 | "Costs page shows me the bill" | Hidden from prod nav (dev-only, e4e9a55e) | S4 | Navigation |

## Behavioral Patterns (CDN-Specific)

- **Primary loop:** Login → Admin panel (check pending) → Approve users → Create meeting → Host call
- **Hosting loop:** Login → Meetings → Create meeting → Share link → Join as host → Moderate
- **Monitoring pattern:** Check admin panel for pending users (no notification when someone signs up)
- **Frustration pattern:** Approves user → user reports "still can't join" → must tell them to re-login

## Path Priorities (ordered by frequency)

1. Check for pending user approvals (admin panel)
2. Create a meeting for the community
3. Join/host a meeting as moderator
4. Approve new members
5. Troubleshoot member access issues (usually: "re-login")

## Emotional Arc (CDN-Specific)

| Phase | Emotion | CDN Design Response |
|-------|---------|---------------------|
| Login | Impatient — "let me manage things" | MFA required, no shortcut |
| Admin panel | Confident — "I'm in control" | Clean 3-tab interface (pending/members/banned) |
| Approving users | Purposeful — "growing the community" | One-click approve, defaults to "members" group |
| User reports "still pending" | Confused → Realizes | Must tell user to re-login (STALE_TOKEN_GROUPS) |
| Hosting a call | Authoritative — "I'm running this" | Jitsi moderator controls (mute, kick, end) |
| Looking for costs | Curious → Blocked | Nav item hidden (dev-only) |

## Admin-Specific Gaps

1. **No notification of new signups** — must manually check admin panel
2. **No "force token refresh" for approved users** — they must re-login themselves
3. **No distinction in UI between approving as member vs moderator** — `approveUser()` defaults to "members", promoting to "moderators" requires knowing to pass the parameter
4. **No activity log** — can't see who joined which call, when
5. **No way to message pending users** — can't tell them "you're approved, please re-login"
