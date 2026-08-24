# Jibri Recording Pipeline — Complete

**date:** 2026-08-24 (originally 2026-08-15, rewritten with resolution)
**author:** poltergeist-harald-core-anchor
**status:** COMPLETE — recording verified end-to-end with MP4 in S3

## summary

server-side recording for Cloud Del Norte meetings via Jibri. moderators click "Start Recording" in the Jitsi UI, Jibri captures video + audio, uploads MP4 to S3. moderators access recordings from the quantum dashboard (presigned download URLs, no AWS console needed).

## architecture

| component | resource | detail |
|-----------|----------|--------|
| conference | jitsi-web:28 (EC2 via Fargate-like deploy) | prosody + jicofo + jvb + web |
| recorder | jitsi-video-platform-jibri:14 (EC2, bridge mode) | Chrome + ffmpeg + PulseAudio null-sink |
| storage | s3://jitsi-video-platform-recordings-4b917dff | recordings/YYYY-MM-DD/*.mp4 |
| access | cdn-recordings Lambda + API Gateway | GET /admin/recordings returns presigned URLs |
| discovery | Cloud Map jitsi.jitsi.local | Jibri finds prosody via DNS |
| custom image | 170473530355.dkr.ecr.us-west-2.amazonaws.com/jitsi-jibri:latest | Dockerfile in repo |

## recording flow (verified working 2026-08-24)

```
moderator clicks Start Recording in Jitsi UI
  → jicofo dispatches to Jibri via XMPP brewery MUC
  → Jibri launches ChromeDriver + Chrome 143
  → Chrome navigates to https://meet.clouddelnorte.org/{room} (bridge mode — host internet)
  → Chrome joins conference as hidden recorder (1.5s load time)
  → ffmpeg captures X11 display + PulseAudio null-sink audio
  → on stop: finalize.sh uploads MP4 to S3 bucket
  → moderator downloads from quantum.clouddelnorte.org/dashboard/
```

## root cause chain (resolved 2026-08-24)

five separate issues stacked on top of each other, each masked by the one above it:

| # | issue | symptom | fix |
|---|-------|---------|-----|
| 1 | pip3 install awscli broke Chrome shared libs | `google-chrome --version` failed | standalone AWS CLI v2 zip bundle |
| 2 | awsvpc networking — task ENI has no internet | Chrome couldn't reach meet.clouddelnorte.org | bridge networking mode ($0) |
| 3 | snd-aloop kernel module missing on Amazon Linux 2 AMI | PulseAudio failed — no audio device | PulseAudio null-sink virtual audio |
| 4 | dbus policy denied PulseAudio bus ownership | PA crash loop: "not allowed to own org.PulseAudio1" | dbus policy file for jibri user |
| 5 | jicofo 15s PENDING_TIMEOUT too tight | jicofo canceled before Chrome finished loading | extended to 60s |

## custom docker image layers

built from `jitsi/jibri:stable`, adds:

- dbus + dbus-x11 (Chrome 143 requirement)
- pulseaudio-utils (pactl for runtime sink management)
- SSM agent (ECS Exec debugging)
- AWS CLI v2 standalone bundle (S3 upload in finalize.sh)
- PulseAudio null-sink config (virtual audio without kernel module)
- ALSA .asoundrc routing through PulseAudio
- dbus policy allowing jibri user PA bus ownership
- launch.sh with PA wait loop + diagnostics
- console logging config (Selenium output to CloudWatch)

## lessons learned

| lesson | detail |
|--------|--------|
| awsvpc task ENIs have NO internet without NAT gateway | bridge mode inherits host internet for $0 |
| Amazon Linux 2 ECS AMI does NOT have snd-aloop | PulseAudio null-sink replaces hardware loopback entirely |
| PulseAudio reads user config from ~/.config/pulse/default.pa | NOT /etc/pulse/default.pa — user config takes priority |
| Chrome 143 requires dbus or it hangs indefinitely | dbus-daemon must run before Chrome launches |
| PA needs dbus policy to own org.PulseAudio1 | without it PA crash-loops and ffmpeg gets "No such process" |
| Jibri logs go to files by default | override logging.properties with ConsoleHandler for CloudWatch visibility |
| jicofo has a 15s default recording timeout | too tight for Chrome to load the meeting page under network latency |
| bridge mode is the correct ECS networking for Jibri | single-task EC2 instance, outbound-only connections, no discovery needed |

## cost

| state | monthly |
|-------|---------|
| recording enabled, stack running | ~$30 (1x t3.medium EC2) |
| recording enabled, stack scaled to zero | ~$0 (S3 storage only) |
| recording disabled | $0 |

## references

- Dockerfile + all configs: chasko-labs/jitsi-video-hosting `modules/jibri/`
- admin runbook: chasko-labs/jitsi-video-hosting `docs/JIBRI_RECORDING.md`
- recordings Lambda: chasko-labs/cloud-del-norte-website `infra/lambda/recordings/`
- deploy script: chasko-labs/cloud-del-norte-website `scripts/deploy-cdn-recordings.sh`
- test recording: `s3://jitsi-video-platform-recordings-4b917dff/recordings/2026-08-24/cloud-del-norte-awsug_2026-08-24-13-23-10.mp4`
