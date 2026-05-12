[//]: # (TODO: no public blog surface exists in src/sites/ or src/pages/ as of 2026-05-12. This post lives in docs/blog-posts/ until a first-party blog surface is built at src/sites/blog/. When that surface ships, move this file and update any HANDOFF.md references.)

# two synthetic users joined a call before i ate lunch

PASS. That's the verdict. Two synthetic users — one moderator, one member — both attached to a live Jitsi iframe at meet.clouddelnorte.org/cloud-del-norte-awsug with valid JWTs. The call was alive. The roles were correct. The test ran at 16:23Z on 2026-05-12 and finished before I'd thought about food.

This post covers what shipped, how the test harness works, what the screenshots show, and what we hardened immediately after the run exposed a new bug.

---

## what shipped

FP-019 closed on the same day. The admin-approve Lambda in the meet repo now sends a SES welcome email when a user is added to the Cognito `members` group. SES MessageId `2e740433-7b36-49d7-8a2f-6485d73b708a` is in the evidence record. PR [chasko-labs/cloud-del-norte-meet#18](https://github.com/chasko-labs/cloud-del-norte-meet/pull/18) is closed. The friction point that said "admin has no tool to resolve this without out-of-band communication" is resolved.

The 2-user Nova Act run was the validation gate for the full join-call flow. Both users completed the flow end-to-end. The harness captured screenshots, DOM inventory, evidence JSON and a structured log at `scripts/nova-act/output/2user-postcsp-20260512T1619Z.log`.

---

## the user matrix

Two roles. Two different capability sets. One shared room.

| | Moderator | Member |
|---|---|---|
| Account | heraldstack@clouddelnorte.org | heraldstack-test-member@clouddelnorte.org |
| Cognito group | moderators | members |
| moderator claim in JWT | true | false |
| Jitsi features | recording, livestreaming, screen-share | screen-share only |
| Nav: admin link | visible | hidden (FP-014 PASS) |
| Nav: create meeting | visible | hidden |

The flow for both users is the same sequence of steps:

1. Cognito login at auth.clouddelnorte.org with email + password
2. TOTP MFA challenge — authenticator app code
3. Redirect to awsug.clouddelnorte.org dashboard
4. Click "Join Call" on the active meeting row
5. Token-exchange Lambda mints a Jitsi JWT scoped to the user's group claims
6. Cloudscape Modal opens with a JitsiEmbed iframe pointed at meet.clouddelnorte.org/cloud-del-norte-awsug
7. Jitsi prejoin lobby — camera/mic selection
8. Call live

The FP-021 fix is what made step 6 work. Before that fix, "Join Call" called `window.open()` — which CloudFront's CSP blocked because `frame-src` didn't cover the popup origin. The fix replaced `window.open` with a Cloudscape Modal containing an inline JitsiEmbed component, and opened `script-src` and `connect-src` for `meet.clouddelnorte.org` in the CloudFront response-headers policy. Without that CSP change, the iframe would have loaded a blank frame and the Nova Act harness would have timed out waiting for the Jitsi API to initialize.

---

## screenshots

Six artifacts from the 2026-05-12 runs. The first four are from the 16:19Z 2-user session. The last two are from the 19:27Z FP-014 adversarial run.

![Moderator immediately after Join Call click — iframe mounted, Jitsi prejoin settling](https://clouddelnorte.org/screenshots/nova-act/MOD-post-click-20260512T1619Z.png)

Moderator session, frame captured immediately after the Join Call click. The Cloudscape Modal is open, the iframe is mounted, and the Jitsi prejoin screen is in the process of loading. The JWT has been exchanged and the room ID is in the iframe src.

![Moderator settled in room — controls visible, recording and livestream buttons present](https://clouddelnorte.org/screenshots/nova-act/MOD-post-settle-20260512T1619Z.png)

Moderator session after settle. The Jitsi toolbar is fully rendered. Recording and livestream controls are present — these are gated on the `moderator: true` claim in the JWT. The room is live.

![Member immediately after Join Call click — same room ID, iframe mounting](https://clouddelnorte.org/screenshots/nova-act/MEM-post-click-20260512T1619Z.png)

Member session, same moment in the flow. Same room ID in the iframe src. The JWT for this session has `moderator: false` — the token-exchange Lambda reads the Cognito group claim and sets the flag accordingly.

![Member settled in room — moderator visible in session, recording controls absent](https://clouddelnorte.org/screenshots/nova-act/MEM-post-settle-20260512T1619Z.png)

Member session after settle. The moderator is visible as a participant. Recording and livestream controls are not present in the member toolbar — the Jitsi server enforces this based on the JWT claim. Screen-share is available. The two-user session is confirmed live.

![Member nav DOM — zero admin links visible, FP-014 PASS](https://clouddelnorte.org/screenshots/nova-act/fp014-nav-member-only-20260512T1927Z.png)

Member nav DOM from the 19:27Z adversarial run. The Nova Act harness inspected the rendered navigation tree after login. Zero admin links are present. FP-014 — the phantom navigation friction point — passes the client-side hide check. The `isModerator` gate in the navigation component is working.

![Direct /admin navigation as non-moderator — HTTP 200, tan blank React mount, no denial UI](https://clouddelnorte.org/screenshots/nova-act/fp014-admin-direct-20260512T1927Z.png)

This is the bug. The same adversarial run navigated directly to `/admin/index.html` as the member user. The server returned HTTP 200 — the static asset exists and CloudFront serves it to anyone. React mounted. But the auth state hadn't resolved yet, so the denial card hadn't rendered. What the harness captured is a tan blank page: the `:root` background color, no content, no loading indicator, no denial message. This is issue #162. The nav hide is working. The direct-URL path is not. This is why we run adversarial tests.

---

## how nova act works here

The harness at `scripts/nova-act/fp014-016-member-only-validation.py` runs two Chromium sessions concurrently via the Amazon Nova Act SDK. Each session is driven by Playwright Chromium with Nova Act providing the high-level action model (Amazon Nova model, us-east-1).

Credentials are pulled from SSM at runtime — no secrets in the script, no hardcoded passwords, no `.env` files. Each user's credentials are parameterized: the harness accepts a user config dict and the SSM paths are resolved per-user before the session starts.

The two sessions run in parallel via `ThreadPoolExecutor`. The moderator session and the member session start at the same time, proceed through login and MFA independently, and both attempt to join the same room. The harness waits for both threads to complete before evaluating the verdict.

After each session settles in the call, the harness captures:

- A screenshot (the six images above are from these captures)
- A DOM inventory of the navigation tree (used for FP-014 assertion)
- An evidence JSON blob with JWT issuer, audience, room ID and session metadata
- A structured log entry with timestamps and pass/fail per assertion

The verdict gate is strict: PASS requires both sessions to reach joined status, both JWTs to have the correct issuer (`https://cognito-idp.us-west-2.amazonaws.com/us-west-2_XXXXXXXXX`) and audience (the Cognito app client ID), and the moderator session to have `moderator: true` in the JWT payload while the member session has `moderator: false`.

The harness pattern is one file per feature under `scripts/nova-act/`. Login and token helpers are shared across harnesses. Adding a new validation scenario means writing a new harness file that imports the shared helpers — not duplicating the auth flow.

---

## device farm: the next tier

Nova Act runs controlled Chromium on ROCm-AIBOX. That's a known environment: specific Chrome version, specific network path, no real device variability. It catches logic regressions fast and cheaply. It does not catch what happens when a member on an Android WebView with a spotty LTE connection tries to join a call, or when iOS Safari's iframe sandboxing behaves differently than desktop Chrome.

That's what AWS Device Farm is for. The infra is provisioned — Device Farm project resources are in `infra/`. What's pending is the woodpecker-cli token configuration on AIBOX so the pipeline can invoke Device Farm runs as a stage after the Nova Act gate passes.

The contract between the two tiers is straightforward. Nova Act runs on every PR that touches the join-call flow, the auth flow, or the navigation component. It's fast — a full 2-user run completes in under four minutes. Device Farm runs on prod-bound PRs only, after Nova Act passes. It's slower and costs real money per device-minute. You don't run it on every commit.

When both gates are active, a regression in the Jitsi JWT minting logic will fail Nova Act before it ever reaches Device Farm. A regression in Android WebView's handling of the Cloudscape Modal iframe will fail Device Farm without touching Nova Act. The two tiers are complementary, not redundant.

---

## what we hardened this sprint

The adversarial run that found the phantom-nav bug (#162) also confirmed what was working. FP-014 passes on the client-side nav hide. The fix this sprint adds the defense-in-depth layer that was missing.

The navigation component now reads `isModerator` from the auth context and excludes the admin link from the items array for non-moderators. The admin link was previously rendered unconditionally for all authenticated users. It's now gated on the `moderators` group claim.

The admin route (`/admin/index.html`) already had an `AccessDenied` component that rendered once auth resolved. The blank-page problem was the pre-mount state — React hadn't loaded yet, auth state was unresolved, and the page showed nothing but the background color. The fix ensures a loading state renders immediately on mount, before auth resolves, so the user sees something intentional rather than a blank tan page.

Create-meeting access is now moderator-only. The previous gate was `members` group — any approved member could create a meeting. The product decision is that meeting creation is a moderator function, matching the `admin-meetings/create.ts` group gate on the API side. The nav button and the route guard both reflect this now.

The CSP verify script picked up two new assertions from the Nova Act learnings: a check that `frame-ancestors` covers `meet.clouddelnorte.org` for the Jitsi iframe embed, and a check that the screenshot asset paths at `clouddelnorte.org/screenshots/nova-act/` return HTTP 200. The second one is a direct result of the 6 screenshot URLs being public assets that the blog post and evidence records depend on.

---

## what's next

Issue #157 — the Woodpecker death-loop on the chrome-extension-moodle-uploader pipeline — is quiescent. The pipeline isn't actively failing in a way that blocks deploys, but the root cause isn't resolved. That's the next CI item.

Device Farm activation is the next validation tier item. Once woodpecker-cli has a token on AIBOX, the Device Farm stage can be wired into the pipeline as a post-Nova-Act gate on prod-bound PRs.

This post lives in `docs/blog-posts/` because there's no public blog surface on the site yet. The `src/pages/feed/` page aggregates external RSS feeds — it's not a first-party publishing surface. When a blog surface ships at `src/sites/blog/`, this post moves there.
