# Secure Join Behavioral Path Map — Cloud Del Norte

> The User-System Handshake Map for the video call join flow.
> CONFIRMED: Jitsi is an embedded iframe in a Cloudscape Modal, NOT a popup window.
> Self-hosted at meet.clouddelnorte.org (ECS). Pre-join lobby enabled.

## Overview

```
DISCOVERY → IDENTITY → TRUST_ELEVATION → AUTHORIZATION → RESOURCE_ACCESS → GOVERNANCE → EXIT
```

## Phase 1: DISCOVERY

> "How does the user learn about and decide to join a call?"

| Field | Content |
|-------|---------|
| **Map ID** | SJH-01 |
| **User Intent** | "I want to join this meeting" |
| **System Response** | Meetings table with meeting rows + "Join" buttons |
| **Handshake** | User sees meeting exists → clicks Join → system opens modal |
| **Friction Budget** | Low — one click |
| **Role Divergence** | |
| — Admin | Sees meetings table + Join buttons + Create Meeting button |
| — Member | Sees meetings table + Join buttons (no Create) |
| — Pending | Sees "your application is pending approval" (no Join buttons) |
| — Guest | Never reaches this page (requireAuth redirects to login) |
| **Failure Modes** | |
| — Meeting in the past | No roomName → no Join button rendered (correct) |
| — No meetings exist | Empty table state |
| **Zero Trust Check** | Meeting list is public data (no secrets). Join requires auth. |

---

## Phase 2: IDENTITY

> "Proving who you are to the system"

| Field | Content |
|-------|---------|
| **Map ID** | SJH-02 |
| **User Intent** | "Let me log in so I can join" |
| **System Response** | Cognito auth flow (email + password + SOFTWARE_TOKEN MFA) |
| **Handshake** | User provides credentials → Cognito validates → MFA challenge → token issued |
| **Friction Budget** | Medium-high (MFA every time, no remember-device) |
| **Role Divergence** | |
| — Returning user | ~30s (email + password + TOTP code) |
| — First-time user | 3-5 min (signup + email verify + MFA setup) + unknown approval wait |
| **Failure Modes** | |
| — Wrong password | "Incorrect email or password" — retry |
| — TOTP code expired | 30-second window missed — must wait for next code |
| — No authenticator app | Dead end (MFA_HOSTAGE). No help text. No install links. |
| — Account locked | Generic error. No self-service recovery. No support contact. |
| **Zero Trust Check** | No device remembered. Full auth every session. Tab-scoped tokens. |

---

## Phase 3: TRUST_ELEVATION

> "Verifying group membership before granting resource access"

| Field | Content |
|-------|---------|
| **Map ID** | SJH-03 |
| **User Intent** | "I've logged in, now let me join" |
| **System Response** | fetchJitsiToken() POSTs Cognito ID token to /token/jitsi Lambda |
| **Handshake** | Client sends ID token → Lambda reads cognito:groups → issues Jitsi JWT |
| **Friction Budget** | Zero (invisible to user — happens during "requesting access token…" spinner) |
| **Role Divergence** | |
| — Admin (moderators) | JWT issued with moderator:true |
| — Member (members) | JWT issued with moderator:false |
| — Pending (no group) | 403 returned → "cannot join meeting" error in modal |
| **Failure Modes** | |
| — Token expired between login and join | 401 → withRetry() refreshes → retries once |
| — Retry fails | "not authenticated" error. No re-login prompt. @gap |
| — User has no group | 403 → "cannot join meeting" (no explanation of pending status) @gap |
| **Zero Trust Check** | Group membership verified on every join (not cached client-side) |

### Token Exchange Detail

```
Client: POST /token/jitsi
  Headers: Authorization: Bearer <cognito-id-token>
  
Server (Lambda):
  1. Validate Cognito token signature
  2. Read cognito:groups claim (space-delimited bracket-wrapped: "[moderators members]")
  3. Parse groups, determine role
  4. Issue Jitsi JWT: { moderator: true/false, room: roomName, exp: ... }
  5. Return: { token, domain: "meet.clouddelnorte.org", expiresAt }
```

---

## Phase 4: AUTHORIZATION

> "Loading the Jitsi meeting room"

| Field | Content |
|-------|---------|
| **Map ID** | SJH-04 |
| **User Intent** | "Connect me to the call" |
| **System Response** | Load external_api.js from meet.clouddelnorte.org, create JitsiMeetExternalAPI iframe |
| **Handshake** | Script loads → iframe created → Jitsi connects to room with JWT |
| **Friction Budget** | Low (automatic) — BUT ECS cold-start may add 30-90s |
| **Role Divergence** | None at this phase — both roles load the same way |
| **Failure Modes** | |
| — ECS scale-from-zero | Jitsi server starting up. Script load hangs. User sees extended spinner. No "warming up" message. @gap |
| — Jitsi server unreachable | Blank iframe. No CDN-authored error message. @gap |
| — Network error | Browser connection error in iframe area |
| **Zero Trust Check** | JWT is room-scoped and time-limited. Unguessable room names. |

### Jitsi Embed Configuration

```javascript
new JitsiMeetExternalAPI("meet.clouddelnorte.org", {
  roomName: meeting.roomName,
  jwt: token,  // from token-exchange Lambda
  parentNode: hostRef.current,  // div inside Cloudscape Modal
  configOverwrite: {
    prejoinPageEnabled: true,      // pre-join lobby with device preview
    startWithAudioMuted: true,     // don't blast audio on connect
    startWithVideoMuted: true      // don't show face until ready
  },
  interfaceConfigOverwrite: {
    SHOW_JITSI_WATERMARK: false,   // no "jitsi" branding
    SHOW_BRAND_WATERMARK: false    // clean interface
  }
})
```

---

## Phase 5: RESOURCE_ACCESS

> "Pre-join lobby — testing devices before entering"

| Field | Content |
|-------|---------|
| **Map ID** | SJH-05 |
| **User Intent** | "Let me check my camera/mic before others see me" |
| **System Response** | Jitsi native pre-join page (inside iframe) |
| **Handshake** | Browser prompts for camera/mic → user grants/denies → preview shown |
| **Friction Budget** | Medium (permission prompts are expected for video calls) |
| **Role Divergence** | None — same pre-join for moderator and participant |
| **Failure Modes** | |
| — Reflexive camera block | No preview. Can still join (video off). Jitsi shows toggle. |
| — Reflexive mic block | No audio input. Can join but cannot speak. Recovery: browser settings. |
| — Both blocked | Can join as observer. Jitsi shows both as off. |
| — Permission previously blocked (site-wide) | Must go to browser settings → site permissions → allow |
| **Zero Trust Check** | Permissions are per-origin (meet.clouddelnorte.org), per-device |

> NOTE: Because Jitsi is in an iframe, the permission prompt shows the Jitsi domain
> (meet.clouddelnorte.org), not the parent domain (clouddelnorte.org).
> This may confuse users who don't recognize the subdomain.

---

## Phase 6: GOVERNANCE

> "In-call experience and moderation"

| Field | Content |
|-------|---------|
| **Map ID** | SJH-06 |
| **User Intent** | "Participate" (Member) or "Manage this meeting" (Admin) |
| **System Response** | Jitsi call UI with role-appropriate controls |
| **Handshake** | Ongoing — user actions ↔ Jitsi responses |
| **Friction Budget** | Low — standard video call UX |
| **Role Divergence** | |
| — Admin (JWT moderator:true) | Mute others ✓, Kick ✓, End for all ✓, Lobby management ✓ |
| — Member (JWT moderator:false) | Mute self ✓, Camera toggle ✓, Screen share ✓, Chat ✓, Raise hand ✓, Leave ✓ |
| **Failure Modes** | |
| — Connection drops (WebRTC) | Jitsi handles reconnection internally |
| — Admin can't find controls | Jitsi's "..." menu contains moderator actions |
| **Zero Trust Check** | Moderator role enforced by Jitsi server via JWT (not client-spoofable) |

---

## Phase 7: EXIT

> "Leaving the call and returning to the app"

| Field | Content |
|-------|---------|
| **Map ID** | SJH-07 |
| **User Intent** | "I'm done" |
| **System Response** | Jitsi fires "readyToClose" → onClose() → setActiveRoom(null) → Modal closes |
| **Handshake** | User leaves/call ends → event fires → modal dismissed → meetings table visible |
| **Friction Budget** | Zero — seamless |
| **Role Divergence** | |
| — Admin ends for all | All participants get readyToClose → their modals close |
| — Participant leaves | Only their modal closes. Others stay in call. |
| **Failure Modes** | |
| — User closes browser tab during call | WebRTC drops. No cleanup needed (modal was in that tab). |
| — Token expired during call | CDN tab still shows meetings table. Next action may fail (SILENT_AUTH_FAILURE). |
| **Zero Trust Check** | No sensitive state persists after call ends. Modal disposal cleans up iframe. |

---

## End-to-End Timing (Confirmed)

| Phase | First-Time User | Returning User |
|-------|----------------|----------------|
| Discovery (find meeting) | 10s | 5s |
| Identity (signup + MFA setup) | 3-5 min | 30s (MFA) |
| Approval wait | **Unknown (hours? days?)** | N/A |
| Trust Elevation (token exchange) | 1-2s | 1-2s |
| Authorization (Jitsi load) | 2-5s (warm) / 30-90s (cold-start) | 2-5s |
| Resource Access (pre-join) | 10-30s | 5-10s |
| **Total to first "Hello"** | **4-7 min + unknown wait** | **~45 seconds** |

> The approval wait is the critical unknown. A first-time user who completes signup
> cannot join a call until an admin manually approves them. There is no notification
> when approval happens. The user must return, re-login, and check.

---

## Confirmed Anti-Patterns in This Flow

| Anti-Pattern | Phase | Description |
|-------------|-------|-------------|
| MFA_HOSTAGE | Identity | No escape from MFA setup, no help, account locked if abandoned |
| GROUP_ASSIGNMENT_LIMBO | Trust Elevation | Authenticated but no group = 403 with no explanation |
| SILENT_AUTH_FAILURE | Trust Elevation | Token expired, "not authenticated" error, no re-login prompt |
| STALE_TOKEN_GROUPS | Trust Elevation | Approved but old token still has groups:[] until re-login |
| No cold-start messaging | Authorization | ECS scale-from-zero adds delay with no user-facing explanation |
