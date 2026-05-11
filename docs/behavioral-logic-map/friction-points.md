# Friction Points Registry — Cloud Del Norte

> Where user logic and app logic clash.
> All entries confirmed via source code audit (2026-05-11).

## Severity Scale

| Level | Label | Definition | Action Required |
|-------|-------|-----------|-----------------|
| S1 | Critical | User cannot complete their goal | Must fix before public launch |
| S2 | High | User can complete goal but with significant confusion/delay | Fix in current sprint |
| S3 | Medium | User notices friction but recovers without help | Fix in next sprint |
| S4 | Low | Minor annoyance, no impact on task completion | Backlog |

## Status Values

| Status | Meaning |
|--------|---------|
| Confirmed | Verified via source code audit |
| Accepted | Known friction, intentional (e.g., MFA is a security requirement) |

---

## Registry

### Auth Flow

| ID | Sev | Role | Trigger | Predicted Behavior | Actual Behavior | Gap | Status |
|----|-----|------|---------|-------------------|-----------------|-----|--------|
| FP-001 | S1 | Guest | MFA_SETUP screen | User expects guidance | QR code + raw secret + otpauth:// link. No help text, no "what is this?", no app store links. | User doesn't know what an authenticator app is or where to get one | Confirmed |
| FP-002 | S1 | Guest | MFA_SETUP abandonment | User wants to skip/defer | No escape. Account created but MFA not configured = account permanently locked out. No admin contact shown. | MFA_HOSTAGE — no recovery without admin Cognito console access | Confirmed |
| FP-003 | S2 | Guest | Post-signup state | User expects immediate access | cognito:groups = []. "pending approval" on meetings. "moderator access required" on admin. No ETA, no notification. | GROUP_ASSIGNMENT_LIMBO — unknown wait, no status updates | Confirmed |
| FP-004 | S3 | Guest | Password policy | User enters simple password | Rejected. Policy: 12+ chars, upper+lower+numbers+symbols. Not shown before first attempt. | Policy revealed only on failure | Confirmed |
| FP-005 | S3 | All | Tab close → re-open | User expects to stay logged in | sessionStorage cleared. Full re-auth (email + password + MFA) required. | Every new tab = full login ceremony | Confirmed |
| FP-006 | S3 | All | MFA every session | User wants quick access | No remember-device. Must grab phone + open authenticator every time. | Acceptable security trade-off but high friction for casual users | Accepted |
| FP-007 | S3 | Guest | Signup wizard state | User closes tab mid-signup | React useState only — not persisted. Must restart from step 1. If SignUp API already called: "account already exists" (handled, directs to /verify/). | Wizard progress lost on tab close | Confirmed |
| FP-008 | S4 | Guest | Spanish mode login | User expects Spanish UI | "sign in with passkey" hardcoded in English (not using i18n t() function) | Untranslated string breaks language consistency | Confirmed |

### Join Call Flow

| ID | Sev | Role | Trigger | Predicted Behavior | Actual Behavior | Gap | Status |
|----|-----|------|---------|-------------------|-----------------|-----|--------|
| FP-009 | S2 | All | Jitsi server cold-start | User clicks Join, expects quick connection | ECS scale-from-zero may add 30-90s. Spinner shows "connecting to meeting…" with no explanation of delay. | No "meeting room is starting up" message | Confirmed |
| FP-010 | S2 | Pending | Join attempt without group | User expects to join after signup | fetchJitsiToken() returns 403. Modal shows "cannot join meeting". No mention of pending approval status. | Error doesn't explain WHY or what to do | Confirmed |
| FP-011 | S2 | All | Token expired mid-session | User clicks Join after idle period | "not authenticated" error in modal. No re-login prompt. Must manually refresh page. | SILENT_AUTH_FAILURE — no recovery guidance | Confirmed |
| FP-012 | S3 | All | Camera/mic permission denied | User reflexively blocks browser prompt | Can still join (audio/video off). Jitsi pre-join shows toggles. Recovery requires browser settings. | Recoverable but confusing for non-technical users | Confirmed |
| FP-013 | S2 | All | Jitsi server unreachable | Network issue or ECS not running | Blank iframe area. No error message from CDN code. Browser may show generic connection error. | No CDN-authored error state for Jitsi unavailability | Confirmed |

### Navigation Flow

| ID | Sev | Role | Trigger | Predicted Behavior | Actual Behavior | Gap | Status |
|----|-----|------|---------|-------------------|-----------------|-----|--------|
| FP-014 | S2 | Member/Pending | "Admin" nav item | User sees it, assumes they have access | Clicks → page loads → inline "moderator access required" alert. No redirect. | PHANTOM_NAVIGATION — nav promises access user doesn't have | Confirmed |
| FP-015 | S2 | All | Silent token expiry | Token expires during session | No "session expired" prompt. Next API call fails. withRetry() attempts refresh once. If fails: error alert, no re-login flow. | SILENT_AUTH_FAILURE — no graceful degradation | Confirmed |
| FP-016 | S3 | Pending | Full nav visible | User just signed up, sees everything | All nav items visible. Most pages show "pending" or denial messages. Mixed signals: "I'm logged in but can't do anything." | Confusing permission landscape for new users | Confirmed |

### Permissions Flow

| ID | Sev | Role | Trigger | Predicted Behavior | Actual Behavior | Gap | Status |
|----|-----|------|---------|-------------------|-----------------|-----|--------|
| FP-017 | S2 | Pending→Member | Admin approves user | User expects immediate access | Token in sessionStorage still has groups: []. Must re-login to get updated token. No notification of approval. | STALE_TOKEN_GROUPS — approved but still blocked until re-login | Confirmed |
| FP-018 | S3 | Member | Permission denied on admin page | User expects helpful message | "Admin access requires member approval. Your application is still pending." — confusing wording (says "member approval" when it means "moderator access") | Misleading error copy | Confirmed |
| FP-019 | S3 | Admin | Approves user, user reports "still blocked" | Admin expects approval = instant access | Must tell user to re-login. No "force refresh" mechanism. No way to message the user. | Admin has no tool to resolve this without out-of-band communication | Confirmed |

---

## Summary by Severity

| Severity | Count | Flows Affected |
|----------|-------|----------------|
| S1 (Critical) | 2 | Auth (MFA onboarding) |
| S2 (High) | 9 | Auth (1), Join Call (4), Navigation (2), Permissions (2) |
| S3 (Medium) | 7 | Auth (4), Join Call (1), Navigation (1), Permissions (1) |
| S4 (Low) | 1 | Auth (passkey translation) |

## Summary by Role

| Role | S1 | S2 | S3 | S4 | Total |
|------|----|----|----|----|-------|
| Guest/Pending | 2 | 3 | 3 | 1 | 9 |
| Member | 0 | 2 | 2 | 0 | 4 |
| Admin | 0 | 0 | 1 | 0 | 1 |
| All (any role) | 0 | 4 | 1 | 0 | 5 |

## Top Priority Fixes (with Test Criteria)

### 1. FP-001 + FP-002 (S1): MFA Onboarding
**Fix:** Add help text, app store links, support contact to MFA_SETUP screen.
**Test:** Navigate to auth.clouddelnorte.org/signup/, complete to MFA_SETUP step. Verify:
- [ ] "What is an authenticator app?" explanation visible
- [ ] Link to Google Authenticator (Play Store + App Store)
- [ ] Link to Authy or alternative
- [ ] Support contact or "need help?" link
- [ ] Escape path (cancel/back) that doesn't lock the account

### 2. FP-003 + FP-017 (S2): Group Assignment UX
**Fix:** Show clear pending status with context. Notify user on approval. Force token refresh.
**Test:** Create new account, complete signup. Verify:
- [ ] "Pending" message includes "an admin will review your request"
- [ ] Estimated wait time or "you'll receive an email when approved"
- [ ] After admin approves: user receives email notification
- [ ] On next page load: token refresh picks up new group (no manual re-login)

### 3. FP-014 (S2): PHANTOM_NAVIGATION
**Fix:** Add `isModerator` check to navigation component. Hide "admin" for non-moderators.
**Test:** Log in as Member (members group only). Verify:
- [ ] "Admin" does NOT appear in side navigation
- [ ] Direct URL /admin/ still shows inline denial (defense in depth)
- [ ] Mobile hamburger menu also hides "admin"

### 4. FP-009 + FP-013 (S2): Jitsi Availability Messaging
**Fix:** Add timeout detection + "meeting room is starting up" message. Add error state for unreachable.
**Test:** With Jitsi ECS at zero tasks, click Join. Verify:
- [ ] After 5s of spinner: "Meeting room is starting up, please wait…" message appears
- [ ] After 90s timeout: "Unable to connect. The meeting room may be unavailable." error
- [ ] Retry button offered on timeout

### 5. FP-015 + FP-011 (S2): SILENT_AUTH_FAILURE
**Fix:** Add "session expired" modal with re-login button when token refresh fails.
**Test:** Let token expire (or clear sessionStorage manually). Attempt API action. Verify:
- [ ] Modal appears: "Your session has expired. Please log in again."
- [ ] "Log in" button redirects to auth.clouddelnorte.org/login/ with returnTo preserved
- [ ] No cryptic error message shown instead
