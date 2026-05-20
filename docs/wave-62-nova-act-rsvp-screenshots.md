# Wave 62 — Nova Act RSVP Screenshots

Re-run of wave 54 Nova Act existing-user RSVP flow with two fixes applied:
1. Credential bootstrap via `aws configure export-credentials` (bypasses expired SSO tokens)
2. DOM-presence waits (`page.url` check + `act_get` QR poll) before each screenshot

## Screenshot Paths

| # | Checkpoint | Path |
|---|-----------|------|
| 1 | Anon feed view | `/tmp/wave-62-existing/01-feed-anon.png` |
| 2 | Auth page after RSVP CTA click | `/tmp/wave-62-existing/02-rsvp-cta-clicked.png` |
| 3 | Login form filled, pre-submit | `/tmp/wave-62-existing/03-login-pre-submit.png` |
| 4 | /rsvp/ page loading (pre-useEffect) | `/tmp/wave-62-existing/04-rsvp-page-loading.png` |
| 5 | RSVP confirmation (QR expected) | `/tmp/wave-62-existing/05-rsvp-confirmed-with-qr.png` |

All 5 screenshots captured successfully.

## Backend State Delta

| Checkpoint | Capacity | Taken | Remaining |
|-----------|----------|-------|-----------|
| Before | 50 | 0 | 50 |
| After (post-login) | 50 | 0 | 50 |
| Final (post-cleanup) | 50 | 0 | 50 |

Net delta: **0** — the auto-RSVP useEffect did not fire, so no record was created and cleanup was a no-op delete.

## QR Render Status

**QR did NOT render.** The page landed on `awsug.clouddelnorte.org/rsvp/?event=happy-hour-2026-06-03` and the user was authenticated (`good evening, heraldstack ☁` visible in page text), but the RSVP useEffect did not execute the backend POST. The page rendered the main app shell (sidebar, meetings list, radio widget) rather than the ticket/QR confirmation component.

Ticket payload extracted: main app shell text (meetings, radio, profile info). No QR data.

**Root cause hypothesis:** The RSVP page component's useEffect may require a Cognito `id_token` in localStorage/cookies that the Bedrock AgentCore browser session doesn't persist from the auth redirect. The auth flow completes (URL lands on /rsvp/ with the user logged in) but the SPA's client-side auth state may not be fully hydrated for the API call.

## Cleanup Confirmation

DDB `delete_item` on `cdn-rsvps` for `user_sub=e8716360-c081-708a-1211-3234508e71d2` / `event_id=happy-hour-2026-06-03` — succeeded (idempotent, no record existed).

## Lessons Learned: DOM-Presence Wait Pattern

For future Nova Act scripts:

1. **Don't ask Nova Act about the URL.** Use `nova.page.url` directly. Nova Act's `act_get` cannot reliably read the browser URL bar and will answer "no" even when the URL matches.

2. **Use `page.url` polling for navigation waits:**
   ```python
   deadline = time.time() + 10
   while time.time() < deadline:
       if "expected-path" in nova.page.url:
           break
       time.sleep(1)
   ```

3. **Use `act_get` for visual element presence** (QR codes, modals, text). Poll with a timeout:
   ```python
   def wait_for_condition(nova, question, expected="yes", timeout=10.0):
       deadline = time.time() + timeout
       while time.time() < deadline:
           resp = nova.act_get(question)
           if expected in resp.response.lower():
               return True
           time.sleep(1)
       return False
   ```

4. **Always screenshot after wait, even on timeout.** Mark as `qr-not-rendered` in the report — the screenshot still has diagnostic value.

5. **Credential bootstrap:** boto3 SSO token refresh fails in non-interactive environments. Use `aws configure export-credentials --format process` to extract cached role credentials from the CLI's `session.db` cache, then inject into boto3 sessions directly.

6. **Be explicit about which CTA to click.** Nova Act will click Meetup links if the instruction is ambiguous. Include "Do NOT click Meetup" in the prompt.
