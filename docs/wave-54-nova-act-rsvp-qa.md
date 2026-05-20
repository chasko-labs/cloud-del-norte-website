# Wave 54 — Nova Act RSVP Flow Validation Results

**Date:** 2026-05-20T19:04–19:18 UTC  
**Branch:** `chore/wave-54-nova-act-rsvp-qa`  
**Bryan EOS goal:** "ensure a first time visitor can click on the wedns june 3 event, be guided through the signup process & come out with confirmation of their registration for the event"

## Summary

| Test | Status | Reason |
|------|--------|--------|
| A — existing-user RSVP | **BLOCKED** | Login succeeds but `return_to` redirect to RSVP completion page does not fire — user lands on awsug.clouddelnorte.org home instead |
| B — new-user signup + RSVP | **BLOCKED** | Signup form submit button not triggered (Nova Act agent confused navigation link with submit CTA); user never created in Cognito |

## Critical Finding: return_to Redirect Broken

Both tests confirm the RSVP CTA on the feed page works correctly:
- Clicking "RSVP on CloudDelNorte.org" redirects to `auth.clouddelnorte.org/signup/index.html?return_to=%2Frsvp%2F%3Fevent%3Dhappy-hour-2026-06-03`

**However, after successful authentication, the `return_to=/rsvp/?event=happy-hour-2026-06-03` parameter is NOT honored.** The user is redirected to `awsug.clouddelnorte.org/index.html` instead of the RSVP completion page.

This means: **no first-time visitor can currently complete the RSVP flow end-to-end via the auth redirect path.**

## Test A — Existing User (heraldstack@clouddelnorte.org)

### Flow Observed
1. ✅ Opened `https://clouddelnorte.org/feed/` — feed rendered with Featured Event card
2. ✅ Clicked "RSVP on CloudDelNorte.org" → redirected to `auth.clouddelnorte.org/signup/index.html?return_to=%2Frsvp%2F%3Fevent%3Dhappy-hour-2026-06-03`
3. ✅ Navigated to Sign In page, entered email + password
4. ✅ Login succeeded — no MFA challenge
5. ❌ **Redirected to `awsug.clouddelnorte.org/index.html`** instead of RSVP confirmation
6. ❌ No QR code visible (never reached RSVP confirmation page)
7. ❌ Spots unchanged: 0 taken before and after

### Backend Verification
```json
{"eventId": "happy-hour-2026-06-03", "capacity": 50, "taken": 0, "remaining": 50}
```
No delta — RSVP was never completed.

### Screenshots
| File | Description |
|------|-------------|
| `/tmp/wave-54-existing/01-feed-anon.png` | Feed page with Featured Event card visible |
| `/tmp/wave-54-existing/02-rsvp-confirm.png` | Post-login page (awsug home, NOT RSVP confirmation) |
| `/tmp/wave-54-existing/block-login.png` | Earlier run: login button click timeout (fixed in subsequent run) |

## Test B — New User (heraldstack+novaact-1779304484@clouddelnorte.org)

### Flow Observed
1. ✅ Opened feed, clicked RSVP CTA → redirected to signup page
2. ✅ Entered email in signup form
3. ✅ Entered display name "Nova Act-Test"
4. ✅ Password filled via Playwright `page.fill()`
5. ❌ **Submit button not clicked** — Nova Act agent confused "Sign in" nav link with the form submit button, navigated away from signup form
6. ❌ User never created in Cognito → `admin-confirm-sign-up` returned UserNotFoundException
7. ❌ Cleanup: no user to delete (never created)

### Backend Verification
```json
{"eventId": "happy-hour-2026-06-03", "capacity": 50, "taken": 0, "remaining": 50}
```
No delta.

### Screenshots
| File | Description |
|------|-------------|
| `/tmp/wave-54-new/01-signup-pending.png` | Signup form state after agent interaction (form not submitted) |

### Credentials (for reference — user was never created)
- Email: `heraldstack+novaact-1779304484@clouddelnorte.org`
- Password: `Fd1#9gHHHUWWN8`

## Blocks & Recommendations

### Block 1: `return_to` parameter not honored after auth
**Severity:** P1 — breaks the entire RSVP-via-auth flow  
**Location:** Auth app redirect logic (likely in `auth.clouddelnorte.org` post-login handler)  
**Expected:** After login/signup, redirect to `/rsvp/?event=happy-hour-2026-06-03`  
**Actual:** Redirects to `awsug.clouddelnorte.org/index.html`

### Block 2: Signup form submit button UX
**Severity:** P2 — AI agent (and possibly users) cannot easily identify the submit CTA  
**Observation:** The Nova Act agent scrolled looking for a "Create account" button, couldn't find it, and clicked navigation links instead. This suggests the submit button may be below the fold or insufficiently prominent.

### Block 3: No QR code on any page reached
**Severity:** Informational — cannot verify QR code feature since RSVP completion page was never reached  
**Note:** The QR code may exist on the RSVP confirmation page that is unreachable due to Block 1.

## Environment
- AWS_PROFILE: `bryanchasko-kiro` (Bedrock/browser_session), `jitsi-video-hosting` (Cognito/Secrets)
- Nova Act model: `nova-act-latest`
- Workflow definition: `cdn-ux-audit`
- Browser: headless via Bedrock AgentCore browser_session (us-east-1)
