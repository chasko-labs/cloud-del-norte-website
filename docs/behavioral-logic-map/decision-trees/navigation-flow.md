# Logic Decision Tree — Navigation Flow

> Flow ID: NAV-01 through NAV-03
> Roles affected: All
> Technology: Cloudscape AppLayout + SideNavigation, React state routing, cognito:groups from JWT
> CONFIRMED: Navigation is role-blind — all items visible to all users. Protection is page-level only.

## NAV-01: Initial Page Load

```
[S] User navigates to clouddelnorte.org (or awsug.clouddelnorte.org)
 |
 [F] AuthContext checks sessionStorage for JWT
 |
 |--{valid token exists?}
 |    |
 |    |--YES--> [F] Parse cognito:groups from ID token
 |    |          |
 |    |          |--{moderators}--> [ST] Full nav rendered
 |    |          |                   Admin page accessible (shows admin table)
 |    |          |
 |    |          |--{members}----> [ST] Full nav rendered (SAME items as admin!)
 |    |          |                  Admin page shows "moderator access required" alert
 |    |          |                  @gap PHANTOM_NAVIGATION confirmed
 |    |          |
 |    |          |--{no group}---> [ST] Full nav rendered (SAME items!)
 |    |                             Meetings shows "pending approval" message
 |    |                             Admin shows "moderator access required" alert
 |    |                             @gap PHANTOM_NAVIGATION + GROUP_ASSIGNMENT_LIMBO
 |    |
 |    |--NO (expired token)--> [F] Silent refresh (20% threshold timer)
 |    |    |
 |    |    |--{refresh succeeds}--> (route as above)
 |    |    |--{refresh fails}----> [ST] User appears logged out
 |    |                             Next API call will fail.
 |    |                             No "session expired" prompt. @gap SILENT_AUTH_FAILURE
 |    |
 |    |--NO (no token / new tab)--> [F] requireAuth() check
 |         |
 |         |--{page requires auth?}
 |              |--YES--> [G] Redirect to auth.clouddelnorte.org/login/
 |              |          returnTo URL preserved via sessionStorage (cdn.loginState)
 |              |          OR via ?return_to= query param
 |              |
 |              |--NO--> [ST] Public page loads (radio, about, etc.)
```

## NAV-02: Navigation Item Click

```
[A] User clicks a nav item in Cloudscape SideNavigation
 |
 |  Active state: amber left border (light) / violet left border (dark)
 |  via aria-current="page" + CSS gradient background
 |
 [F] Is this item role-gated at the page level?
 |
 |--{not gated (home, about, roadmap, plans, radio)}--> [ST] Page loads
 |
 |--{gated: meetings page}
 |    |--{user authenticated?}
 |         |--YES + has group--> [ST] Meetings table loads with Join buttons
 |         |--YES + no group--> [ST] "your application is pending approval"
 |         |--NO--> [G] Redirect to login (returnTo preserved)
 |
 |--{gated: admin page}
 |    |--{user authenticated?}
 |         |--YES + moderators group--> [ST] Admin table loads (pending/members/banned tabs)
 |         |--YES + members group--> [ST] "moderator access required" alert (inline, no redirect)
 |         |--YES + no group--> [ST] "moderator access required" alert
 |         |--NO--> [G] Redirect to login
 |
 |  NOTE: The "admin" nav item is ALWAYS VISIBLE regardless of role.
 |  A Member sees "admin" in the nav, clicks it, and gets an inline denial.
 |  This is PHANTOM_NAVIGATION — the nav promises access the user doesn't have.
```

## NAV-03: Deep Link / Bookmark Access

```
[S] User navigates directly to a deep URL (bookmark, shared link, back button)
 |
 [F] requireAuth() fires on protected pages
 |
 |--{logged in + authorized}--> [ST] Page loads normally
 |
 |--{logged in + NOT authorized (e.g., Member → /admin/)}
 |    --> [ST] Page shell loads, inline "moderator access required" alert
 |    --> No redirect. User stays on the URL. Nav shows admin as active.
 |    --> @gap User may think the page is broken rather than restricted
 |
 |--{not logged in + private page}
 |    --> [G] Redirect to auth.clouddelnorte.org/login/
 |    --> returnTo URL preserved (sessionStorage cdn.loginState)
 |    --> After successful login: window.location.replace(returnTo)
 |    --> User lands on their original target. ✓ CORRECT BEHAVIOR
 |
 |--{not logged in + public page}
 |    --> [ST] Page loads normally (no auth required)
```

## Navigation State Matrix (Confirmed)

| Nav Item | Guest (logged out) | Member | Admin | Pending (no group) |
|----------|-------------------|--------|-------|-------------------|
| Home | Visible ✓ | Visible ✓ | Visible ✓ | Visible ✓ |
| Feed | Visible ✓ | Visible ✓ | Visible ✓ | Visible ✓ |
| About | Visible ✓ | Visible ✓ | Visible ✓ | Visible ✓ |
| Roadmap | Visible ✓ | Visible ✓ | Visible ✓ | Visible ✓ |
| UG Roadmap | Visible ✓ | Visible ✓ | Visible ✓ | Visible ✓ |
| **Meetings** | Visible (redirects to login) | Visible ✓ | Visible ✓ | Visible ("pending") |
| **Admin** | Visible (redirects to login) | **Visible** (shows denial) | Visible ✓ | **Visible** (shows denial) |
| Plans | Visible ✓ | Visible ✓ | Visible ✓ | Visible ✓ |
| Costs | **Hidden** (dev only) | **Hidden** | **Hidden** | **Hidden** |

> PHANTOM_NAVIGATION: Admin nav item visible to Members and Pending users.
> They can click it, see the page shell load, then get an inline denial alert.

## Mobile Behavior

- Hamburger menu triggers Cloudscape drawer (same SideNavigation component)
- **Same items visible** — no mobile-specific filtering
- Mobile drawer background: #ede5d4 (cream)
- Mobile-specific CSS: adjusted padding/font-size, no item hiding

## Confirmed Friction Points

| ID | Node | Description | Severity | Status |
|----|------|-------------|----------|--------|
| FP-NAV-01 | NAV-02 | PHANTOM_NAVIGATION — "admin" visible to all, denied at page level | S2 | **Confirmed** |
| FP-NAV-02 | NAV-01 | SILENT_AUTH_FAILURE — token expires, no prompt, next action fails | S2 | **Confirmed** |
| FP-NAV-03 | NAV-03 | Deep link to private page → login → returns to target ✓ | — | **Not a friction point** (works correctly) |
| FP-NAV-04 | NAV-02 | Inline denial alert may look like a broken page, not a permission issue | S3 | **Confirmed** |
| FP-NAV-05 | NAV-01 | Pending user sees full nav but most features show "pending" messages | S3 | **Confirmed** |

## Corrected from Skeleton

| Original Assumption | Actual Behavior |
|--------------------|-----------------| 
| "Does the app preserve target URL?" (unknown) | YES — via sessionStorage cdn.loginState + window.location.replace |
| "Is there a 'you don't have access' page?" (unknown) | Inline alert within page shell, not a separate page |
| "Are admin items hidden or disabled?" (unknown) | VISIBLE to all — page-level protection only |
| "Deep link loses context" (predicted friction) | NOT a friction point — returnTo works correctly |
