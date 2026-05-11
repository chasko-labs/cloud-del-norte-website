# Logic Decision Tree — Auth Flow

> Flow ID: AUTH-01 through AUTH-05
> Roles affected: All (Admin, Member, Guest)
> Technology: AWS Cognito (us-west-2_cyPQF4F3r), MFA SOFTWARE_TOKEN, JWT in sessionStorage
> Auth subdomain: auth.clouddelnorte.org
> Client ID: 57eikmt418ea6vti2f6h0pl74r

## AUTH-01: Initial Login

```
[S] User arrives at auth.clouddelnorte.org/login/
 |
 |--{has account?}
 |    |
 |    |--YES--> [A] Enter email + password
 |    |          |
 |    |          |--{credentials valid?}
 |    |               |
 |    |               |--YES--> [G] SOFTWARE_TOKEN_MFA Challenge (AUTH-02)
 |    |               |--NO---> [ST] "Incorrect email or password"
 |    |                          |
 |    |                          |--{retry or reset?}
 |    |                               |--RETRY--> [A] Enter email + password
 |    |                               |--RESET--> AUTH-03
 |    |
 |    |--NO--> [B] User decides to sign up
 |    |         |--SIGN UP--> AUTH-04
 |    |         |--ABANDON--> [E] User leaves
 |    |
 |    |--{WebAuthn available?}
 |         |--YES--> [A] "sign in with passkey" button visible
 |                    (hardcoded English — not translated in es-MX) @gap
 |                    |--{clicks passkey}--> [G] WebAuthn challenge
 |                    |                      |--{succeeds}--> Route by group
 |                    |                      |--{fails}--> Fall back to password
 |                    |--{ignores}--> Standard email+password flow
```

## AUTH-02: MFA Challenge (Returning User)

```
[G] SOFTWARE_TOKEN_MFA Challenge presented
 |
 |  NOTE: No "remember this device" option exists.
 |  MFA is required EVERY session. Tokens stored in sessionStorage (tab-scoped).
 |  Closing the tab = full re-auth next time.
 |
 |--{user has authenticator app ready?}
 |    |
 |    |--YES--> [A] Enter 6-digit TOTP code
 |    |          |
 |    |          |--{code valid + within 30s window?}
 |    |               |--YES--> [F] Route by cognito:groups
 |    |               |          |
 |    |               |          |--{moderators}--> [E] Redirect to returnTo URL (preserved)
 |    |               |          |--{members}----> [E] Redirect to returnTo URL
 |    |               |          |--{no group}---> [E] Redirect to returnTo URL
 |    |               |          |                  User sees "pending approval" on meetings page
 |    |               |          |                  @gap GROUP_ASSIGNMENT_LIMBO
 |    |               |
 |    |               |--NO---> [ST] "Verification failed" (generic error)
 |    |                          No attempt counter shown to user.
 |    |                          Lockout enforced server-side by Cognito (threshold unknown).
 |    |                          @friction no feedback on remaining attempts
 |    |
 |    |--NO--> [ST] User must find phone, open authenticator app
 |              |--{finds it}--> [A] Enter TOTP code
 |              |--{gives up}--> [E] Abandonment
```

## AUTH-03: Password Reset

```
[S] User clicks "Forgot Password"
 |
 [A] Enter email
 |
 [ST] "Check your email for reset code"
 |
 |--{email received?}
 |    |--YES--> [A] Enter code + new password
 |    |          |--{password meets policy? (12+ chars, upper+lower+numbers+symbols)}
 |    |               |--YES + code valid--> [ST] "Password reset successful" --> AUTH-01
 |    |               |--NO (policy fail)--> [ST] Policy error shown
 |    |
 |    |--NO (spam folder? wrong email?)--> [ST] User stuck
 |         |--{retry}--> [A] Enter email
 |         |--{abandon}--> [E] User leaves
```

## AUTH-04: First-Time Signup

```
[S] User clicks "Sign Up" (auth.clouddelnorte.org/signup/)
 |
 [A] Step 1: Enter email
 [A] Step 2: Enter password + display name
 |
 |  NOTE: Wizard state is React useState only — NOT persisted.
 |  Closing tab mid-wizard loses all progress.
 |  After step 2, Cognito SignUp API is called.
 |
 |--{password meets policy? (12+ chars, upper+lower+numbers+symbols)}
 |    |
 |    |--NO--> [ST] Policy error @friction (policy not shown upfront)
 |    |
 |    |--YES--> [ST] "Verification code sent to email"
 |               |
 |               |--{code received?}
 |                    |
 |                    |--YES--> [A] Enter verification code
 |                    |          (Can also use standalone /verify/ page later)
 |                    |          |--{valid?}
 |                    |               |--YES--> [G] MFA_SETUP Challenge (AUTH-04b)
 |                    |               |--NO---> [ST] "Invalid code"
 |                    |
 |                    |--NO--> [ST] User stuck waiting
 |                              If they close tab and return, they must restart wizard.
 |                              On retry: "An account with this email already exists"
 |                              (handled — directs to /verify/ page)
```

## AUTH-04b: First-Time MFA Setup

```
[G] MFA_SETUP Challenge
 |
 [ST] Screen shows:
      - "Scan this QR code with your authenticator app:" + QR (180×180)
      - "Or enter this secret manually:" + raw TOTP secret
      - "Open in authenticator app" (otpauth:// deep link)
      - 6-digit code input field
      
      NO help link. NO "what is an authenticator app?" explanation.
      NO link to Google Authenticator / Authy download.
      @friction @gap MFA_HOSTAGE
 |
 |--{user understands what an authenticator app is?}
 |    |
 |    |--YES--> [A] Scan QR or use otpauth:// link
 |    |          [A] Enter TOTP code to verify
 |    |          |
 |    |          |--{valid?}
 |    |               |--YES--> [E] Account created, logged in
 |    |               |          User has NO cognito:group.
 |    |               |          Redirected to returnTo URL.
 |    |               |          Meetings page shows: "your application is pending approval"
 |    |               |          Admin panel shows: "Admin access requires member approval"
 |    |               |          @gap GROUP_ASSIGNMENT_LIMBO (must wait for admin approval)
 |    |               |
 |    |               |--NO---> [ST] "Verification failed" — retry
 |    |
 |    |--NO--> [ST] User confused — no guidance provided
 |              Only affordance: otpauth:// link (opens authenticator if installed)
 |              |--{has authenticator installed}--> otpauth:// link works → scan
 |              |--{no authenticator installed}--> Dead end. No install link. @friction
 |              |--{gives up}--> [E] ABANDONMENT
 |                               Account exists but MFA never configured.
 |                               User CANNOT log in again (MFA required, not set up).
 |                               @gap MFA_HOSTAGE — no recovery without admin intervention
```

## AUTH-05: Account Lockout / Recovery

```
[G] Account locked (Cognito server-side enforcement)
 |
 |  Lockout threshold: Unknown (Cognito default, not configurable from client).
 |  Client shows generic "Verification failed" — no "locked out" specific message.
 |  No attempt counter visible to user.
 |
 |--{recovery mechanism?}
 |    |
 |    |--Password reset: YES (AUTH-03) — but doesn't help with MFA lockout
 |    |--MFA reset: NO self-service path exists
 |    |--Admin intervention: Admin can reset MFA via Cognito console (not via admin panel UI)
 |    |
 |    |--{user knows to contact admin?}
 |         |--{how?} No contact mechanism in the app. No support email shown.
 |         |--[E] User permanently stuck unless they know an admin personally.
```

## Token Lifecycle

```
Token storage: sessionStorage (tab-scoped, cleared on tab close)
Token refresh: Silent, proactive — fires at 20% remaining lifetime (min 30s)
Refresh mechanism: REFRESH_TOKEN_AUTH flow via Cognito
On 401 from API: Retry once with fresh token, then throw error
No "session expired" modal — if refresh fails, next API call fails silently
```

## Confirmed Friction Points

| ID | Node | Description | Severity | Status |
|----|------|-------------|----------|--------|
| FP-AUTH-01 | AUTH-04b | No explanation of authenticator apps, no install links | S1 | Confirmed |
| FP-AUTH-02 | AUTH-04b | MFA_HOSTAGE — no escape, no help, account unusable if abandoned | S1 | Confirmed |
| FP-AUTH-03 | AUTH-02 | MFA every session, no remember-device, tokens tab-scoped | S3 | Confirmed |
| FP-AUTH-04 | AUTH-04 | Password policy not shown before first attempt | S3 | Confirmed |
| FP-AUTH-05 | AUTH-04b | New user has no group — "pending approval" state | S2 | Confirmed |
| FP-AUTH-06 | AUTH-05 | No self-service MFA recovery, no support contact shown | S2 | Confirmed |
| FP-AUTH-07 | AUTH-01 | "sign in with passkey" not translated (hardcoded English) | S4 | Confirmed |
| FP-AUTH-08 | AUTH-04 | Wizard state not persisted — tab close loses progress | S3 | Confirmed |
