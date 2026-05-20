# Wave 64 — RSVP Final Verification (Nova Act)

**Date:** 2026-05-20T22:30Z  
**Script:** `scripts/nova-act/wave-54-rsvp-existing-user.py` (unmodified)  
**Branch:** `chore/wave-64-nova-act-final-verification`  
**Status:** ❌ FAIL — QR did not render

## Result Summary

| Check | Result |
|-------|--------|
| QR rendered in screenshot 05? | **No** |
| Backend spots taken (during test) | 0 → 0 → 0 (never incremented) |
| Ticket payload extracted? | No — RSVP component never mounted |
| Cleanup confirmed? | Yes (DDB delete_item succeeded, no-op since no record existed) |

## Diagnosis

The `return_to` preservation fix from wave 63 **partially worked**:

1. ✅ Auth redirect URL correctly included `return_to=%2Frsvp%2F%3Fevent%3Dhappy-hour-2026-06-03`
2. ✅ Post-login URL resolved to `https://awsug.clouddelnorte.org/rsvp/?event=happy-hour-2026-06-03`
3. ❌ **SPA router did not mount the RSVP component** — the dashboard/speakeasy view rendered instead

### Evidence from Screenshots

- **Screenshot 04** (`04-rsvp-page-loading.png`): Shows the authenticated dashboard — "good evening, heraldstack", nav links (meetings, admin, resources, learning), "next meetup" card, "your profile" card. No RSVP content visible.
- **Screenshot 05** (`05-rsvp-confirmed-with-qr.png`): Same dashboard scrolled down — "your profile" section with `heraldstack@clouddelnorte.org [members] [moderators]`. No QR. No RSVP confirmation.

### Root Cause

The URL is `/rsvp/?event=happy-hour-2026-06-03` but the client-side router renders the default authenticated route (speakeasy dashboard). The `/rsvp/` route is either:
- Not registered in the SPA router
- Being overridden by a catch-all/default route
- Requires a different base path on the `awsug.` subdomain
- The router reads `pathname` before the full URL is settled post-redirect

### Nova Act Page Text (from act_get)

Nova Act only saw: `heraldstack@clouddelnorte.org` and `16:33:22 next meetup in 6d 15h 56m` — confirming the dashboard rendered, not the RSVP page.

## Backend State

```
Spots before:  {"eventId": "happy-hour-2026-06-03", "capacity": 50, "taken": 0, "remaining": 50}
Spots after:   {"eventId": "happy-hour-2026-06-03", "capacity": 50, "taken": 0, "remaining": 50}
Spots final:   {"eventId": "happy-hour-2026-06-03", "capacity": 50, "taken": 0, "remaining": 50}
```

No RSVP was created — the useEffect never fired because the component never mounted.

## Screenshots

| # | Path | Content |
|---|------|---------|
| 01 | `/tmp/wave-62-existing/01-feed-anon.png` | Anon feed page |
| 02 | `/tmp/wave-62-existing/02-rsvp-cta-clicked.png` | Auth signup page with return_to |
| 03 | `/tmp/wave-62-existing/03-login-pre-submit.png` | Login form filled |
| 04 | `/tmp/wave-62-existing/04-rsvp-page-loading.png` | Dashboard (NOT /rsvp/) |
| 05 | `/tmp/wave-62-existing/05-rsvp-confirmed-with-qr.png` | Dashboard scrolled (no QR) |
| extra | `/tmp/wave-64-extra/error-state.png` | Same as 05 — dashboard, no RSVP |

## Document URL

```
https://awsug.clouddelnorte.org/rsvp/?event=happy-hour-2026-06-03
```

URL is correct. Router is not honoring it.

## Next Steps

The fix must be in the **awsug SPA router** — the `/rsvp/` route needs to be registered and take priority over the default dashboard route when the path matches. Investigate:
1. The router config on `awsug.clouddelnorte.org`
2. Whether `/rsvp/` is a defined route or if it only exists on the main `clouddelnorte.org` domain
3. Whether the post-auth redirect should target a different subdomain/path
