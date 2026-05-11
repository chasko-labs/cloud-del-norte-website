# Logic Decision Tree — Join Call Flow

> Flow ID: JOIN-01 through JOIN-04
> Roles affected: Admin (Jitsi moderator), Member (participant), Guest (blocked)
> Technology: Jitsi Meet External API (embedded iframe), meet.clouddelnorte.org (self-hosted), Cloudscape Modal, token-exchange Lambda
> CRITICAL: Jitsi is an EMBEDDED IFRAME in a full-screen Modal, NOT a popup window.

## JOIN-01: Initiate Join

```
[S] User clicks "Join" button on a meeting row in the meetings table
 |
 [F] System checks auth state (AuthContext)
 |
 |--{logged in (valid token in sessionStorage)?}
 |    |
 |    |--NO--> [ST] "not authenticated" error shown in embed area
 |    |         NOTE: The meetings page itself requires auth (requireAuth redirect).
 |    |         This path only triggers if token expired mid-session.
 |    |         @gap SILENT_AUTH_FAILURE — no re-login prompt, just error text
 |    |
 |    |--YES--> [A] setActiveRoom(meeting) → Cloudscape Modal opens (size="max")
 |               |
 |               [ST] Spinner: "requesting access token…"
 |               |
 |               [A] fetchJitsiToken() — POSTs Cognito ID token to /token/jitsi
 |               |
 |               |--{token API returns 200?}
 |               |    |
 |               |    |--YES--> Receives: { token (Jitsi JWT), domain, expiresAt }
 |               |    |          domain = "meet.clouddelnorte.org"
 |               |    |          JWT contains moderator:true/false based on cognito:groups
 |               |    |          --> JOIN-02
 |               |    |
 |               |    |--NO (401)--> [A] Retry: refreshTokens() + retry once
 |               |    |               |--{retry succeeds}--> JOIN-02
 |               |    |               |--{retry fails}--> [ST] Error in modal @gap
 |               |    |
 |               |    |--NO (403 / no group)--> [ST] "cannot join meeting" @gap
 |               |         User authenticated but not in members/moderators group.
 |               |         GROUP_ASSIGNMENT_LIMBO blocks join.
 |               |
 |               |--{Jitsi server cold-starting (ECS scale-from-zero)?}
 |                    |--Token API may succeed but Jitsi iframe load hangs
 |                    |--User sees spinner longer than expected
 |                    |--No messaging about "meeting room is starting up" @gap
```

## JOIN-02: Jitsi Embed Load

```
[A] System loads https://meet.clouddelnorte.org/external_api.js
 |
 [ST] Spinner: "connecting to meeting…"
 |
 |--{script loads successfully?}
 |    |
 |    |--YES--> [A] new JitsiMeetExternalAPI(domain, {
 |    |              roomName: meeting.roomName,
 |    |              jwt: token,
 |    |              parentNode: hostRef.current,
 |    |              configOverwrite: {
 |    |                prejoinPageEnabled: true,
 |    |                startWithAudioMuted: true,
 |    |                startWithVideoMuted: true
 |    |              },
 |    |              interfaceConfigOverwrite: {
 |    |                SHOW_JITSI_WATERMARK: false,
 |    |                SHOW_BRAND_WATERMARK: false
 |    |              }
 |    |          })
 |    |          --> JOIN-03 (Pre-Join Lobby)
 |    |
 |    |--NO (Jitsi server unreachable)--> [ST] iframe fails to load
 |         |--{ECS tasks at zero? Server starting?}
 |         |    No CDN-specific error handling for this case.
 |         |    User sees blank iframe or browser connection error.
 |         |    @gap No "meeting room is warming up" message
 |         |
 |         |--{network error}--> [ST] Blank embed area, no error message @gap
```

## JOIN-03: Pre-Join Lobby (Jitsi Native)

```
[ST] Jitsi pre-join page renders inside the iframe
 |
 |  User sees:
 |  - Display name field (pre-filled from JWT)
 |  - Camera preview (if permission granted)
 |  - Mic level indicator
 |  - "Join Meeting" button
 |  - Camera/mic toggle buttons
 |
 [G] Browser requests camera permission (triggered by Jitsi, not CDN code)
 |
 |--{user grants camera?}
 |    |--YES--> Camera preview visible in pre-join
 |    |--NO (reflexive block)--> No preview, camera toggle shows "off"
 |    |    User CAN still join without camera (audio-only is valid)
 |    |    @friction but recoverable — Jitsi shows device settings
 |
 [G] Browser requests microphone permission
 |
 |--{user grants mic?}
 |    |--YES--> Mic level indicator active
 |    |--NO---> No audio input. User can join but cannot speak.
 |              Jitsi shows mic as muted/blocked.
 |              @friction — recovery requires browser settings
 |
 [A] User clicks "Join Meeting" in Jitsi pre-join
 |
 --> JOIN-04
```

## JOIN-04: In-Call Experience

```
[ST] User is in the Jitsi call (inside Cloudscape Modal, full-screen)
 |
 [F] Role determined by JWT issued by token-exchange Lambda:
 |
 |--{JWT has moderator: true (Admin/moderator group)?}
 |    |--Jitsi moderator controls available:
 |    |  - Mute other participants: YES
 |    |  - Kick participants: YES
 |    |  - End call for all: YES (via "End meeting for all" in Jitsi)
 |    |  - Recording: Depends on Jitsi server config (not CDN-controlled)
 |    |  - Lobby management: Can admit/deny if lobby enabled
 |
 |--{JWT has moderator: false (Member/members group)?}
 |    |--Participant controls:
 |    |  - Mute/unmute self: YES
 |    |  - Toggle camera: YES
 |    |  - Share screen: YES (Jitsi default allows all participants)
 |    |  - Chat: YES
 |    |  - Leave call: YES
 |    |  - Raise hand: YES
 |
 |--{Call ends (any trigger)?}
      |
      |--{Moderator clicks "End meeting for all"}
      |    --> Jitsi fires "readyToClose" event
      |    --> onClose() called → setActiveRoom(null)
      |    --> Modal closes
      |    --> User sees meetings table again
      |
      |--{Participant clicks "Leave"}
      |    --> Jitsi fires "readyToClose" event
      |    --> Same flow: modal closes, back to meetings table
      |
      |--{User closes browser tab}
      |    --> WebRTC connection drops
      |    --> No cleanup on CDN side (tab is gone)
      |    --> Other participants see user disconnect
```

## Asymmetric Experience Map (Corrected)

| Moment | Admin (Moderator) | Member (Participant) | Guest/No-Group |
|--------|-------------------|---------------------|----------------|
| Meetings page | Sees meeting list + "Join" buttons | Sees meeting list + "Join" buttons | Redirected to login (requireAuth) |
| Click "Join" | Modal opens, token fetched | Modal opens, token fetched | N/A (not on page) |
| Token exchange | JWT with moderator:true | JWT with moderator:false | "not authenticated" error |
| Pre-join lobby | Name pre-filled, camera/mic preview | Name pre-filled, camera/mic preview | N/A |
| In call | Host controls (mute others, kick, end) | Participant controls (mute self, share) | N/A |
| Call ends | Modal closes → meetings table | Modal closes → meetings table | N/A |
| Pending user (no group) | N/A | N/A | "cannot join meeting" in modal |

## Confirmed Friction Points

| ID | Node | Description | Severity | Status |
|----|------|-------------|----------|--------|
| FP-JOIN-01 | JOIN-02 | Jitsi server cold-start (ECS scale-from-zero) — no "warming up" message | S2 | Confirmed (architecture) |
| FP-JOIN-02 | JOIN-03 | Reflexive permission denial (camera/mic) — recovery requires browser settings | S3 | Confirmed |
| FP-JOIN-03 | JOIN-01 | Token expired mid-session — "not authenticated" error, no re-login prompt | S2 | Confirmed |
| FP-JOIN-04 | JOIN-01 | Pending user (no group) gets cryptic error, not "awaiting approval" | S2 | Confirmed |
| FP-JOIN-05 | JOIN-02 | Jitsi server unreachable — blank iframe, no error message | S2 | Confirmed |

## Corrected from Skeleton

| Original Assumption | Actual Behavior |
|--------------------|-----------------| 
| Jitsi opens in a popup (window.open) | Embedded iframe in Cloudscape Modal (size="max") |
| Popup blocker is a risk | NOT a risk — iframe, not popup |
| No pre-join device test | Pre-join lobby IS enabled (prejoinPageEnabled: true) |
| User loses parent tab context | Parent tab preserved — modal overlays meetings page |
| Call end behavior unclear | readyToClose → modal closes → back to meetings table |
| Guest can attempt join | Guest never reaches meetings page (requireAuth redirect) |
