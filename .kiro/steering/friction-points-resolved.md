# friction points resolved — cloud-del-norte-website

source registry: docs/behavioral-logic-map/friction-points.md

## registry

| fp | sev | status | lesson |
| -- | --- | ------ | ------ |
| FP-001 | S1 | resolved | MFA help text + app store links + support contact on MFA_SETUP screen (9b018a39) |
| FP-002 | S1 | resolved | MFA abandonment escape path — cancel/back does not lock account (e110d311) |
| FP-003 | S2 | resolved | pending-approval banner with admin-will-review context + ETA (185c785b) |
| FP-004 | S3 | resolved | password policy shown before first attempt, not only on failure (e110d311) |
| FP-005 | S3 | accepted | sessionStorage cleared on tab close — every new tab = full login. acceptable trade-off. |
| FP-006 | S3 | accepted | MFA every session — no remember-device. security trade-off for casual users. |
| FP-007 | S3 | resolved | signup wizard state persisted — tab close does not lose progress (96d38531) |
| FP-008 | S4 | resolved | passkey button text translated via i18n t() function (e110d311) |
| FP-009 | S2 | resolved | jitsi cold-start messaging — room is starting up (447ccc12) |
| FP-010 | S2 | resolved | pending-user join attempt — explains why 403 + what to do (96d38531) |
| FP-011 | S2 | resolved | session-expired modal with re-login button + returnTo preserved (07ea8af9) |
| FP-012 | S3 | resolved | camera/mic denial — test coverage added (aec2cfba, impl 13a694a1) |
| FP-013 | S2 | resolved | jitsi unreachable error state with retry button (447ccc12) |
| FP-014 | S2 | resolved | phantom navigation — admin nav hidden for non-moderators (96d38531, confirmed ab10ba7b) |
| FP-015 | S2 | resolved | silent auth failure → session-expired modal with re-login flow (07ea8af9) |
| FP-016 | S2 | resolved | nav filtering for pending users — hide inaccessible items (96d38531) |
| FP-017 | S2 | resolved | stale token groups — CSP drift was root cause, client logic correct (4f2f268b + dfe2ed9d), cloudfront CSP fixed |
| FP-018 | S3 | resolved | admin denial copy fixed — moderator access not member approval (9b018a39) |
| FP-019 | S3 | resolved | admin-approve lambda sends SES welcome email on group-add (a6970d2 in cloud-del-norte-meet) |
| FP-020 | — | — | not referenced in source material — placeholder reserved |
| FP-021 | S2 | resolved | awsug meetings join-call actually joins jitsi — in-modal embed + CSP fix (58a85d08 + 0cf54d7a) |

## severity key

| sev | meaning |
| --- | ------- |
| S1 | critical — user locked out or data loss |
| S2 | high — feature broken or misleading UX |
| S3 | medium — degraded experience, workaround exists |
| S4 | low — cosmetic or minor inconvenience |

## status key

| status | meaning |
| ------ | ------- |
| resolved | fix shipped and verified |
| accepted | intentional trade-off — do not fix without Bryan's explicit direction |

## notable patterns

FP-017 is the canonical example of CSP drift causing false failures. three client-side fix attempts all had correct logic — the real root cause was cloudfront response-headers-policy missing a cognito domain in connect-src. lesson: when client code looks correct but behavior is wrong, check CSP and cloudfront headers before iterating on the client.

FP-021 is the canonical example of test-harness false-positive. nova act reported PASS while both users were misrouted to the meetings list, never entering jitsi. lesson: assert on the actual target state (iframe src contains meet.clouddelnorte.org), not just navigation success.

FP-005 and FP-006 are accepted trade-offs. agents encountering these symptoms should NOT attempt fixes. they are intentional security posture decisions.

## why this list exists

agents triaging UX symptoms that look like auth failures, navigation bugs, or form submission errors should grep this file first. most common patterns have already been diagnosed and fixed. if the symptom matches a resolved FP, check whether the fix regressed rather than re-discovering the root cause from scratch. accepted items are intentional trade-offs, not bugs — do not attempt to fix them without Bryan's explicit direction.

## the rule in one sentence

check this registry before investigating any auth, navigation, or form UX issue — the fix or the intentional acceptance is likely already documented here.
