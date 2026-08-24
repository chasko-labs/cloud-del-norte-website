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
