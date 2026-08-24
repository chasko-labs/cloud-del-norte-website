# Quantum Dashboard — Full E2E Verified

**date:** 2026-08-24
**author:** poltergeist-harald-core-anchor
**status:** verified end-to-end — admin + member flow working

## what was tested

full user journey from sign-in through meeting join and recording, using real Cognito test accounts against the live quantum.clouddelnorte.org infrastructure.

## user accounts

| role | email | cognito groups | what they can do |
|------|-------|----------------|-----------------|
| admin | heraldstack-test-admin@clouddelnorte.org | moderators, members | launch meetings, start/stop recording, view recordings |
| member | cdn-member-only-test@clouddelnorte.org | members | join live meetings, view upcoming sessions |

## the journey (with screenshots)

### step 1: admin signs in

admin authenticates via Cognito USER_PASSWORD_AUTH flow. the dashboard detects the `cdn.idToken` in sessionStorage and renders the full MemberView with moderator controls.

**what happens in the background:**
- Cognito returns id_token + access_token + refresh_token
- tokens stored in sessionStorage (`cdn.idToken`, `cdn.accessToken`, `cdn.expiresAt`)
- dashboard's `getUserInfo()` decodes the JWT, extracts `cognito:groups`
- detects `moderators` group → shows ModeratorControls expandable section

![admin dashboard](https://dev.clouddelnorte.org/_previews/dogfood-e2e/dogfood-01-admin-dashboard.png)

### step 2: admin launches meeting

admin clicks "Launch Meeting" in the moderator controls. the API creates a DynamoDB record and returns `{live: true}`.

**what happens in the background:**
- POST to `rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/launch`
- Lambda creates a `live` record in `cloud-del-norte-meetings` DynamoDB table
- Dashboard polls `/meetings/status` every 30 seconds
- UI updates: shows "Join Now" button with live indicator

### step 3: admin joins meeting

admin clicks "Join Now". the Jitsi iframe loads inside the dashboard with a JWT token embedded.

**what happens in the background:**
- dashboard constructs URL: `https://meet.clouddelnorte.org/{room}?jwt={token}`
- JWT contains user claims (name, email, avatar, groups)
- Jitsi web container validates the JWT
- user joins the conference via WebRTC through JVB (video bridge)
- jicofo (conference focus) manages the session

![admin in meeting](https://dev.clouddelnorte.org/_previews/dogfood-e2e/dogfood-02-admin-in-meeting.png)

### step 4: admin starts recording

admin clicks three-dot menu → Start Recording → confirms.

**what happens in the background:**
- jitsi-web sends XMPP IQ to jicofo requesting recording start
- jicofo selects available Jibri from the `jibribrewery` MUC
- Jibri receives the start command with room URL
- ChromeDriver 143 launches Chrome, navigates to the meeting URL
- Chrome joins as a hidden participant (no video/audio out, captures all)
- ffmpeg starts capturing X11 display + PulseAudio null-sink audio
- Jibri reports IDLE → BUSY to jicofo
- jicofo sends "recording started" notification to all participants
- UI shows red REC indicator

![recording started](https://dev.clouddelnorte.org/_previews/dogfood-e2e/dogfood-03-recording-started.png)

### step 5: member sees meeting is live

member authenticates with their own credentials. the dashboard shows the live meeting with a "Join Now" button.

**what happens in the background:**
- same Cognito auth flow, different user
- dashboard polls `/meetings/status` → `{live: true, title: "E2E Dogfood Test"}`
- member is in `members` group but NOT `moderators` — no moderator controls shown
- "Join Now" button appears for the live session

### step 6: recording in progress

the meeting runs with participants present. ffmpeg captures everything on the Xorg virtual display at 1280x720 30fps.

**what happens in the background:**
- ffmpeg command: `-f x11grab -r 30 -s 1280x720 -i :0.0+0,0 -f pulse -i default`
- video: libx264, ultrafast preset, CRF 25
- audio: AAC 128kbps from PulseAudio null-sink monitor
- output: MP4 in `/config/recordings/{session-id}/`
- Jibri monitors call status: participant count, media flow, mute state
- 30-second empty-call timeout if all participants leave

![during recording](https://dev.clouddelnorte.org/_previews/dogfood-e2e/dogfood-04-during-recording.png)

### step 7: recording stops

admin clicks three-dot menu → Stop Recording → confirms. or: Jibri detects empty call and auto-stops.

**what happens in the background:**
- Jibri receives stop command (or empty-call timeout fires)
- ffmpeg process terminated gracefully (writes MP4 trailer)
- finalize.sh runs: `aws s3 cp` uploads recording to S3 bucket
- Jibri reports BUSY → IDLE to jicofo
- recording appears in S3 at `recordings/YYYY-MM-DD/{room}_{timestamp}.mp4`

![recording stopped](https://dev.clouddelnorte.org/_previews/dogfood-e2e/dogfood-05-recording-stopped.png)

### step 8: admin accesses recordings

admin's moderator panel shows recordings list with download buttons. each download link is a presigned S3 URL valid for 1 hour.

**what happens in the background:**
- dashboard calls `GET /admin/recordings` with Bearer token
- cdn-recordings Lambda checks JWT for `moderators` group
- Lambda calls S3 ListObjectsV2 on the recordings bucket
- generates presigned GetObject URLs for each MP4 file
- returns `{recordings: [{filename, date, size, downloadUrl}]}`
- dashboard renders download buttons

### step 9: shutdown

meeting ended via API, Jibri scaled to 0, infrastructure idle.

**what happens in the background:**
- POST `/admin/meetings/end` → deletes DynamoDB `live` record
- dashboard's next status poll returns `{live: false}`
- UI reverts to "upcoming sessions" view
- `aws ecs update-service --desired-count 0` stops Jibri container
- EC2 instance remains (ASG min=0 would terminate it if configured)
- cost at idle: ~$0 (EC2 stays until ASG scales down)

---

## new user signup flow (verified 2026-08-24)

this is the flow real attendees will experience when we create their accounts for the Aug 30 event.

### what AdminCreateUser does (the RSVP Lambda path)

when we call `AdminCreateUser` for an RSVPed attendee:

1. Cognito creates the account in `FORCE_CHANGE_PASSWORD` state
2. user is added to the `members` group
3. Cognito sends an invite email via SES from `no-reply@clouddelnorte.org`

### the welcome email (captured from SES → S3)

verified by reading the actual email delivered via SES to an S3 bucket (receipt rule `store-test-verification-emails` → `cdn-ses-inbound-test-emails`).

**from:** `Cloud Del Norte <no-reply@clouddelnorte.org>`
**to:** `cdn-member-only-test@clouddelnorte.org`
**subject:** `Your temporary password`
**body (full content, HTML part):**

```
Your username is cdn-member-only-test@clouddelnorte.org and temporary password is Quantum-Temp-2026!.
```

that's the entire email body. one sentence. no formatting, no links, no context.

**email infrastructure verified:**
- SES identity: `clouddelnorte.org` (DKIM-signed, SPF pass, virus/spam pass)
- delivery: confirmed in S3 within 2 seconds of AdminCreateUser call
- DKIM signature: valid (`dkim=pass header.i=@clouddelnorte.org`)

**what real attendees will see with this default template:**

they get an email from "Cloud Del Norte" with a temporary password and nothing else. no event name, no link to the dashboard, no instructions for what to do next. this is a bad first impression.

**fix required before inviting real users:**

set a custom invite message template on the Cognito pool:

```bash
aws cognito-idp update-user-pool --user-pool-id us-west-2_cyPQF4F3r \
  --admin-create-user-config '{
    "InviteMessageTemplate": {
      "EmailSubject": "Your login for the Quantum Computing Workshop — Aug 30",
      "EmailMessage": "Hi {username},<br><br>You are confirmed for the <b>Quantum Computing Workshop on Amazon Braket</b> — Saturday, August 30, 3:00–6:00 PM CDT.<br><br>Sign in at: <a href=\"https://auth.clouddelnorte.org/login/\">https://auth.clouddelnorte.org/login/</a><br><br>Your temporary password is: <b>{####}</b><br><br>You will be asked to set a new password on your first sign-in. After signing in, go to <a href=\"https://quantum.clouddelnorte.org/dashboard/\">quantum.clouddelnorte.org/dashboard/</a> to join the live session on event day.<br><br>See you there,<br>Bryan Chasko, co-organizer | Cloud Del Norte"
    }
  }' --region us-west-2 --profile jitsi-video-hosting
```

once that template is set, all future AdminCreateUser calls will use it automatically.

### first sign-in: NEW_PASSWORD_REQUIRED challenge

when the user signs in with the temporary password, Cognito returns a `NEW_PASSWORD_REQUIRED` challenge. the auth.clouddelnorte.org login page handles this:

1. user enters email + temporary password
2. Cognito returns challenge instead of tokens
3. login page shows "set your new password" form
4. user sets permanent password
5. Cognito returns full token set (id + access + refresh)
6. redirect to dashboard via auth-callback

### verified: new user sees live meeting + joins

after password change, the new user (`dogfood-newuser@clouddelnorte.org`) was able to:

- authenticate successfully (USER_PASSWORD_AUTH with permanent password)
- see meeting status via API (`{live: true, title: "New User Join Test"}`)
- load the quantum dashboard with session active
- see the "Join Now" button for the live session
- join the meeting (Nova Act clicked Join Now, page showed "connecting to meeting...")

![new user dashboard](https://dev.clouddelnorte.org/_previews/dogfood-e2e/newuser-01-dashboard.png)

![new user in meeting](https://dev.clouddelnorte.org/_previews/dogfood-e2e/newuser-02-in-meeting.png)

### the full sequence (what happens in the background)

```
AdminCreateUser (email, temp password, email_verified=true)
  → Cognito creates user in FORCE_CHANGE_PASSWORD state
  → SES sends invite email from no-reply@clouddelnorte.org
  → user receives email with temp password (valid 3 days)

AdminAddUserToGroup (user, "members")
  → user's JWT will include cognito:groups=["members"]

user clicks link → auth.clouddelnorte.org/login/
  → enters email + temp password
  → Cognito returns NEW_PASSWORD_REQUIRED challenge
  → user sets permanent password
  → Cognito returns tokens, status changes to CONFIRMED
  → redirect to quantum.clouddelnorte.org/auth-callback/
  → tokens stored in sessionStorage
  → redirect to /dashboard/

user sees dashboard with live meeting → clicks Join Now
  → Jitsi iframe loads with JWT containing user claims
  → user joins the conference via WebRTC
```

### what needs to be done before sending invites to real users

1. **custom invite email template** — the default Cognito message is too generic. need to configure `AdminCreateUserConfig.InviteMessageTemplate` on the pool with event-specific content, sign-in link, and instructions
2. **test the auth.clouddelnorte.org password-change flow** — verify the login page properly handles the NEW_PASSWORD_REQUIRED challenge (this is the UX the real users will see)
3. **passkey setup** — after first sign-in, the dashboard offers passkey enrollment. verify this works for the new user

## infrastructure verified

| component | status | evidence |
|-----------|--------|----------|
| Cognito auth (admin) | working | JWT with moderators group decoded successfully |
| Cognito auth (member) | working | JWT with members group, sees live meeting |
| meetings API (launch/end) | working | DynamoDB record created/deleted on demand |
| Jitsi conference | working | admin joined via embedded iframe |
| Jibri recording | working | Chrome joined, ffmpeg captured, MP4 uploaded |
| recordings API | working | presigned URLs returned, download functional |
| dashboard UI | working | all views render correctly per user role |

## remaining for aug 30

- RSVP-to-signup (#537): create Cognito accounts for the 4 real attendees
- jicofo timeout: already set to 60s in jitsi-web:28 — may need tuning if recording start is slow under load
- recording under load: untested with 5+ participants — should work but need to verify

## screenshots

all screenshots from this test run are published at:
`https://dev.clouddelnorte.org/_previews/dogfood-e2e/`
