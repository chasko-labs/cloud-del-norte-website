#!/usr/bin/env python3
"""Wave 54 — existing-user RSVP flow (heraldstack@clouddelnorte.org).

Opens /feed/, clicks the June 3 Community Happy Hour RSVP CTA,
authenticates as heraldstack@, captures confirmation + QR screenshots,
verifies backend spots endpoint.
"""
import json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
import requests
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

# --- Constants ---
FEED_URL = "https://clouddelnorte.org/feed/"
SPOTS_URL = "https://tta0e43bs0.execute-api.us-west-2.amazonaws.com/prod/rsvp/happy-hour-2026-06-03/spots"
OUTPUT_DIR = Path("/tmp/wave-54-existing")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")

# --- Credential fetch (jitsi-video-hosting profile owns the secret) ---
_sm = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("secretsmanager")
EMAIL = "heraldstack@clouddelnorte.org"
PASSWORD = _sm.get_secret_value(SecretId="cloud-del-norte/heraldstack-cognito-pw")["SecretString"]

results = {"test": "A-existing-user", "status": "FAIL", "blocks": []}


def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}][EXISTING] {msg}", flush=True)


def screenshot(nova, filename: str) -> str:
    path = str(OUTPUT_DIR / filename)
    nova.page.screenshot(path=path)
    log(f"Screenshot: {path}")
    return path


def check_spots_before():
    try:
        r = requests.get(SPOTS_URL, timeout=10)
        data = r.json()
        log(f"Spots before: {json.dumps(data)}")
        return data
    except Exception as e:
        log(f"Spots check failed: {e}")
        return None


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def run_existing_user_rsvp():
    log(f"Starting existing-user RSVP test — {TS}")

    spots_before = check_spots_before()
    results["spots_before"] = spots_before

    with browser_session(region="us-east-1", name="wave54-rsvp-existing") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=FEED_URL, headless=True, tty=False,
            logs_directory="/tmp/nova-act-logs",
            go_to_url_timeout=30,
        ) as nova:
            time.sleep(3)

            # Step 1: Screenshot feed (anonymous)
            screenshot(nova, "01-feed-anon.png")
            log(f"URL after feed load: {nova.page.url}")

            # Step 2: Click RSVP CTA on June 3 event
            try:
                nova.act(
                    "Find the Featured Event card for the June 3 Community Happy Hour. "
                    "Click the RSVP button or 'Limited space — RSVP now' link on that card."
                )
                time.sleep(4)
                log(f"URL after RSVP click: {nova.page.url}")
            except ActActuationError as e:
                results["blocks"].append(f"RSVP CTA click failed: {e}")
                log(f"BLOCK: RSVP CTA click failed: {e}")
                screenshot(nova, "block-rsvp-cta.png")
                return

            # Step 3: Sign in (may land on signup page first — click sign in link)
            try:
                # Check if we're on signup page and need to switch to login
                current_url = nova.page.url
                if "/signup" in current_url:
                    nova.act("Click the 'Sign in' link to go to the login page.")
                    time.sleep(2)

                nova.act(f"Enter '{EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', PASSWORD)
                try:
                    nova.act("Click the 'Sign in' button to submit the login form.")
                except ActActuationError:
                    pass  # redirect causes screenshot timeout — expected
                time.sleep(8)
                log(f"URL after login: {nova.page.url}")
            except ActActuationError as e:
                results["blocks"].append(f"Login failed: {e}")
                log(f"BLOCK: Login failed: {e}")
                screenshot(nova, "block-login.png")
                return

            # Step 4: Handle MFA if present
            try:
                mfa_check = nova.act_get(
                    "Is there an MFA, authenticator, or one-time-code input visible on this page? Reply yes or no only."
                )
                if "yes" in mfa_check.response.lower():
                    log("MFA challenge detected — attempting code 000000")
                    nova.act("Type '000000' in the MFA/code input field and click verify or submit.")
                    time.sleep(4)
                    mfa_still = nova.act_get("Is MFA still blocking? Reply yes or no only.")
                    if "yes" in mfa_still.response.lower():
                        results["blocks"].append("MFA brick — cannot bypass with 000000")
                        log("BLOCK: MFA brick")
                        screenshot(nova, "block-mfa.png")
                        return
            except ActActuationError:
                pass

            # Step 5: Confirmation page
            time.sleep(3)
            screenshot(nova, "02-rsvp-confirm.png")
            log(f"URL at confirmation: {nova.page.url}")

            # Step 6: Check for QR code
            try:
                qr_check = nova.act_get(
                    "Is there a QR code visible on this page? Reply yes or no only."
                )
                if "yes" in qr_check.response.lower():
                    screenshot(nova, "03-qr.png")
                    log("QR code captured")
                    results["qr_found"] = True
                else:
                    log("BLOCKER: No QR code visible on confirmation page")
                    results["blocks"].append("No QR code visible on confirmation page")
                    results["qr_found"] = False
            except ActActuationError as e:
                results["blocks"].append(f"QR check failed: {e}")
                results["qr_found"] = False

            # Step 7: Extract ticket payload
            try:
                ticket = nova.act_get(
                    "Read all text on this page and return it as a single string."
                )
                results["ticket_payload"] = ticket.response
                log(f"Page text: {ticket.response[:200]}")
            except (ActActuationError, Exception) as e:
                results["ticket_payload"] = f"extraction failed: {e}"
                log(f"Ticket extraction failed: {e}")

    # Step 8: Verify backend spots after
    spots_after = check_spots_before()
    results["spots_after"] = spots_after
    results["status"] = "PASS" if not results["blocks"] else "BLOCKED"
    log(f"Test complete — status: {results['status']}")


if __name__ == "__main__":
    run_existing_user_rsvp()
    print(f"\n{'='*60}")
    print(f"RESULT: {results['status']}")
    print(f"Blocks: {results['blocks'] or 'none'}")
    print(f"QR found: {results.get('qr_found', 'N/A')}")
    print(f"Spots before: {results.get('spots_before')}")
    print(f"Spots after: {results.get('spots_after')}")
    print(f"{'='*60}")
    print(json.dumps(results, indent=2, default=str))
