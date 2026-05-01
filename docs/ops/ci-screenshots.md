# ci screenshots

two woodpecker pipelines run in parallel on every push to dev or main:
- `deploy.yml` — build + deploy to s3/cloudfront
- `screenshot.yml` — playwright capture + s3 upload

screenshot pipeline failures never block deploys. each capture step has `failure: ignore`.

## url patterns

versioned (immutable):
- `https://dev.clouddelnorte.org/_ci/screenshots/<commit-sha>/<page>-<viewport>-<theme>.png`
- `https://clouddelnorte.org/_ci/screenshots/<commit-sha>/<page>-<viewport>-<theme>.png`

latest (always current, no-cache):
- `https://dev.clouddelnorte.org/_ci/screenshots/latest/<page>-<viewport>-<theme>.png`
- `https://clouddelnorte.org/_ci/screenshots/latest/<page>-<viewport>-<theme>.png`

## debug log

every capture run uploads a log regardless of success or failure:
- `https://dev.clouddelnorte.org/_ci/screenshots/<sha>/capture.log`
- `https://dev.clouddelnorte.org/_ci/screenshots/latest/capture.log`

check log first when screenshots are missing. it contains full stdout+stderr from
`scripts/ci-screenshot.mjs` plus any aws auth/install output before the node call.

```
curl -sL https://dev.clouddelnorte.org/_ci/screenshots/latest/capture.log | head -30
```

if the log itself 404s, the s3 upload step failed — indicates an auth problem in the
playwright container (not a script problem).

## capture matrix

| dimension | values |
|---|---|
| pages | home, feed |
| viewports | desktop (1440x900), tablet (768x1024), mobile (375x667) |
| themes | light, dark |

12 captures per push.

## playwright container compatibility

the `mcr.microsoft.com/playwright:v1.49.0-jammy` image does not include awscli or
`aws_signing_helper` by default. the screenshot pipeline installs both at runtime:
- awscli via `pip install --quiet awscli`
- aws_signing_helper 1.7.0 via curl from rolesanywhere.amazonaws.com

workload cert mount: woodpecker agent must mount `/workload.crt` and `/workload.key`
into the playwright container via `WOODPECKER_BACKEND_DOCKER_VOLUMES`. this is the
same volumes config that mounts them for the aws-cli deploy steps. if the playwright
image is not in the same volume mount scope, the `test -f /workload.crt` check will
fail immediately and the log will show the diagnosis.

if the cert mount is confirmed missing from the playwright container, operator fix:
check `WOODPECKER_BACKEND_DOCKER_VOLUMES` on the woodpecker agent host and confirm
the volume pattern applies to all images, not just the aws-cli image. typically
a wildcard `*` in the volume source is sufficient — no agent restart needed after
env var change if the agent reloads config dynamically; otherwise restart the agent.

## timing

screenshot pipeline runs in parallel with deploy. it waits `sleep 90` before
launching playwright to allow the parallel deploy + cloudfront propagation to settle.
full capture + upload is ~3-5 min after push in normal conditions.

## adding pages or viewports

edit `scripts/ci-screenshot.mjs` `PAGES` or `VIEWPORTS` array. file naming
convention: `<page>-<viewport>-<theme>.png`.

## for agents

reference the `latest/` path after a deploy completes (~3-5 min after push).
check the capture.log before assuming screenshots are current.

example check:
```
curl -sI https://dev.clouddelnorte.org/_ci/screenshots/latest/home-desktop-light.png
```
expect: `200 image/png`, content-length > 1000 bytes.
if 404 or text/html: fetch the capture.log for diagnosis.
