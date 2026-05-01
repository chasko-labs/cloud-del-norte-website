# deploy notifications — ntfy.sh

ci fires a push notification after every successful deploy (dev + prod).

## topic

```
https://ntfy.sh/cdn-deploy-74697e0f
```

the random suffix keeps the topic effectively private. ntfy.sh has no auth — the url is the secret. do not share it publicly.

## subscribe

**ios** — install [ntfy.sh](https://apps.apple.com/app/ntfy/id1625396347) from the app store. tap + → subscribe to topic → paste `cdn-deploy-74697e0f`

**android** — install [ntfy.sh](https://play.google.com/store/apps/details?id=io.heckel.ntfy) from the play store. tap + → subscribe to topic → paste `cdn-deploy-74697e0f`

**web** — visit `https://ntfy.sh/cdn-deploy-74697e0f` in any browser. click subscribe

**email** — visit `https://ntfy.sh/cdn-deploy-74697e0f` in a browser, open the menu (three-dot or gear), choose "email forwarding", enter your address

## notification content

- **title**: `[CDN dev] deploy: <7-char sha>` or `[CDN prod] deploy: <7-char sha>`
- **body**: git commit message subject
- **click**: opens `https://dev.clouddelnorte.org/` (dev) or `https://clouddelnorte.org/` (prod)
- **tags**: rocket + green_heart icons

## mute / unsubscribe

- ios/android: long-press the topic in the app → mute or unsubscribe
- web: close the browser tab; no persistent subscription
- email: remove forwarding from the topic settings page

## privacy

operational deploy events only — no secrets, tokens, or user data sent. ntfy.sh is a public relay; anyone with the url can post or read. the 8-char random suffix is the only access control.

## rotating the topic if it leaks

1. generate a new suffix: `head -c 8 /dev/urandom | xxd -p | head -c 8`
2. replace `cdn-deploy-74697e0f` everywhere in `.woodpecker/deploy.yml` (two occurrences)
3. update this doc with the new topic url
4. commit + push — old topic becomes a dead channel on next deploy
5. re-subscribe on all devices with the new url
