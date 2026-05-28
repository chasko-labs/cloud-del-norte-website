# iter3-3.2 code-map sweep — `cdn-auth-subdomain` classification path

**Status:** Sub-task 3.2 complete. **Hypothesis broke.** Surfacing to cdn-anchor per directive.

## Methodology

Read-only filesystem sweep of `chasko-labs/cloud-del-norte-website` and the live `awsug.clouddelnorte.org` bundle. Two phases:

1. Literal grep for `cdn-auth-subdomain` across `src/`.
2. Trace WRITE-site imports + verify against deployed chunks served on the live awsug entrypoint.

## Ranked file list

| Rank | Confidence | File:Line | Site type | Code excerpt | Conditional / hypothesis-fit |
|------|------------|-----------|-----------|--------------|------------------------------|
| 1    | HIGH       | `src/sites/auth/_layout/index.tsx:88` | WRITE | `document.body.classList.add("cdn-auth-subdomain")` | `useEffect` on mount; **unconditional**. Fires on every mount of `AuthLayout`. NOT hostname-keyed. |
| 1b   | HIGH       | `src/sites/auth/_layout/index.tsx:90` | WRITE (cleanup) | `document.body.classList.remove("cdn-auth-subdomain")` | Cleanup on unmount. |
| 2    | HIGH       | `src/sites/auth/passkeys/index.html:36` | WRITE (static) | `<body class="cdn-auth-subdomain">` | Static HTML class on the passkeys auth page. Only loads at `auth.clouddelnorte.org/passkeys/`. |
| 3    | HIGH       | `src/sites/auth/_layout/styles.css:35,1032` | STYLE | `body.cdn-auth-subdomain .cdn-player-slot { display: none }` | The hide rule. STYLE site, not WRITE. |
| 3b   | HIGH       | `src/components/persistent-player/styles.css:941` | STYLE | `.cdn-auth-subdomain .cdn-player-slot { ... }` | Frozen path; player-slot hide rule co-located with player. |
| 3c   | HIGH       | `src/components/footer/atmosphere-ribbon.css:33` | STYLE | `body.cdn-auth-subdomain .cdn-atmosphere-ribbon { display: none }` | Hides the atmosphere-ribbon footer element when class is present. Frozen path. |
| 4    | HIGH       | `src/components/persistent-player/index.tsx:1372` | READ | `document.body.classList.contains("cdn-auth-subdomain")` | Frozen path; player checks the class to gate internal behavior. |

**No other files in the repo write or remove the class.** Repo-wide grep (excluding `node_modules`, `.git`, `lib-*`, `dist`) returns exactly the six files above.

## Helper / classifier analysis

**There is no hostname-keyed classifier function.** The class is not applied via:

- A helper like `isAuthSubdomain(hostname)`.
- A check on `window.location.hostname`.
- Any `AuthContext` provider class application.
- Any layout-level (`Shell`, `AwsugLayout`) class application.

The single WRITE site (`AuthLayout`'s `useEffect`) is unconditional. `AuthLayout` is imported only by:

- `src/sites/auth/login/app.tsx`
- `src/sites/auth/signup/app.tsx`
- `src/sites/auth/verify/app.tsx`
- `src/sites/auth/forgot-password/app.tsx`
- `src/sites/auth/passkeys/app.tsx`
- `src/sites/auth/verification-setup/index.tsx`

All callers live under `src/sites/auth/` — none under `src/sites/awsug/`.

## Live-bundle verification

Deployed chunks preloaded by `awsug.clouddelnorte.org/index.html`:

`index-CBoImrQ2.js`, `_layout-Cz7GLcax.js`, `auth-DScz2Hjp.js`, `audio-ELP-ZlE7.js`, `rsvp-Oi-jjWCn.js`, `vendor-cloudscape-Bj6I0_bh.js`, `vendor-react-BDL3wqF6.js`, `vendor-cloudscape-shell-CsnVUXal.js`, `device-capabilities-CP5xzAX2.js`, `babylon-gate-CBVeJdiU.js`, `locale-en-CogCVjrX.js`, `locale-mx-DJWWWjsg.js`, `rolldown-runtime-DT-7dnLZ.js`, `preload-helper-uTix4PVD.js`.

Searched all 14 preloaded chunks for `cdn-auth-subdomain`:

- **Only `_layout-Cz7GLcax.js` contains the string**, with **1 occurrence: `document.body.classList.contains("cdn-auth-subdomain")`** — the persistent-player READ check from `src/components/persistent-player/index.tsx:1372`. Not a WRITE.
- **No deployed awsug chunk writes the class.** Searched explicitly for `classList.add(\`cdn-auth-subdomain\`)` and `classList.add("cdn-auth-subdomain")` across all 14 chunks — zero hits.

## Diagnosis: what actually happens on `awsug.clouddelnorte.org`

The body class is NOT applied on awsug via runtime hostname misclassification. There is no hostname classifier. The class arrives on awsug body via a completely different mechanism:

1. Harness loads `https://awsug.clouddelnorte.org/`.
2. The awsug index serves `src/sites/awsug/main.tsx` → `src/sites/awsug/app.tsx`.
3. `app.tsx` calls `setAuth(requireAuth())` inside a `useEffect` (lines 219 and 239 of `src/sites/awsug/app.tsx`).
4. `requireAuth()` from `src/sites/awsug/_shared/auth.ts:234` checks `getAuthState()` for a Cognito ID token in `sessionStorage`.
5. The Device Farm harness has no Cognito tokens (no auth flow runs in the harness).
6. `requireAuth()` calls `window.location.assign(\`${AUTH_ORIGIN}/login/index.html?return_to=...\`)` where `AUTH_ORIGIN = "https://auth.clouddelnorte.org"`.
7. The browser navigates to the auth subdomain login page.
8. That page mounts `AuthLayout`, whose `useEffect` adds `cdn-auth-subdomain` to body.
9. The harness's `preClickAudio` capture reads `document.body.classList` at this point — **on the auth page after redirect**, not on awsug.

The capture's `subdomain` field still reports `awsug.clouddelnorte.org` because that is the harness input string, not the final URL. The capture schema has no `finalUrl` field, and the performance-log entries are font/resource `responseReceived` events (no parseable frame-navigation records).

The dev preview at `dev.clouddelnorte.org/awsug-preview/` PASSES because the path-based subroute either:

- (a) serves a different bundle that lacks `requireAuth()`,
- (b) has different Cognito token state than a fresh harness session,
- (c) the awsug app at that path does not fire `requireAuth()` on first paint, or
- (d) the redirect target on dev points somewhere that does not mount `AuthLayout`.

Sub-task 3.1 did not drill into the precise reason for the preview's PASS.

## Side note: `AwsugLayout` already passes `hidePlayer`

`src/sites/awsug/_layout/index.tsx:108` renders `<Shell hidePlayer ...>`. Awsug intentionally hides the persistent player. The "music player on awsug" test scenario is fighting an intentional hide regardless of auth state — even if the harness were authenticated and reached awsug body, `hidePlayer` plus the `cdn-auth-subdomain`-hide CSS rule could both contribute to the player slot not being clickable.

## What broke

**The locked hypothesis assumed a hostname-keyed classifier that does not exist.** There is no `isAuthSubdomain()`, no `hostname.startsWith('awsug.')` check, no shell-layout class application. The body class on awsug.* is a side effect of an unauthenticated `requireAuth()` redirect to `auth.clouddelnorte.org/login/`, not a misclassification.

**Implication for iter-3 fix scope:** the directive's prescribed fix ("whitelist `awsug.*` alongside `clouddelnorte.org`") has no fix site. There is no classifier to whitelist. The actual problem space splits:

- **Path A — Authenticate the harness.** Accept that `awsug.*` is auth-gated and inject Cognito tokens (or mock the auth state) so `requireAuth()` returns rather than redirects. Harness change. No source change.
- **Path B — Drop awsug from the music-player matrix.** Awsug intentionally hides the player via `hidePlayer` AND `cdn-auth-subdomain` CSS rules. Testing the player on awsug is the wrong test. Test only on `clouddelnorte.org` and `dev.clouddelnorte.org/awsug-preview/`. Spec scope change.
- **Path C — Add a non-prod auth-gate bypass.** Source change to awsug app.tsx (e.g., a query-param or build-flag that skips `requireAuth()` for Device Farm runs). Touches awsug app code, not frozen paths. Adds a new code path that has to be guarded against accidentally shipping.

None of these is the one-line fix the directive predicted. The correct path depends on cdn-anchor's intent for what music-player-playback is meant to verify on awsug specifically.

**Surfacing for direction.**

## Cross-references

- `chasko-labs/cloud-del-norte-website#399` — original parity defect filing.
- `chasko-labs/cloud-del-norte-website#400` — `--base-url` harness flag (already merged on main, used by sub-task 3.1 run 2).
- `BryanChasko/haunting-kiro-cli#1158` — spec-discipline addendum (already filed).
- Sub-task 3.1 evidence: `tests/device-farm/captures/iter3-step3.1-20260527T221751Z/`.
