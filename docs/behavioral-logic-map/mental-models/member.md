# User Mental Model — Member

> cognito:groups = ["members"] | Standard access | Task-oriented behavior
> Approved by admin. Can join calls as participant. Cannot create meetings or manage users.

## Identity

- **Who they are:** AWS community participant, meeting attendee, radio listener
- **Technical comfort:** Medium-high (AWS user group members skew technical)
- **Session frequency:** Weekly or event-driven (joins when there's a meeting)
- **Device profile:** Desktop for meetings (camera/mic), mobile for checking schedule

## Expectations vs Reality (Confirmed)

| Touchpoint | Member Expects | Actual Behavior | Gap |
|------------|---------------|-----------------|-----|
| Login | Quick re-auth | MFA every time (no remember-device, sessionStorage = tab-scoped) | S3 — mild friction |
| Home Page | See upcoming meetings | Must navigate to Meetings page (home is radio/content) | Minor |
| Join Call | Click → in the call | Click → modal → token fetch → pre-join lobby → join | Acceptable (iframe, not popup) |
| Navigation | Clear menu, relevant items only | ALL items visible including "admin" (PHANTOM_NAVIGATION) | S2 |
| Admin link | Shouldn't see it / "not for me" | Visible, clickable, shows inline denial alert | S2 |
| Profile | Edit my info | No profile page exists in current build | S4 |
| Notifications | Get notified about meetings | No notification system exists | S3 |

## Knowledge Assumptions (Confirmed)

- [✓] "I need my authenticator app to log in" — Correct, MFA every time
- [✗] "I'll get an email when there's a meeting" — No notification mechanism exists
- [✓] "Joining a call is straightforward" — Yes: click Join → modal → pre-join → in call
- [✗] "If I can see a nav item, I can use it" — Admin visible but denied (PHANTOM_NAVIGATION)
- [✗] "I can create meetings too" — Create is moderator-gated (button hidden for members ✓)
- [✓] "The call is in the browser, no install needed" — Correct (embedded Jitsi iframe)

## Common Misconceptions (Confirmed)

| # | Misconception | Actual Behavior | Severity | Flow |
|---|--------------|-----------------|----------|------|
| 1 | "I can skip MFA on my regular device" | No remember-device. MFA every session. Tab close = re-auth. | S3 | Auth |
| 2 | "The admin link is for me somehow" | Inline "moderator access required" alert | S2 | Navigation |
| 3 | "I'll be notified about meetings" | No notification system — must check meetings page manually | S3 | Meetings |
| 4 | "Closing my tab keeps me logged in" | sessionStorage cleared on tab close — full re-auth next time | S3 | Auth |
| 5 | "I was just approved but nothing changed" | Must re-login to get new token with group claim (STALE_TOKEN_GROUPS) | S2 | Permissions |

## Behavioral Patterns (CDN-Specific)

- **Primary loop:** Open tab → MFA → Meetings page → Join Call → Leave call → Close tab
- **Browse pattern:** Open tab → MFA → Listen to radio → Check meetings → Close tab
- **Confusion pattern:** Sees "admin" in nav → clicks → gets denial → wonders why it's there
- **Recovery pattern:** Token expires → next action fails → confused → refreshes page → re-login
- **Tab behavior:** Opens new tab = full re-auth (sessionStorage is tab-scoped)

## Path Priorities (ordered by frequency)

1. Join an upcoming meeting/call (primary reason to visit)
2. Check meeting schedule (is there one today?)
3. Listen to radio/podcast content (passive engagement)
4. Browse community content (roadmap, about)
5. (Cannot: create meetings, manage users, view costs)

## Emotional Arc (CDN-Specific)

| Phase | Emotion | CDN Design Response |
|-------|---------|---------------------|
| Opening site | Purposeful — "time for the meeting" | Radio plays, dune scene loads |
| MFA prompt | Mild annoyance — "again?" | No remember-device, must grab phone every time |
| Meetings page | Focused — "which one do I join?" | Table with meeting list + Join buttons |
| Click Join | Eager — "let's go" | Modal opens, spinner: "requesting access token…" |
| Pre-join lobby | Prepared — "do I look ok?" | Jitsi native pre-join (camera/mic preview) |
| In call | Engaged — participating | Jitsi participant controls (mute, share, chat) |
| Sees "admin" in nav | Curious → Confused | Clicks → inline denial → "why is this here?" |
| Token expires silently | Unaware → Frustrated | Next action fails with no explanation |

## Session Lifecycle

```
Tab open:     Full auth required (email + password + MFA)
During session: Token refreshes silently (20% threshold)
Tab close:    sessionStorage cleared — all tokens gone
New tab:      Full re-auth required (even if other tabs are open)
Token expiry: Silent refresh attempts. If fails, next API call errors.
```

> Key insight: Every new browser tab is a full re-authentication event.
> Members who habitually close tabs will re-auth multiple times per day.
