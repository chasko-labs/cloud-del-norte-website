# ci screenshots

every push to dev or main triggers a post-deploy screenshot capture step in
woodpecker. captures are uploaded to public s3 paths under `/_ci/screenshots/`.

## url patterns

versioned (immutable):
- `https://dev.clouddelnorte.org/_ci/screenshots/<commit-sha>/<page>-<viewport>-<theme>.png`
- `https://clouddelnorte.org/_ci/screenshots/<commit-sha>/<page>-<viewport>-<theme>.png`

latest (always current, no-cache):
- `https://dev.clouddelnorte.org/_ci/screenshots/latest/<page>-<viewport>-<theme>.png`
- `https://clouddelnorte.org/_ci/screenshots/latest/<page>-<viewport>-<theme>.png`

## capture matrix

| dimension | values |
|---|---|
| pages | home, feed |
| viewports | desktop (1440x900), tablet (768x1024), mobile (375x667) |
| themes | light, dark |

12 captures per push.

## adding pages or viewports

edit `scripts/ci-screenshot.mjs` `PAGES` or `VIEWPORTS` array. file naming
convention: `<page>-<viewport>-<theme>.png`.

## for agents

reference the `latest/` path after a deploy completes (~2-3 min after push).
no need to launch playwright ad-hoc.

example check:
```
curl -sI https://dev.clouddelnorte.org/_ci/screenshots/latest/home-desktop-light.png
```
expect: `200 image/png`, content-length > 1000 bytes.

## timing

screenshot steps depend on the deploy step completing, then sleep 60s for
cloudfront propagation before launching playwright. full pipeline is ~3-5 min
after push.
