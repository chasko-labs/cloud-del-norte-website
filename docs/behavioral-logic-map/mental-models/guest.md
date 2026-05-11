# User Mental Model — Guest (Logged-Out)

> cognito:groups = (none) | Read-only + public content | Discovery-oriented behavior
> Auth subdomain: auth.clouddelnorte.org | Main site: clouddelnorte.org

## Identity

- **Who they are:** Potential member, curious visitor, someone who received a meeting link
- **Technical comfort:** Variable (could be anyone — AWS community skews technical)
- **Session frequency:** One-time or rare (evaluating whether to join)
- **Device profile:** Unknown — any device, any browser

## Expectations vs Reality (Confirmed)

| Touchpoint | Guest Expects | Actual Behavior | Gap |
|------------|--------------|-----------------|-----|
| Landing Page | Understand what this is quickly | Radio/podcast player, dune scene, community content | Minor — creative but clear |
| Navigation | See what's available, what requires login | ALL nav items visible including "admin" | PHANTOM_NAVIGATION |
| Meeting Link (shared) | Click → join the call | Must create account + MFA + wait for admin approval | S1 — massive friction |
| Sign Up | Email + password → done | Email + password + email verify + MFA setup (authenticator app) | S1 — unexpected complexity |
| MFA Setup | (doesn't expect this) | Must install authenticator app, scan QR, enter code | S1 — no help provided |
| After Signup | Immediate access | GROUP_ASSIGNMENT_LIMBO — "pending approval" | S2 — no ETA, no notification |
| Content | Browse freely | Public pages work. Meetings/admin show denial messages. | S3 — confusing mixed signals |
| Radio/Podcast | Listen without logging in | Works — player is public | ✓ No gap |

## Knowledge Assumptions (Confirmed)

- [✗] "I can join a meeting without an account" — **No guest join path exists**
- [✗] "Signing up is just email and password" — **MFA setup mandatory, no skip**
- [✗] "I know what an authenticator app is" — **No explanation provided, no install links**
- [✓] "I can see what I'm signing up for before committing" — **Public content is browsable**
- [✗] "If someone shared a link, I can use it immediately" — **Full auth + approval required**
- [✗] "Once I sign up, I can participate" — **Must wait for admin approval (no ETA)**

## Common Misconceptions (Confirmed)

| # | Misconception | Actual Behavior | Severity | Flow |
|---|--------------|-----------------|----------|------|
| 1 | "I can join the call from this link" | Must create account + MFA + get approved first | S1 | Join Call |
| 2 | "Sign up is quick (< 1 minute)" | Account + email verify + MFA setup = 3-5 min, then wait for approval | S1 | Auth |
| 3 | "I don't need to install anything" | Must install authenticator app (Google Authenticator, Authy, etc.) | S1 | Auth |
| 4 | "Once I sign up I'm in" | GROUP_ASSIGNMENT_LIMBO — must wait for admin to approve | S2 | Permissions |
| 5 | "If I can see 'admin' in the nav, maybe I have access" | Inline denial alert, not a permission | S3 | Navigation |

## Behavioral Patterns (CDN-Specific)

- **Discovery pattern:** Land → Hear radio → Scan nav → Decide (10 second window)
- **Shared link pattern:** Click meeting link → Hit auth wall → Evaluate effort → Likely abandon
- **Comparison pattern:** "This requires an authenticator app? Zoom/Discord/Meet don't..."
- **Trust evaluation:** "clouddelnorte.org — is this legitimate? Why enterprise-grade auth for a community?"
- **Abandonment triggers (in order):**
  1. MFA requirement revealed (authenticator app)
  2. No explanation of what authenticator app is
  3. Approval wait after completing signup
  4. No notification when approved

## Path Priorities (ordered by likelihood)

1. Understand what Cloud Del Norte is (radio, community, AWS user group)
2. Listen to radio/podcast (works without auth ✓)
3. Decide whether to create an account
4. Complete signup (if they decide yes) — 3-5 min
5. Wait for admin approval (unknown duration)
6. Join their first meeting/call (only after approval)

## Emotional Arc (CDN-Specific)

| Phase | Emotion | CDN Design Response |
|-------|---------|---------------------|
| Landing | Curious — "what is this?" | Dune scene + radio player (atmospheric, inviting) |
| Exploring | Evaluating — "is this for me?" | Public content browsable, AWS community signals |
| Clicking "Meetings" | Interested — "I want to join" | Redirected to login (returnTo preserved ✓) |
| Seeing MFA requirement | Confused → Resistant | No help text, no explanation, just QR code |
| Installing authenticator | Frustrated — "this is too much work" | Only affordance: otpauth:// deep link |
| Completing signup | Relieved — "finally done" | Immediately hit with "pending approval" |
| Waiting for approval | Confused → Forgotten — "did it work?" | No notification, no ETA, no status page |
| Getting approved (if they return) | Must re-login to see new permissions | STALE_TOKEN_GROUPS if they don't |

## Critical Abandonment Points (Confirmed)

1. **The MFA Wall** — "I need to install an app just to join a community call?" (S1)
2. **The Authenticator Confusion** — "What is Google Authenticator? Where do I get it?" (S1, no help provided)
3. **The Approval Wait** — "I did everything and I still can't join?" (S2, no ETA)
4. **The Stale Return** — User returns days later, token expired, must re-auth, may not remember MFA (S3)
5. **The Passkey Confusion** — "Sign in with passkey" shown in English during Spanish mode (S4)

## First-Time-to-First-Call Timeline

```
Signup + email verify:     ~2 min
MFA setup (if they know what it is): ~1 min
MFA setup (if they don't): ~5 min (install app + configure)
Wait for admin approval:   UNKNOWN (hours? days?)
Re-login after approval:   ~30s (MFA required)
Join call (pre-join lobby): ~15s
─────────────────────────────────────────
TOTAL: 3-8 min active + unknown wait time
```

> The unknown approval wait is the biggest trust-killer.
> A user who completes a 5-minute signup and then sees "pending" with no ETA will likely never return.
