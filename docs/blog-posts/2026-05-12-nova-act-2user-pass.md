## Two Users Walk Into a Meeting Room

date: 2026-05-12
author: Bryan Chasko

---

The question was simple. Can two people with different permission levels join the same video call through our app and each see exactly what they should see? Not what the test framework says they see. What they actually see rendered in a browser.

I ran the validation at 16:23 UTC today. Two concurrent Chromium sessions driven by Amazon Nova Act. One moderator. One member. Both navigating to the same meeting room on meet.clouddelnorte.org/cloud-del-norte-awsug. Both authenticating with real Cognito JWTs pulled from SSM at runtime.

The moderator gets recording, livestreaming and screen-sharing. The member gets screen-sharing only. That is the contract. The screenshots prove the contract holds.

---

## The Moderator Flow

The moderator authenticates as heraldstack@clouddelnorte.org. Groups claim includes both `members` and `moderators`. The JWT minted for the Jitsi room carries `moderator: true` and the full feature set.

After clicking Join Call, the Cloudscape modal opens with the JitsiEmbed iframe. The iframe loads meet.clouddelnorte.org/cloud-del-norte-awsug with the room JWT in the URL fragment.

![Moderator immediately after Join Call click](https://clouddelnorte.org/screenshots/nova-act/MOD-post-click-20260512T1619Z.png)

The iframe settles. Jitsi pre-join screen renders with camera and microphone toggles. The toolbar shows recording, livestreaming and screen-sharing controls.

![Moderator iframe settled](https://clouddelnorte.org/screenshots/nova-act/MOD-post-settle-20260512T1619Z.png)

---

## The Member Flow

The member authenticates as heraldstack-test-member@clouddelnorte.org. Groups claim is `members` only. The JWT carries `moderator: false` and a restricted feature set.

Same meeting room. Same Join Call button. Same modal. Different capabilities.

![Member immediately after Join Call click](https://clouddelnorte.org/screenshots/nova-act/MEM-post-click-20260512T1619Z.png)

The iframe settles. Pre-join screen renders. The toolbar shows screen-sharing only. No recording. No livestreaming. The permission boundary is enforced at the Jitsi token level, not just the UI.

![Member iframe settled](https://clouddelnorte.org/screenshots/nova-act/MEM-post-settle-20260512T1619Z.png)

---

## Navigation Enforcement

The same Nova Act run validated FP-014: the member's navigation DOM contains no admin links. The side navigation renders meetings, feed, about, learning. No admin. No create-meeting. The permission boundary is enforced before the user can even attempt to navigate somewhere they do not belong.

![Member navigation DOM — no admin links visible](https://clouddelnorte.org/screenshots/nova-act/fp014-nav-member-only-20260512T1927Z.png)

Direct navigation to /admin/index.html by a non-moderator renders a tan blank page. This is the phantom-nav bug (issue 162). The defense-in-depth layer exists — the admin app checks isModerator and renders an AccessDenied card — but the pre-mount state shows nothing. Fix is in this sprint: hide the nav link entirely for non-moderators and render a styled denial card that does not depend on auth state resolution timing.

![Direct /admin navigation — phantom-nav blank page](https://clouddelnorte.org/screenshots/nova-act/fp014-admin-direct-20260512T1927Z.png)

---

## The Harness

The test script is `scripts/nova-act/fp014-016-member-only-validation.py`. It pulls credentials from AWS Systems Manager Parameter Store at runtime. No passwords in the script. No passwords in the repo. No passwords in environment variables.

Two sessions run concurrently via ThreadPoolExecutor. Each session authenticates through the real Cognito login flow on auth.clouddelnorte.org, navigates to the meetings page, clicks Join Call and polls for the Jitsi iframe to attach with a valid room JWT. The script exits non-zero on any FAIL verdict. Screenshots land in `scripts/nova-act/output/` and get pushed to the public S3 bucket for evidence.

The model driving the browser is Amazon Nova. The browser is Playwright Chromium. The credential store is SSM. The verdict is binary: PASS or FAIL. No flaky middle ground.

---

## What Ships Next: Device Farm

Nova Act validates the happy path in controlled Chromium. It does not tell you what happens on a Pixel 7 running Chrome 124 or an iPhone 14 on Safari 17. That is what AWS Device Farm is for.

The infrastructure is provisioned in `infra/`. The device matrix definition exists. What remains is wiring the woodpecker-cli token on the CI host so Device Farm runs execute as a pipeline step alongside Nova Act. Two tiers of validation: controlled browser for logic correctness, real device for rendering fidelity.

---

## FP-019 Shipped

The same day as the 2-user PASS, FP-019 shipped end-to-end. When an admin approves a pending user, the admin-approve lambda now sends an SES welcome email. The user knows they have been approved without anyone sending a manual message. SEND_APPROVAL_EMAIL=true is live in production. SES MessageId 2e740433-7b36-49d7-8a2f-6485d73b708a confirmed delivery.

That closes the loop on the original friction point: admin approves user, user reports still blocked, admin has no tool to resolve this without out-of-band communication. Now the tool exists. It is an email.

---

## The User Matrix

For anyone building a similar system — Cognito groups mapped to Jitsi JWT claims mapped to feature toggles — here is the matrix as validated today:

| Role | Groups | Jitsi moderator | Recording | Livestream | Screen-share | Admin nav | Create meeting |
|------|--------|-----------------|-----------|------------|--------------|-----------|----------------|
| Moderator | members, moderators | true | yes | yes | yes | visible | allowed |
| Member | members | false | no | no | yes | hidden | denied |
| Pending | (none) | n/a | n/a | n/a | n/a | hidden | denied |

The JWT is the single source of truth. The client reads `cognito:groups` from the ID token. The navigation component reads `isModerator` from auth context. The Jitsi room token carries the feature flags. Three layers, one permission model, zero ambiguity.
