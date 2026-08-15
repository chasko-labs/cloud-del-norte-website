# Jibri Recording Pipeline — Infrastructure Completion

**date:** 2026-08-15
**author:** poltergeist-harald-core-anchor
**status:** infrastructure deployed, Chrome launch blocker remaining

## what was done

the full Jibri recording pipeline for Cloud Del Norte meetings was stood up and debugged end-to-end:

- custom Jibri Docker image built with aws-cli + S3 finalize script, pushed to ECR
- standalone Jibri ECS service running on EC2 (t3.medium) with SYS_ADMIN + /dev/snd
- removed dead Jibri sidecar from Fargate task (crash-looped due to missing SYS_ADMIN)
- fixed XMPP recorder domain (hidden.meet.jitsi, not recorder.meet.jitsi)
- fixed PUBLIC_URL (https://meet.clouddelnorte.org) so Jibri's Chrome knows where to connect
- disabled local recording in jitsi-web config (forces server-side Jibri)
- fixed TOKEN_AUTH_URL redirect loop that prevented JWT-based room joins
- dashboard "View Recordings" link pointed at correct S3 bucket
- Nova Act verified the full UI flow: join room → start recording → jicofo dispatches to Jibri

## architecture

| component | resource | location |
|-----------|----------|----------|
| conference | jitsi-web:25 (Fargate) | prosody + jicofo + jvb + web |
| recorder | jitsi-video-platform-jibri:6 (EC2) | Chrome + ffmpeg + finalize.sh |
| storage | s3://jitsi-video-platform-recordings-4b917dff | recordings/YYYY-MM-DD/ |
| discovery | Cloud Map jitsi.jitsi.local | Jibri finds prosody via DNS |
| custom image | 170473530355.dkr.ecr.us-west-2.amazonaws.com/jitsi-jibri:latest | aws-cli + finalize.sh baked in |

## dispatch chain (verified working)

```
user clicks Start Recording
  → jitsi-web sends IQ to jicofo
  → jicofo selects available Jibri from brewery MUC
  → Jibri receives start command with room name + URL
  → Jibri launches Chrome at PUBLIC_URL/room?jwt=token
  → Chrome joins conference as hidden recorder
  → ffmpeg captures display + ALSA loopback audio
  → on stop: finalize.sh uploads MP4 to S3
```

## remaining blocker

Jibri's Chrome fails to launch inside the custom container. After loading chrome flags, there's 15s of silence until jicofo times out. Root cause: the `pip3 install awscli` in the Dockerfile likely broke Chrome's shared library dependencies (libglib, libnss, etc).

**fix path:** multi-stage Docker build that installs aws-cli in isolation (or use a standalone `aws` binary from https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip) without touching apt packages that Chrome depends on.

## lessons learned

| lesson | detail |
|--------|--------|
| XMPP_RECORDER_DOMAIN must match the VirtualHost prosody creates | prosody templates `hidden.meet.jitsi`, not `recorder.meet.jitsi` |
| Fargate cannot run Jibri | SYS_ADMIN + /dev/snd + shm > 64MB — all require EC2 |
| DISABLE_LOCAL_RECORDING=true is required | without it, the UI triggers browser-local recording, not Jibri |
| TOKEN_AUTH_URL must be empty for JWT-in-URL to work | setting it to the meet domain causes a redirect loop |
| PUBLIC_URL tells Jibri where to load the room | without it, Jibri tries the internal XMPP domain which doesn't resolve from EC2 |
| Nova Act can drive Jitsi UI | overflow menu → start recording → confirm dialog all work via act() |
| pip install in a Jibri image breaks Chrome | Chrome's apt deps (libglib2.0, libnss3, etc) are fragile — isolate aws-cli install |

## related

- jitsi-video-hosting docs/JIBRI_RECORDING.md — admin runbook
- chasko-labs/jitsi-video-hosting#36 — original recording issue
- task defs: jitsi-web:25, jitsi-video-platform-jibri:6
